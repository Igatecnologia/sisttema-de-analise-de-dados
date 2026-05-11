import {
  createWebhookDelivery,
  findWebhookDelivery,
  findWebhookSubscription,
  listPendingRetries,
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
  /**
   * SEC: assinatura com timestamp + payload (estilo Stripe). O receiver deve:
   *   1) ler X-IGA-Webhook-Timestamp e rejeitar se |now - timestamp| > tolerancia (ex: 5min)
   *   2) recalcular HMAC sobre `timestamp.payload` e comparar com X-IGA-Webhook-Signature
   * Isso bloqueia replay com payload capturado e protege contra clock skew.
   */
  const timestamp = Math.floor(Date.now() / 1000)
  const signature = signWebhookPayload(subscription.signingSecret, payload, timestamp)
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10_000)
  try {
    const response = await fetch(subscription.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-IGA-Webhook-Id': delivery.id,
        'X-IGA-Webhook-Event': delivery.eventType,
        'X-IGA-Webhook-Timestamp': String(timestamp),
        'X-IGA-Webhook-Signature': `t=${timestamp},sha256=${signature}`,
        // Idempotencia: receiver deve dedupar por este id se enxergar o mesmo
        // numa janela curta (retry duplicado, ex: timeout + processo seguinte).
        'Idempotency-Key': delivery.id,
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

// ── Recovery loop ───────────────────────────────────────────────────────────
//
// Os retries usam setTimeout no processo atual — se o servidor reinicia entre
// tentativas, a entrega fica "presa" com nextAttemptAt no passado. Esse loop
// varre periodicamente e re-dispara as elegiveis. Idempotency-Key garante que
// um receiver bem implementado nao processa o evento duas vezes.
const RECOVERY_INTERVAL_MS = 60_000
let recoveryTimer: NodeJS.Timeout | null = null

async function recoverPendingDeliveries() {
  try {
    const pending = await listPendingRetries()
    for (const delivery of pending) {
      const subscription = await findWebhookSubscription(delivery.tenantId, delivery.subscriptionId)
      if (!subscription || !subscription.active) continue
      // Re-dispara sem await pra nao serializar tudo num tick — send tem timeout proprio.
      void send(subscription, delivery)
    }
  } catch (err) {
    // Loop nao pode quebrar — qualquer erro fica logado e tentamos de novo no proximo tick.
    // eslint-disable-next-line no-console
    console.warn('[webhook] recovery scan falhou:', err instanceof Error ? err.message : err)
  }
}

export function startWebhookRecoveryLoop(): void {
  if (recoveryTimer) return
  // Primeira execucao em 5s pra capturar deliveries que estavam pendentes
  // quando o processo subiu, depois cada 60s.
  setTimeout(() => { void recoverPendingDeliveries() }, 5_000)
  recoveryTimer = setInterval(() => { void recoverPendingDeliveries() }, RECOVERY_INTERVAL_MS)
  if (typeof recoveryTimer.unref === 'function') recoveryTimer.unref()
}

export function stopWebhookRecoveryLoop(): void {
  if (recoveryTimer) {
    clearInterval(recoveryTimer)
    recoveryTimer = null
  }
}

export async function retryWebhookDelivery(tenantId: string, subscriptionId: string, deliveryId: string) {
  const subscription = await findWebhookSubscription(tenantId, subscriptionId)
  if (!subscription || !subscription.active) return
  const delivery = await findWebhookDelivery(tenantId, deliveryId)
  if (!delivery || delivery.status === 'success') return
  await send(subscription, delivery)
}
