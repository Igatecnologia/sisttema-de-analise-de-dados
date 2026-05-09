---
name: iga-deploy
description: Deploy do IGA Gestão — Render (backend) + Vercel (frontend) + Supabase (Postgres) + Upstash (Redis) + Resend (email) + Stripe + Cloudflare Turnstile. Use ao mexer em render.yaml, env vars de produção, runbooks de deploy, healthchecks ou troubleshooting de produção.
---

# IGA Deploy — Beta Free Path

## Arquitetura de deploy (Beta gratuito)

```
Cliente → Vercel (frontend) → Render (backend) → Supabase (Postgres + RLS)
                                                ↘ Upstash (Redis + BullMQ)
                                                ↘ Resend (email transacional)
                                                ↘ Stripe (billing)
                                                ↘ Cloudflare Turnstile (anti-bot)
                                                ↘ Sentry (errors, opcional)
```

**Custo recorrente: R$ 0/mês** (todos os tiers free). Limitações:
- Render free dorme após 15min sem request → 30-60s no primeiro hit. Solução: UptimeRobot ping `/health/live` a cada 14 min.
- Supabase free: 500MB Postgres, backups 7d. Suficiente para 5-10 tenants Beta.
- Upstash free: 10k req/dia. Suficiente para Beta.

## Runbook completo

`docs/DEPLOY-TODAY.md` tem o passo-a-passo de 1-2h. Referenciar ao subir.

## Env vars críticas no Render

`assertEnvValid()` em `back-end-gest-o/src/envValidation.ts` aborta o boot se faltar. Lista mínima:

```bash
# Storage
DATABASE_URL=postgresql://postgres.xxx:senha@aws-0-region.pooler.supabase.com:6543/postgres
REDIS_URL=rediss://default:senha@xxx.upstash.io:6379
IGA_STORAGE_DRIVER=postgres
POSTGRES_SSL=1
POSTGRES_POOL_MAX=5

# Secrets (gerar local: openssl rand -hex 48 / 32)
IGA_SESSION_JWT_SECRET=<96 hex chars>
IGA_SECRETS_KEY=<64 hex chars>

# Frontend / CORS
FRONTEND_URL=https://<vercel-url>.vercel.app
PUBLIC_BASE_URL=https://<vercel-url>.vercel.app
CORS_TENANT_DOMAIN_REGEX=^https://(.+\.vercel\.app|.+\.onrender\.com)$

# Auth
ADMIN_DEFAULT_EMAIL=admin@empresa.com
ADMIN_DEFAULT_PASSWORD=<senha forte 14+ chars>
SUPER_ADMIN_EMAILS=admin@empresa.com

# Stripe (test mode no Beta)
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
STRIPE_PRICE_PRO=price_xxx
STRIPE_PRICE_ENTERPRISE=price_xxx
BILLING_SUCCESS_URL=https://<vercel-url>.vercel.app/billing/sucesso
BILLING_CANCEL_URL=https://<vercel-url>.vercel.app/billing/cancelado
BILLING_PORTAL_RETURN_URL=https://<vercel-url>.vercel.app/billing

# Email (Resend free 100/dia)
RESEND_API_KEY=re_xxx

# Anti-bot
TURNSTILE_SECRET=xxx

# Opcional
SENTRY_DSN=https://...
LOG_PROXY_DATA=0
SECURITY_CONTACT_EMAIL=security@iga.com
```

## render.yaml

`healthCheckPath: /health/ready` (valida DB+Redis, não só processo).

## Auto-seed Tiete Espumas

Se setar `SGBR_API_URL=http://108.181.223.103:3007` e `SGBR_CREDENTIALS=iga:123456`, o backend cria 6 datasources Tiete no primeiro boot via `seedDataSources.ts`. Útil para Beta.

## Smoke test pós-deploy

```bash
# 1. Backend healthy
curl https://<backend>.onrender.com/health/ready

# 2. Endpoint público funciona
curl https://<backend>.onrender.com/api/v1/segments

# 3. Frontend carrega
curl -I https://<vercel-url>.vercel.app

# 4. Signup → email verify → login → onboarding → dashboard com dados demo
```

## Migrations

Rodam automaticamente no boot:
- SQLite: inline em `db/sqlite.ts` + ALTER TABLEs idempotentes
- Postgres: `db/postgresMigrations.ts` array de 14 migrations sequenciais (001-014). Tabela `schema_migrations` evita re-executar.

## Stripe webhook setup

1. Stripe Dashboard → Developers → Webhooks → Add endpoint
2. URL: `https://<backend>.onrender.com/api/v1/billing/stripe/webhook`
3. Events: `checkout.session.completed`, `customer.subscription.{created,updated,deleted}`, `invoice.{paid,payment_failed}`
4. Copy "Signing secret" (whsec_...) → cole em STRIPE_WEBHOOK_SECRET no Render → redeploy

## Bloqueadores para GA público

- Pentest externo (R$ 10-30k, 2-4 sem)
- DPIA + DPA + Termos com advogado (R$ 5-15k)
- CNPJ + Stripe live KYC (1-2 sem)
- Cloudflare WAF (~R$ 100/mês)

Beta Fechada não precisa nenhum desses (Stripe test mode + 5-10 tenants convidados).

## Rollback

- Render: Dashboard → Deploys → Rollback ao deploy anterior (1-clique, ~30s)
- Vercel: Dashboard → Deployments → ⋯ → Promote to Production ao deploy anterior
- DB: Supabase backup automático 7d → restore via SQL Editor

## Troubleshooting

| Sintoma | Causa | Fix |
|---------|-------|-----|
| Backend boot aborta com "Configuração de produção incompleta" | Env var faltando | Mensagem do log lista exatamente qual; setar no Render → redeploy |
| Migration falha no primeiro boot | DATABASE_URL incorreta | Confirmar Connection Pooler porta 6543 (não Direct 5432) |
| CORS errors no browser | FRONTEND_URL no Render diferente da Vercel | Atualizar e redeploy backend |
| Render 30-60s no 1º request | Free tier dorme | UptimeRobot ping a cada 14 min em /health/live |
| Stripe webhook 400 invalid signature | STRIPE_WEBHOOK_SECRET errado | Re-copiar do Signing secret do endpoint específico |
| Email não chega | Domínio não verificado no Resend | Para Beta usar `onboarding@resend.dev` (sem verificação) |
