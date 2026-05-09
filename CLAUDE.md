# CLAUDE.md — IGA Gestao

Contexto para o Claude Code trabalhar neste repositorio.

## O que e este projeto

SaaS multi-tenant de gestao operacional (BI) que conecta a ERPs via proxy de API e exibe dashboards de producao, estoque, financeiro, vendas e compras. Inclui IA Copilot integrada.

**Estado atual**: SaaS multi-tenant em producao. Suporta 4 segmentos de negocio (industria, comercio, servicos, distribuicao) com modulos, conectores e templates por segmento.

**Segmentos**: Cada tenant escolhe um segmento no signup que determina:
- Conectores recomendados (filtrados por compatibilidade — ex: SGBR Espuma so atende industry)
- Modulos habilitados por padrao
- Labels da UI (override em cima dos labels do connector)
- Templates de dashboard

Ver `back-end-gest-o/src/segments.ts` para o registro canonico e `front-end-gest-o/src/services/authService.ts::listSegments()` para o consumo no front.

## Estrutura do repositorio

```
sistema de gestão/
├── back-end-gest-o/       # Backend Express + TypeScript
│   ├── src/
│   │   ├── app.ts         # Express app, middleware, rotas
│   │   ├── server.ts      # Servidor HTTP, porta auto-discovery
│   │   ├── routes/
│   │   │   ├── proxy.ts   # Proxy generico para APIs externas (paginacao, cache, auth)
│   │   │   ├── erp.ts     # Endpoints ERP (fichas, producao, vendas, compras)
│   │   │   ├── finance.ts # Endpoints financeiros (contas pagar, estoque classificado)
│   │   │   ├── auth.ts    # Login, sessoes, CRUD usuarios
│   │   │   ├── copilot.ts # Chat IA (Groq/local)
│   │   │   └── ...        # alerts, audit, dashboard, reports, etc.
│   │   ├── middleware/
│   │   │   ├── auth.ts    # requireAuth, sessao via cookie httpOnly
│   │   │   ├── csrf.ts    # Protecao CSRF
│   │   │   └── requestLog.ts
│   │   ├── segments.ts    # Definicao dos 4 segmentos de negocio + helpers
│   │   ├── connectors/    # IndustryConnector + 7 connectors (sgbr-espuma, iga-custom-api, csv, bling, tiny, omie, generic)
│   │   ├── db/
│   │   │   ├── sqlite.ts          # SQLite local (dev) — DEFAULT
│   │   │   ├── postgres.ts        # PostgreSQL prod (com RLS) quando IGA_STORAGE_DRIVER=postgres
│   │   │   ├── postgresMigrations.ts  # 12 migrations sequenciais
│   │   │   └── schema.sql         # Espelho canonico do SQLite
│   │   ├── services/ai/   # Copilot: orchestrator, providers, tools
│   │   └── jobs/          # BullMQ + fallback setInterval (warmCache, dbBackup, copilotRetention, scheduledReports, alertsEngine, trialLifecycle)
│   ├── .env               # Variaveis de ambiente (NAO commitar)
│   ├── .env.example       # Template de variaveis
│   └── package.json
│
├── front-end-gest-o/      # Frontend React 19 + Vite + Ant Design v6
│   ├── src/
│   │   ├── pages/         # Paginas do app (DashboardPage, FinancePage, etc.)
│   │   ├── components/    # Componentes compartilhados
│   │   ├── services/      # http.ts (axios), authStorage, tenantStorage
│   │   ├── hooks/         # Custom hooks (useSortableWidgets, etc.)
│   │   ├── routes/        # AppRouter.tsx (React Router v7, lazy loading)
│   │   ├── theme/         # ThemeProvider, tokens, chart defaults
│   │   └── layout/        # AppLayout (sidebar, header, content)
│   ├── .env.local         # VITE_API_BASE_URL do backend
│   ├── .env.production    # Config de producao
│   └── package.json
│
├── docs/                  # Plano canonico, runbooks, compliance — ver docs/README.md
├── render.yaml            # Config de deploy no Render
└── .gitignore
```

## Comandos

### Backend

```bash
cd back-end-gest-o
npm install          # Instalar dependencias
npm run dev          # Dev com hot reload (tsx watch)
npm run build        # Compilar TypeScript
npm run start        # Rodar build de producao
npm run test         # Vitest
npm run test:coverage
npm run lint         # ESLint
npm run lint:fix
```

### Frontend

```bash
cd front-end-gest-o
npm install
npm run dev          # Vite dev server (:5173)
npm run build        # Build producao
npm run preview      # Preview do build
npm run test:unit    # Vitest
npm run test:e2e     # Playwright
npm run lint
npm run check        # lint + tsc
npm run size:check   # Bundle size check
```

## Stack tecnica

### Backend
- **Runtime**: Node.js + TypeScript
- **Framework**: Express
- **Banco**: SQLite (dev) ou PostgreSQL com RLS (prod) — controlado por `IGA_STORAGE_DRIVER`
- **Auth**: JWT em cookie httpOnly `iga_session` (access) + `iga_refresh` (refresh com rotacao + reuse detection), CSRF via `X-XSRF-TOKEN`, MFA/TOTP, account lockout, HIBP pwned-password
- **API Keys**: 4 scopes (`reports:read`, `dashboards:read`, `datasources:read`, `webhooks:write`) com hash SHA256 timing-safe, prefixo `iga_live_`
- **Billing**: Stripe (checkout, customer portal, webhook validado). Bypass `BILLING_GATE_DISABLED=1` so funciona fora de prod
- **RBAC**: 19 permissoes granulares (admin/manager/viewer + custom per-user) — ver `permissions.ts`
- **Jobs**: BullMQ (Redis) com fallback para `setInterval` se Redis ausente
- **Email**: Nodemailer (scheduled reports, transactional)
- **IA**: AI SDK abstraction com Groq como provider default (free tier 30 req/min)

### Frontend
- **Framework**: React 19 + TypeScript
- **Build**: Vite 8
- **UI Library**: Ant Design v6 + Lucide icons
- **State**: TanStack React Query v5 (server), useState/useContext (client)
- **Routing**: React Router v7 (lazy loading, permission-based)
- **Charts**: Recharts
- **Animacoes**: Framer Motion
- **Tabelas**: TanStack React Virtual
- **Command palette**: cmdk (Cmd+K)
- **Tema**: Dark/light mode, Sora (display) + Inter (body), tokens em `theme/tokens.ts`

## Variaveis de ambiente

### Backend — obrigatorias em DEV
```
PORT=3001
FRONTEND_URL=http://localhost:5173
ADMIN_DEFAULT_EMAIL=admin@iga.com
ADMIN_DEFAULT_PASSWORD=SenhaForte@2026!
```

### Backend — obrigatorias em PRODUCAO
```
NODE_ENV=production
IGA_SECRETS_KEY=<base64 32 bytes>          # criptografia at rest de credenciais
IGA_SESSION_JWT_SECRET=<32+ bytes>          # assinatura do JWT de sessao
DATABASE_URL=postgresql://...               # PostgreSQL gerenciado
IGA_STORAGE_DRIVER=postgres
REDIS_URL=redis://...                       # BullMQ + sharedCache
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_PRO=price_...
STRIPE_PRICE_ENTERPRISE=price_...
SUPER_ADMIN_EMAILS=admin@empresa.com        # acesso ao painel cross-tenant
SMTP_HOST=...                               # transactional email
SMTP_USER=...
SMTP_PASS=...
SMTP_FROM=no-reply@empresa.com
```

### Backend — opcionais (segmentacao por feature)
- `SGBR_CREDENTIALS`, `SGBR_API_URL` — apenas para tenants com connector `sgbr-espuma`
- `GROQ_API_KEY`, `COPILOT_PROVIDER` — IA Copilot (default: groq free tier)
- `BILLING_GATE_DISABLED=1` — DEV-ONLY: pula o gate de assinatura. Bloqueado em `NODE_ENV=production`
- `ALLOW_PRIVATE_HOSTS` — DEV-ONLY: permite conectar ERP em localhost
- `IGA_DATA_DIR`, `SERVE_FRONTEND_DIR` — paths customizados

### Frontend (.env.local) — obrigatorias
```
VITE_API_BASE_URL=http://localhost:3001
```

Ver `back-end-gest-o/.env.example` para lista completa de variaveis opcionais.

## Arquitetura de dados

```
[ERP cliente] ←→ [proxy.ts] ←→ [erp.ts / finance.ts] ←→ [Frontend React Query]
                     ↑
              Cache 5min (LRU)
              Token cache 45min
              Paginacao auto (paralela)
              Deadline 110s
```

### Fluxo de autenticacao
1. Frontend POST `/auth/login` com email + senha
2. Backend valida contra SQLite, cria sessao (8h TTL)
3. Seta cookie `iga_session` (httpOnly) + cookie `XSRF-TOKEN`
4. Frontend envia cookie automaticamente + `X-XSRF-TOKEN` header em mutacoes
5. Em 401, frontend faz auto-logout e redireciona para `/login`

### Fluxo de dados do proxy
1. Frontend chama `/api/proxy/data?dsId=xxx&endpoint=yyy`
2. Proxy resolve datasource do SQLite, autentica na API externa
3. Busca dados com paginacao automatica (cursor ou numerada)
4. Aplica field mappings configurados no datasource
5. Cacheia resposta por 5min (LRU, max 50 entradas)
6. Retorna array de registros ao frontend

## Padroes de codigo

### TypeScript
- Tipos explicitos, sem `any`
- Async/await com error handling
- Zod para validacao de dados externos
- Early return pattern

### React
- Componentes funcionais com hooks
- React Query para todo data fetching (staleTime: 15min)
- Lazy loading de paginas com Suspense
- Ant Design ConfigProvider para tema
- Framer Motion para animacoes

### Nomenclatura
- Paginas: `NomePage.tsx` (PascalCase)
- Componentes: `NomeComponent.tsx` (PascalCase)
- Hooks: `useNome.ts` (camelCase com prefixo use)
- Services: `nomeService.ts` (camelCase)
- Rotas backend: `nome.ts` (camelCase)

## SaaS core vs. por segmento vs. opcional

### SaaS core (todos os tenants)
- Auth (login, refresh, MFA), RBAC (19 permissoes), API Keys (4 scopes)
- Billing Stripe (checkout, portal, webhook), TrialBanner
- Tenants CRUD, Users CRUD, DataSources CRUD
- Reports, ScheduledReports, Alerts, Webhooks, AuditLog
- SavedViews, PublicShares, OrgSwitcher (header)
- Help Center, Changelog, Onboarding (5 passos com CSV import)
- Copilot IA (Groq), CommandPalette (Cmd+K)

### Por segmento (4 perfis)
- **Industria**: producao, ficha_tecnica, estoque (com aba "Produto base"), compras
- **Comercio**: comercial, estoque (sem aba intermediaria), compras
- **Servicos**: comercial, operations (sem producao/estoque/ficha_tecnica)
- **Distribuicao**: comercial, compras, estoque, operations

Cada segmento tem connector recomendado (ver `segments.ts::recommendedConnectorForSegment`) e templates de dashboard pre-configurados.

### Opcional (instalavel/configuravel por tenant)
- Connector SGBR Espuma (so atende segmento `industry`, requer `SGBR_CREDENTIALS`)
- Connectors Bling/Tiny/Omie (status `coming-soon`, requer credenciais OAuth)
- Connector CSV (qualquer segmento, sem auth)
- IA Copilot (configuravel via tela de admin OU env vars)

## SGBR-specific (legado tornado opcional)

Era hardcoded no codigo, agora eh um connector entre outros:
- `connectors/sgbrEspumaConnector.ts` — connector com `segments=['industry']`
- `routes/finance.ts::classifyEstoqueItem()` — delega ao `connector.classifyProduct()` (generico)
- Endpoint `/finance/estoque-espuma` — alias depreciado de `/finance/estoque-intermediario`
- `SGBR_CREDENTIALS` env var — fallback opcional do proxy
- Frontend `EstoqueEspumaTab` — so renderizada quando `tenant.segment === 'industry'`

## O que ja existe e funciona

- TenantContext + TenantProvider no frontend (subdomain detection, branding)
- 19 permissoes granulares (admin/manager/viewer)
- AES-256-GCM para credenciais at rest
- Copilot IA com tool-calling (Groq provider)
- Audit logging de eventos de seguranca
- Command palette (Cmd+K)
- Dark/light mode com design tokens
- Code splitting (vendor-antd, vendor-charts, vendor-pdf)
- Drag-and-drop de widgets no dashboard
- Virtual scrolling para tabelas grandes
- Skeletons de loading (Dashboard, Financeiro, VendasAnalitico)

## Testes

- Backend: 11 test files (vitest) — 76 testes. Cobre app, permissions, segments, connectorSegments, MFA, account lockout, refresh tokens, RLS Postgres, crypto, registration anti-fraud, audit chain hash, shared cache, AI local provider
- Frontend: 11 test files (vitest) — 34 testes. Cobre auth service, normalizers, contracts, utils
- E2E: 5 specs Playwright (a11y, bi-reports, ops-admin, rbac-and-crud, smoke-saas) — rodam via `npm run test:e2e`
- Total: 110 testes unitarios + 5 specs e2e. Build limpo back e front sem erros TypeScript.

## Deploy

### Render (producao atual)
- Config em `render.yaml`
- Build script: `render-build.sh` (instala deps, builda frontend e backend)
- Start: `node dist/server.js`
- Frontend servido pelo Express (static files em `front-end-dist/`)

### Dev local
```bash
# Terminal 1 — Backend
cd back-end-gest-o && npm run dev

# Terminal 2 — Frontend
cd front-end-gest-o && npm run dev
```

## Planos e roadmap

O plano original (`docs/PLANO-SAAS.md`, 3606 linhas) foi 93% executado e arquivado.
Restou roadmap pos-GA compacto:

### Trilha pos-GA (codigo, quando houver PMF + time)

- **INT-1 Common Industrial Model**: Zod schemas comuns + transformation library cross-connector
- **INT-2 Multi-protocol/auth**: OAuth2 PKCE, Basic, header, cookie + retry/backoff
- **INT-3 Sync Engine v2**: incremental sync, watermarks, dead-letter queue
- **INT-4 Mapping Studio**: UI visual para mapping field-by-field
- **INT-5 Write-back / Webhook reverso**: enviar dados de volta ao ERP (Enterprise tier)
- **INT-6 Universal Data Ingestion**: file uploads, CSV drag-drop com auto-detection
- **INT-7 Smart Onboarding com IA**: detectar schema do ERP automaticamente

### Trilha pos-GA (operacional/pago — NAO e codigo)

- DPIA + DPA + Termos com advogado (R$ 5-15k, 1-2 sem)
- Pentest externo (R$ 10-30k, 2-4 sem) — bloqueador GA
- Cloudflare WAF Pro (R$ 100-300/mes), DAST managed, SSO Enterprise WorkOS (R$ 50/conexao)
- CNPJ + Stripe live KYC (R$ 0-1k, 1-2 sem)
- Hiring + runway + ESOP (OPS-1)

### SLOs principais (alvos GA)

- `POST /auth/login` p95 < 500ms; `GET /data/*` (proxy) p95 < 2s; `POST /copilot/chat` TTFT < 1.5s
- Dashboard: LCP < 2.0s, INP < 200ms, CLS < 0.1
- Bundle: vendor-antd < 1.2MB, entry < 100KB
- Carga: 500 tenants concurrent + 200 req/s sem degradar (validar com `back-end-gest-o/tests/load/baseline.js`)

### Severidade de incidentes

- **SEV-0** (vazamento PII / downtime total): resposta 15min, ANPD em 48h (LGPD Art.48), publico 7d
- **SEV-1** (RCE/SSRF/credential stuffing): 30min, cliente afetado 24h
- **SEV-2** (brecha contida / audit chain quebrada): 2h, equipe interna
- **SEV-3** (bug pontual): 24h, ticket

### Planos vivos

- `PLANO-IGA-IA.md` — Migracao do Copilot para Python (FastAPI + Claude + RAG, AI-1 a AI-6) — pos-GA
- `DEPLOY-TODAY.md` — Runbook 1-2h Beta Fechada (Render+Vercel+Supabase+Upstash)
- `beta/` — emails, onboarding, runbook, termo Beta
- `compliance/` — DPIA, RoPA, DPA-template (LGPD)

## Cuidados importantes

- **Nunca commitar `.env`** — contem credenciais reais
- **SGBR_CREDENTIALS** no .env e sensivel — nunca logar ou expor
- **SQLite** esta em `back-end-gest-o/data/` — nao esta no git, e criado automaticamente
- **proxy.ts** e o arquivo mais critico e complexo (~1000 linhas) — editar com cuidado
- **Cache do proxy** pode mascarar problemas — desabilitar com `PROXY_CACHE_TTL_MS=0` para debug
- **Ant Design v6** foi lancado recentemente — algumas APIs mudaram do v5. Consultar docs atuais.
- **React 19** esta em uso — usar `useActionState` e Actions para forms, evitar useMemo/useCallback manuais (React Compiler otimiza)
