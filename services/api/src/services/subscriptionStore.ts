/**
 * Subscription store (S5) — estado do plano por tenant.
 *
 * Status (Stripe-aligned):
 *   trialing | active | past_due | canceled | incomplete | unpaid | grace
 *
 * Tenant em trial usa o `trial_ends_at` da tabela tenants. Subscription real
 * surge quando o tenant assina via Stripe Checkout (webhook customer.subscription.created).
 */
import { getDb } from '../db/sqlite.js'
import { getPostgresPool, hasPostgresConfig } from '../db/postgres.js'

const db = getDb()

function usePostgresStorage(): boolean {
  return process.env.IGA_STORAGE_DRIVER === 'postgres' && hasPostgresConfig()
}

export type SubscriptionStatus =
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'incomplete'
  | 'unpaid'
  | 'grace'

export type SubscriptionRecord = {
  tenantId: string
  plan: string
  status: SubscriptionStatus
  stripeCustomerId: string | null
  stripeSubscriptionId: string | null
  currentPeriodEnd: string | null
  cancelAtPeriodEnd: boolean
  graceUntil: string | null
  createdAt: string
  updatedAt: string
}

type Row = {
  tenant_id: string
  plan: string
  status: string
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  current_period_end: string | null
  cancel_at_period_end: number | boolean
  grace_until: string | null
  created_at: string
  updated_at: string
}

function mapRow(row: Row): SubscriptionRecord {
  return {
    tenantId: row.tenant_id,
    plan: row.plan,
    status: row.status as SubscriptionStatus,
    stripeCustomerId: row.stripe_customer_id,
    stripeSubscriptionId: row.stripe_subscription_id,
    currentPeriodEnd: row.current_period_end,
    cancelAtPeriodEnd: row.cancel_at_period_end === true || row.cancel_at_period_end === 1,
    graceUntil: row.grace_until,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function getSubscription(tenantId: string): Promise<SubscriptionRecord | null> {
  if (usePostgresStorage()) {
    const result = await getPostgresPool().query<Row>(
      `SELECT tenant_id, plan, status, stripe_customer_id, stripe_subscription_id,
        current_period_end::text AS current_period_end, cancel_at_period_end,
        grace_until::text AS grace_until, created_at::text AS created_at, updated_at::text AS updated_at
       FROM subscriptions WHERE tenant_id = $1`,
      [tenantId],
    )
    return result.rows[0] ? mapRow(result.rows[0]) : null
  }
  const row = db.prepare('SELECT * FROM subscriptions WHERE tenant_id = ?').get(tenantId) as Row | undefined
  return row ? mapRow(row) : null
}

export async function upsertSubscription(input: {
  tenantId: string
  plan: string
  status: SubscriptionStatus
  stripeCustomerId?: string | null
  stripeSubscriptionId?: string | null
  currentPeriodEnd?: string | null
  cancelAtPeriodEnd?: boolean
  graceUntil?: string | null
}): Promise<void> {
  const now = new Date().toISOString()
  const cancelFlag = input.cancelAtPeriodEnd === true
  if (usePostgresStorage()) {
    await getPostgresPool().query(
      `INSERT INTO subscriptions (tenant_id, plan, status, stripe_customer_id, stripe_subscription_id,
        current_period_end, cancel_at_period_end, grace_until, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)
       ON CONFLICT (tenant_id) DO UPDATE SET
         plan = EXCLUDED.plan,
         status = EXCLUDED.status,
         stripe_customer_id = EXCLUDED.stripe_customer_id,
         stripe_subscription_id = EXCLUDED.stripe_subscription_id,
         current_period_end = EXCLUDED.current_period_end,
         cancel_at_period_end = EXCLUDED.cancel_at_period_end,
         grace_until = EXCLUDED.grace_until,
         updated_at = $9`,
      [
        input.tenantId,
        input.plan,
        input.status,
        input.stripeCustomerId ?? null,
        input.stripeSubscriptionId ?? null,
        input.currentPeriodEnd ?? null,
        cancelFlag,
        input.graceUntil ?? null,
        now,
      ],
    )
    return
  }
  db.prepare(
    `INSERT INTO subscriptions (tenant_id, plan, status, stripe_customer_id, stripe_subscription_id,
       current_period_end, cancel_at_period_end, grace_until, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(tenant_id) DO UPDATE SET
       plan = excluded.plan,
       status = excluded.status,
       stripe_customer_id = excluded.stripe_customer_id,
       stripe_subscription_id = excluded.stripe_subscription_id,
       current_period_end = excluded.current_period_end,
       cancel_at_period_end = excluded.cancel_at_period_end,
       grace_until = excluded.grace_until,
       updated_at = excluded.updated_at`,
  ).run(
    input.tenantId,
    input.plan,
    input.status,
    input.stripeCustomerId ?? null,
    input.stripeSubscriptionId ?? null,
    input.currentPeriodEnd ?? null,
    cancelFlag ? 1 : 0,
    input.graceUntil ?? null,
    now,
    now,
  )
}

/** Status efetivo para gating: considera trial do tenant + subscription. */
export type AccessVerdict =
  | { allowed: true; reason: 'active' | 'trialing' | 'grace' }
  | { allowed: false; reason: 'trial_expired' | 'subscription_inactive'; trialEndsAt?: string | null; status?: SubscriptionStatus }

export function evaluateAccess(input: {
  trialEndsAt: string | null | undefined
  subscription: SubscriptionRecord | null
}): AccessVerdict {
  const sub = input.subscription
  if (sub) {
    if (sub.status === 'active' || sub.status === 'trialing') return { allowed: true, reason: sub.status }
    if (sub.status === 'grace' && sub.graceUntil && Date.parse(sub.graceUntil) > Date.now()) return { allowed: true, reason: 'grace' }
    return { allowed: false, reason: 'subscription_inactive', status: sub.status }
  }
  /** Sem subscription registrada: cai no trial do tenant. */
  if (input.trialEndsAt && Date.parse(input.trialEndsAt) > Date.now()) {
    return { allowed: true, reason: 'trialing' }
  }
  return { allowed: false, reason: 'trial_expired', trialEndsAt: input.trialEndsAt ?? null }
}
