import { Router, type Response } from 'express'
import { z } from 'zod'
import { requireAdmin, requireAuth, type AuthenticatedRequest } from '../middleware/auth.js'
import { resolveTenantId } from '../utils/tenant.js'
import { validateExternalApiUrl } from '../utils/urlSafety.js'
import {
  createWebhookSubscription,
  deleteWebhookSubscription,
  listWebhookDeliveries,
  listWebhookSubscriptions,
  updateWebhookSubscription,
  type WebhookEventType,
} from '../services/webhookStore.js'
import { dispatchWebhook } from '../services/webhookDispatcher.js'

export const webhooksRouter = Router()
webhooksRouter.use(requireAuth, requireAdmin)

const eventTypes = [
  'datasource.connected',
  'datasource.failed',
  'billing.updated',
  'tenant.updated',
  'report.generated',
] as const

const webhookBodySchema = z.object({
  name: z.string().min(1).max(120),
  url: z.string().url().max(600),
  eventTypes: z.array(z.enum(eventTypes)).min(1).max(eventTypes.length),
  active: z.boolean().default(true),
})

function publicSubscription<T extends { signingSecret: string }>(item: T) {
  const { signingSecret, ...rest } = item
  return { ...rest, signingSecretPreview: `${signingSecret.slice(0, 10)}...` }
}

webhooksRouter.get('/', async (req, res) => {
  const tenantId = resolveTenantId(req)
  const subscriptions = await listWebhookSubscriptions(tenantId)
  res.json({ subscriptions: subscriptions.map(publicSubscription), eventTypes })
})

webhooksRouter.post('/', async (req, res: Response) => {
  const tenantId = resolveTenantId(req)
  const parsed = webhookBodySchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'Dados invalidos' })
  const safety = validateExternalApiUrl(parsed.data.url)
  if (!safety.ok) return res.status(400).json({ message: safety.message })
  const subscription = await createWebhookSubscription({ tenantId, ...parsed.data })
  res.status(201).json(publicSubscription(subscription))
})

webhooksRouter.put('/:id', async (req, res: Response) => {
  const tenantId = resolveTenantId(req)
  const parsed = webhookBodySchema.partial().safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'Dados invalidos' })
  if (parsed.data.url) {
    const safety = validateExternalApiUrl(parsed.data.url)
    if (!safety.ok) return res.status(400).json({ message: safety.message })
  }
  const subscription = await updateWebhookSubscription(tenantId, req.params.id, parsed.data)
  if (!subscription) return res.status(404).json({ message: 'Webhook nao encontrado' })
  res.json(publicSubscription(subscription))
})

webhooksRouter.delete('/:id', async (req, res) => {
  const tenantId = resolveTenantId(req)
  await deleteWebhookSubscription(tenantId, req.params.id)
  res.json({ ok: true })
})

webhooksRouter.get('/deliveries/recent', async (req, res) => {
  const tenantId = resolveTenantId(req)
  res.json({ deliveries: await listWebhookDeliveries(tenantId) })
})

webhooksRouter.post('/:id/test', async (req, res: Response) => {
  const tenantId = resolveTenantId(req)
  const authReq = req as unknown as AuthenticatedRequest
  const subscriptions = await listWebhookSubscriptions(tenantId)
  const subscription = subscriptions.find((item) => item.id === req.params.id)
  if (!subscription) return res.status(404).json({ message: 'Webhook nao encontrado' })
  if (!subscription.active) return res.status(409).json({ message: 'Webhook inativo' })
  const eventType = (subscription.eventTypes[0] ?? 'tenant.updated') as WebhookEventType
  const delivery = await dispatchWebhook(subscription, eventType)
  res.status(202).json({ delivery, requestedBy: authReq.userId })
})
