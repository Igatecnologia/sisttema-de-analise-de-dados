import { getDb } from '../db/sqlite.js'
import { getPostgresPool, hasPostgresConfig } from '../db/postgres.js'
import { readAllForTenantAsync } from '../storage.js'
import { findTenantBySlug, type TenantRecord } from '../tenantStorage.js'
import { readUsersForTenantAsync } from '../userStorage.js'

const db = getDb()

function usePostgresStorage(): boolean {
  return process.env.IGA_STORAGE_DRIVER === 'postgres' && hasPostgresConfig()
}

export type PlanLimitKey = 'users' | 'datasources' | 'copilotMessagesMonthly'

type NumericLimit = number | null

export type PlanLimits = Record<PlanLimitKey, NumericLimit>

const LIMITS: Record<TenantRecord['plan'], PlanLimits> = {
  trial: {
    users: 3,
    datasources: 2,
    copilotMessagesMonthly: 20,
  },
  starter: {
    users: 5,
    datasources: 3,
    copilotMessagesMonthly: 100,
  },
  pro: {
    users: 25,
    datasources: 10,
    copilotMessagesMonthly: 1000,
  },
  enterprise: {
    users: null,
    datasources: null,
    copilotMessagesMonthly: null,
  },
}

export type PlanLimitVerdict =
  | { allowed: true; plan: TenantRecord['plan']; limit: NumericLimit; used: number }
  | { allowed: false; plan: TenantRecord['plan']; limit: number; used: number; key: PlanLimitKey; message: string }

export function getPlanLimits(plan: TenantRecord['plan']): PlanLimits {
  return LIMITS[plan] ?? LIMITS.trial
}

function monthStartIso(now = new Date()): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0)).toISOString()
}

async function countCopilotUserMessagesThisMonth(tenantId: string): Promise<number> {
  const since = monthStartIso()
  if (usePostgresStorage()) {
    const result = await getPostgresPool().query<{ total: string }>(
      `SELECT COUNT(*)::text AS total
       FROM copilot_messages
       WHERE tenant_id = $1 AND role = 'user' AND created_at >= $2`,
      [tenantId, since],
    )
    return Number(result.rows[0]?.total ?? 0)
  }
  const row = db
    .prepare(
      `SELECT COUNT(*) AS total
       FROM copilot_messages
       WHERE tenant_id = ? AND role = 'user' AND created_at >= ?`,
    )
    .get(tenantId, since) as { total: number } | undefined
  return Number(row?.total ?? 0)
}

export async function getPlanUsage(tenantId: string, key: PlanLimitKey): Promise<number> {
  if (key === 'users') return (await readUsersForTenantAsync(tenantId)).length
  if (key === 'datasources') return (await readAllForTenantAsync(tenantId)).length
  return countCopilotUserMessagesThisMonth(tenantId)
}

export async function getPlanUsageSummary(tenantId: string) {
  const tenant = await findTenantBySlug(tenantId)
  const plan = tenant?.plan ?? 'trial'
  const limits = getPlanLimits(plan)
  const [users, datasources, copilotMessagesMonthly] = await Promise.all([
    getPlanUsage(tenantId, 'users'),
    getPlanUsage(tenantId, 'datasources'),
    getPlanUsage(tenantId, 'copilotMessagesMonthly'),
  ])
  return {
    plan,
    limits,
    usage: {
      users,
      datasources,
      copilotMessagesMonthly,
    },
  }
}

function labelForKey(key: PlanLimitKey): string {
  if (key === 'users') return 'usuarios'
  if (key === 'datasources') return 'fontes de dados'
  return 'mensagens mensais do copiloto'
}

export async function evaluatePlanLimit(tenantId: string, key: PlanLimitKey, increment = 1): Promise<PlanLimitVerdict> {
  const tenant = await findTenantBySlug(tenantId)
  const plan = tenant?.plan ?? 'trial'
  const limit = getPlanLimits(plan)[key]
  const used = await getPlanUsage(tenantId, key)
  if (limit === null || used + increment <= limit) {
    return { allowed: true, plan, limit, used }
  }
  return {
    allowed: false,
    plan,
    limit,
    used,
    key,
    message: `Limite do plano ${plan} atingido para ${labelForKey(key)} (${used}/${limit}).`,
  }
}
