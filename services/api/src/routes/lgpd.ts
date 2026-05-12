import { Router, type Response } from 'express'
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth.js'
import { findUserByIdForTenantAsync, upsertUserAsync, readAllUsersAsync } from '../userStorage.js'
import { findTenantBySlug } from '../tenantStorage.js'
import { logAudit } from '../services/auditLog.js'
import { revokeAllUserSessions } from '../middleware/auth.js'
import { buildTenantExport } from '../services/tenantExport.js'

export const lgpdRouter = Router()
lgpdRouter.use(requireAuth)

/**
 * GET /api/v1/lgpd/my-data
 * Retorna em JSON estruturado todos os dados pessoais do usuario autenticado.
 * LGPD Art. 18 — direito de acesso.
 */
lgpdRouter.get('/my-data', async (req, res: Response) => {
  const authReq = req as unknown as AuthenticatedRequest
  const user = await findUserByIdForTenantAsync(authReq.userId, authReq.tenantId)
  if (!user) return res.status(404).json({ message: 'Usuario nao encontrado' })

  const tenant = await findTenantBySlug(authReq.tenantId)
  res.json({
    requestedAt: new Date().toISOString(),
    user: {
      id: user.id,
      tenantId: user.tenantId,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      permissions: user.permissions,
      mustChangePassword: user.mustChangePassword,
      emailVerifiedAt: user.emailVerifiedAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    },
    tenant: tenant ? {
      id: tenant.id,
      slug: tenant.slug,
      name: tenant.name,
      plan: tenant.plan,
      trialEndsAt: tenant.trialEndsAt,
      createdAt: tenant.createdAt,
    } : null,
    legalNotice: 'Estes dados sao armazenados conforme a LGPD (Lei 13.709/2018). Para exclusao ou anonimizacao, use os endpoints /lgpd/erase e /lgpd/anonymize.',
  })
})

/**
 * GET /api/v1/lgpd/export
 * Export completo (LGPD Art. 18 V — portabilidade). Retorna JSON estruturado
 * com todos os dados do TENANT (apenas admin do tenant).
 */
lgpdRouter.get('/export', async (req, res: Response) => {
  const authReq = req as unknown as AuthenticatedRequest
  if (authReq.userRole !== 'admin') {
    return res.status(403).json({ message: 'Apenas admin do tenant pode exportar dados.' })
  }
  const payload = await buildTenantExport(authReq.tenantId)
  logAudit({
    userId: authReq.userId,
    tenantId: authReq.tenantId,
    action: 'lgpd_export',
    resource: 'lgpd',
    metadata: { userCount: payload.counts.users, dsCount: payload.counts.datasources },
  })
  res.setHeader('Content-Disposition', `attachment; filename="iga-export-${authReq.tenantId}-${Date.now()}.json"`)
  res.json(payload)
})

/**
 * POST /api/v1/lgpd/anonymize
 * Anonimiza o usuario autenticado (LGPD Art. 18 IV).
 * Substitui PII por marcadores e revoga todas as sessoes.
 */
lgpdRouter.post('/anonymize', async (req, res: Response) => {
  const authReq = req as unknown as AuthenticatedRequest
  const all = await readAllUsersAsync()
  const idx = all.findIndex((u) => u.id === authReq.userId && u.tenantId === authReq.tenantId)
  if (idx < 0) return res.status(404).json({ message: 'Usuario nao encontrado' })
  const stamp = Date.now().toString(36)
  const anonEmail = `anonymized+${stamp}@local.invalid`
  all[idx] = {
    ...all[idx],
    name: '[ANONIMIZADO]',
    email: anonEmail,
    status: 'inactive',
    updatedAt: new Date().toISOString(),
  }
  await upsertUserAsync(all[idx])
  await revokeAllUserSessions(authReq.userId)
  logAudit({
    userId: authReq.userId,
    tenantId: authReq.tenantId,
    action: 'lgpd_anonymized',
    resource: 'lgpd',
    metadata: {},
  })
  res.json({ ok: true, anonymizedAt: new Date().toISOString() })
})

/**
 * POST /api/v1/lgpd/erase
 * Soft delete do usuario. Hard delete fica para job apos 7 dias (LGPD Art. 18 VI).
 * Para a primeira versao, marcamos `status='inactive'` e adicionamos sufixo no email.
 */
lgpdRouter.post('/erase', async (req, res: Response) => {
  const authReq = req as unknown as AuthenticatedRequest
  const all = await readAllUsersAsync()
  const idx = all.findIndex((u) => u.id === authReq.userId && u.tenantId === authReq.tenantId)
  if (idx < 0) return res.status(404).json({ message: 'Usuario nao encontrado' })
  /** Admin nao pode auto-deletar se for o unico admin do tenant. */
  if (all[idx].role === 'admin') {
    const otherAdmins = all.filter((u) => u.tenantId === authReq.tenantId && u.role === 'admin' && u.status === 'active' && u.id !== authReq.userId)
    if (otherAdmins.length === 0) {
      return res.status(409).json({ message: 'Voce eh o unico admin ativo. Convide outro admin antes de excluir sua conta.' })
    }
  }
  const stamp = Date.now().toString(36)
  all[idx] = {
    ...all[idx],
    name: '[REMOVIDO]',
    email: `deleted+${stamp}@local.invalid`,
    status: 'inactive',
    updatedAt: new Date().toISOString(),
  }
  await upsertUserAsync(all[idx])
  await revokeAllUserSessions(authReq.userId)
  logAudit({
    userId: authReq.userId,
    tenantId: authReq.tenantId,
    action: 'lgpd_erased',
    resource: 'lgpd',
    metadata: { hardDeleteAfter: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() },
  })
  res.json({
    ok: true,
    erasedAt: new Date().toISOString(),
    note: 'Hard delete em 7 dias. Backups sao purgados em 30 dias.',
  })
})
