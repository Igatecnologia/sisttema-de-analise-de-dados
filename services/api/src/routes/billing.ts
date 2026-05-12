import { Router, type Request, type Response } from 'express'
import express from 'express'
import { z } from 'zod'
import { requireAuth, requireAdmin, type AuthenticatedRequest } from '../middleware/auth.js'
import { findTenantBySlug } from '../tenantStorage.js'
import { findUserByIdForTenantAsync } from '../userStorage.js'
import {
  createCheckoutSession,
  createPortalSession,
  constructWebhookEvent,
  isStripeEnabled,
  mapStripeStatus,
} from '../services/stripeBilling.js'
import { evaluateAccess, getSubscription, upsertSubscription } from '../services/subscriptionStore.js'
import { logAudit } from '../services/auditLog.js'
import type Stripe from 'stripe'
import { getPlanUsageSummary } from '../services/planLimits.js'
import { getDb } from '../db/sqlite.js'
import { getPostgresPool, hasPostgresConfig } from '../db/postgres.js'

const sqlite = getDb()

function usePostgresStorage(): boolean {
  return process.env.IGA_STORAGE_DRIVER === 'postgres' && hasPostgresConfig()
}

/**
 * Reserva idempotente do evento de webhook. Retorna `true` se este é o primeiro
 * processamento do event_id (segue adiante), `false` se já foi processado (caller
 * deve responder 200 OK sem reprocessar). Em caso de erro de DB, log e retorna
 * true (fail-open: melhor processar duas vezes que cair em loop infinito).
 */
export async function reserveWebhookEvent(eventId: string, source: string, eventType: string): Promise<boolean> {
  const now = new Date().toISOString()
  try {
    if (usePostgresStorage()) {
      const result = await getPostgresPool().query(
        `INSERT INTO processed_webhook_events (event_id, source, event_type, processed_at)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (event_id) DO NOTHING`,
        [eventId, source, eventType, now],
      )
      return (result.rowCount ?? 0) > 0
    }
    const result = sqlite.prepare(
      `INSERT OR IGNORE INTO processed_webhook_events (event_id, source, event_type, processed_at)
       VALUES (?, ?, ?, ?)`,
    ).run(eventId, source, eventType, now)
    return result.changes > 0
  } catch (err) {
    console.warn('[billing] reserveWebhookEvent falhou, fail-open:', err)
    return true
  }
}

export const billingRouter = Router()

billingRouter.get('/status', requireAuth, async (req: Request, res: Response) => {
  const authReq = req as unknown as AuthenticatedRequest
  const tenant = await findTenantBySlug(authReq.tenantId)
  const subscription = await getSubscription(authReq.tenantId)
  const verdict = evaluateAccess({ trialEndsAt: tenant?.trialEndsAt ?? null, subscription })
  const usageSummary = await getPlanUsageSummary(authReq.tenantId)
  res.json({
    plan: subscription?.plan ?? tenant?.plan ?? 'trial',
    status: subscription?.status ?? (verdict.allowed ? 'trialing' : 'trial_expired'),
    trialEndsAt: tenant?.trialEndsAt ?? null,
    currentPeriodEnd: subscription?.currentPeriodEnd ?? null,
    cancelAtPeriodEnd: subscription?.cancelAtPeriodEnd ?? false,
    access: verdict,
    stripeEnabled: isStripeEnabled(),
    limits: usageSummary.limits,
    usage: usageSummary.usage,
  })
})

const checkoutSchema = z.object({ plan: z.enum(['pro', 'enterprise']) })

billingRouter.post('/checkout-session', requireAdmin, async (req, res: Response) => {
  if (!isStripeEnabled()) return res.status(503).json({ message: 'Pagamento nao configurado' })
  const authReq = req as unknown as AuthenticatedRequest
  const parsed = checkoutSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'Plano invalido' })
  const user = await findUserByIdForTenantAsync(authReq.userId, authReq.tenantId)
  if (!user) return res.status(404).json({ message: 'Usuario nao encontrado' })
  const subscription = await getSubscription(authReq.tenantId)

  const successUrl = (process.env.BILLING_SUCCESS_URL?.trim() || `${process.env.FRONTEND_URL ?? ''}/billing/sucesso`) + '?session_id={CHECKOUT_SESSION_ID}'
  const cancelUrl = process.env.BILLING_CANCEL_URL?.trim() || `${process.env.FRONTEND_URL ?? ''}/billing/cancelado`

  try {
    const session = await createCheckoutSession({
      tenantId: authReq.tenantId,
      customerEmail: user.email,
      plan: parsed.data.plan,
      successUrl,
      cancelUrl,
      existingCustomerId: subscription?.stripeCustomerId,
    })
    logAudit({ userId: authReq.userId, action: 'billing_checkout_started', resource: 'billing', metadata: { tenantId: authReq.tenantId, plan: parsed.data.plan, sessionId: session.id } })
    res.json({ url: session.url, sessionId: session.id })
  } catch (err) {
    res.status(502).json({ message: err instanceof Error ? err.message : 'Falha ao criar checkout' })
  }
})

billingRouter.post('/portal-link', requireAdmin, async (req, res: Response) => {
  if (!isStripeEnabled()) return res.status(503).json({ message: 'Pagamento nao configurado' })
  const authReq = req as unknown as AuthenticatedRequest
  const subscription = await getSubscription(authReq.tenantId)
  if (!subscription?.stripeCustomerId) return res.status(400).json({ message: 'Tenant sem customer Stripe ainda' })
  const returnUrl = process.env.BILLING_PORTAL_RETURN_URL?.trim() || `${process.env.FRONTEND_URL ?? ''}/billing`
  try {
    const session = await createPortalSession({ customerId: subscription.stripeCustomerId, returnUrl })
    res.json({ url: session.url })
  } catch (err) {
    res.status(502).json({ message: err instanceof Error ? err.message : 'Falha ao abrir portal' })
  }
})

/**
 * Webhook Stripe — registra subscriptions baseado em eventos.
 * IMPORTANTE: precisa de raw body parser (configurado em app.ts antes do JSON global).
 */
export const stripeWebhookRouter = Router()
stripeWebhookRouter.post(
  '/webhook',
  express.raw({ type: 'application/json' }),
  async (req: Request, res: Response) => {
    if (!isStripeEnabled()) return res.status(503).end()
    const signature = req.headers['stripe-signature']
    if (typeof signature !== 'string' || !signature) {
      return res.status(400).json({ message: 'Assinatura ausente' })
    }
    let event: Stripe.Event
    try {
      event = constructWebhookEvent(req.body as Buffer, signature)
    } catch (err) {
      return res.status(400).json({ message: `Webhook signature invalido: ${err instanceof Error ? err.message : 'erro'}` })
    }

    /** Idempotencia: se o Stripe re-enviar o mesmo event.id (retry de timeout),
     * pulamos o reprocessamento e respondemos 200 OK para nao gerar duplicacao
     * em subscriptions/audit logs. */
    const firstTime = await reserveWebhookEvent(event.id, 'stripe', event.type)
    if (!firstTime) {
      return res.json({ received: true, duplicate: true })
    }

    try {
      switch (event.type) {
        case 'checkout.session.completed': {
          const session = event.data.object as Stripe.Checkout.Session
          const tenantId = session.metadata?.tenantId ?? session.client_reference_id
          const plan = session.metadata?.plan ?? 'pro'
          if (tenantId) {
            await upsertSubscription({
              tenantId,
              plan,
              status: 'active',
              stripeCustomerId: typeof session.customer === 'string' ? session.customer : null,
              stripeSubscriptionId: typeof session.subscription === 'string' ? session.subscription : null,
            })
          }
          break
        }
        case 'customer.subscription.created':
        case 'customer.subscription.updated': {
          const sub = event.data.object as Stripe.Subscription
          const tenantId = sub.metadata?.tenantId
          if (tenantId) {
            const item = sub.items.data[0]
            // current_period_end existe em runtime mas pode estar typado como any em algumas versoes
            const periodEndUnix = (sub as unknown as { current_period_end?: number }).current_period_end
              ?? (item as unknown as { current_period_end?: number })?.current_period_end
            await upsertSubscription({
              tenantId,
              plan: sub.metadata?.plan ?? 'pro',
              status: mapStripeStatus(sub.status),
              stripeCustomerId: typeof sub.customer === 'string' ? sub.customer : null,
              stripeSubscriptionId: sub.id,
              currentPeriodEnd: typeof periodEndUnix === 'number'
                ? new Date(periodEndUnix * 1000).toISOString()
                : null,
              cancelAtPeriodEnd: sub.cancel_at_period_end ?? false,
            })
          }
          break
        }
        case 'customer.subscription.deleted': {
          const sub = event.data.object as Stripe.Subscription
          const tenantId = sub.metadata?.tenantId
          if (tenantId) {
            await upsertSubscription({
              tenantId,
              plan: sub.metadata?.plan ?? 'pro',
              status: 'canceled',
              stripeCustomerId: typeof sub.customer === 'string' ? sub.customer : null,
              stripeSubscriptionId: sub.id,
              cancelAtPeriodEnd: true,
            })
          }
          break
        }
        case 'invoice.payment_failed': {
          const invoice = event.data.object as Stripe.Invoice
          const subId = (invoice as unknown as { subscription?: string }).subscription
          if (typeof subId === 'string') {
            /** Move pra grace de 7 dias — frontend mostra banner. */
            const tenantId = invoice.metadata?.tenantId
            if (tenantId) {
              const grace = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
              await upsertSubscription({
                tenantId,
                plan: invoice.metadata?.plan ?? 'pro',
                status: 'grace',
                stripeSubscriptionId: subId,
                graceUntil: grace,
              })
            }
          }
          break
        }
        default:
          /** Eventos nao manipulados sao 2xx para nao re-enviar indefinidamente. */
          break
      }
      res.json({ received: true })
    } catch (err) {
      logAudit({ action: 'billing_webhook_error', resource: 'billing', metadata: { event: event.type, error: err instanceof Error ? err.message : 'erro' } })
      res.status(500).json({ message: 'Erro ao processar webhook' })
    }
  },
)
