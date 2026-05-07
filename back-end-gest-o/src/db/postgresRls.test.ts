import { afterAll, describe, expect, it } from 'vitest'
import type { PoolClient } from 'pg'
import { closePostgresPool, getPostgresPool, runPostgresMigrations } from './postgres.js'

const hasDatabaseUrl = Boolean(process.env.DATABASE_URL?.trim())
const describeIfPostgres = hasDatabaseUrl ? describe : describe.skip

describeIfPostgres('PostgreSQL RLS tenant isolation', () => {
  /** Helper compartilhado: roda fn dentro de uma transacao no role iga_app + tenant context. */
  async function withTenant<T>(tenantId: string, fn: (client: PoolClient) => Promise<T>): Promise<T> {
    const pool = getPostgresPool()
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await client.query('SET LOCAL ROLE iga_app')
      await client.query("SELECT set_config('app.current_tenant_id', $1, true)", [tenantId])
      const result = await fn(client)
      await client.query('COMMIT')
      return result
    } catch (err) {
      await client.query('ROLLBACK').catch(() => undefined)
      throw err
    } finally {
      client.release()
    }
  }

  async function ensureTenants(ids: string[]): Promise<void> {
    const pool = getPostgresPool()
    const now = new Date().toISOString()
    for (const id of ids) {
      await pool.query(
        `INSERT INTO tenants (id, slug, name, subtitle, enabled_modules, status, created_at, updated_at)
         VALUES ($1, $1, $2, 'RLS', '["dashboard"]'::jsonb, 'active', $3, $3)
         ON CONFLICT (id) DO NOTHING`,
        [id, `Tenant ${id}`, now],
      )
    }
  }

  async function cleanupTenants(ids: string[]): Promise<void> {
    const pool = getPostgresPool()
    /** Limpa rows orfas em todas as tabelas multi-tenant antes de remover tenants. */
    for (const table of ['datasources', 'users', 'alerts', 'copilot_messages', 'scheduled_reports', 'audit_log']) {
      await pool
        .query(`DELETE FROM ${table} WHERE tenant_id = ANY($1)`, [ids])
        .catch(() => undefined)
    }
    await pool.query('DELETE FROM tenants WHERE id = ANY($1)', [ids]).catch(() => undefined)
  }

  afterAll(async () => {
    await closePostgresPool()
  })

  it('isola datasources entre tenants A e B via app.current_tenant_id', async () => {
    await runPostgresMigrations()
    const suffix = Date.now().toString(36)
    const tenantA = `rls-a-${suffix}`
    const tenantB = `rls-b-${suffix}`
    const dsA = `ds_${tenantA}`
    const dsB = `ds_${tenantB}`
    const now = new Date().toISOString()
    await ensureTenants([tenantA, tenantB])

    try {
      await withTenant(tenantA, (client) =>
        client.query(
          `INSERT INTO datasources (id, tenant_id, name, type, api_url, auth_method, status,
             field_mappings_json, erp_endpoints_json, created_at, updated_at)
           VALUES ($1, $2, 'A', 'rest', 'https://example.com/a', 'none', 'active', '[]'::jsonb, '[]'::jsonb, $3, $3)`,
          [dsA, tenantA, now],
        ),
      )
      await withTenant(tenantB, (client) =>
        client.query(
          `INSERT INTO datasources (id, tenant_id, name, type, api_url, auth_method, status,
             field_mappings_json, erp_endpoints_json, created_at, updated_at)
           VALUES ($1, $2, 'B', 'rest', 'https://example.com/b', 'none', 'active', '[]'::jsonb, '[]'::jsonb, $3, $3)`,
          [dsB, tenantB, now],
        ),
      )

      const visibleToA = await withTenant(tenantA, (client) =>
        client.query<{ id: string }>('SELECT id FROM datasources WHERE id IN ($1, $2) ORDER BY id', [dsA, dsB]),
      )
      const visibleToB = await withTenant(tenantB, (client) =>
        client.query<{ id: string }>('SELECT id FROM datasources WHERE id IN ($1, $2) ORDER BY id', [dsA, dsB]),
      )
      const visibleWithoutTenant = await withTenant('', (client) =>
        client.query<{ id: string }>('SELECT id FROM datasources WHERE id IN ($1, $2) ORDER BY id', [dsA, dsB]),
      )

      expect(visibleToA.rows.map((row) => row.id)).toEqual([dsA])
      expect(visibleToB.rows.map((row) => row.id)).toEqual([dsB])
      expect(visibleWithoutTenant.rows).toEqual([])
    } finally {
      await cleanupTenants([tenantA, tenantB])
    }
  })

  it('WITH CHECK rejeita INSERT com tenant_id diferente do contexto', async () => {
    await runPostgresMigrations()
    const suffix = Date.now().toString(36)
    const tenantA = `rls-wc-a-${suffix}`
    const tenantB = `rls-wc-b-${suffix}`
    const dsCross = `ds_cross_${suffix}`
    const now = new Date().toISOString()
    await ensureTenants([tenantA, tenantB])

    try {
      /** Tenant A esta logado mas tenta inserir datasource marcado como tenantB. */
      await expect(
        withTenant(tenantA, (client) =>
          client.query(
            `INSERT INTO datasources (id, tenant_id, name, type, api_url, auth_method, status,
               field_mappings_json, erp_endpoints_json, created_at, updated_at)
             VALUES ($1, $2, 'cross', 'rest', 'https://example.com/x', 'none', 'active', '[]'::jsonb, '[]'::jsonb, $3, $3)`,
            [dsCross, tenantB, now],
          ),
        ),
      ).rejects.toThrow(/row-level security|violates row-level/i)
    } finally {
      await cleanupTenants([tenantA, tenantB])
    }
  })

  it('UPDATE cross-tenant nao afeta linhas de outro tenant', async () => {
    await runPostgresMigrations()
    const suffix = Date.now().toString(36)
    const tenantA = `rls-up-a-${suffix}`
    const tenantB = `rls-up-b-${suffix}`
    const dsB = `ds_b_${suffix}`
    const now = new Date().toISOString()
    await ensureTenants([tenantA, tenantB])

    try {
      await withTenant(tenantB, (client) =>
        client.query(
          `INSERT INTO datasources (id, tenant_id, name, type, api_url, auth_method, status,
             field_mappings_json, erp_endpoints_json, created_at, updated_at)
           VALUES ($1, $2, 'B', 'rest', 'https://example.com/b', 'none', 'active', '[]'::jsonb, '[]'::jsonb, $3, $3)`,
          [dsB, tenantB, now],
        ),
      )

      /** Tenant A tenta atualizar row de B — RLS faz UPDATE nao afetar nenhuma row. */
      const updated = await withTenant(tenantA, (client) =>
        client.query<{ id: string }>(
          `UPDATE datasources SET name = 'hacked' WHERE id = $1 RETURNING id`,
          [dsB],
        ),
      )
      expect(updated.rowCount).toBe(0)

      /** Confirma do lado de B que o name original foi preservado. */
      const fromB = await withTenant(tenantB, (client) =>
        client.query<{ name: string }>('SELECT name FROM datasources WHERE id = $1', [dsB]),
      )
      expect(fromB.rows[0]?.name).toBe('B')
    } finally {
      await cleanupTenants([tenantA, tenantB])
    }
  })

  it('DELETE cross-tenant nao remove linhas de outro tenant', async () => {
    await runPostgresMigrations()
    const suffix = Date.now().toString(36)
    const tenantA = `rls-del-a-${suffix}`
    const tenantB = `rls-del-b-${suffix}`
    const dsB = `ds_b_${suffix}`
    const now = new Date().toISOString()
    await ensureTenants([tenantA, tenantB])

    try {
      await withTenant(tenantB, (client) =>
        client.query(
          `INSERT INTO datasources (id, tenant_id, name, type, api_url, auth_method, status,
             field_mappings_json, erp_endpoints_json, created_at, updated_at)
           VALUES ($1, $2, 'B', 'rest', 'https://example.com/b', 'none', 'active', '[]'::jsonb, '[]'::jsonb, $3, $3)`,
          [dsB, tenantB, now],
        ),
      )

      const deleted = await withTenant(tenantA, (client) =>
        client.query('DELETE FROM datasources WHERE id = $1 RETURNING id', [dsB]),
      )
      expect(deleted.rowCount).toBe(0)

      const stillThere = await withTenant(tenantB, (client) =>
        client.query('SELECT 1 FROM datasources WHERE id = $1', [dsB]),
      )
      expect(stillThere.rowCount).toBe(1)
    } finally {
      await cleanupTenants([tenantA, tenantB])
    }
  })

  it('alerts e users tambem respeitam isolamento de tenant', async () => {
    await runPostgresMigrations()
    const suffix = Date.now().toString(36)
    const tenantA = `rls-multi-a-${suffix}`
    const tenantB = `rls-multi-b-${suffix}`
    const alertA = `alert_a_${suffix}`
    const alertB = `alert_b_${suffix}`
    const userA = `usr_a_${suffix}`
    const userB = `usr_b_${suffix}`
    const now = new Date().toISOString()
    await ensureTenants([tenantA, tenantB])

    try {
      await withTenant(tenantA, async (client) => {
        await client.query(
          `INSERT INTO alerts (id, tenant_id, type, severity, title, message, created_at)
           VALUES ($1, $2, 'sys', 'info', 'a', 'msg', $3)`,
          [alertA, tenantA, now],
        )
        await client.query(
          `INSERT INTO users (id, tenant_id, name, email, role, status, password_hash, created_at, updated_at)
           VALUES ($1, $2, 'A', $3, 'admin', 'active', 'x', $4, $4)`,
          [userA, tenantA, `${userA}@example.com`, now],
        )
      })
      await withTenant(tenantB, async (client) => {
        await client.query(
          `INSERT INTO alerts (id, tenant_id, type, severity, title, message, created_at)
           VALUES ($1, $2, 'sys', 'info', 'b', 'msg', $3)`,
          [alertB, tenantB, now],
        )
        await client.query(
          `INSERT INTO users (id, tenant_id, name, email, role, status, password_hash, created_at, updated_at)
           VALUES ($1, $2, 'B', $3, 'admin', 'active', 'x', $4, $4)`,
          [userB, tenantB, `${userB}@example.com`, now],
        )
      })

      const alertsA = await withTenant(tenantA, (client) =>
        client.query<{ id: string }>('SELECT id FROM alerts WHERE id IN ($1, $2)', [alertA, alertB]),
      )
      const usersA = await withTenant(tenantA, (client) =>
        client.query<{ id: string }>('SELECT id FROM users WHERE id IN ($1, $2)', [userA, userB]),
      )
      expect(alertsA.rows.map((r) => r.id)).toEqual([alertA])
      expect(usersA.rows.map((r) => r.id)).toEqual([userA])
    } finally {
      await cleanupTenants([tenantA, tenantB])
    }
  })
})
