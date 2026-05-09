import { Router, type NextFunction, type Request, type Response } from 'express'
import { z } from 'zod'
import { requireAdmin, requireAuth, type AuthenticatedRequest } from '../middleware/auth.js'
import { deleteTenant, findTenantBySlug, genTenantId, listTenants, upsertTenant, type TenantRecord } from '../tenantStorage.js'
import { logAudit } from '../services/auditLog.js'
import { ConnectorRegistry } from '../connectors/connectorRegistry.js'
import { buildTenantExport } from '../services/tenantExport.js'
import { BUSINESS_SEGMENTS } from '../segments.js'

export const tenantsRouter = Router()

const enabledModuleSchema = z.enum([
  'dashboard',
  'financeiro',
  'relatorios',
  'usuarios',
  'auditoria',
  'producao',
  'ficha_tecnica',
  'comercial',
  'compras',
  'estoque',
  'alertas',
  'suporte',
  'datasources',
  'operations',
])

const tenantSchema = z.object({
  slug: z.string().min(2).max(64).regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/, 'Slug invalido'),
  name: z.string().min(1).max(160),
  subtitle: z.string().min(1).max(160).default('Automacao & Tecnologia'),
  logoUrl: z.string().url().max(600).nullable().optional(),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{3,8}$/, 'Cor primaria invalida').nullable().optional(),
  connectorId: z.string().min(2).max(64).default('iga-custom-api'),
  segment: z.enum(BUSINESS_SEGMENTS as [string, ...string[]]).default('industry'),
  plan: z.enum(['trial', 'starter', 'pro', 'enterprise']).default('trial'),
  trialEndsAt: z.string().datetime().nullable().optional(),
  enabledModules: z.array(enabledModuleSchema).default(['dashboard']),
  status: z.enum(['active', 'inactive']).default('active'),
})

const tenantSettingsSchema = z.object({
  name: z.string().min(1).max(160),
  subtitle: z.string().min(1).max(160),
  logoUrl: z.string().url().max(600).nullable().optional(),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{3,8}$/, 'Cor primaria invalida').nullable().optional(),
})

function sanitizeTenant(tenant: TenantRecord) {
  return {
    id: tenant.id,
    slug: tenant.slug,
    name: tenant.name,
    subtitle: tenant.subtitle,
    logoUrl: tenant.logoUrl,
    primaryColor: tenant.primaryColor,
    enabledModules: tenant.enabledModules,
    connectorId: tenant.connectorId,
    segment: tenant.segment,
    plan: tenant.plan,
    trialEndsAt: tenant.trialEndsAt,
    status: tenant.status,
    createdAt: tenant.createdAt,
    updatedAt: tenant.updatedAt,
  }
}

function sanitizePublicTenantConfig(tenant: TenantRecord) {
  const connector = ConnectorRegistry.get(tenant.connectorId)
  return {
    tenantId: tenant.id,
    slug: tenant.slug,
    companyName: tenant.name,
    subtitle: tenant.subtitle,
    logoUrl: tenant.logoUrl,
    primaryColor: tenant.primaryColor,
    enabledModules: tenant.enabledModules,
    segment: tenant.segment,
    connector: {
      id: connector.id,
      name: connector.name,
      labels: connector.labels,
      segments: connector.segments,
      productTypes: connector.getProductTypes(),
      demoData: connector.getDemoData(),
    },
    plan: tenant.plan,
    trialEndsAt: tenant.trialEndsAt,
  }
}

function requireSuperAdmin(req: Request, res: Response, next: NextFunction) {
  void requireAuth(req, res, () => {
    const authReq = req as AuthenticatedRequest
    const explicitSuperAdmins = (process.env.SUPER_ADMIN_USER_IDS ?? '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean)
    const isBootstrapSuperAdmin = authReq.userRole === 'admin' && authReq.tenantId === 'default'
    const isExplicitSuperAdmin = authReq.userRole === 'admin' && explicitSuperAdmins.includes(authReq.userId)
    if (!isBootstrapSuperAdmin && !isExplicitSuperAdmin) {
      return res.status(403).json({ message: 'Acesso restrito a super administradores' })
    }
    next()
  })
}

tenantsRouter.get('/:slug/config', async (req, res) => {
  const tenant = await findTenantBySlug(req.params.slug)
  if (!tenant || tenant.status !== 'active') {
    return res.status(404).json({ message: 'Tenant nao encontrado' })
  }
  res.json(sanitizePublicTenantConfig(tenant))
})

tenantsRouter.get('/current/settings', requireAuth, async (req, res) => {
  const authReq = req as AuthenticatedRequest
  const tenant = await findTenantBySlug(authReq.tenantId)
  if (!tenant) return res.status(404).json({ message: 'Tenant nao encontrado' })
  res.json(sanitizeTenant(tenant))
})

tenantsRouter.put('/current/settings', requireAdmin, async (req, res) => {
  const authReq = req as AuthenticatedRequest
  const current = await findTenantBySlug(authReq.tenantId)
  if (!current) return res.status(404).json({ message: 'Tenant nao encontrado' })

  const parsed = tenantSettingsSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'Dados invalidos' })
  }

  const tenant = await upsertTenant({
    ...current,
    name: parsed.data.name.trim(),
    subtitle: parsed.data.subtitle.trim(),
    logoUrl: parsed.data.logoUrl === undefined ? current.logoUrl : parsed.data.logoUrl,
    primaryColor: parsed.data.primaryColor === undefined ? current.primaryColor : parsed.data.primaryColor,
  })
  logAudit({
    userId: authReq.userId,
    tenantId: authReq.tenantId,
    action: 'tenant_settings_updated',
    resource: 'tenants',
    metadata: { tenantId: tenant.id, slug: tenant.slug },
  })
  res.json(sanitizeTenant(tenant))
})

tenantsRouter.get('/:id/export', requireAdmin, async (req, res) => {
  const authReq = req as AuthenticatedRequest
  if (req.params.id !== authReq.tenantId) {
    return res.status(403).json({ message: 'Export permitido apenas para o tenant atual' })
  }
  const payload = await buildTenantExport(authReq.tenantId)
  logAudit({
    userId: authReq.userId,
    tenantId: authReq.tenantId,
    action: 'tenant_export',
    resource: 'tenants',
    metadata: { tenantId: authReq.tenantId, userCount: payload.counts.users, dsCount: payload.counts.datasources },
  })
  res.setHeader('Content-Disposition', `attachment; filename="iga-tenant-${authReq.tenantId}-${Date.now()}.json"`)
  res.json(payload)
})

tenantsRouter.use(requireSuperAdmin)

tenantsRouter.get('/', async (_req, res) => {
  res.json((await listTenants()).map(sanitizeTenant))
})

tenantsRouter.post('/', async (req, res) => {
  const parsed = tenantSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'Dados invalidos' })
  }

  const slug = parsed.data.slug.trim().toLowerCase()
  const existing = await findTenantBySlug(slug)
  if (existing) return res.status(409).json({ message: 'Ja existe um tenant com este slug' })

  const tenant = await upsertTenant({
    id: genTenantId(slug),
    slug,
    name: parsed.data.name.trim(),
    subtitle: parsed.data.subtitle.trim(),
    logoUrl: parsed.data.logoUrl ?? null,
    primaryColor: parsed.data.primaryColor ?? null,
    connectorId: parsed.data.connectorId,
    segment: parsed.data.segment as TenantRecord['segment'],
    plan: parsed.data.plan,
    trialEndsAt: parsed.data.trialEndsAt ?? null,
    enabledModules: [...new Set(parsed.data.enabledModules)].sort(),
    status: parsed.data.status,
  })
  const authReq = req as unknown as AuthenticatedRequest
  logAudit({ userId: authReq.userId, action: 'tenant_created', resource: 'tenants', metadata: { tenantId: tenant.id, slug } })
  res.status(201).json(sanitizeTenant(tenant))
})

tenantsRouter.put('/:slug', async (req, res) => {
  const current = await findTenantBySlug(req.params.slug)
  if (!current) return res.status(404).json({ message: 'Tenant nao encontrado' })

  const parsed = tenantSchema.partial().safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'Dados invalidos' })
  }

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
    connectorId: parsed.data.connectorId ?? current.connectorId,
    segment: (parsed.data.segment as TenantRecord['segment'] | undefined) ?? current.segment,
    plan: parsed.data.plan ?? current.plan,
    trialEndsAt: parsed.data.trialEndsAt === undefined ? current.trialEndsAt : parsed.data.trialEndsAt,
    enabledModules: parsed.data.enabledModules ? [...new Set(parsed.data.enabledModules)].sort() : current.enabledModules,
    status: parsed.data.status ?? current.status,
  })
  const authReq = req as unknown as AuthenticatedRequest
  logAudit({ userId: authReq.userId, action: 'tenant_updated', resource: 'tenants', metadata: { tenantId: tenant.id, slug: tenant.slug } })
  res.json(sanitizeTenant(tenant))
})

tenantsRouter.delete('/:slug', async (req, res) => {
  const tenant = await findTenantBySlug(req.params.slug)
  if (!tenant) return res.status(404).json({ message: 'Tenant nao encontrado' })
  if (tenant.id === 'default') return res.status(400).json({ message: 'Tenant default nao pode ser excluido' })
  const ok = await deleteTenant(tenant.id)
  if (!ok) return res.status(404).json({ message: 'Tenant nao encontrado' })
  const authReq = req as unknown as AuthenticatedRequest
  logAudit({ userId: authReq.userId, action: 'tenant_deleted', resource: 'tenants', metadata: { tenantId: tenant.id, slug: tenant.slug } })
  res.json({ ok: true })
})
