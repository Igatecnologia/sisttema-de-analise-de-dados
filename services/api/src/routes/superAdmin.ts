import { Router, type Response } from 'express'
import { z } from 'zod'
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth.js'
import { findUserByIdForTenantAsync, readAllUsersAsync } from '../userStorage.js'
import { deleteTenant, findTenantByIdOrSlug, findTenantBySlug, genTenantId, upsertTenant, type TenantRecord } from '../tenantStorage.js'
import { BUSINESS_SEGMENTS } from '../segments.js'
import { getDb } from '../db/sqlite.js'
import { getPostgresPool, hasPostgresConfig } from '../db/postgres.js'
import { logAudit } from '../services/auditLog.js'
import { readCookieToken } from './auth.js'
import { registerToken, revokeToken } from '../middleware/auth.js'
import { signSessionJwt } from '../services/sessionJwt.js'
import { buildSessionBinding } from '../services/sessionStore.js'
import { resolveEffectivePermissions } from '../permissions.js'
import { readAllAsync as readAllDataSourcesAsync } from '../storage.js'
import { getResilienceMetrics, resetCircuit } from '../services/proxyResilience.js'

export const superAdminRouter = Router()

const db = getDb()
const PRICE_BRL: Record<string, number> = { trial: 0, starter: 97, pro: 197, enterprise: 497 }
const DEFAULT_MODULES = [
  'dashboard',
  'financeiro',
  'relatorios',
  'usuarios',
  'auditoria',
  'datasources',
  'operations',
]

const tenantBodySchema = z.object({
  slug: z.string().min(2).max(64).regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/, 'Slug invalido').optional(),
  name: z.string().min(1).max(160),
  subtitle: z.string().min(1).max(160).default('Gestao e Analise de Dados'),
  logoUrl: z.string().url().max(600).nullable().optional(),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{3,8}$/).nullable().optional(),
  connectorId: z.string().min(2).max(64).default('iga-custom-api'),
  segment: z.enum(BUSINESS_SEGMENTS as [string, ...string[]]).default('industry'),
  plan: z.enum(['trial', 'starter', 'pro', 'enterprise']).default('trial'),
  trialEndsAt: z.string().datetime().nullable().optional(),
  enabledModules: z.array(z.string().min(1).max(80)).default(DEFAULT_MODULES),
  status: z.enum(['active', 'inactive']).default('active'),
  /** Beta Fechada — preenchidos pelo super-admin a partir de lookup CNPJ. */
  cnpj: z.string().regex(/^\d{14}$/, 'CNPJ deve ter 14 digitos').nullable().optional(),
  contactEmail: z.string().email().max(254).nullable().optional(),
  contactPhone: z.string().max(40).nullable().optional(),
  betaNotes: z.string().max(2000).nullable().optional(),
})

function usePostgresStorage(): boolean {
  return process.env.IGA_STORAGE_DRIVER === 'postgres' && hasPostgresConfig()
}

const useSecureCookie =
  process.env.NODE_ENV === 'production' && !process.env.ELECTRON_RUN_AS_NODE

function resolveCookieSameSite(): 'Strict' | 'Lax' | 'None' {
  const v = process.env.COOKIE_SAMESITE?.trim()
  if (v === 'None' || v === 'Lax' || v === 'Strict') return v
  return 'Strict'
}

function buildCookie(name: string, value: string, maxAgeSeconds: number): string {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    'HttpOnly',
    'Path=/',
    `Max-Age=${maxAgeSeconds}`,
    `SameSite=${resolveCookieSameSite()}`,
  ]
  if (useSecureCookie) parts.push('Secure')
  return parts.join('; ')
}

function clearCookie(name: string): string {
  const parts = [
    `${name}=`,
    'HttpOnly',
    'Path=/',
    'Max-Age=0',
    `SameSite=${resolveCookieSameSite()}`,
  ]
  if (useSecureCookie) parts.push('Secure')
  return parts.join('; ')
}

function authPayload(user: Awaited<ReturnType<typeof findUserByIdForTenantAsync>>, tenantId: string) {
  if (!user) return null
  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      mustChangePassword: user.mustChangePassword ?? false,
    },
    permissions: resolveEffectivePermissions(user.role, user.permissions),
    impersonation: { active: true, tenantId },
  }
}

async function loadSubscriptionsByTenant(): Promise<Map<string, { plan: string; status: string }>> {
  const map = new Map<string, { plan: string; status: string }>()
  if (usePostgresStorage()) {
    const result = await getPostgresPool().query<{ tenant_id: string; plan: string; status: string }>(
      'SELECT tenant_id, plan, status FROM subscriptions',
    )
    for (const row of result.rows) map.set(row.tenant_id, { plan: row.plan, status: row.status })
    return map
  }
  const rows = db.prepare('SELECT tenant_id, plan, status FROM subscriptions').all() as Array<{ tenant_id: string; plan: string; status: string }>
  for (const row of rows) map.set(row.tenant_id, { plan: row.plan, status: row.status })
  return map
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
    if (allowed.length === 0 || !allowed.includes(user.email.toLowerCase())) {
      logAudit({ userId: authReq.userId, action: 'super_admin_denied', resource: 'super_admin', metadata: { email: user.email } })
      return res.status(403).json({ message: 'Acesso restrito a super-admins.' })
    }
    /** Super admin tem que ler/escrever cross-tenant — pula RLS via role bypass-safe nao implementado;
     * usar pool admin ou queries explicitamente cross-tenant abaixo. */
    next()
  })
}

superAdminRouter.post('/impersonation/stop', requireAuth, async (req, res: Response) => {
  const current = req as unknown as AuthenticatedRequest
  const impersonatorToken = readCookieToken(req.headers.cookie, 'iga_impersonator')
  if (!impersonatorToken) return res.status(409).json({ message: 'Nenhuma impersonation ativa.' })

  const currentToken = readCookieToken(req.headers.cookie, 'iga_session')
  if (currentToken) await revokeToken(currentToken).catch(() => undefined)

  logAudit({
    userId: current.userId,
    tenantId: current.tenantId,
    action: 'super_admin_impersonation_stopped',
    resource: 'super_admin',
    metadata: { tenantId: current.tenantId },
  })
  res.setHeader('Set-Cookie', [
    buildCookie('iga_session', impersonatorToken, 28_800),
    clearCookie('iga_impersonator'),
  ])
  res.json({ ok: true, impersonation: null })
})

superAdminRouter.use(requireSuperAdmin)

/** GET /api/v1/super-admin/tenants — lista tenants com metricas. */
superAdminRouter.get('/tenants', async (_req, res) => {
  type RawRow = { id: string; slug: string; name: string; subtitle: string | null; logo_url: string | null; primary_color: string | null; connector_id: string | null; segment: string | null; enabled_modules: unknown; plan: string; status: string; trial_ends_at: string | null; cnpj: string | null; contact_email: string | null; contact_phone: string | null; beta_notes: string | null; created_at: string; updated_at: string | null }
  let tenantsRaw: RawRow[]
  if (usePostgresStorage()) {
    /** Ja roda fora do RLS context — ainda assim, se tenant_context nao esta setado, RLS nao filtra. */
    const result = await getPostgresPool().query<RawRow>(
      `SELECT id, slug, name, subtitle, logo_url, primary_color, connector_id, segment, enabled_modules,
              plan, status, trial_ends_at::text AS trial_ends_at,
              cnpj, contact_email, contact_phone, beta_notes,
              created_at::text AS created_at, updated_at::text AS updated_at
       FROM tenants ORDER BY created_at DESC`,
    )
    tenantsRaw = result.rows
  } else {
    tenantsRaw = db.prepare(
      `SELECT id, slug, name, subtitle, logo_url, primary_color, connector_id, segment,
              enabled_modules_json AS enabled_modules,
              plan, status, trial_ends_at, cnpj, contact_email, contact_phone, beta_notes,
              created_at, updated_at
       FROM tenants ORDER BY created_at DESC`,
    ).all() as RawRow[]
  }
  function parseModulesField(value: unknown): string[] {
    if (Array.isArray(value)) return value.filter((v): v is string => typeof v === 'string')
    if (typeof value !== 'string') return []
    try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [] } catch { return [] }
  }

  const [allUsers, allDataSources, subscriptions] = await Promise.all([
    readAllUsersAsync(),
    readAllDataSourcesAsync(),
    loadSubscriptionsByTenant(),
  ])
  const userCount = new Map<string, number>()
  for (const u of allUsers) {
    userCount.set(u.tenantId, (userCount.get(u.tenantId) ?? 0) + 1)
  }
  const datasourceCount = new Map<string, number>()
  for (const ds of allDataSources) {
    datasourceCount.set(ds.tenantId, (datasourceCount.get(ds.tenantId) ?? 0) + 1)
  }

  const tenants = tenantsRaw.map((t) => ({
    id: t.id,
    slug: t.slug,
    name: t.name,
    subtitle: t.subtitle ?? 'Gestao e Analise de Dados',
    logoUrl: t.logo_url,
    primaryColor: t.primary_color,
    connectorId: t.connector_id ?? 'iga-custom-api',
    segment: t.segment ?? 'industry',
    enabledModules: parseModulesField(t.enabled_modules),
    plan: t.plan,
    status: t.status,
    trialEndsAt: t.trial_ends_at,
    cnpj: t.cnpj,
    contactEmail: t.contact_email,
    contactPhone: t.contact_phone,
    betaNotes: t.beta_notes,
    createdAt: t.created_at,
    updatedAt: t.updated_at,
    userCount: userCount.get(t.id) ?? 0,
    datasourceCount: datasourceCount.get(t.id) ?? 0,
    subscriptionStatus: subscriptions.get(t.id)?.status ?? (t.plan === 'trial' ? 'trialing' : 'none'),
    mrrBrlCents: (subscriptions.get(t.id)?.status === 'active' ? PRICE_BRL[subscriptions.get(t.id)?.plan ?? t.plan] ?? 0 : 0) * 100,
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

superAdminRouter.post('/tenants', async (req, res: Response) => {
  const authReq = req as unknown as AuthenticatedRequest
  const parsed = tenantBodySchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'Dados invalidos' })
  const slug = (parsed.data.slug ?? parsed.data.name).trim().toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
  const existing = await findTenantBySlug(slug)
  if (existing) return res.status(409).json({ message: 'Ja existe um tenant com este slug' })
  const tenant = await upsertTenant({
    id: genTenantId(slug),
    slug,
    name: parsed.data.name.trim(),
    subtitle: parsed.data.subtitle.trim(),
    logoUrl: parsed.data.logoUrl ?? null,
    primaryColor: parsed.data.primaryColor ?? null,
    enabledModules: [...new Set(parsed.data.enabledModules)].sort(),
    connectorId: parsed.data.connectorId,
    segment: parsed.data.segment as TenantRecord['segment'],
    plan: parsed.data.plan,
    trialEndsAt: parsed.data.trialEndsAt ?? null,
    status: parsed.data.status,
    cnpj: parsed.data.cnpj ?? null,
    contactEmail: parsed.data.contactEmail ?? null,
    contactPhone: parsed.data.contactPhone ?? null,
    betaNotes: parsed.data.betaNotes ?? null,
  })
  logAudit({ userId: authReq.userId, tenantId: authReq.tenantId, action: 'super_admin_tenant_created', resource: 'super_admin', metadata: { tenantId: tenant.id, slug: tenant.slug } })
  res.status(201).json(tenant)
})

superAdminRouter.put('/tenants/:id', async (req, res: Response) => {
  const authReq = req as unknown as AuthenticatedRequest
  const current = await findTenantByIdOrSlug(req.params.id)
  if (!current) return res.status(404).json({ message: 'Tenant nao encontrado' })
  const parsed = tenantBodySchema.partial().safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'Dados invalidos' })
  const nextSlug = parsed.data.slug?.trim().toLowerCase() ?? current.slug
  if (nextSlug !== current.slug) {
    const duplicate = await findTenantBySlug(nextSlug)
    if (duplicate) return res.status(409).json({ message: 'Ja existe um tenant com este slug' })
  }
  const tenant = await upsertTenant({
    id: current.id,
    slug: nextSlug,
    name: parsed.data.name?.trim() ?? current.name,
    subtitle: parsed.data.subtitle?.trim() ?? current.subtitle,
    logoUrl: parsed.data.logoUrl === undefined ? current.logoUrl : parsed.data.logoUrl,
    primaryColor: parsed.data.primaryColor === undefined ? current.primaryColor : parsed.data.primaryColor,
    enabledModules: parsed.data.enabledModules ? [...new Set(parsed.data.enabledModules)].sort() : current.enabledModules,
    connectorId: parsed.data.connectorId ?? current.connectorId,
    segment: (parsed.data.segment as TenantRecord['segment'] | undefined) ?? current.segment,
    plan: parsed.data.plan ?? current.plan,
    trialEndsAt: parsed.data.trialEndsAt === undefined ? current.trialEndsAt : parsed.data.trialEndsAt,
    status: parsed.data.status ?? current.status,
    cnpj: parsed.data.cnpj === undefined ? current.cnpj : parsed.data.cnpj,
    contactEmail: parsed.data.contactEmail === undefined ? current.contactEmail : parsed.data.contactEmail,
    contactPhone: parsed.data.contactPhone === undefined ? current.contactPhone : parsed.data.contactPhone,
    betaNotes: parsed.data.betaNotes === undefined ? current.betaNotes : parsed.data.betaNotes,
  })
  logAudit({ userId: authReq.userId, tenantId: authReq.tenantId, action: 'super_admin_tenant_updated', resource: 'super_admin', metadata: { tenantId: tenant.id, slug: tenant.slug } })
  res.json(tenant)
})

superAdminRouter.delete('/tenants/:id', async (req, res: Response) => {
  const authReq = req as unknown as AuthenticatedRequest
  const tenant = await findTenantByIdOrSlug(req.params.id)
  if (!tenant) return res.status(404).json({ message: 'Tenant nao encontrado' })
  if (tenant.id === 'default') return res.status(400).json({ message: 'Tenant default nao pode ser excluido' })
  const ok = await deleteTenant(tenant.id)
  if (!ok) return res.status(404).json({ message: 'Tenant nao encontrado' })
  logAudit({ userId: authReq.userId, tenantId: authReq.tenantId, action: 'super_admin_tenant_deleted', resource: 'super_admin', metadata: { tenantId: tenant.id, slug: tenant.slug } })
  res.json({ ok: true })
})

/** POST /api/v1/super-admin/tenants/:id/suspend — suspende tenant. */
superAdminRouter.post('/tenants/:id/suspend', async (req, res: Response) => {
  const authReq = req as unknown as AuthenticatedRequest
  const tenant = await findTenantByIdOrSlug(req.params.id)
  if (!tenant) return res.status(404).json({ message: 'Tenant nao encontrado' })
  const now = new Date().toISOString()
  if (usePostgresStorage()) {
    await getPostgresPool().query(`UPDATE tenants SET status = 'suspended', updated_at = $2 WHERE id = $1`, [tenant.id, now])
  } else {
    db.prepare(`UPDATE tenants SET status = 'suspended', updated_at = ? WHERE id = ?`).run(now, tenant.id)
  }
  logAudit({ userId: authReq.userId, action: 'tenant_suspended', resource: 'super_admin', metadata: { tenantId: tenant.id } })
  res.json({ ok: true })
})

/** POST /api/v1/super-admin/tenants/:id/activate — reativa tenant. */
superAdminRouter.post('/tenants/:id/activate', async (req, res: Response) => {
  const authReq = req as unknown as AuthenticatedRequest
  const tenant = await findTenantByIdOrSlug(req.params.id)
  if (!tenant) return res.status(404).json({ message: 'Tenant nao encontrado' })
  const now = new Date().toISOString()
  if (usePostgresStorage()) {
    await getPostgresPool().query(`UPDATE tenants SET status = 'active', updated_at = $2 WHERE id = $1`, [tenant.id, now])
  } else {
    db.prepare(`UPDATE tenants SET status = 'active', updated_at = ? WHERE id = ?`).run(now, tenant.id)
  }
  logAudit({ userId: authReq.userId, action: 'tenant_activated', resource: 'super_admin', metadata: { tenantId: tenant.id } })
  res.json({ ok: true })
})

/** POST /api/v1/super-admin/tenants/:id/extend-trial — estende trial em N dias. */
const extendTrialSchema = z.object({ days: z.number().int().min(1).max(365) })
superAdminRouter.post('/tenants/:id/extend-trial', async (req, res: Response) => {
  const authReq = req as unknown as AuthenticatedRequest
  const tenant = await findTenantByIdOrSlug(req.params.id)
  if (!tenant) return res.status(404).json({ message: 'Tenant nao encontrado' })
  const parsed = extendTrialSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'Dados invalidos' })
  const base = tenant.trialEndsAt ? new Date(tenant.trialEndsAt) : new Date()
  if (Number.isNaN(base.getTime())) base.setTime(Date.now())
  if (base.getTime() < Date.now()) base.setTime(Date.now())
  base.setUTCDate(base.getUTCDate() + parsed.data.days)
  const newDate = base.toISOString()
  const now = new Date().toISOString()
  if (usePostgresStorage()) {
    await getPostgresPool().query(`UPDATE tenants SET trial_ends_at = $2, updated_at = $3 WHERE id = $1`, [tenant.id, newDate, now])
  } else {
    db.prepare(`UPDATE tenants SET trial_ends_at = ?, updated_at = ? WHERE id = ?`).run(newDate, now, tenant.id)
  }
  logAudit({ userId: authReq.userId, action: 'super_admin_trial_extended', resource: 'super_admin', metadata: { tenantId: tenant.id, days: parsed.data.days, newTrialEndsAt: newDate } })
  res.json({ ok: true, trialEndsAt: newDate })
})

/** GET /api/v1/super-admin/tenants/:id/detail — drill-down de um tenant. */
superAdminRouter.get('/tenants/:id/detail', async (req, res: Response) => {
  const tenant = await findTenantByIdOrSlug(req.params.id)
  if (!tenant) return res.status(404).json({ message: 'Tenant nao encontrado' })

  const [allUsers, allDataSources] = await Promise.all([
    readAllUsersAsync(),
    readAllDataSourcesAsync(),
  ])
  const users = allUsers
    .filter((u) => u.tenantId === tenant.id)
    .map((u) => ({ id: u.id, name: u.name, email: u.email, role: u.role, status: u.status }))
  const datasources = allDataSources
    .filter((d) => d.tenantId === tenant.id)
    .map((d) => ({ id: d.id, name: d.name }))

  const recentAudit: Array<{ id: string; action: string; resource: string; createdAt: string; userId: string | null; metadata: unknown }> = usePostgresStorage()
    ? await (async () => {
    const result = await getPostgresPool().query<{ id: string; action: string; resource: string; created_at: string; user_id: string | null; metadata_json: string | null }>(
      `SELECT id, action, resource, created_at::text AS created_at, user_id, metadata_json
       FROM audit_log WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 25`,
      [tenant.id],
    )
    return result.rows.map((r) => ({ id: r.id, action: r.action, resource: r.resource, createdAt: r.created_at, userId: r.user_id, metadata: r.metadata_json ? safeJson(r.metadata_json) : null }))
  })()
    : (() => {
    const rows = db.prepare(`SELECT id, action, resource, created_at, user_id, metadata_json FROM audit_log WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 25`).all(tenant.id) as Array<{ id: string; action: string; resource: string; created_at: string; user_id: string | null; metadata_json: string | null }>
    return rows.map((r) => ({ id: r.id, action: r.action, resource: r.resource, createdAt: r.created_at, userId: r.user_id, metadata: r.metadata_json ? safeJson(r.metadata_json) : null }))
  })()

  res.json({ tenant: serializeTenant(tenant), users, datasources, recentAudit })
})

/** GET /api/v1/super-admin/audit-recent — eventos super_admin_* recentes. */
superAdminRouter.get('/audit-recent', async (_req, res: Response) => {
  const rows: Array<{ id: string; action: string; resource: string; createdAt: string; userId: string | null; tenantId: string | null; metadata: unknown }> = usePostgresStorage()
    ? await (async () => {
    const result = await getPostgresPool().query<{ id: string; action: string; resource: string; created_at: string; user_id: string | null; tenant_id: string | null; metadata_json: string | null }>(
      `SELECT id, action, resource, created_at::text AS created_at, user_id, tenant_id, metadata_json
       FROM audit_log WHERE action LIKE 'super_admin_%' OR action IN ('tenant_suspended','tenant_activated')
       ORDER BY created_at DESC LIMIT 50`,
    )
    return result.rows.map((r) => ({ id: r.id, action: r.action, resource: r.resource, createdAt: r.created_at, userId: r.user_id, tenantId: r.tenant_id, metadata: r.metadata_json ? safeJson(r.metadata_json) : null }))
  })()
    : (() => {
    const result = db.prepare(`SELECT id, action, resource, created_at, user_id, tenant_id, metadata_json FROM audit_log WHERE action LIKE 'super_admin_%' OR action IN ('tenant_suspended','tenant_activated') ORDER BY created_at DESC LIMIT 50`).all() as Array<{ id: string; action: string; resource: string; created_at: string; user_id: string | null; tenant_id: string | null; metadata_json: string | null }>
    return result.map((r) => ({ id: r.id, action: r.action, resource: r.resource, createdAt: r.created_at, userId: r.user_id, tenantId: r.tenant_id, metadata: r.metadata_json ? safeJson(r.metadata_json) : null }))
  })()
  res.json({ events: rows })
})

function safeJson(input: string): unknown {
  try { return JSON.parse(input) } catch { return null }
}

function serializeTenant(t: TenantRecord) {
  return {
    id: t.id,
    slug: t.slug,
    name: t.name,
    subtitle: t.subtitle,
    logoUrl: t.logoUrl,
    primaryColor: t.primaryColor,
    enabledModules: t.enabledModules,
    connectorId: t.connectorId,
    segment: t.segment,
    plan: t.plan,
    trialEndsAt: t.trialEndsAt,
    status: t.status,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  }
}

superAdminRouter.post('/tenants/:id/impersonate', async (req, res: Response) => {
  const authReq = req as unknown as AuthenticatedRequest
  const tenant = await findTenantByIdOrSlug(req.params.id)
  if (!tenant || tenant.status !== 'active') return res.status(404).json({ message: 'Tenant ativo nao encontrado' })

  const users = await readAllUsersAsync()
  const targetUser = users.find(
    (user) => user.tenantId === tenant.id && user.role === 'admin' && user.status === 'active',
  ) ?? users.find((user) => user.tenantId === tenant.id && user.status === 'active')

  if (!targetUser) return res.status(404).json({ message: 'Tenant sem usuario ativo para impersonation' })

  const currentToken = readCookieToken(req.headers.cookie, 'iga_session')
  if (!currentToken) return res.status(401).json({ message: 'Sessao original nao encontrada' })

  const token = signSessionJwt({
    sub: targetUser.id,
    tid: tenant.id,
    role: targetUser.role,
    plan: tenant.plan,
  })
  const userAgent = typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : ''
  await registerToken(token, targetUser.id, tenant.id, buildSessionBinding(req.ip ?? '', userAgent))
  logAudit({
    userId: authReq.userId,
    tenantId: authReq.tenantId,
    action: 'super_admin_impersonation_started',
    resource: 'super_admin',
    metadata: { targetTenantId: tenant.id, targetUserId: targetUser.id },
  })
  res.setHeader('Set-Cookie', [
    buildCookie('iga_impersonator', currentToken, 28_800),
    buildCookie('iga_session', token, 28_800),
  ])
  res.json(authPayload(targetUser, tenant.id))
})

/** GET /api/v1/super-admin/metrics — MRR, churn estimado, tenants ativos. */
superAdminRouter.get('/metrics', async (_req, res) => {
  let active = 0
  let mrrCents = 0
  let trialing = 0
  let canceled = 0
  let suspended: number

  if (usePostgresStorage()) {
    const subs = await getPostgresPool().query<{ plan: string; status: string }>(
      `SELECT plan, status FROM subscriptions`,
    )
    for (const r of subs.rows) {
      if (r.status === 'active') {
        active++
        mrrCents += (PRICE_BRL[r.plan] ?? 0) * 100
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
        mrrCents += (PRICE_BRL[r.plan] ?? 0) * 100
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
    churnRatePct: active + canceled > 0 ? Number(((canceled / (active + canceled)) * 100).toFixed(2)) : 0,
  })
})

/** GET /super-admin/users — lista cross-tenant. Apenas super admin. */
superAdminRouter.get('/users', async (req, res: Response) => {
  const q = String(req.query.q ?? '').toLowerCase().trim()
  const tenantFilter = String(req.query.tenantId ?? '').trim()
  const all = await readAllUsersAsync()
  const filtered = all.filter((u) => {
    if (tenantFilter && u.tenantId !== tenantFilter) return false
    if (!q) return true
    return (
      u.name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.id.toLowerCase().includes(q)
    )
  })
  res.json({
    total: filtered.length,
    users: filtered.slice(0, 500).map((u) => ({
      id: u.id,
      tenantId: u.tenantId,
      name: u.name,
      email: u.email,
      role: u.role,
      status: u.status,
      mfaEnabled: Boolean((u as { mfaEnabled?: boolean }).mfaEnabled),
      createdAt: (u as { createdAt?: string }).createdAt ?? null,
    })),
  })
})

/** GET /super-admin/ai-usage — agregacoes de custo IA por tenant/mes. */
superAdminRouter.get('/ai-usage', async (req, res: Response) => {
  if (!usePostgresStorage()) {
    return res.json({ supported: false, message: 'AI usage tracking requer Postgres' })
  }
  const months = Math.min(Math.max(Number(req.query.months ?? 3), 1), 12)
  const result = await getPostgresPool().query<{
    tenant_id: string
    month: string
    total_cost_usd: string
    total_tokens_in: string
    total_tokens_out: string
    conversations: string
    avg_latency_ms: string
    error_rate: string
    primary_model: string | null
  }>(
    `SELECT
       u.tenant_id,
       to_char(date_trunc('month', u.created_at), 'YYYY-MM') AS month,
       SUM(u.cost_usd)::text AS total_cost_usd,
       SUM(u.tokens_in)::text AS total_tokens_in,
       SUM(u.tokens_out)::text AS total_tokens_out,
       COUNT(DISTINCT u.conversation_id)::text AS conversations,
       AVG(u.latency_ms)::text AS avg_latency_ms,
       AVG(CASE WHEN u.had_error THEN 1.0 ELSE 0.0 END)::text AS error_rate,
       MODE() WITHIN GROUP (ORDER BY u.model) AS primary_model
     FROM ai_usage u
     WHERE u.created_at >= now() - ($1 || ' months')::interval
     GROUP BY u.tenant_id, date_trunc('month', u.created_at)
     ORDER BY SUM(u.cost_usd) DESC`,
    [String(months)],
  )
  const rows = result.rows.map((r) => ({
    tenantId: r.tenant_id,
    month: r.month,
    totalCostUsd: Number(r.total_cost_usd),
    totalTokensIn: Number(r.total_tokens_in),
    totalTokensOut: Number(r.total_tokens_out),
    conversations: Number(r.conversations),
    avgLatencyMs: Number(r.avg_latency_ms),
    errorRate: Number(r.error_rate),
    primaryModel: r.primary_model,
  }))
  const grandTotal = rows.reduce((acc, r) => acc + r.totalCostUsd, 0)
  res.json({
    supported: true,
    months,
    grandTotalUsd: Number(grandTotal.toFixed(4)),
    rows,
  })
})

/** GET /super-admin/system-health — status do proxy, db, redis. */
superAdminRouter.get('/system-health', async (_req, res: Response) => {
  const checks: Record<string, { ok: boolean; detail?: string }> = {}
  // DB
  try {
    if (usePostgresStorage()) {
      await getPostgresPool().query('SELECT 1')
      checks.database = { ok: true, detail: 'postgres' }
    } else {
      db.prepare('SELECT 1').get()
      checks.database = { ok: true, detail: 'sqlite' }
    }
  } catch (err) {
    checks.database = { ok: false, detail: (err as Error).message }
  }
  // Redis (opcional)
  if (process.env.REDIS_URL) {
    checks.redis = { ok: true, detail: 'configurado' }
  } else {
    checks.redis = { ok: false, detail: 'nao configurado (usando memory fallback)' }
  }
  // Stripe
  checks.stripe = {
    ok: Boolean(process.env.STRIPE_SECRET_KEY),
    detail: process.env.STRIPE_SECRET_KEY ? 'configurado' : 'nao configurado',
  }
  // Email
  checks.email = {
    ok: Boolean(process.env.RESEND_API_KEY || process.env.SMTP_HOST),
    detail: process.env.RESEND_API_KEY ? 'resend' : process.env.SMTP_HOST ? 'smtp' : 'nao configurado',
  }
  // Sentry
  checks.sentry = {
    ok: Boolean(process.env.SENTRY_DSN),
    detail: process.env.SENTRY_DSN ? 'configurado' : 'nao configurado',
  }
  // IGA-AI
  checks.igaAi = {
    ok: Boolean(process.env.IGA_AI_BASE_URL && process.env.IGA_AI_SHARED_SECRET),
    detail: process.env.IGA_AI_BASE_URL ?? 'V2 nao configurado',
  }
  const allOk = Object.values(checks).every((c) => c.ok)
  res.json({
    status: allOk ? 'healthy' : 'degraded',
    checks,
    uptime: process.uptime(),
    nodeEnv: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
  })
})

/** GET /super-admin/subscriptions — lista subscriptions com filtros. */
superAdminRouter.get('/subscriptions', async (_req, res: Response) => {
  if (!usePostgresStorage()) {
    const rows = db
      .prepare(
        `SELECT tenant_id, plan, status, stripe_customer_id, stripe_subscription_id, current_period_end FROM subscriptions ORDER BY current_period_end DESC LIMIT 200`,
      )
      .all() as Array<{
      tenant_id: string
      plan: string
      status: string
      stripe_customer_id: string | null
      stripe_subscription_id: string | null
      current_period_end: string | null
    }>
    return res.json({
      total: rows.length,
      subscriptions: rows.map((r) => ({
        tenantId: r.tenant_id,
        plan: r.plan,
        status: r.status,
        stripeCustomerId: r.stripe_customer_id,
        stripeSubscriptionId: r.stripe_subscription_id,
        currentPeriodEnd: r.current_period_end,
      })),
    })
  }
  const result = await getPostgresPool().query<{
    tenant_id: string
    plan: string
    status: string
    stripe_customer_id: string | null
    stripe_subscription_id: string | null
    current_period_end: string | null
  }>(
    `SELECT tenant_id, plan, status, stripe_customer_id, stripe_subscription_id, current_period_end
     FROM subscriptions ORDER BY current_period_end DESC LIMIT 200`,
  )
  res.json({
    total: result.rows.length,
    subscriptions: result.rows.map((r) => ({
      tenantId: r.tenant_id,
      plan: r.plan,
      status: r.status,
      stripeCustomerId: r.stripe_customer_id,
      stripeSubscriptionId: r.stripe_subscription_id,
      currentPeriodEnd: r.current_period_end,
    })),
  })
})

/** GET /super-admin/audit-search — auditoria com filtros. */
superAdminRouter.get('/audit-search', async (req, res: Response) => {
  const action = String(req.query.action ?? '').trim()
  const tenantId = String(req.query.tenantId ?? '').trim()
  const limit = Math.min(Math.max(Number(req.query.limit ?? 200), 1), 1000)
  let sql = 'SELECT id, action, resource, created_at, user_id, tenant_id, metadata_json FROM audit_log WHERE 1=1'
  const params: unknown[] = []
  if (action) {
    if (usePostgresStorage()) {
      sql += ` AND action ILIKE $${params.length + 1}`
    } else {
      sql += ' AND action LIKE ?'
    }
    params.push(`%${action}%`)
  }
  if (tenantId) {
    if (usePostgresStorage()) {
      sql += ` AND tenant_id = $${params.length + 1}`
    } else {
      sql += ' AND tenant_id = ?'
    }
    params.push(tenantId)
  }
  if (usePostgresStorage()) {
    sql += ` ORDER BY created_at DESC LIMIT $${params.length + 1}`
  } else {
    sql += ' ORDER BY created_at DESC LIMIT ?'
  }
  params.push(limit)
  let rows: Array<{
    id: string
    action: string
    resource: string
    created_at: string
    user_id: string | null
    tenant_id: string | null
    metadata_json: string | null
  }>
  if (usePostgresStorage()) {
    const result = await getPostgresPool().query(sql, params)
    rows = result.rows as typeof rows
  } else {
    rows = db.prepare(sql).all(...params) as typeof rows
  }
  res.json({
    total: rows.length,
    events: rows.map((r) => ({
      id: r.id,
      action: r.action,
      resource: r.resource,
      createdAt: r.created_at,
      userId: r.user_id,
      tenantId: r.tenant_id,
      metadata: r.metadata_json ? safeJsonParse(r.metadata_json) : null,
    })),
  })
})

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

// ── Proxy resilience (circuit breakers + retry counters) ────────────────────

superAdminRouter.get('/proxy-health', (_req, res) => {
  res.json(getResilienceMetrics())
})

superAdminRouter.post('/proxy-health/circuits/:key/reset', async (req, res: Response) => {
  const key = String(req.params.key || '')
  const ok = resetCircuit(key)
  if (!ok) {
    res.status(404).json({ message: 'Circuit nao encontrado' })
    return
  }
  const userId = (req as unknown as AuthenticatedRequest).userId ?? ''
  logAudit({ userId, action: 'proxy_circuit_reset', resource: 'proxy', metadata: { key } })
  res.json({ ok: true, key })
})
