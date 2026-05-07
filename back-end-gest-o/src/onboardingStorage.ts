import { getDb } from './db/sqlite.js'
import { hasPostgresConfig, queryPostgres } from './db/postgres.js'

export type TenantOnboardingRecord = {
  tenantId: string
  status: 'pending' | 'in_progress' | 'completed'
  companyProfile: Record<string, unknown>
  dataSetup: Record<string, unknown>
  teamInvites: string[]
  importStatus: 'idle' | 'running' | 'completed' | 'failed'
  importProgress: number
  updatedAt: string
}

const db = getDb()

function usePostgresStorage(): boolean {
  return process.env.IGA_STORAGE_DRIVER === 'postgres' && hasPostgresConfig()
}

function parseObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>
  if (typeof value !== 'string') return {}
  try {
    const parsed = JSON.parse(value) as unknown
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {}
  } catch {
    return {}
  }
}

function parseStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string')
  if (typeof value !== 'string') return []
  try {
    const parsed = JSON.parse(value) as unknown
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : []
  } catch {
    return []
  }
}

function mapRow(row: Record<string, unknown>): TenantOnboardingRecord {
  return {
    tenantId: String(row.tenant_id),
    status: row.status === 'completed' ? 'completed' : row.status === 'in_progress' ? 'in_progress' : 'pending',
    companyProfile: parseObject(row.company_profile_json),
    dataSetup: parseObject(row.data_setup_json),
    teamInvites: parseStringArray(row.team_invites_json),
    importStatus: row.import_status === 'running' || row.import_status === 'completed' || row.import_status === 'failed'
      ? row.import_status
      : 'idle',
    importProgress: Math.max(0, Math.min(100, Number(row.import_progress ?? 0))),
    updatedAt: String(row.updated_at),
  }
}

export async function getTenantOnboarding(tenantId: string): Promise<TenantOnboardingRecord> {
  if (usePostgresStorage()) {
    const result = await queryPostgres('SELECT * FROM tenant_onboarding WHERE tenant_id = $1 LIMIT 1', [tenantId])
    if (result.rows[0]) return mapRow(result.rows[0] as Record<string, unknown>)
  } else {
    const row = db.prepare('SELECT * FROM tenant_onboarding WHERE tenant_id = ? LIMIT 1').get(tenantId) as Record<string, unknown> | undefined
    if (row) return mapRow(row)
  }
  return {
    tenantId,
    status: 'pending',
    companyProfile: {},
    dataSetup: {},
    teamInvites: [],
    importStatus: 'idle',
    importProgress: 0,
    updatedAt: new Date().toISOString(),
  }
}

export async function upsertTenantOnboarding(input: Omit<TenantOnboardingRecord, 'updatedAt'>): Promise<TenantOnboardingRecord> {
  const updatedAt = new Date().toISOString()
  if (usePostgresStorage()) {
    const result = await queryPostgres(
      `
      INSERT INTO tenant_onboarding (
        tenant_id, status, company_profile_json, data_setup_json, team_invites_json, import_status, import_progress, updated_at
      ) VALUES ($1, $2, $3::jsonb, $4::jsonb, $5::jsonb, $6, $7, $8)
      ON CONFLICT (tenant_id) DO UPDATE SET
        status = EXCLUDED.status,
        company_profile_json = EXCLUDED.company_profile_json,
        data_setup_json = EXCLUDED.data_setup_json,
        team_invites_json = EXCLUDED.team_invites_json,
        import_status = EXCLUDED.import_status,
        import_progress = EXCLUDED.import_progress,
        updated_at = EXCLUDED.updated_at
      RETURNING *
      `,
      [
        input.tenantId,
        input.status,
        JSON.stringify(input.companyProfile),
        JSON.stringify(input.dataSetup),
        JSON.stringify(input.teamInvites),
        input.importStatus,
        input.importProgress,
        updatedAt,
      ],
    )
    return mapRow(result.rows[0] as Record<string, unknown>)
  }

  db.prepare(`
    INSERT INTO tenant_onboarding (
      tenant_id, status, company_profile_json, data_setup_json, team_invites_json, import_status, import_progress, updated_at
    ) VALUES (
      @tenant_id, @status, @company_profile_json, @data_setup_json, @team_invites_json, @import_status, @import_progress, @updated_at
    )
    ON CONFLICT(tenant_id) DO UPDATE SET
      status = excluded.status,
      company_profile_json = excluded.company_profile_json,
      data_setup_json = excluded.data_setup_json,
      team_invites_json = excluded.team_invites_json,
      import_status = excluded.import_status,
      import_progress = excluded.import_progress,
      updated_at = excluded.updated_at
  `).run({
    tenant_id: input.tenantId,
    status: input.status,
    company_profile_json: JSON.stringify(input.companyProfile),
    data_setup_json: JSON.stringify(input.dataSetup),
    team_invites_json: JSON.stringify(input.teamInvites),
    import_status: input.importStatus,
    import_progress: input.importProgress,
    updated_at: updatedAt,
  })
  return getTenantOnboarding(input.tenantId)
}

