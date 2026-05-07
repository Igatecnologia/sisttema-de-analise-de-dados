import { Router, type Response } from 'express'
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth.js'
import { findUserByIdForTenantAsync, readAllUsersAsync } from '../userStorage.js'
import { findTenantBySlug } from '../tenantStorage.js'
import { getDb } from '../db/sqlite.js'
import { getPostgresPool, hasPostgresConfig } from '../db/postgres.js'
import { logAudit } from '../services/auditLog.js'

export const superAdminRouter = Router()

const db = getDb()

function usePostgresStorage(): boolean {
  return process.env.IGA_STORAGE_DRIVER === 'postgres' && hasPostgresConfig()
}

/**
 * Middleware: bloqueia acesso a quem nao for super_admin.
 * Lista de super-admins vem do env `SUPER_ADMIN_EMAILS` (CSV) — fallback robusto
 * antes de criar role formal (Sprint 7 evolui para coluna na tabela users).
 */
async function requireSuperAdmin(req: import('express').Request, res: Response, next: import('express').NextFunction) {
  await requireAuth(req, res, async () => {
    const authReq = req as unknown as AuthenticatedRequest
    const allowed = (process.env.SUPER_ADMIN_EMAILS ?? '')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
    const user = await findUserByIdForTenantAsync(authReq.userId, authReq.tenantId)
    if (!user) return res.status(401).json({ message: 'Usuario nao encontrado' })
    if (allowed.length > 0 && !allowed.includes(user.email.toLowerCase())) {
      logAudit({ userId: authReq.userId, action: 'super_admin_denied', resource: 'super_admin', metadata: { email: user.email } })
      return res.status(403).json({ message: 'Acesso restrito a super-admins.' })
    }
    /** Super admin tem que ler/escrever cross-tenant — pula RLS via role bypass-safe nao implementado;
     * usar pool admin ou queries explicitamente cross-tenant abaixo. */
    next()
  })
}

superAdminRouter.use(requireSuperAdmin)

/** GET /api/v1/super-admin/tenants — lista tenants com metricas. */
superAdminRouter.get('/tenants', async (_req, res) => {
  let tenantsRaw: Array<{ id: string; slug: string; name: string; plan: string; status: string; trial_ends_at: string | null; created_at: string }>
  if (usePostgresStorage()) {
    /** Ja roda fora do RLS context — ainda assim, se tenant_context nao esta setado, RLS nao filtra. */
    const result = await getPostgresPool().query<{ id: string; slug: string; name: string; plan: string; status: string; trial_ends_at: string | null; created_at: string }>(
      `SELECT id, slug, name, plan, status, trial_ends_at::text AS trial_ends_at, created_at::text AS created_at FROM tenants ORDER BY created_at DESC`,
    )
    tenantsRaw = result.rows
  } else {
    tenantsRaw = db.prepare('SELECT id, slug, name, plan, status, trial_ends_at, created_at FROM tenants ORDER BY created_at DESC').all() as typeof tenantsRaw
  }

  /** Conta usuarios por tenant. */
  const allUsers = await readAllUsersAsync()
  const userCount = new Map<string, number>()
  for (const u of allUsers) {
    userCount.set(u.tenantId, (userCount.get(u.tenantId) ?? 0) + 1)
  }

  const tenants = tenantsRaw.map((t) => ({
    id: t.id,
    slug: t.slug,
    name: t.name,
    plan: t.plan,
    status: t.status,
    trialEndsAt: t.trial_ends_at,
    createdAt: t.created_at,
    userCount: userCount.get(t.id) ?? 0,
  }))

  res.json({
    total: tenants.length,
    tenants,
    metrics: {
      byPlan: tenants.reduce<Record<string, number>>((acc, t) => {
        acc[t.plan] = (acc[t.plan] ?? 0) + 1
        return acc
      }, {}),
      byStatus: tenants.reduce<Record<string, number>>((acc, t) => {
        acc[t.status] = (acc[t.status] ?? 0) + 1
        return acc
      }, {}),
    },
  })
})

/** POST /api/v1/super-admin/tenants/:id/suspend — suspende tenant. */
superAdminRouter.post('/tenants/:id/suspend', async (req, res: Response) => {
  const authReq = req as unknown as AuthenticatedRequest
  const id = req.params.id
  const tenant = await findTenantBySlug(id)
  if (!tenant) return res.status(404).json({ message: 'Tenant nao encontrado' })
  const now = new Date().toISOString()
  if (usePostgresStorage()) {
    await getPostgresPool().query(`UPDATE tenants SET status = 'suspended', updated_at = $2 WHERE id = $1`, [id, now])
  } else {
    db.prepare(`UPDATE tenants SET status = 'suspended', updated_at = ? WHERE id = ?`).run(now, id)
  }
  logAudit({ userId: authReq.userId, action: 'tenant_suspended', resource: 'super_admin', metadata: { tenantId: id } })
  res.json({ ok: true })
})

/** POST /api/v1/super-admin/tenants/:id/activate — reativa tenant. */
superAdminRouter.post('/tenants/:id/activate', async (req, res: Response) => {
  const authReq = req as unknown as AuthenticatedRequest
  const id = req.params.id
  const tenant = await findTenantBySlug(id)
  if (!tenant) return res.status(404).json({ message: 'Tenant nao encontrado' })
  const now = new Date().toISOString()
  if (usePostgresStorage()) {
    await getPostgresPool().query(`UPDATE tenants SET status = 'active', updated_at = $2 WHERE id = $1`, [id, now])
  } else {
    db.prepare(`UPDATE tenants SET status = 'active', updated_at = ? WHERE id = ?`).run(now, id)
  }
  logAudit({ userId: authReq.userId, action: 'tenant_activated', resource: 'super_admin', metadata: { tenantId: id } })
  res.json({ ok: true })
})

/** GET /api/v1/super-admin/metrics — MRR, churn estimado, tenants ativos. */
superAdminRouter.get('/metrics', async (_req, res) => {
  /** MRR estimado pelos planos ativos x preco hardcoded ate trazer do Stripe. */
  const PRICE: Record<string, number> = { free: 0, pro: 197, enterprise: 497 }
  let active = 0
  let mrrCents = 0
  let trialing = 0
  let suspended = 0
  let canceled = 0

  if (usePostgresStorage()) {
    const subs = await getPostgresPool().query<{ plan: string; status: string }>(
      `SELECT plan, status FROM subscriptions`,
    )
    for (const r of subs.rows) {
      if (r.status === 'active') {
        active++
        mrrCents += (PRICE[r.plan] ?? 0) * 100
      }
      if (r.status === 'trialing') trialing++
      if (r.status === 'canceled') canceled++
    }
    const susp = await getPostgresPool().query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM tenants WHERE status = 'suspended'`,
    )
    suspended = Number(susp.rows[0]?.count ?? 0)
  } else {
    const subs = db.prepare(`SELECT plan, status FROM subscriptions`).all() as Array<{ plan: string; status: string }>
    for (const r of subs) {
      if (r.status === 'active') {
        active++
        mrrCents += (PRICE[r.plan] ?? 0) * 100
      }
      if (r.status === 'trialing') trialing++
      if (r.status === 'canceled') canceled++
    }
    const susp = db.prepare(`SELECT COUNT(*) AS count FROM tenants WHERE status = 'suspended'`).get() as { count: number }
    suspended = susp?.count ?? 0
  }

  res.json({
    mrrBrlCents: mrrCents,
    mrrBrlFormatted: (mrrCents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
    activeSubscriptions: active,
    trialingTenants: trialing,
    suspendedTenants: suspended,
    canceledSubscriptions: canceled,
  })
})
