import { randomBytes } from 'node:crypto'
import { getDb } from './db/sqlite.js'
import { hasPostgresConfig, queryPostgres } from './db/postgres.js'
import { type BusinessSegment, inferSegmentFromConnectorId, isBusinessSegment } from './segments.js'

export type TenantRecord = {
  id: string
  slug: string
  name: string
  subtitle: string
  logoUrl: string | null
  primaryColor: string | null
  enabledModules: string[]
  connectorId: string
  /** Segmento de negócio escolhido no signup. Vazio em tenants legados é inferido do connector. */
  segment: BusinessSegment
  plan: 'trial' | 'starter' | 'pro' | 'enterprise'
  trialEndsAt: string | null
  status: 'active' | 'inactive'
  createdAt: string
  updatedAt: string
}

const db = getDb()

function usePostgresStorage(): boolean {
  return process.env.IGA_STORAGE_DRIVER === 'postgres' && hasPostgresConfig()
}

function parseModules(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string')
  if (typeof value !== 'string') return []
  try {
    const parsed = JSON.parse(value) as unknown
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : []
  } catch {
    return []
  }
}

function mapTenant(row: Record<string, unknown>): TenantRecord {
  const connectorId = String(row.connector_id ?? 'iga-custom-api')
  const rawSegment = row.segment
  const segment: BusinessSegment = isBusinessSegment(rawSegment)
    ? rawSegment
    : inferSegmentFromConnectorId(connectorId)
  return {
    id: String(row.id),
    slug: String(row.slug),
    name: String(row.name),
    subtitle: String(row.subtitle ?? 'Automacao & Tecnologia'),
    logoUrl: row.logo_url ? String(row.logo_url) : null,
    primaryColor: row.primary_color ? String(row.primary_color) : null,
    enabledModules: parseModules(row.enabled_modules ?? row.enabled_modules_json),
    connectorId,
    segment,
    plan: row.plan === 'starter' || row.plan === 'pro' || row.plan === 'enterprise' ? row.plan : 'trial',
    trialEndsAt: row.trial_ends_at ? String(row.trial_ends_at) : null,
    status: row.status === 'inactive' ? 'inactive' : 'active',
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }
}

export function genTenantId(slug: string): string {
  const normalized = slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
  return normalized || `tenant-${randomBytes(4).toString('hex')}`
}

export async function listTenants(): Promise<TenantRecord[]> {
  if (usePostgresStorage()) {
    const result = await queryPostgres('SELECT * FROM tenants ORDER BY created_at ASC')
    return result.rows.map((row) => mapTenant(row as Record<string, unknown>))
  }
  const rows = db.prepare('SELECT * FROM tenants ORDER BY created_at ASC').all() as Record<string, unknown>[]
  return rows.map(mapTenant)
}

export async function findTenantBySlug(slug: string): Promise<TenantRecord | null> {
  const normalized = slug.trim().toLowerCase()
  if (!normalized) return null
  if (usePostgresStorage()) {
    const result = await queryPostgres('SELECT * FROM tenants WHERE slug = $1 LIMIT 1', [normalized])
    return result.rows[0] ? mapTenant(result.rows[0] as Record<string, unknown>) : null
  }
  const row = db.prepare('SELECT * FROM tenants WHERE slug = ? LIMIT 1').get(normalized) as Record<string, unknown> | undefined
  return row ? mapTenant(row) : null
}

export async function findTenantById(id: string): Promise<TenantRecord | null> {
  const trimmed = id.trim()
  if (!trimmed) return null
  if (usePostgresStorage()) {
    const result = await queryPostgres('SELECT * FROM tenants WHERE id = $1 LIMIT 1', [trimmed])
    return result.rows[0] ? mapTenant(result.rows[0] as Record<string, unknown>) : null
  }
  const row = db.prepare('SELECT * FROM tenants WHERE id = ? LIMIT 1').get(trimmed) as Record<string, unknown> | undefined
  return row ? mapTenant(row) : null
}

export async function findTenantByIdOrSlug(value: string): Promise<TenantRecord | null> {
  return (await findTenantById(value)) ?? findTenantBySlug(value)
}

export async function upsertTenant(input: Omit<TenantRecord, 'createdAt' | 'updatedAt'>): Promise<TenantRecord> {
  const now = new Date().toISOString()
  const record: TenantRecord = { ...input, createdAt: now, updatedAt: now }
  if (usePostgresStorage()) {
    const result = await queryPostgres(
      `
      INSERT INTO tenants (
        id, slug, name, subtitle, logo_url, primary_color, enabled_modules, connector_id, segment, plan, trial_ends_at, status, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10, $11, $12, $13, $14)
      ON CONFLICT (id) DO UPDATE SET
        slug = EXCLUDED.slug,
        name = EXCLUDED.name,
        subtitle = EXCLUDED.subtitle,
        logo_url = EXCLUDED.logo_url,
        primary_color = EXCLUDED.primary_color,
        enabled_modules = EXCLUDED.enabled_modules,
        connector_id = EXCLUDED.connector_id,
        segment = EXCLUDED.segment,
        plan = EXCLUDED.plan,
        trial_ends_at = EXCLUDED.trial_ends_at,
        status = EXCLUDED.status,
        updated_at = EXCLUDED.updated_at
      RETURNING *
      `,
      [
        record.id,
        record.slug,
        record.name,
        record.subtitle,
        record.logoUrl,
        record.primaryColor,
        JSON.stringify(record.enabledModules),
        record.connectorId,
        record.segment,
        record.plan,
        record.trialEndsAt,
        record.status,
        record.createdAt,
        record.updatedAt,
      ],
    )
    return mapTenant(result.rows[0] as Record<string, unknown>)
  }

  db.prepare(`
    INSERT INTO tenants (
      id, slug, name, subtitle, logo_url, primary_color, enabled_modules_json, connector_id, segment, plan, trial_ends_at, status, created_at, updated_at
    ) VALUES (
      @id, @slug, @name, @subtitle, @logo_url, @primary_color, @enabled_modules_json, @connector_id, @segment, @plan, @trial_ends_at, @status, @created_at, @updated_at
    )
    ON CONFLICT(id) DO UPDATE SET
      slug = excluded.slug,
      name = excluded.name,
      subtitle = excluded.subtitle,
      logo_url = excluded.logo_url,
      primary_color = excluded.primary_color,
      enabled_modules_json = excluded.enabled_modules_json,
      connector_id = excluded.connector_id,
      segment = excluded.segment,
      plan = excluded.plan,
      trial_ends_at = excluded.trial_ends_at,
      status = excluded.status,
      updated_at = excluded.updated_at
  `).run({
    id: record.id,
    slug: record.slug,
    name: record.name,
    subtitle: record.subtitle,
    logo_url: record.logoUrl,
    primary_color: record.primaryColor,
    enabled_modules_json: JSON.stringify(record.enabledModules),
    connector_id: record.connectorId,
    segment: record.segment,
    plan: record.plan,
    trial_ends_at: record.trialEndsAt,
    status: record.status,
    created_at: record.createdAt,
    updated_at: record.updatedAt,
  })
  return (await findTenantBySlug(record.slug)) ?? record
}

export async function deleteTenant(id: string): Promise<boolean> {
  if (id === 'default') return false
  if (usePostgresStorage()) {
    const result = await queryPostgres('DELETE FROM tenants WHERE id = $1', [id])
    return Boolean(result.rowCount && result.rowCount > 0)
  }
  const result = db.prepare('DELETE FROM tenants WHERE id = ?').run(id)
  return result.changes > 0
}
