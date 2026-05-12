/**
 * T-A2 (audit 2026-05-12): cobertura do Stripe webhook — idempotência +
 * mapeamento de status. Roda contra SQLite local (sem REDIS_URL nem Postgres).
 *
 * Escopo:
 *  - reserveWebhookEvent: 1ª vez retorna true (processa), 2ª retorna false
 *    (Stripe re-envia em retries — não pode duplicar subscription)
 *  - reserveWebhookEvent: events com event_id diferente são independentes
 *  - mapStripeStatus: cobre os 8 status do Stripe + default
 *  - mapStripeStatus: garante que statuses críticos (canceled, past_due)
 *    não viram 'active' por engano
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { randomBytes } from 'node:crypto'
import { reserveWebhookEvent } from './billing.js'
import { mapStripeStatus } from '../services/stripeBilling.js'

function makeEventId(prefix = 'evt_test'): string {
  return `${prefix}_${randomBytes(8).toString('hex')}`
}

describe('Stripe webhook · reserveWebhookEvent (idempotência)', () => {
  beforeAll(() => {
    /** Garante storage SQLite — sem dep externa. */
    delete process.env.IGA_STORAGE_DRIVER
  })
  afterAll(() => undefined)

  it('primeira vez: retorna true (processa)', async () => {
    const id = makeEventId()
    const result = await reserveWebhookEvent(id, 'stripe', 'checkout.session.completed')
    expect(result).toBe(true)
  })

  it('segunda vez com o mesmo event_id: retorna false (Stripe retry)', async () => {
    const id = makeEventId()
    const first = await reserveWebhookEvent(id, 'stripe', 'invoice.payment_failed')
    const second = await reserveWebhookEvent(id, 'stripe', 'invoice.payment_failed')
    const third = await reserveWebhookEvent(id, 'stripe', 'invoice.payment_failed')
    expect(first).toBe(true)
    expect(second).toBe(false)
    expect(third).toBe(false)
  })

  it('event_ids diferentes são independentes (cada um processa 1x)', async () => {
    const id1 = makeEventId()
    const id2 = makeEventId()
    expect(await reserveWebhookEvent(id1, 'stripe', 'customer.subscription.created')).toBe(true)
    expect(await reserveWebhookEvent(id2, 'stripe', 'customer.subscription.created')).toBe(true)
    expect(await reserveWebhookEvent(id1, 'stripe', 'customer.subscription.created')).toBe(false)
    expect(await reserveWebhookEvent(id2, 'stripe', 'customer.subscription.created')).toBe(false)
  })

  it('idempotência funciona mesmo com event_type diferente (event_id é a chave)', async () => {
    const id = makeEventId()
    // Mesmo event_id com event_type diferente — implementação usa event_id como chave única
    expect(await reserveWebhookEvent(id, 'stripe', 'checkout.session.completed')).toBe(true)
    expect(await reserveWebhookEvent(id, 'stripe', 'customer.subscription.updated')).toBe(false)
  })

  it('source diferente, mesmo event_id: bloqueado (event_id é unique global)', async () => {
    const id = makeEventId()
    expect(await reserveWebhookEvent(id, 'stripe', 'evt.x')).toBe(true)
    expect(await reserveWebhookEvent(id, 'paypal', 'evt.x')).toBe(false)
  })
})

describe('Stripe · mapStripeStatus', () => {
  it('active → active', () => {
    expect(mapStripeStatus('active')).toBe('active')
  })

  it('trialing → trialing', () => {
    expect(mapStripeStatus('trialing')).toBe('trialing')
  })

  it('past_due → past_due (não deve virar active)', () => {
    expect(mapStripeStatus('past_due')).toBe('past_due')
  })

  it('canceled → canceled (não deve virar active)', () => {
    expect(mapStripeStatus('canceled')).toBe('canceled')
  })

  it('paused → canceled (Stripe não tem paused interno; tratamos como canceled)', () => {
    expect(mapStripeStatus('paused')).toBe('canceled')
  })

  it('incomplete e incomplete_expired → incomplete', () => {
    expect(mapStripeStatus('incomplete')).toBe('incomplete')
    expect(mapStripeStatus('incomplete_expired')).toBe('incomplete')
  })

  it('unpaid → unpaid', () => {
    expect(mapStripeStatus('unpaid')).toBe('unpaid')
  })

  it('status desconhecido vira incomplete (fail-safe — não libera acesso por engano)', () => {
    // @ts-expect-error — testando branch default
    expect(mapStripeStatus('marciano_status')).toBe('incomplete')
  })

  it('SEC: nenhum status do Stripe deve mapear para active a menos que explicitamente listado', () => {
    const stripeStatuses = [
      'past_due', 'canceled', 'incomplete', 'incomplete_expired', 'unpaid', 'paused',
    ] as const
    for (const status of stripeStatuses) {
      expect(mapStripeStatus(status)).not.toBe('active')
    }
  })
})
