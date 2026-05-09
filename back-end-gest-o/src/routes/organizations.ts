import { Router } from 'express'
import { requireAdmin, requireAuth, type AuthenticatedRequest } from '../middleware/auth.js'
import { findTenantBySlug, listTenants, type TenantRecord } from '../tenantStorage.js'

export const organizationsRouter = Router()
organizationsRouter.use(requireAuth)

function sanitizeOrganization(tenant: TenantRecord) {
  return {
    id: tenant.id,
    slug: tenant.slug,
    name: tenant.name,
    subtitle: tenant.subtitle,
    logoUrl: tenant.logoUrl,
    plan: tenant.plan,
    status: tenant.status,
    current: false,
    createdAt: tenant.createdAt,
  }
}

organizationsRouter.get('/', async (req, res) => {
  const authReq = req as AuthenticatedRequest
  if (authReq.userRole === 'admin' && authReq.tenantId === 'default') {
    const tenants = await listTenants()
    return res.json(tenants.map((tenant) => ({
      ...sanitizeOrganization(tenant),
      current: tenant.slug === authReq.tenantId || tenant.id === authReq.tenantId,
    })))
  }
  const current = await findTenantBySlug(authReq.tenantId)
  if (!current) return res.status(404).json({ message: 'Organizacao atual nao encontrada' })
  res.json([{ ...sanitizeOrganization(current), current: true }])
})

organizationsRouter.post('/:slug/switch', requireAdmin, async (req, res) => {
  const tenant = await findTenantBySlug(String(req.params.slug))
  if (!tenant || tenant.status !== 'active') return res.status(404).json({ message: 'Organizacao nao encontrada' })
  res.json({ tenantId: tenant.id, slug: tenant.slug, message: 'Troca de organizacao requer nova sessao neste tenant.' })
})
