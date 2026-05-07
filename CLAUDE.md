# CLAUDE.md — IGA Gestao

Contexto para o Claude Code trabalhar neste repositorio.

## O que e este projeto

Sistema de gestao industrial (BI) que conecta a ERPs via proxy de API e exibe dashboards de producao, estoque, financeiro, vendas e compras. Inclui IA Copilot integrada.

**Estado atual**: Aplicativo desktop single-tenant sendo transformado em SaaS multi-tenant.

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
│   │   ├── db/
│   │   │   ├── sqlite.ts  # Banco SQLite (sera migrado para PostgreSQL)
│   │   │   └── schema.sql
│   │   ├── services/ai/   # Copilot: orchestrator, providers, tools
│   │   └── jobs/          # warmCache, dbBackup, copilotRetention, scheduledReports
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
├── PLANO-SAAS.md          # Plano completo de transformacao SaaS (v3)
├── PLANO-LANDING-PAGE.md  # Plano da landing page
├── TROUBLESHOOTING.md     # Guia de resolucao de problemas de dados
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
- **Banco**: SQLite (via better-sqlite3) — sera migrado para PostgreSQL
- **Auth**: Sessoes em SQLite, cookie httpOnly `iga_session`, CSRF via `X-XSRF-TOKEN`
- **Jobs**: setInterval (sera migrado para BullMQ)
- **Email**: Nodemailer (scheduled reports)
- **IA**: Groq API (Copilot), abstraction layer em `services/ai/`

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

### Backend (.env) — obrigatorias
```
PORT=3001
FRONTEND_URL=http://localhost:5173
SGBR_CREDENTIALS=usuario:senha
ADMIN_DEFAULT_EMAIL=admin@iga.com
ADMIN_DEFAULT_PASSWORD=SenhaForte123
```

### Frontend (.env.local) — obrigatorias
```
VITE_API_BASE_URL=http://localhost:3001
```

Ver `TROUBLESHOOTING.md` para lista completa de variaveis opcionais.

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

## O que esta hardcoded para SGBR (precisa desacoplar)

- `routes/erp.ts` — 10 referencias a `/sgbrbi/*`
- `routes/finance.ts` — `classifyEstoqueItem()` classifica por espuma/aglomerado
- `routes/proxy.ts` — `SGBR_CREDENTIALS` fallback, token retry SGBR-specific
- `jobs/warmCache.ts` — `tenantId='default'` hardcoded
- `app.ts` — CSP whitelist `*.sgbrbi.com.br`
- Frontend: schemas com tipos fixos de espuma, 4 arquivos `sgbr*Normalize`

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

- Backend: 4 test files (vitest) — app, permissions, localProvider, crypto
- Frontend: 11 test files (vitest) — normalizers, contracts, utils
- E2E: 3 specs Playwright (auth, rbac, bi-reports) — nao executados em CI
- Cobertura geral: baixa. Priorizar testes de isolamento quando migrar para multi-tenant.

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

- `PLANO-SAAS.md` — Plano completo de transformacao SaaS (9 sprints, 15 semanas)
- `PLANO-LANDING-PAGE.md` — Landing page de conversao (Next.js + Tailwind)
- `TROUBLESHOOTING.md` — Guia de diagnostico quando dados nao carregam

## Cuidados importantes

- **Nunca commitar `.env`** — contem credenciais reais
- **SGBR_CREDENTIALS** no .env e sensivel — nunca logar ou expor
- **SQLite** esta em `back-end-gest-o/data/` — nao esta no git, e criado automaticamente
- **proxy.ts** e o arquivo mais critico e complexo (~1000 linhas) — editar com cuidado
- **Cache do proxy** pode mascarar problemas — desabilitar com `PROXY_CACHE_TTL_MS=0` para debug
- **Ant Design v6** foi lancado recentemente — algumas APIs mudaram do v5. Consultar docs atuais.
- **React 19** esta em uso — usar `useActionState` e Actions para forms, evitar useMemo/useCallback manuais (React Compiler otimiza)
