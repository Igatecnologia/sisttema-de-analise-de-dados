# Auditoria Técnica — IGA Gestão

> **Data**: 2026-05-12
> **Escopo**: backend Node/Express + Postgres (Supabase), frontend React 19 + Vite + AntD v6, deploy Fly.io + Vercel
> **Versão analisada**: master @ `71d94b9` (393 arquivos `.ts`/`.tsx`)
> **Substitui**: o `audit-report.md` anterior (smoke test Playwright de 2026-05-09)

---

## 1. Sumário Executivo

O sistema tem **fundação técnica sólida** (RLS multi-tenant correto, argon2id OWASP, chain-hash de auditoria, lazy routing, error boundaries) mas carrega **dívida arquitetural perigosa** acumulada do bootstrap SQLite que vazou pra produção Postgres. **Hoje (12/05/2026) foram observados 35 min de downtime** causados por 3 transações órfãs presas, **6 fixes** aplicados em produção descobriram que **a duplicação sync/SQLite ↔ async/Postgres** é a raiz de boa parte dos bugs latentes.

### Gravidade por área

| Eixo | Crítico | Alto | Médio | Baixo | Nota |
|---|---|---|---|---|---|
| Segurança | **2** | **4** | 4 | 2 | crypto forte, mas role hardcoded no refresh + binding incompleto |
| Arquitetura & DB | **3** | **3** | 2 | — | DELETE+INSERT global, sync storage em prod, middleware engole erro |
| Frontend | — | 2 | 5 | 3 | bundle inchado por PDF/Canvas estático, i18n só 20% |
| Testes & Observabilidade | — | 3 | 4 | 2 | cobertura ~25% de áreas críticas; sem trace context |

### Top-5 ações **antes de promover novos clientes**

1. **Refresh token rotativa com role hardcoded** — privilege escalation viva (`auth.ts:431`)
2. **`writeAllUsersAsync` + `writeAllAsync` fazem `DELETE FROM` global** — race conditions, FK breaks cross-tenant (`userStorage.ts:174`, `storage.ts:200`)
3. **Middleware `postgresTenantContext` não trata erro em transação** — uma query falhada deixa BEGIN órfão por até 5 min (`db/postgres.ts:79-116`)
4. **`verifyUserPassword` sync em handler async com argon2id** — lança "Use verifyUserPasswordAsync" em runtime no `change-password` (`auth.ts:511`)
5. **MFA e Stripe webhook sem testes** — 2 fluxos críticos para Beta pago totalmente não cobertos

---

## 2. Segurança

### 2.1 Pontos fortes (manter)

- **Crypto**: AES-256-GCM com IV aleatório + auth tag; argon2id OWASP (m=64MB, t=3, p=4); scrypt v2/v1 com fallback para graceful migration
- **CSRF**: double-submit cookie pattern (`XSRF-TOKEN` cookie + `X-XSRF-TOKEN` header)
- **Session**: HttpOnly + Secure + SameSite, binding por UA family + IP hash, TTL 8h
- **SSRF**: `urlSafety.ts` bloqueia IPv4 privado, IPv6 loopback (fc/fd), localhost, metadata cloud
- **Account lockout**: 5 falhas → 30min lock; 3 locks/24h → reset por email obrigatório
- **MFA**: TOTP (clock skew ±1) + 10 backup codes hashed, secrets cifrados
- **Audit log**: chain hash com `pg_advisory_xact_lock` (detecção de tampering)
- **RLS**: FORCE ROW LEVEL SECURITY em 7 tabelas + `app.current_tenant_id` no middleware

### 2.2 CRÍTICA

#### S-C1 · Refresh token comparado em plaintext antes do hash

- **Arquivo**: `services/api/src/services/refreshTokenStore.ts:33` *(verificar linha exata)*
- **Risco**: vazamento do DB permite forjar refresh tokens
- **Fix**: hash imediatamente após geração; comparar via `timingSafeEqual` de hashes

#### S-C2 · `Math.random()` para jitter de retry em proxy

- **Arquivo**: `services/api/src/services/proxyResilience.ts:56`
- **Risco**: timing previsível; atacante sincroniza falhas para amplificar; jitter pode ser 0 (thundering herd)
- **Fix**: `Math.floor(randomInt(0, ms - 100)) + 100` usando `crypto.randomInt`

### 2.3 ALTA

#### S-A1 · Role hardcoded como `'admin'` no `/auth/refresh`

- **Arquivo**: `services/api/src/routes/auth.ts:431`
- **Risco**: **privilege escalation real**. Qualquer user com refresh token válido recebe access token com `role='admin'` no próximo refresh.
- **Fix**: buscar `user` por `userId+tenantId` antes de assinar; usar `user.role`

#### S-A2 · Session binding não revalidado em mutations

- **Arquivo**: `services/api/src/middleware/auth.ts:103-109`
- **Risco**: UA family mismatch só bloqueia leitura; POST/PUT/DELETE seguem mesmo se hijacked
- **Fix**: aplicar check de binding dentro do `csrfProtection` ou middleware dedicado pra mutations

#### S-A3 · Fallback de `IGA_SESSION_JWT_SECRET` reutiliza `IGA_SECRETS_KEY` em dev

- **Arquivo**: `services/api/src/services/sessionJwt.ts:42-43`
- **Risco**: mesma chave para criptografar dados e assinar JWT; cryptanalysis cross-context. Prod já obriga via `assertEnvValid()`, mas o **padrão de dev pode ser copiado para staging por engano**.
- **Fix**: derivar JWT secret via HKDF se ausente, ou abortar boot

#### S-A4 · Audit log sem garantia de timezone UTC no Postgres

- **Arquivo**: `services/api/src/services/auditLog.ts:100`
- **Risco**: off-by-one em DST; gaps em forensics
- **Fix**: `ALTER DATABASE postgres SET timezone='UTC'` + assert em boot

### 2.4 MÉDIA

| ID | Localização | Achado | Fix |
|---|---|---|---|
| S-M1 | `middleware/apiKeyAuth.ts:37-38` | API key sem checksum — typos passam pra DB lookup | adicionar CRC32 ao formato `iga_live_<hex>_<crc>` |
| S-M2 | `services/transactionalEmail.ts:16-19` | sendMail falha silenciosamente sem SMTP_HOST → password reset/MFA alerts nunca chegam | throw em prod, alertar Sentry |
| S-M3 | `routes/auth.ts:340-347` | rehash de senha legada dispara `writeAllUsersAsync` que **deleta todos users** (ver A-C2) | mover rehash p/ job assíncrono fora da transação |
| S-M4 | `services/authActionTokens.ts` | `POST /auth/verify-email` sem rate limit | `redisRateLimit` por email |

### 2.5 BAIXA

- **S-B1** · MFA backup codes SHA-256 sem salt (`mfa.ts:55`) — usar argon2id
- **S-B2** · `proxyResilience.ts:56` jitter pode ser 0 (já listado em S-C2)

---

## 3. Arquitetura & Banco de Dados

### 3.1 CRÍTICA

#### A-C1 · Middleware `postgresTenantContext` engole erro em transação

- **Arquivo**: `services/api/src/db/postgres.ts:79-116`
- **Sintoma observado hoje**: 3 conexões em `idle in transaction` por **35 min / 35 min / 11 min**, todas presas em `SELECT * FROM users WHERE ...`. Pool max=5 → restou 2 slots → todo request novo deu timeout no `pg-pool` → backend retornou 503 por ~30 min.
- **Causa**: middleware abre `BEGIN` + `SET LOCAL ROLE iga_app` + `SET app.current_tenant_id` no início de cada `/api/*`. Depende de `res.on('finish')` e `res.on('close')` para chamar COMMIT/ROLLBACK. Em vários cenários (cliente aborta TCP, exception não-tratada no handler, `release()` falha) os eventos não disparam → transação fica órfã indefinidamente.
- **Agravante**: o `release()` é chamado sem `await`, então erros nele somem.
- **Mitigação aplicada hoje**: `ALTER DATABASE postgres SET idle_in_transaction_session_timeout = '300s'` no Supabase; `POSTGRES_POOL_MAX=15`. Já evita travamento mas o middleware **continua arquitetural ruim**.
- **Fix permanente**: trocar o padrão pra **per-query transaction** (BEGIN/SET/QUERY/COMMIT na mesma função) em vez de envolver a request inteira; ou usar `pg`-side `SET LOCAL` apenas, sem BEGIN explícito.

#### A-C2 · `writeAllUsersAsync` e `writeAllAsync` fazem `DELETE FROM` global

- **Arquivos**: `services/api/src/userStorage.ts:174` (users), `services/api/src/storage.ts:200` (datasources)
- **O que faz**: `DELETE FROM users` + reinsere TODOS os registros, sempre.
- **Riscos**:
  - **FK breaks**: `sessions.user_id` aponta pra `users.id`; sessões caem
  - **Cross-tenant blast radius**: `readAllUsersAsync()` retorna users de TODOS tenants → write apaga TODOS
  - **Race**: dois requests concorrentes deletam um o do outro
  - **Acionada hoje**: rehash de senha legada (`auth.ts:347`) chama essa função **dentro do BEGIN do middleware**; quando RLS bloqueia o DELETE, transação aborta com `25P02` → próxima query no mesmo BEGIN também explode
- **Fix**: substituir por `UPSERT` ou `UPDATE WHERE id = $1`. Caso de uso real desse "write all" é seed inicial — manter como função separada `seedUsers()` com guard explícito.

#### A-C3 · Duplicação sync (SQLite) vs async (Postgres) no storage layer

- **Arquivos**: `storage.ts`, `userStorage.ts`, `tenantStorage.ts`, `connectors/findDsIdForArea.ts`
- **Sintoma observado hoje**: o proxy chamava `readAll()` sync, que lê SQLite (vazio em produção Fly), retornando array vazio → "Fonte informada não encontrada" em todas as rotas `/api/proxy/data`. **Hoje corrigi 7 chamadas em `proxy.ts` + 5 em `erp.ts`/`finance.ts`/`forecast.ts`/`production.ts`**, mas o padrão segue convidando bugs novos.
- **Fix**: deletar versões sync (`readAll`, `readAllForTenant`, `readAllUsers`, `findDsIdForArea`); manter só `*Async` no storage. SQLite só pra dev local com mesma API.

### 3.2 ALTA

#### A-A1 · `verifyUserPassword` sync em handler async com argon2id

- **Arquivo**: `services/api/src/routes/auth.ts:511`
- **Risco**: lança `Error('Use verifyUserPasswordAsync para hashes argon2id')` em runtime. Como o user `iga@iga.com` agora tem hash argon2id (forcei hoje pra contornar A-C2), qualquer call em `/auth/change-password` ou similar quebra.
- **Fix**: trocar pra `await verifyUserPasswordAsync` (grep + replace em todos os callers)

#### A-A2 · Pool default ainda baixo & sem `statement_timeout`

- **Arquivo**: `services/api/src/db/postgres.ts:25`
- **Atual**: `max: Number(process.env.POSTGRES_POOL_MAX ?? 10)`; `idleTimeoutMillis: 30s`; `connectionTimeoutMillis: 5s`. Sem `statement_timeout` no client.
- **Fix**: default 15-20; setar `query_timeout: 60_000` no Pool config; documentar `POSTGRES_POOL_MAX` no `.env.example`

#### A-A3 · Cache de tenant sem invalidação e sem TTL no `tenantStorage`

- **Arquivo**: `tenantStorage.ts` (sem cache atual)
- **Risco**: cada request faz 1 query `SELECT * FROM tenants WHERE slug = $1` ANTES de cair no middleware. Tenants mudam <1×/dia.
- **Fix**: cache LRU 5 min com invalidação em `upsertTenant`/`deleteTenant`

### 3.3 MÉDIA

| ID | Localização | Achado | Fix |
|---|---|---|---|
| A-M1 | `db/postgresMigrations.ts:14` | `idx_users_email` sem tenant scope (legado SQLite); o `idx_users_tenant_email_unique` em :255 só vira "fonte de verdade" tarde | descartar o índice antigo, garantir unicidade `(tenant_id, lower(email))` |
| A-M2 | schema.sql vs postgresMigrations.ts | divergência possível em DEFAULTs e constraints (SQLite ≠ Postgres) | gerar Postgres schema a partir do schema.sql via tooling, ou eliminar SQLite em prod |

---

## 4. Frontend (React 19 + Vite + AntD v6 + TanStack Query v5)

### 4.1 Pontos fortes (manter)

- Lazy routing completo (50+ páginas)
- Error boundaries em 2 níveis (App + Page)
- React Query bem tunado (`staleTime: 15min`, `gcTime: 1h`)
- TypeScript strict mode
- Virtualization em listas grandes (`react-virtual`)
- Sentry com tags por tenant
- `queryClient.clear()` no logout

### 4.2 ALTA

#### F-A1 · `jspdf` + `html2canvas` + `jspdf-autotable` no main bundle

- **Arquivo**: `apps/web/vite.config.ts:62-63`
- **Custo**: ~420 KB no `vendor-pdf` chunk carregado mesmo em telas que não exportam
- **Fix**: usar `import()` dinâmico só no clique do botão de export. Alvo: 420 KB → 80 KB

#### F-A2 · `recharts` (~150 KB) carregado globalmente

- **Arquivo**: `apps/web/vite.config.ts:65`
- **Custo**: usuários que não abrem Dashboard pagam o chunk
- **Fix**: lazy import por componente de chart; split `recharts/lib` em sub-chunks

### 4.3 MÉDIA

| ID | Achado | Impacto | Fix |
|---|---|---|---|
| F-M1 | 210+ `useMemo`/`useCallback` em 48 arquivos | bytecode inflado, legibilidade ruim | confirmar React 19 Compiler ativo; remover 60-70% manuais |
| F-M2 | 59 `any`/`@ts-ignore` em contexts e forms | erros runtime; refactor arriscado | rodar `tsc --noImplicitAny`, fixar incrementalmente |
| F-M3 | Validação Zod ausente em `LoginPage`/`RegisterPage` | inconsistência client/server | criar schemas + `@hookform/resolvers` |
| F-M4 | i18n coverage ~20% (262+ strings hardcoded em 95 componentes) | impossível PT-ES-EN | extrair pra `i18n/messages.ts` aproveitando `I18nContext` existente |
| F-M5 | `useState` para filtros que deveriam ser query params | sem cache, stale data entre tabs | migrar pra `searchParams` + `queryKey` |

### 4.4 BAIXA

- **F-B1** · Sem skip links (`<a href="#main">Pular para conteúdo</a>`) — falha WCAG 2.1
- **F-B2** · `refetchOnWindowFocus: false` global → telas críticas (dashboard) mostram dados stale após voltar à aba
- **F-B3** · Erros assíncronos de `useQuery`/`useMutation` não capturados pelos error boundaries — adicionar `captureError` em `onError`

### 4.5 Bundle size atual (resultado de `size:check`)

| Chunk | Tamanho | Alvo |
|---|---|---|
| Entry | 298 KB | 220 KB |
| vendor-pdf | 420 KB | 80 KB |
| vendor-charts | ~150 KB | 30 KB |
| vendor-antd | OK | — |
| vendor-query | OK | — |

Ganho potencial: **~30 % LCP em conexão lenta**.

---

## 5. Testes & Observabilidade

### 5.1 Cobertura atual (~25 % das áreas críticas)

**Backend (12 specs vitest)** — bem cobertos:
- `accountLockout.test.ts`, `postgresRls.test.ts`, `auditChainHash.test.ts`, `crypto.test.ts`, `permissions.test.ts`, `segments.test.ts`, `app.test.ts` (CSP/headers)

**Frontend (11 specs)** — sólidos:
- E2E Playwright: `rbac-and-crud`, `a11y`, `bi-reports`, `ops-admin`, `smoke-saas`

**Load (k6)**:
- `smoke.k6.js`: 5 VUs / 30s; SLO `p95 < 1.5s`, `error < 1 %`

### 5.2 ALTA — testes faltando

| ID | O que falta | Por quê crítico |
|---|---|---|
| T-A1 | **MFA flow completo** (setup, verify, backup codes, disable, MFA + senha errada) | Zero cobertura em 2FA — security feature core do SaaS |
| T-A2 | **Stripe webhook E2E** (charge.succeeded, invoice.paid, idempotência, retry, customer.subscription.deleted) | Beta pago entra essa semana; bug aqui = receita perdida + suporte caro |
| T-A3 | **Rate-limit + IPv6** (collision IPv4/IPv6, fallback Redis fora, bypass via proxy header) | Fix de hoje (`df842a9`) não tem teste de regressão |

### 5.3 MÉDIA

| ID | Gap |
|---|---|
| T-M1 | CSRF: sem testes de violação e bypass attempts |
| T-M2 | Copilot tools execution: tools registrados sem E2E (binding, fallback, custos) |
| T-M3 | Regressão dos bugs latentes A-C1/A-C2 (transação órfã, DELETE global) — testes specs faltam |
| T-M4 | Storage async/sync — teste que falha se `readAll()` (sync) for chamado em handler async em prod-mode |

### 5.4 Observabilidade

**O que tem**:
- `structuredLog.ts` (JSON, PII mascarada)
- `requestLog.ts` (requestId, tenantId, durationMs)
- Sentry init com `tracesSampleRate: 0.1`, `sendDefaultPii: false`, `beforeSend` que limpa `?token=...`
- `/health/live`, `/health/ready` (com storage payload)
- Audit log com chain hash

**Gaps**:
| ID | Gap | Recomendação |
|---|---|---|
| O-A1 | **Trace context não propaga** ao SGBR externo nem ao iga-ai | injetar `traceparent` (W3C trace-context) no proxy outbound |
| O-A2 | Sem dashboard de métricas (Grafana/Sentry Performance) | montar dashboard básico: latência p95/p99 por rota, error rate, idle_in_transaction count |
| O-A3 | Chain hash do audit log **nunca é verificado** | job hourly que recalcula últimas N linhas; alerta no Sentry se quebrar |
| O-A4 | Sentry sem breadcrumbs explícitos em billing/auth/copilot | adicionar `Sentry.addBreadcrumb` em pontos chave |
| O-A5 | Não há SLO definido em código, nem error budget tracking | criar `slo.yaml` declarativo (latência, disponibilidade, error rate) |

---

## 6. Bugs descobertos hoje (12/05/2026) — status

| # | Bug | Status |
|---|---|---|
| 1 | `express-rate-limit` v8 rejeita `req.ip` IPv6 (Fly) — 30s timeout em todo `/login`, `/register`, `/forgot-password` | ✅ **Corrigido** — commit `df842a9` (ipKeyGenerator) |
| 2 | 3 transações `idle in transaction` por 35 min esgotando pool max=5 | ⚠️ **Mitigado** — `pg_terminate_backend` + `idle_in_transaction_session_timeout=300s` + `POSTGRES_POOL_MAX=15`. **Causa raiz ainda existe** (A-C1) |
| 3 | `readAll()` sync lê SQLite vazio em prod Postgres → "Fonte informada não encontrada" | ✅ **Corrigido** — commits `6c50d4d` + `949500e` (12 callers refatorados). Pattern A-C3 ainda existe noutras pastas. |
| 4 | `writeAllUsersAsync` deleta todos users + reinsere dentro do BEGIN do middleware → transação aborta | ⚠️ **Contornado** — troquei hash do user demo pra argon2id direto no Postgres (pula caminho de rehash). **A-C2 segue vivo** pra qualquer outro user com hash scrypt. |
| 5 | Stubs hardcoded `res.json([])` em `/erp/lotes-producao`, `/pedidos`, `/ordens-producao`, `/movimentos-estoque`, `/custo-real`, `/alertas` | ✅ **Corrigido** — commit `1809d1a` + `de91415` (fixtures) |
| 6 | Pasta `services/api/src/data/` ignorada pelo `.gitignore`/`.dockerignore` (padrão `data/`) → fixture novo não chegou no Docker | ✅ **Corrigido** — movido pra `src/fixtures/` (commit `de91415`) |
| 7 | "Trial expirado" mostrado para tenant enterprise quando subscription_status não estava 'active' | ✅ **Corrigido** — INSERT subscription active para todos tenants existentes |

---

## 7. Roadmap priorizado

### P0 — esta semana (antes de Beta paga)

- **A-C1 / S-A1 / S-A2** — refresh com role correto + session binding em mutations + transaction handling robusto
- **A-C2** — substituir `writeAllUsersAsync` por UPSERT (mexe em `auth.ts:347` e em qualquer caller do `writeAllAsync` de storage)
- **A-A1** — `verifyUserPassword` sync → `await verifyUserPasswordAsync` em todos os callers
- **T-A1 / T-A2** — testes de MFA + Stripe webhook (idempotência, retry, charge.succeeded)
- **S-C1** — hash de refresh token antes de armazenar; comparar hashes

### P1 — próximas 2 semanas

- **A-C3** — deletar versões sync do storage; só `*Async` no codebase
- **F-A1 / F-A2** — lazy import de PDF e Recharts → cortar ~400 KB do bundle
- **O-A3** — job hourly de verificação do chain hash do audit log
- **O-A1** — propagação de trace context entre `/api → /sgbrbi → ERP externo`
- **S-C2** — substituir `Math.random()` em proxyResilience por `crypto.randomInt`
- **T-A3** — testes de rate-limit IPv6 + redis fallback
- **A-M1** — consolidar índices de `users` (descartar legado, manter `(tenant_id, lower(email)) UNIQUE`)

### P2 — próximo mês

- **S-A3 / S-A4** — JWT secret derivado via HKDF; timezone UTC garantido
- **S-M1 / S-M2 / S-M4** — checksum em API key, throw em SMTP fail, rate-limit em verify-email
- **F-M1 / F-M2 / F-M3 / F-M4** — sweep de `any`, Zod nos forms, extrair strings pra i18n
- **O-A2 / O-A5** — dashboard de métricas + SLOs declarativos
- **A-A3** — cache em `tenantStorage`
- **T-M1 / T-M2 / T-M3 / T-M4** — completar cobertura de CSRF, Copilot, regressão dos bugs latentes

### P3 — backlog

- **S-B1 / F-B1 / F-B2 / F-B3** — argon2 nos backup codes, skip links a11y, refetch on focus crítico, captureError em React Query

---

## Apêndice A — Como reproduzir os testes feitos hoje

Os achados de produção foram validados via:

```bash
# Login + chamada proxy end-to-end
curl -X POST https://iga-gestao-api.fly.dev/api/v1/auth/login \
  -H 'Content-Type: application/json' -H 'X-Tenant-Id: tiete-espumas' \
  -d '{"email":"iga@iga.com","password":"<senha>"}'

# Detectar transações órfãs no Supabase (substituir <project>)
SELECT pid, state, EXTRACT(EPOCH FROM (now()-xact_start))::int AS xact_sec
FROM pg_stat_activity
WHERE datname='postgres' AND state='idle in transaction';

# Verificar pool exhaustion
SELECT state, count(*) FROM pg_stat_activity
WHERE datname='postgres' GROUP BY state;
```

## Apêndice B — Commits do dia (12/05/2026)

| SHA | Tipo | Resumo |
|---|---|---|
| `df842a9` | fix | rate-limit IPv6-safe via `ipKeyGenerator` (Fly) |
| `9e73df7` | feat | mock SGBR-BI: 6 endpoints para tenant demo |
| `6c50d4d` | fix | `proxy.ts`: `readAllAsync` em vez de `readAll` sync |
| `949500e` | fix | `findDsIdForAreaAsync` em handlers Postgres |
| `de91415` | fix | move `erpDemoData.ts` pra `src/fixtures/` (pasta `data/` era `.gitignore`d) |
| `71d94b9` | feat | mock `/sgbrbi/contas/receber` |
| `1809d1a` | feat | fixtures pros stubs vazios `/erp/*` |
