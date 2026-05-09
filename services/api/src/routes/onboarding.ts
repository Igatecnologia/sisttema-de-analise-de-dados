import { Router } from 'express'
import { z } from 'zod'
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth.js'
import { getTenantOnboarding, upsertTenantOnboarding } from '../onboardingStorage.js'

export const onboardingRouter = Router()

const onboardingSchema = z.object({
  companyProfile: z.record(z.string(), z.unknown()).default({}),
  dataSetup: z.record(z.string(), z.unknown()).default({}),
  teamInvites: z.array(z.string().email().max(254)).default([]),
  status: z.enum(['pending', 'in_progress', 'completed']).default('in_progress'),
  importStatus: z.enum(['idle', 'running', 'completed', 'failed']).default('idle'),
  importProgress: z.number().int().min(0).max(100).default(0),
})

onboardingRouter.use(requireAuth)

onboardingRouter.get('/', async (req, res) => {
  const authReq = req as AuthenticatedRequest
  res.json(await getTenantOnboarding(authReq.tenantId))
})

onboardingRouter.post('/', async (req, res) => {
  const authReq = req as AuthenticatedRequest
  const parsed = onboardingSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'Dados invalidos' })
  }
  const record = await upsertTenantOnboarding({
    tenantId: authReq.tenantId,
    ...parsed.data,
  })
  res.status(201).json(record)
})

onboardingRouter.post('/start-import', async (req, res) => {
  const authReq = req as AuthenticatedRequest
  const current = await getTenantOnboarding(authReq.tenantId)
  const record = await upsertTenantOnboarding({
    ...current,
    status: 'in_progress',
    importStatus: 'running',
    importProgress: Math.max(current.importProgress, 15),
  })
  res.json(record)
})

onboardingRouter.get('/import-status', async (req, res) => {
  const authReq = req as AuthenticatedRequest
  const current = await getTenantOnboarding(authReq.tenantId)
  if (current.importStatus !== 'running') return res.json(current)
  const nextProgress = Math.min(100, current.importProgress + 18)
  const record = await upsertTenantOnboarding({
    ...current,
    status: nextProgress >= 100 ? 'completed' : 'in_progress',
    importStatus: nextProgress >= 100 ? 'completed' : 'running',
    importProgress: nextProgress,
  })
  res.json(record)
})

