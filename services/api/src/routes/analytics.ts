import { Router } from 'express'
import { z } from 'zod'
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth.js'
import { tenantRateLimit } from '../middleware/tenantRateLimit.js'
import { logInfo } from '../services/structuredLog.js'

/**
 * OPS-4 — Analytics events.
 * Frontend envia eventos via POST. Backend apenas LOGA estruturado (sem persistir).
 * Operacional faz ETL do log para PostHog/Datadog/Mixpanel/etc.
 */

export const analyticsRouter = Router()

const eventNameRegex = /^[a-z][a-z0-9_]*$/i

const eventSchema = z.object({
  name: z.string().min(1).max(80),
  props: z.record(z.string(), z.unknown()).optional(),
  /** Timestamp client — aceito mas backend reescreve com seu proprio relogio. */
  timestamp: z.string().datetime().optional(),
})

const tenantAnalyticsLimiter = tenantRateLimit({
  namespace: 'analytics-events',
  windowMs: 60_000,
  max: 60,
})

analyticsRouter.use(requireAuth)
analyticsRouter.use(tenantAnalyticsLimiter)

analyticsRouter.post('/event', (req, res) => {
  const parsed = eventSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'Evento invalido' })
  }
  if (!eventNameRegex.test(parsed.data.name)) {
    return res.status(400).json({ message: 'name deve ser snake_case (a-z, 0-9, _)' })
  }
  const authReq = req as AuthenticatedRequest
  logInfo('analytics.event', {
    name: parsed.data.name,
    props: parsed.data.props ?? {},
    userId: authReq.userId,
    tenantId: authReq.tenantId,
    receivedAt: new Date().toISOString(),
  })
  res.status(204).end()
})
