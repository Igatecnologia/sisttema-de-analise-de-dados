import {
  createWebhookDelivery,
  findWebhookDelivery,
  findWebhookSubscription,
  signWebhookPayload,
  updateWebhookDelivery,
  type WebhookDelivery,
  type WebhookEventType,
  type WebhookSubscription,
} from './webhookStore.js'

const MAX_ATTEMPTS = 4
const BASE_DELAY_MS = 5_000

function nextDelayMs(attempts: number): number {
  return BASE_DELAY_MS * 2 ** Math.max(0, attempts - 1)
}

async function send(subscription: WebhookSubscription, delivery: WebhookDelivery) {
  const payload = JSON.stringify({
    id: delivery.id,
    type: delivery.eventType,
    tenantId: delivery.tenantId,
    createdAt: delivery.createdAt,
  })
  const signature = signWebhookPayload(subscription.signingSecret, payload)
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10_000)
  try {
    const response = await fetch(subscription.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-IGA-Webhook-Id': delivery.id,
        'X-IGA-Webhook-Event': delivery.eventType,
        'X-IGA-Webhook-Signature': `sha256=${signature}`,
      },
      body: payload,
      signal: controller.signal,
    })
    clearTimeout(timeout)
    if (response.ok) {
      await updateWebhookDelivery(delivery.tenantId, delivery.id, {
        status: 'success',
        attempts: delivery.attempts + 1,
        statusCode: response.status,
        error: null,
        nextAttemptAt: null,
      })
      return
    }
    throw new Error(`HTTP ${response.status}`)
  } catch (err) {
    clearTimeout(timeout)
    const attempts = delivery.attempts + 1
    const failed = attempts >= MAX_ATTEMPTS
    const delay = nextDelayMs(attempts)
    const nextAttemptAt = failed ? null : new Date(Date.now() + delay).toISOString()
    await updateWebhookDelivery(delivery.tenantId, delivery.id, {
      status: failed ? 'failed' : 'pending',
      attempts,
      statusCode: null,
      error: err instanceof Error ? err.message : 'Falha ao entregar webhook',
      nextAttemptAt,
    })
    if (!failed) {
      setTimeout(() => {
        void retryWebhookDelivery(delivery.tenantId, subscription.id, delivery.id)
      }, delay)
    }
  }
}

export async function dispatchWebhook(subscription: WebhookSubscription, eventType: WebhookEventType) {
  const delivery = await createWebhookDelivery({
    tenantId: subscription.tenantId,
    subscriptionId: subscription.id,
    eventType,
  })
  void send(subscription, delivery)
  return delivery
}

export async function retryWebhookDelivery(tenantId: string, subscriptionId: string, deliveryId: string) {
  const subscription = await findWebhookSubscription(tenantId, subscriptionId)
  if (!subscription || !subscription.active) return
  const delivery = await findWebhookDelivery(tenantId, deliveryId)
  if (!delivery || delivery.status === 'success') return
  await send(subscription, delivery)
}
