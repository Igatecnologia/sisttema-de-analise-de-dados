---
name: iga-billing-stripe
description: Stripe billing — checkout, portal, webhook, plan limits, subscription gate. Use ao mexer em routes/billing.ts, services/stripeBilling.ts, services/subscriptionStore.ts, middleware/subscriptionGate.ts, BillingPortalPage, TrialBanner, ou debug de pagamentos.
---

# IGA Billing — Stripe Reference

## Arquivos-chave

- `back-end-gest-o/src/services/stripeBilling.ts` — cliente Stripe (init com STRIPE_SECRET_KEY)
- `back-end-gest-o/src/routes/billing.ts` — checkout, portal, webhook
- `back-end-gest-o/src/services/subscriptionStore.ts` — `evaluateAccess()`, `getSubscription()`
- `back-end-gest-o/src/middleware/subscriptionGate.ts` — bloqueia 402 quando trial expirou e sem subscription ativa
- `back-end-gest-o/src/services/planLimits.ts` — limites por plano (Free/Starter/Pro/Enterprise)
- `front-end-gest-o/src/pages/BillingPortalPage.tsx`, `BillingPlansPage.tsx`
- `front-end-gest-o/src/components/TrialBanner.tsx`

## Env vars obrigatórias

```bash
STRIPE_SECRET_KEY=sk_live_... (ou sk_test_... em staging)
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_PRO=price_...
STRIPE_PRICE_ENTERPRISE=price_...
BILLING_SUCCESS_URL=https://app.../billing/sucesso
BILLING_CANCEL_URL=https://app.../billing/cancelado
BILLING_PORTAL_RETURN_URL=https://app.../billing
```

`assertEnvValid()` em `envValidation.ts` aborta o boot em prod se faltarem.

## Fluxo de assinatura

```
1. Tenant clica "Upgrade" em /planos
2. POST /api/v1/billing/checkout-session { plan: 'pro' | 'enterprise' }
3. Backend cria Stripe Checkout Session, retorna URL
4. Frontend redireciona pra Stripe-hosted checkout
5. Cliente paga
6. Stripe envia webhook checkout.session.completed → /api/v1/billing/stripe/webhook
7. Backend valida assinatura (constructEvent), cria/atualiza row em subscriptions
8. Frontend (após redirect ao success_url) recarrega billing status
```

Outros eventos webhook: `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`.

## Subscription gate

`subscriptionGate` em `app.ts` aplicado APÓS `requireAuth`. Permite passar:
- `/api/v1/auth/*`, `/api/v1/billing/*`, `/api/v1/onboarding/*`, `/api/v1/legal/*`, `/api/v1/analytics/*`
- `/api/v1/tenants/:slug/config` (público para branding)
- `/health/*`

Quando bloqueado, retorna 402 com `{ message, reason: 'trial_expired' | 'subscription_inactive', trialEndsAt, subscriptionStatus }`.

## Bypass em dev

`BILLING_GATE_DISABLED=1` permite passar tudo. **Bloqueado em produção** — `subscriptionGate.ts:32` checa `NODE_ENV !== 'production'` antes de honrar.

## Test mode

Use `sk_test_...` + cartão de teste `4242 4242 4242 4242` (qualquer CVC, validade futura). Para testar webhooks localmente:

```bash
stripe listen --forward-to localhost:3000/api/v1/billing/stripe/webhook
stripe trigger checkout.session.completed
```

## Plan limits

Em `services/planLimits.ts`:

| Recurso | Free | Starter | Pro | Enterprise |
|---------|------|---------|-----|------------|
| Users | 1 | 3 | 10 | Ilimitado |
| Datasources | 1 | 2 | 5 | Ilimitado |
| API Keys | 0 | 1 | 5 | Ilimitado |
| Scheduled reports | 0 | 1 | 5 | Ilimitado |

`evaluatePlanLimit(tenantId, resource)` retorna `{ allowed, used, limit, plan, key, message }`. Rotas que criam recursos chamam antes do INSERT (ex: POST /datasources, POST /api-keys).

## TrialBanner (frontend)

`TrialBanner.tsx` renderiza estado de billing no topo de páginas internas. 4 estados:
1. `status='grace'` (payment failed) → Alert warning + "Atualizar pagamento"
2. `!access.allowed` (trial expired) → Alert error + "Ver planos"
3. `trialing` + dias <= 5 → Alert warning com CTA "Assinar agora"
4. `trialing` + dias > 5 → Alert info com CTA "Ver planos"

Revalida a cada 15 min via `getBillingStatus()`.

## Anti-pattern

- Não criar subscription manualmente no DB — sempre via webhook (idempotência)
- Não responder webhook antes de processar — Stripe re-envia se 5xx
- Não fazer SET BILLING_GATE_DISABLED=1 em produção (bloqueado mas é fonte de risco)
- Cobrança real só após CNPJ + Stripe live KYC (Beta usa test mode com `sk_test_`)
