import { describe, expect, it } from 'vitest'
import type { PoolClient } from 'pg'
import { closePostgresPool, getPostgresPool, runPostgresMigrations } from './postgres.js'

const hasDatabaseUrl = Boolean(process.env.DATABASE_URL?.trim())
const describeIfPostgres = hasDatabaseUrl ? describe : describe.skip

describeIfPostgres('PostgreSQL RLS tenant isolation', () => {
  it('isola datasources entre tenants A e B via app.current_tenant_id', async () => {
    await runPostgresMigrations()
    const pool = getPostgresPool()
    const suffix = Date.now().toString(36)
    const tenantA = `rls-a-${suffix}`
    const tenantB = `rls-b-${suffix}`
    const dsA = `ds_${tenantA}`
    const dsB = `ds_${tenantB}`
    const now = new Date().toISOString()

    await pool.query(
      `
      INSERT INTO tenants (id, slug, name, subtitle, enabled_modules, status, created_at, updated_at)
      VALUES
        ($1, $1, 'Tenant A', 'RLS', '["dashboard"]'::jsonb, 'active', $3, $3),
        ($2, $2, 'Tenant B', 'RLS', '["dashboard"]'::jsonb, 'active', $3, $3)
      ON CONFLICT (id) DO NOTHING
      `,
      [tenantA, tenantB, now],
    )

    async function withTenant<T>(tenantId: string, fn: (client: PoolClient) => Promise<T>): Promise<T> {
      const client = await pool.connect()
      try {
        await client.query('BEGIN')
        await client.query('SET LOCAL ROLE iga_app')
        await client.query("SELECT set_config('app.current_tenant_id', $1, true)", [tenantId])
        const result = await fn(client)
        await client.query('COMMIT')
        return result
      } catch (err) {
        await client.query('ROLLBACK')
        throw err
      } finally {
        client.release()
      }
    }

    try {
      await withTenant(tenantA, (client) =>
        client.query(
          `
          INSERT INTO datasources (
            id, tenant_id, name, type, api_url, auth_method, status,
            field_mappings_json, erp_endpoints_json, created_at, updated_at
          ) VALUES ($1, $2, 'A', 'rest', 'https://example.com/a', 'none', 'active', '[]'::jsonb, '[]'::jsonb, $3, $3)
          `,
          [dsA, tenantA, now],
        ),
      )
      await withTenant(tenantB, (client) =>
        client.query(
          `
          INSERT INTO datasources (
            id, tenant_id, name, type, api_url, auth_method, status,
            field_mappings_json, erp_endpoints_json, created_at, updated_at
          ) VALUES ($1, $2, 'B', 'rest', 'https://example.com/b', 'none', 'active', '[]'::jsonb, '[]'::jsonb, $3, $3)
          `,
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
      await withTenant(tenantA, (client) => client.query('DELETE FROM datasources WHERE id = $1', [dsA]))
      await withTenant(tenantB, (client) => client.query('DELETE FROM datasources WHERE id = $1', [dsB]))
      await pool.query('DELETE FROM tenants WHERE id IN ($1, $2)', [tenantA, tenantB])
      await closePostgresPool()
    }
  })
})
