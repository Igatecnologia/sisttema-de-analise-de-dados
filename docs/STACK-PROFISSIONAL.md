# STACK-PROFISSIONAL.md

Recomendações de bibliotecas, serviços e práticas pra elevar o IGA Gestão a nível **SaaS profissional**. Curado a partir do que **realmente falta** no nosso stack atual, comparado com referências 2026 (Context7, PostHog blog, agile soft labs, dev.to).

> **Princípio:** menos ferramentas com mais alcance > muitas ferramentas duplicadas. PostHog substitui 3 SaaS (Sentry + Mixpanel + LaunchDarkly).

---

## O que já temos (não precisa duplicar)

| Camada | Tool atual | Comentário |
|---|---|---|
| Frontend framework | React 19 + Vite 8 | Estado da arte. Manter. |
| UI lib | Ant Design v6 | Madura. Manter. |
| Server state | TanStack React Query v5 | Manter. |
| Forms / validation | Zod (back+front) | Manter. |
| Charts | Recharts | OK pro escopo. |
| Animação | Framer Motion | Manter. |
| Backend | Express + TS | Funcional. Pra escalar > 10k tenants, considerar Hono ou Fastify. |
| DB | SQLite → Postgres | Postgres já planejado (PLANO-SAAS Sprint 1). |
| Auth | Custom (cookie httpOnly + JWT + 2FA + Argon2) | Não trocar. Custom já cobre 95% do que Clerk/WorkOS oferecem. |
| Payment | Stripe | Manter. |
| Captcha | Cloudflare Turnstile | Manter. |
| AI | Groq (Copilot via abstraction) | Boa abstração — fácil trocar. |
| Audit log | Hash chain custom | Diferencial. Manter. |
| Tests unit | Vitest | Manter. |
| Tests E2E | Playwright (não rodando em CI) | Plugar no CI é o gap. |

---

## Tier 1 — Alto impacto, baixo custo (faça antes do Beta)

### 1. **PostHog** (substitui Sentry + Mixpanel + LaunchDarkly)

**Por quê:** Hoje temos `errorTracker.ts` stub não plugado e `services/analytics.ts` chamando `trackEvent()` sem destino real. PostHog cobre **erros + product analytics + session replay + feature flags + A/B test** numa única conta.

- 1M eventos/mês grátis, suficiente pra Beta inteiro
- Liga error a session replay (vê o que o usuário fez ANTES de quebrar)
- Feature flags servem como kill switch (desligar Copilot sem deploy)
- Self-hostable se LGPD exigir

```bash
npm i posthog-js posthog-node
```

**ROI:** 4h de setup, substitui ~$80/mês de SaaS terceiros. **Bloqueia Beta P0 1.1.**

### 2. **Resend** (transactional email)

**Por quê:** Hoje usamos Nodemailer com SMTP genérico. Resend tem entregabilidade superior (especialmente Gmail/Outlook), templates React, e tracking de aberturas — útil pra debugar "convite não chegou".

- 3k emails/mês free, depois $20 = 50k
- Suporta DKIM/DMARC automático
- React Email pra templates type-safe

```bash
npm i resend @react-email/components
```

**ROI:** 2h migração. Resolve incidentes "email não chegou" que travam onboarding.

### 3. **BullMQ + Redis** (job queue)

**Por quê:** Hoje `setInterval` em `back-end-gest-o/src/jobs/` pra warmCache, dbBackup, scheduledReports. Não tem retry, observability, paralelismo. Já está no PLANO-SAAS Sprint 2.

- Retry exponencial built-in
- Dashboard (Bull Board) pra ver jobs falhando
- Substitui `node-cron` improvisado

```bash
npm i bullmq ioredis
```

**ROI:** 1 dia setup. Resolve scheduledReports que hoje "manda e esquece" sem confirmação.

### 4. **Crisp / Plain** (suporte conversacional in-app)

**Por quê:** Empresa Beta vai ter dúvida toda hora. Botão de chat no app reduz drop-out e gera feedback orgânico. Hoje só tem WhatsApp via env var.

- Crisp: free 2 agentes, Brasil-friendly
- Plain: developer-first, GitHub/Slack integration, $35/mês

**ROI:** 1h. Aumenta confiança das empresas Beta.

### 5. **OpenTelemetry** (instead of Sentry-only — futuro-prova)

**Por quê:** PostHog/Sentry vendor-lock no protocolo deles. OTel é padrão aberto — instrumenta uma vez, manda pra qualquer backend (PostHog, Honeycomb, Datadog, Grafana Cloud).

- `@opentelemetry/api` + auto-instrumentações pra Express/HTTP/Postgres
- Exporter PostHog (existe via OTLP)
- Spans de proxy.ts (parte mais complexa do backend) viram observáveis

```bash
npm i @opentelemetry/api @opentelemetry/sdk-node @opentelemetry/auto-instrumentations-node
```

**ROI:** 4h. Diferencial enterprise — clientes maiores pedem trace export.

---

## Tier 2 — Profissionalismo & confiança

### 6. **BetterStack / Instatus** (status page + uptime)

- Status page público em `status.iga.com` — empresas avaliando viram confiança
- Pings sintéticos de múltiplas regiões
- Slack/email alert se cair
- BetterStack: free 10 monitores

**ROI:** 1h. Sinal de "produto sério".

### 7. **Lighthouse CI** (performance budget no CI)

**Por quê:** Hoje `npm run size:check` registra bundle, mas não bloqueia regressões. Lighthouse CI roda em PR, mede TTI/LCP/CLS, falha se passar do budget.

```bash
npm i -D @lhci/cli
```

Config simples: `lighthouserc.json` com budget mobile 4G.

**ROI:** 3h. Pega regressão de performance antes de chegar no cliente.

### 8. **Knip** (dead code detection)

**Por quê:** Codebase com 39 páginas tem certamente exports não usados, dependências fantasmas. Knip lista o que pode ser deletado.

```bash
npm i -D knip
npx knip
```

**ROI:** 30min descobrir, 2h limpar. Reduz bundle e atrito de manutenção.

### 9. **size-limit** (bundle budget per import)

**Por quê:** Substitui o `size:check` caseiro. Falha CI se algum chunk passar do limite definido.

```bash
npm i -D size-limit @size-limit/preset-app
```

`.size-limit.json`:
```json
[
  { "path": "front-end-gest-o/dist/assets/index-*.js", "limit": "350 KB" },
  { "path": "front-end-gest-o/dist/assets/vendor-antd-*.js", "limit": "400 KB" }
]
```

**ROI:** 1h. Bloqueia "feature creep" inflando bundle.

### 10. **React Email** (templates de email type-safe)

Funciona com Resend. Templates em React/JSX em vez de HTML inline em `services/emailTemplates.ts`. Preview em dev via `react-email dev`.

**ROI:** 4h pra migrar 5 templates atuais. Manutenção fica trivial.

---

## Tier 3 — Developer experience (acelera time)

### 11. **Storybook 8** (design system docs)

Vale a pena se o time crescer pra 3+ devs. Componentes em `src/components/` viram catálogo navegável + visual regression via Chromatic.

```bash
npx storybook@latest init
```

**ROI:** 1 dia setup + manutenção contínua. **Defer:** vale só com 3+ devs.

### 12. **Vitest UI**

Já tem Vitest. `npm i -D @vitest/ui` e `vitest --ui` abre interface visual de testes — útil em TDD e debug. Free.

### 13. **Drizzle ORM** (substitui SQL bruto)

Hoje queries são raw em `routes/*.ts`. Drizzle dá:
- Type-safety (schema TypeScript = tabela)
- Migrations versionadas (`drizzle-kit push`)
- Suporta SQLite + Postgres com mesmo código

```bash
npm i drizzle-orm
npm i -D drizzle-kit
```

**ROI:** 2 dias migração mas paga em segurança. **Defer:** depois do Beta, junto com Postgres migration.

### 14. **TanStack Router** (substitui React Router v7)

Routes type-safe — hoje paths são strings. Detecta link quebrado em compile time. Tem prefetch automático no hover.

**ROI:** 1 semana migração. **Defer:** backlog. React Router v7 funciona bem.

### 15. **Inngest / Trigger.dev** (alternativa managed ao BullMQ)

Se não quiser rodar Redis dedicado:
- Inngest: workflow durável, retry, observability — $0 até 100k steps/mês
- Trigger.dev: similar, opcional self-host

**ROI:** Trade-off — managed = menos infra, vendor-lock leve. Se for self-host serious, BullMQ. Se for shippar rápido, Inngest.

---

## Tier 4 — Lifecycle & growth

### 16. **Loops** (lifecycle email automation)

- Drip: welcome → 1º dia → 3º dia → trial expirando
- Funciona em cima do Resend
- $39/mês, libera quando começar a escalar

**Defer:** após 5 empresas Beta validadas.

### 17. **Cal.com embed** (agendar onboarding call)

Botão "Agendar com nosso time" dentro do app pra reduzir fricção de empresa em trial. Self-host ou cal.com cloud.

**ROI:** 30min embed.

### 18. **Stripe Tax** (impostos automáticos)

Pra Brasil é parcial — não calcula NF-e. Mas pra clientes USA/EU futuros, automatiza VAT/sales tax. **Defer:** quando expandir geografia.

---

## Práticas de engenharia (não são libs, mas elevam o nível)

### A. **Conventional Commits + Changesets**

`feat:`, `fix:`, `chore:` no commit. Changesets gera changelog automatizado e versão.

```bash
npm i -D @changesets/cli && npx changeset init
```

### B. **Trunk-based dev + PR template**

Hoje é mono-branch. PR template com checklist (testou? typecheck? mobile?). Branch protection bloqueia merge sem CI verde.

### C. **Pre-commit hooks (Husky + lint-staged)**

Roda lint + typecheck só nos arquivos staged. Já tem ESLint config — falta hook.

```bash
npm i -D husky lint-staged
npx husky init
```

### D. **Renovate** (ou Dependabot)

PRs automáticos de bump de dep. Renovate é mais configurável. Free pra public/private.

### E. **CodeRabbit / Greptile** (AI code review em PR)

AI revisa cada PR e comenta issues antes do humano. CodeRabbit free pra OSS, $15/dev/mês private.

---

## Decisões pendentes

| Decisão | Recomendação | Por quê |
|---|---|---|
| **Sentry **OU** PostHog?** | PostHog | Cobre tudo + session replay |
| **BullMQ **OU** Inngest?** | BullMQ pra v1, Inngest se não quiser Redis | Self-host vs managed |
| **Drizzle agora ou depois?** | Depois (junto com Postgres) | Migração grande, baixo ROI imediato |
| **TanStack Router?** | Não pra Beta | React Router v7 já funciona |
| **Storybook?** | Só com 3+ devs | Overhead alto pra solo dev |
| **Crisp **OU** Plain?** | Crisp pra Beta (free) | Plain é melhor mas paga |
| **Resend **OU** Postmark?** | Resend | Brasil-friendly, React Email integrado |

---

## Plano de rollout (3 sprints de 1 semana)

### Sprint A — Observabilidade real
- PostHog plugado (errors + analytics + replay)
- BetterStack uptime
- Lighthouse CI
- Knip + size-limit

**Saída:** todo erro em prod chega no PostHog em <30s, status page público.

### Sprint B — Confiabilidade
- Resend + React Email (migra Nodemailer)
- BullMQ pros 4 jobs atuais
- Pre-commit hooks (Husky + lint-staged)
- E2E Playwright no CI

**Saída:** zero "email não chegou", jobs com retry observável, regressão pega em PR.

### Sprint C — Conversão
- Crisp embed
- Cal.com embed pra demos
- PostHog feature flags ativos (3 flags pra começar: copilot_v2, csv_upload, scheduled_reports_v2)
- Loops drip de onboarding

**Saída:** time de marketing/vendas tem ferramentas, conversão Beta mensurável.

---

## Não recomendo (e por quê)

- **Trocar auth pra Clerk/WorkOS/Auth0** — custom auth atual é robusto (2FA, Argon2, hash chain audit). Migração quebra cookies, sessões, força logout em massa. Só vale se aparecer cliente enterprise pedindo SSO/SAML.
- **NextJS migration do app principal** — Vite + SPA atende 100% do caso. NextJS resolve SEO/SSR que dashboards autenticados não precisam. Custo de migração não paga.
- **GraphQL** — REST + Zod cobre. GraphQL agrega complexidade sem benefício pra dashboards single-tenant view.
- **Microsserviços** — monolito modular Express ainda escala pra dezenas de milhares de tenants. Microsserviços = 10x mais infra.
- **Kubernetes** — Render/Vercel/Fly resolve até 100k req/dia. K8s só vale com time DevOps dedicado.

---

## Quick wins essa semana (3h total)

1. Plugar PostHog (errors + 2 events) — 1h
2. Knip pra deletar dead code — 30min
3. size-limit no CI — 30min
4. Husky + lint-staged — 30min
5. BetterStack monitor de prod — 30min

Resultado: profissionalismo perceptível sem refactor grande.

---

**Última atualização:** 2026-05-08
**Owner:** Mayke Santos
**Doc relacionado:** `PLANO-FRONTEND-BETA.md` (P0/P1 do frontend), `PLANO-SAAS.md` (roadmap geral)
