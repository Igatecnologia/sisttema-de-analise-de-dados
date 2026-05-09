# Performance Budget — IGA Gestao

> Atualizado: 2026-05-09

Define os SLOs (Service Level Objectives) que o sistema deve atingir antes do GA publico.
Quando algum SLO for ultrapassado em producao, o time recebe alerta automatico (Sentry trace).

## Backend — endpoints

| Endpoint | p50 | p95 | p99 | Notas |
|----------|-----|-----|-----|-------|
| `POST /api/v1/auth/login` | 200ms | **500ms** | 1s | Argon2id + HIBP — alvo critico |
| `POST /api/v1/auth/refresh` | 50ms | 150ms | 300ms | Cache de sessao em memory |
| `GET /api/v1/data/*` (proxy) | 800ms | **2s** | 5s | Depende do ERP do cliente, deadline 110s |
| `POST /api/v1/copilot/chat` | 800ms | 2s | 5s | TTFT (time to first token) < 1.5s |
| `GET /api/v1/segments` | 30ms | 80ms | 200ms | Cache 1h |
| `GET /api/v1/billing/plans` | 30ms | 80ms | 200ms | Cache 1h |
| `GET /api/v1/dashboard` | 300ms | 800ms | 2s | LRU cache 5min |
| `POST /api/v1/lgpd/export` | 1s | 5s | 15s | Async — usa BullMQ + email |

## Frontend — Core Web Vitals

Alvos por pagina, medidos via Lighthouse (mobile, throttling 4G):

| Pagina | LCP | INP | CLS | FCP | Score a11y |
|--------|-----|-----|-----|-----|-----------|
| `/login` | < 1.5s | < 100ms | < 0.05 | < 1s | >= 95 |
| `/register` | < 1.5s | < 100ms | < 0.05 | < 1s | >= 95 |
| `/dashboard` | **< 2.0s** | **< 200ms** | **< 0.1** | < 1.2s | >= 90 |
| `/financeiro` | < 2.5s | < 200ms | < 0.1 | < 1.5s | >= 90 |
| `/relatorios` | < 2.5s | < 200ms | < 0.1 | < 1.5s | >= 90 |

## Bundle size budgets

| Chunk | Target | Hard limit |
|-------|--------|-----------|
| `vendor-antd` | < 1.2MB | 1.5MB |
| `vendor-charts` (Recharts) | < 200KB | 350KB |
| `vendor-pdf` (jsPDF) | < 300KB | 500KB |
| `index` (entry) | < 100KB | 200KB |
| First-paint critical | < 200KB gzip | 350KB |

Validacao: `cd front-end-gest-o && npm run size:check`. CI bloqueia merge quando estoura hard limit.

## Carga (k6 load tests)

Objetivos por profile (em `back-end-gest-o/tests/load/baseline.js`):

| Profile | VUs | Duracao | http_req_failed | http_req_duration p(95) |
|---------|-----|---------|-----------------|-------------------------|
| smoke | 5 | 1min | < 0.5% | < 500ms |
| **load** | 50 | 2min | **< 1%** | **< 500ms** |
| spike | 200 | 30s | < 5% | < 2s |

Producao (alvo GA): suportar **500 tenants concurrent + 200 req/s sustentado** sem degradar SLOs.

## Banco

- Connection pool max: 20 (Postgres) — ajustar baseado em carga real
- Slow query threshold: > 1s alerta no Sentry
- Indexes obrigatorios: todos os `tenant_id`, `created_at`, `email`, FKs ativas
- N+1 detection: `pg_stat_statements` review semanal

## Como medir

- **Sentry Performance** (config em `back-end-gest-o/src/observability/sentry.ts`) — trace sample rate 10% em prod
- **Lighthouse CI** — workflow `.github/workflows/lighthouse.yml` em PRs
- **k6** — `cd back-end-gest-o && k6 run tests/load/baseline.js`
- **size:check** — script no `front-end-gest-o/package.json`

## Alertas (quando ultrapassar)

1. p95 > target em janela 5min -> Sentry alert -> Slack #oncall
2. Lighthouse score regrediu > 5 pontos em 1 semana -> issue automatica
3. Bundle size hard limit ultrapassado -> CI bloqueia merge
4. http_req_failed > 1% em load test -> investigar antes de deploy

## Pendencias (operacional / pago)

- APM detalhado (Datadog ou Sentry Performance Pro): R$ 200/mes
- Status page publica em `status.igagestao.com.br`: Statuspage R$ 100/mes ou Better Uptime free tier
- CDN para assets estaticos: Cloudflare CDN (free tier funciona)
- Dashboard publico de DORA metrics: Linear analytics ou Grafana
