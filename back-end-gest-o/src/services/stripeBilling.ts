/**
 * Integracao Stripe (S5) — apenas as funcoes essenciais para checkout, portal e webhook.
 *
 * Configuracao:
 *   STRIPE_SECRET_KEY        — chave server-side (sk_...)
 *   STRIPE_WEBHOOK_SECRET    — para validar webhooks
 *   STRIPE_PRICE_PRO         — price_id do plano Pro
 *   STRIPE_PRICE_ENTERPRISE  — price_id do plano Enterprise (opcional)
 *   BILLING_SUCCESS_URL      — redirect pos-pagamento (ex.: https://app.../billing/sucesso)
 *   BILLING_CANCEL_URL       — redirect cancelamento
 */
import Stripe from 'stripe'

let stripeClient: Stripe | null = null

export function isStripeEnabled(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim())
}

export function getStripe(): Stripe {
  if (!isStripeEnabled()) throw new Error('STRIPE_SECRET_KEY ausente')
  if (!stripeClient) {
    stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY!.trim())
  }
  return stripeClient
}

export function priceIdForPlan(plan: string): string | null {
  if (plan === 'pro') return process.env.STRIPE_PRICE_PRO?.trim() ?? null
  if (plan === 'enterprise') return process.env.STRIPE_PRICE_ENTERPRISE?.trim() ?? null
  return null
}

export async function createCheckoutSession(input: {
  tenantId: string
  customerEmail: string
  plan: string
  successUrl: string
  cancelUrl: string
  existingCustomerId?: string | null
}): Promise<Stripe.Checkout.Session> {
  const price = priceIdForPlan(input.plan)
  if (!price) throw new Error(`Plano nao suportado: ${input.plan}`)
  return getStripe().checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price, quantity: 1 }],
    ...(input.existingCustomerId
      ? { customer: input.existingCustomerId }
      : { customer_email: input.customerEmail }),
    client_reference_id: input.tenantId,
    metadata: { tenantId: input.tenantId, plan: input.plan },
    subscription_data: { metadata: { tenantId: input.tenantId, plan: input.plan } },
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    allow_promotion_codes: true,
  })
}

export async function createPortalSession(input: { customerId: string; returnUrl: string }): Promise<Stripe.BillingPortal.Session> {
  return getStripe().billingPortal.sessions.create({
    customer: input.customerId,
    return_url: input.returnUrl,
  })
}

export function constructWebhookEvent(rawBody: Buffer, signature: string): Stripe.Event {
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim()
  if (!secret) throw new Error('STRIPE_WEBHOOK_SECRET ausente')
  return getStripe().webhooks.constructEvent(rawBody, signature, secret)
}

/** Mapeia status do Stripe para o nosso enum interno. */
export function mapStripeStatus(stripeStatus: Stripe.Subscription.Status): import('./subscriptionStore.js').SubscriptionStatus {
  switch (stripeStatus) {
    case 'active':
      return 'active'
    case 'trialing':
      return 'trialing'
    case 'past_due':
      return 'past_due'
    case 'canceled':
      return 'canceled'
    case 'incomplete':
    case 'incomplete_expired':
      return 'incomplete'
    case 'unpaid':
      return 'unpaid'
    case 'paused':
      return 'canceled'
    default:
      return 'incomplete'
  }
}
