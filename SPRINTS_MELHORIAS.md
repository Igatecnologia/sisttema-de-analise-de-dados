# Plano de Sprints — Sistema de Gestão IGA

> **Base:** [`RELATORIO_ANALISE_TECNICA.md`](./RELATORIO_ANALISE_TECNICA.md) — Nota 7.9/10
> **Meta:** elevar o sistema para **9.0+** em 90 dias
> **Cadência:** 6 sprints de 2 semanas · capacidade estimada **40 story points/sprint** (1 dev sênior)
> **Início sugerido:** 2026-04-20 · **Fim:** 2026-07-12

---

## 📐 Convenções

**Story Points (Fibonacci):**
- `1` = trivial (≤ 1h) · `2` = simples (≤ meio dia) · `3` = pequeno (1 dia)
- `5` = médio (2-3 dias) · `8` = grande (3-5 dias) · `13` = épico (1 semana+)

**Prioridade:**
- 🔴 **P0** — crítico/bloqueante · 🟠 **P1** — alto valor · 🟡 **P2** — desejável · 🔵 **P3** — nice-to-have

**Categorias:** `SEC` segurança · `PERF` performance · `UX` experiência · `FEAT` funcionalidade · `DX` dev experience · `TECH` dívida técnica · `TEST` testes

**Definition of Done (DoD) — toda task precisa:**
- ✅ Código revisado (PR aprovado)
- ✅ Testes automatizados (unit + integração quando aplicável)
- ✅ `npm run lint` + `npm run check` (tsc) sem erros
- ✅ Documentação atualizada (README/AGENTS.md quando relevante)
- ✅ Deploy em ambiente de staging validado
- ✅ Sem regressão em testes e2e existentes

---

## 🎯 Visão geral — mapa dos 3 blocos

| Bloco | Sprints | Tema | Objetivo estratégico |
|:---:|:---:|---|---|
| 🟢 **Bloco 1** | S1 · S2 | Corrigir & Polir | Fechar gaps de segurança e qualidade (Nota Segurança 7.0 → 9.0) |
| 🟡 **Bloco 2** | S3 · S4 | Identidade & Experiência | Elevar UX/Motion (6.5 → 9.0) e percepção de marca |
| 🔵 **Bloco 3** | S5 · S6 | Escala & Diferenciação | Migrar persistência + funcionalidades premium (IA, alertas) |

---

# 🟢 BLOCO 1 — Corrigir e Polir (Sprints 1-2)

## 🏃 Sprint 1 — "Blindagem de Segurança"

**Período:** 2026-04-20 → 2026-05-03 (14 dias)
**Tema:** Fechar achados críticos de segurança do relatório
**Capacidade:** 40 SP · **Objetivo:** Nota Segurança 7.0 → 8.5

### 🎯 Meta da sprint
> Eliminar os 5 achados críticos de segurança identificados no relatório (seção 13) e estabelecer baseline de observabilidade.

### 📋 Backlog da sprint

#### 🔴 SEC-001 — Migrar token de `localStorage` para cookie HttpOnly (8 SP) — P0
**Arquivos:** `front-end-gest-o/src/auth/authStorage.ts` · `front-end-gest-o/src/api/axiosWithAuth.ts` · `back-end-gest-o/src/middleware/auth.ts`

**Tasks:**
- [ ] Remover `localStorage.setItem('t:...auth.session', ...)` do front
- [ ] Backend já devolve cookie `iga_session` — confirmar flags `HttpOnly` + `Secure` em prod + `SameSite=Strict`
- [ ] Axios usar `withCredentials: true` em todas as requests
- [ ] Auth context ler perfil via `GET /api/v1/auth/me` em vez de decodificar token
- [ ] Criar endpoint `GET /api/v1/auth/me` no back (devolve user do token)
- [ ] Migração suave: remover tokens legados do localStorage no 1º load
- [ ] Atualizar testes e2e de login

**Critérios de aceitação:**
- ✅ `localStorage.getItem('t:...auth.session')` retorna `null` em uma sessão nova
- ✅ Cookie `iga_session` tem `HttpOnly=true`, `Secure=true` (prod), `SameSite=Strict`
- ✅ Reload da página mantém sessão ativa
- ✅ XSS simulado (`<script>fetch('/api/v1/users',{credentials:'include'})</script>` em CSP relaxado) não consegue extrair o token
- ✅ Logout revoga o cookie (`Set-Cookie: iga_session=; Max-Age=0`)

---

#### 🔴 SEC-002 — Criptografar credenciais SGBR em repouso (8 SP) — P0
**Arquivos:** `back-end-gest-o/src/storage.ts` · `back-end-gest-o/src/routes/datasources.ts` · `back-end-gest-o/src/routes/proxy.ts`

**Tasks:**
- [ ] Adicionar variável `IGA_SECRETS_KEY` (env, 32 bytes hex) — documentar geração com `openssl rand -hex 32`
- [ ] Criar `src/services/crypto.ts` com `encrypt(plaintext) → ciphertext` e `decrypt(ciphertext) → plaintext` usando **AES-256-GCM** com IV aleatório por registro
- [ ] Campo `authCredentials` no JSON passa a ser objeto `{ v: 1, iv, tag, ciphertext }` em vez de string
- [ ] `storage.ts` criptografa antes de gravar, descriptografa ao ler
- [ ] Script de migração `scripts/migrate-encrypt-datasources.ts` para rotacionar datasources existentes
- [ ] Em dev, se `IGA_SECRETS_KEY` ausente → log warning + usa chave derivada do path do `userData` (não seguro, mas funcional)
- [ ] Rotação de chave: suporte a `IGA_SECRETS_KEY_PREV` para reprocessar

**Critérios de aceitação:**
- ✅ Abrir `data/datasources.json` manualmente — credenciais aparecem como ciphertext base64
- ✅ Sem `IGA_SECRETS_KEY` em produção → backend falha ao iniciar (fail-safe)
- ✅ Rotação de chave via CLI funciona (datasource ainda responde após rotacionar)
- ✅ Teste `vitest` com round-trip encrypt → decrypt igualdade

---

#### 🟠 SEC-003 — Reativar CSP com allowlist Ant Design (3 SP) — P1
**Arquivos:** `back-end-gest-o/src/app.ts`

**Tasks:**
- [ ] Definir CSP explícita:
  ```
  default-src 'self';
  script-src 'self' 'unsafe-eval';     // Ant precisa de eval em dev
  style-src 'self' 'unsafe-inline';    // Ant CSS-in-JS
  img-src 'self' data: blob:;
  font-src 'self' data:;
  connect-src 'self' https://*.sgbrbi.com.br;
  frame-ancestors 'none';
  ```
- [ ] Helmet sem `contentSecurityPolicy: false`
- [ ] Testar console do navegador — zero violations em fluxo login → dashboard → vendas
- [ ] Documentar em `AGENTS.md` seção de CSP

**Critérios de aceitação:**
- ✅ Header `Content-Security-Policy` presente em todas as respostas
- ✅ App funciona 100% em produção com CSP ativa
- ✅ Tentativa de injetar `<script src="http://evil.com">` é bloqueada

---

#### 🟠 SEC-004 — Rate limit em endpoints sensíveis (2 SP) — P1
**Arquivos:** `back-end-gest-o/src/routes/datasources.ts` · `back-end-gest-o/src/routes/users.ts`

**Tasks:**
- [ ] Rate limit em `POST /api/v1/datasources/:id/test` → 10/min por IP+user
- [ ] Rate limit em `POST /api/v1/users` (admin-only mas ainda assim) → 20/hora
- [ ] Rate limit em `POST /api/v1/auth/change-password` → 5/hora por user

**Critérios de aceitação:**
- ✅ 11ª chamada em 1 min retorna `429 Too Many Requests`
- ✅ Header `Retry-After` presente
- ✅ Testes `supertest` cobrindo cada limite

---

#### 🟠 SEC-005 — ErrorBoundary global + telemetria (5 SP) — P1
**Arquivos:** `front-end-gest-o/src/App.tsx` · `front-end-gest-o/src/components/ErrorBoundary.tsx` (novo) · `front-end-gest-o/src/monitoring/`

**Tasks:**
- [ ] Componente `<ErrorBoundary fallback={<ErrorFallback />}>` envolvendo `<AppRouter />`
- [ ] Fallback amigável com botão "Recarregar" + código do erro
- [ ] Enviar para `POST /api/v1/ops/client-error` (novo endpoint no back)
- [ ] Backend loga em `logs/client-errors-YYYY-MM-DD.log`
- [ ] Avaliar integração futura com Sentry (apenas arquitetar, não implementar ainda)

**Critérios de aceitação:**
- ✅ Erro forçado em dev (`throw new Error('test')` em um componente) mostra fallback
- ✅ Erro aparece no log do back em até 5s
- ✅ App pode ser recuperado sem recarregar toda a janela

---

#### 🟡 TECH-001 — ESLint + Prettier no backend (3 SP) — P2
**Arquivos:** `back-end-gest-o/.eslintrc.json` (novo) · `back-end-gest-o/.prettierrc` (novo) · `back-end-gest-o/package.json`

**Tasks:**
- [ ] Config ESLint flat (eslint.config.js) com `@typescript-eslint`
- [ ] Prettier alinhado ao front (single quote, trailing comma, 100 chars)
- [ ] Scripts: `lint`, `lint:fix`, `format`
- [ ] Adicionar ao CI (`.github/workflows/ci.yml`)

**DoD extra:** CI falha se lint falhar.

---

#### 🟡 DX-001 — Husky + lint-staged + commitlint (3 SP) — P2
**Arquivos:** raiz do monorepo

**Tasks:**
- [ ] `npx husky init`
- [ ] Pre-commit: `lint-staged` rodando `eslint --fix` + `prettier --write` em `*.{ts,tsx}`
- [ ] Commit-msg: `commitlint` com `@commitlint/config-conventional`
- [ ] Documentar padrão em novo `CONTRIBUTING.md`

---

#### 🟡 TEST-001 — Baseline de cobertura no backend (8 SP) — P2
**Arquivos:** `back-end-gest-o/src/*.test.ts`

**Tasks:**
- [ ] Vitest com `--coverage` (c8)
- [ ] Testes para `userStorage` (hash, verify, CRUD)
- [ ] Testes para `storage` (lock, read/write, migration)
- [ ] Testes para `crypto.ts` (round-trip, rotação de chave)
- [ ] Testes para `permissions.ts` (resolveEffectivePermissions)
- [ ] Meta: **60% lines** no back-end
- [ ] Badge de cobertura no README

**Critérios de aceitação:**
- ✅ `npm run test -- --coverage` gera relatório
- ✅ CI sobe coverage report como artifact

---

### 📊 Sprint 1 — Total: 40 SP

| ID | Título | SP | Prioridade |
|---|---|:---:|:---:|
| SEC-001 | Cookie HttpOnly | 8 | 🔴 P0 |
| SEC-002 | Criptografia credenciais SGBR | 8 | 🔴 P0 |
| SEC-003 | CSP reativado | 3 | 🟠 P1 |
| SEC-004 | Rate limit endpoints | 2 | 🟠 P1 |
| SEC-005 | ErrorBoundary + telemetria | 5 | 🟠 P1 |
| TECH-001 | ESLint/Prettier back | 3 | 🟡 P2 |
| DX-001 | Husky + commitlint | 3 | 🟡 P2 |
| TEST-001 | Cobertura baseline back | 8 | 🟡 P2 |

### 🎁 Entregáveis Sprint 1
- 🔒 Token fora do localStorage (cookie HttpOnly)
- 🔐 Credenciais SGBR criptografadas em repouso
- 🛡 CSP ativa em produção
- 🚨 Rate limits em endpoints sensíveis
- 💥 ErrorBoundary com telemetria
- 📏 ESLint/Prettier no back + Husky
- 📊 Cobertura backend ≥ 60%

---

## 🏃 Sprint 2 — "Polimento Técnico"

**Período:** 2026-05-04 → 2026-05-17 (14 dias)
**Tema:** Qualidade de código, testes, I/O e observabilidade
**Capacidade:** 40 SP · **Objetivo:** Nota Testes 6.5 → 8.0 + Performance 8.0 → 8.5

### 🎯 Meta da sprint
> Eliminar I/O síncrono bloqueante, subir cobertura de testes para 70%+ e adicionar 5 fluxos e2e críticos.

### 📋 Backlog

#### 🟠 PERF-001 — Converter I/O síncrono → assíncrono com `fs/promises` (5 SP) — P1
**Arquivos:** `back-end-gest-o/src/storage.ts` · `back-end-gest-o/src/userStorage.ts`

**Tasks:**
- [ ] Substituir `readFileSync` / `writeFileSync` por `readFile` / `writeFile` de `node:fs/promises`
- [ ] Propagar `async/await` até os route handlers
- [ ] Cache com `mtimeMs` usa `stat()` async
- [ ] Lock em `runWithDatasourcesLock` usa `Promise` chain em vez de flag

**Critérios de aceitação:**
- ✅ Loadtest (k6/autocannon) em `GET /api/v1/users` com 100 users.json → p95 < 50ms
- ✅ Zero calls para `*Sync` no runtime

---

#### 🟠 TEST-002 — E2E Playwright para 5 fluxos críticos (13 SP) — P1
**Arquivos:** `front-end-gest-o/tests/e2e/*.spec.ts`

**Fluxos:**
1. **Login → home** (valida cookie, redirect por role)
2. **Criar usuário admin** (admin loga → cadastra → novo user loga)
3. **CRUD datasource** (criar → testar conexão → editar → deletar)
4. **Vendas Analítico com filtro de período** (selecionar mês → ver dados → exportar CSV)
5. **Exportar relatório PDF** (dashboard → botão exportar → validar download)

**Tasks:**
- [ ] Fixtures compartilhados (user admin, user viewer, datasource fake)
- [ ] MSW para mockar SGBR em testes (já instalado)
- [ ] CI roda e2e em ambiente headless Ubuntu (já existe job)
- [ ] Retry automático em falhas flaky (max 2)

**Critérios de aceitação:**
- ✅ 5 specs passando no CI
- ✅ Tempo total < 3 min
- ✅ Screenshots em falha anexados como artifact

---

#### 🟡 TEST-003 — Coverage report no CI (3 SP) — P2
**Arquivos:** `.github/workflows/ci.yml` · `package.json`

**Tasks:**
- [ ] Job de coverage com upload para Codecov ou GitHub Pages
- [ ] Badge no README (`![coverage](...)`)
- [ ] Threshold mínimo: 70% back, 60% front

---

#### 🟡 PERF-002 — Lazy load de libs pesadas (jsPDF + html2canvas) (3 SP) — P2
**Arquivos:** `front-end-gest-o/src/pages/ReportsPage.tsx` · `utils/financeExport.ts`

**Tasks:**
- [ ] `const { jsPDF } = await import('jspdf')` apenas quando botão for clicado
- [ ] Idem `html2canvas`
- [ ] Medir bundle size antes/depois com `rollup-plugin-visualizer`

**Critérios de aceitação:**
- ✅ Bundle inicial `< 400 KB` gzipped
- ✅ Chunk `pdf-export` carrega sob demanda

---

#### 🟡 PERF-003 — Bundle analyzer + size-limit (2 SP) — P2
**Tasks:**
- [ ] Adicionar `rollup-plugin-visualizer` no `vite.config.ts` (modo stats)
- [ ] `size-limit` no CI com budget por chunk
- [ ] Documentar em `docs/PERFORMANCE_BUDGETS.md`

---

#### 🟠 UX-001 — Skeleton screens específicos (5 SP) — P1
**Arquivos:** `front-end-gest-o/src/components/skeletons/*.tsx` (novos)

**Tasks:**
- [ ] Skeleton para Dashboard (KPI cards + 2 gráficos)
- [ ] Skeleton para VendasAnalitico (tabela com 10 linhas shimmer)
- [ ] Skeleton para Financeiro (3 abas com placeholders)
- [ ] Shimmer CSS com `background-image: linear-gradient(...)` + keyframes
- [ ] Respeitar `prefers-reduced-motion`

---

#### 🟡 DX-002 — Diagrama de arquitetura (Mermaid) (2 SP) — P2
**Arquivos:** `docs/ARCHITECTURE.md` (novo)

**Tasks:**
- [ ] Diagrama de componentes (front ↔ back ↔ SGBR ↔ Electron)
- [ ] Fluxo de autenticação (sequence diagram)
- [ ] Fluxo de dados (datasource → proxy → SGBR → front)

---

#### 🟡 DX-003 — CHANGELOG.md + Conventional Commits (2 SP) — P2
**Tasks:**
- [ ] `CHANGELOG.md` baseado em *Keep a Changelog*
- [ ] Script `npm run changelog` com `conventional-changelog-cli`
- [ ] Documentar em `CONTRIBUTING.md`

---

#### 🟡 TECH-002 — Health check enriquecido (3 SP) — P2
**Arquivos:** `back-end-gest-o/src/app.ts`

**Tasks:**
- [ ] `/health` retorna `{ status, version, uptime, storage: { ok, users, datasources }, sgbr: { lastSuccessAt, lastErrorAt } }`
- [ ] `/health/live` (liveness) e `/health/ready` (readiness) separados
- [ ] Front exibe status na tela de suporte técnico

---

#### 🟡 TECH-003 — Cache de browsers Playwright no CI (2 SP) — P2
**Arquivos:** `.github/workflows/ci.yml`

**Tasks:**
- [ ] `actions/cache` para `~/.cache/ms-playwright`
- [ ] Key baseada em `package-lock.json` da pasta front

---

### 📊 Sprint 2 — Total: 40 SP

| ID | Título | SP | Prioridade |
|---|---|:---:|:---:|
| PERF-001 | I/O assíncrono | 5 | 🟠 P1 |
| TEST-002 | 5 fluxos e2e Playwright | 13 | 🟠 P1 |
| TEST-003 | Coverage no CI | 3 | 🟡 P2 |
| PERF-002 | Lazy load PDF libs | 3 | 🟡 P2 |
| PERF-003 | Bundle analyzer + size-limit | 2 | 🟡 P2 |
| UX-001 | Skeleton screens | 5 | 🟠 P1 |
| DX-002 | Diagrama arquitetura | 2 | 🟡 P2 |
| DX-003 | CHANGELOG + Conventional | 2 | 🟡 P2 |
| TECH-002 | Health check enriquecido | 3 | 🟡 P2 |
| TECH-003 | Cache Playwright CI | 2 | 🟡 P2 |

### 🎁 Entregáveis Sprint 2
- ⚡ Backend 100% async
- 🧪 5 fluxos e2e cobertos
- 📊 Coverage ≥ 70% back / 60% front
- 📦 Bundle inicial < 400KB
- ✨ Skeleton screens em telas principais
- 📐 Diagrama de arquitetura
- 📝 CHANGELOG versionado

---

# 🟡 BLOCO 2 — Identidade e Experiência (Sprints 3-4)

## 🏃 Sprint 3 — "Sistema de Design + Marca"

**Período:** 2026-05-18 → 2026-05-31 (14 dias)
**Tema:** Identidade visual própria e tokens de design
**Capacidade:** 40 SP · **Objetivo:** Nota UX 6.5 → 8.0

### 🎯 Meta da sprint
> Substituir a aparência "Ant Design padrão" por uma identidade de marca IGA própria, estabelecendo design tokens que suportam dark mode real e escala futura.

### 📋 Backlog

#### 🟠 UX-002 — Design tokens (cores, tipografia, espaçamento) (8 SP) — P1
**Arquivos:** `front-end-gest-o/src/theme/tokens.ts` (novo) · `theme/colors.ts` · `theme/theme.ts`

**Tasks:**
- [ ] Paleta primária IGA (proposta — validar com stakeholder):
  - `--brand-500: #0B5FFF` (azul profundo, confiança)
  - `--brand-600: #0846C9` (hover)
  - `--brand-50: #EBF2FF` (background leve)
  - Acentos: `--success-500: #10B981`, `--warning-500: #F59E0B`, `--danger-500: #EF4444`
- [ ] Tokens semânticos: `--bg-primary`, `--bg-secondary`, `--text-primary`, `--text-muted`, `--border-subtle`
- [ ] Light/dark mode com CSS variables (`[data-theme="dark"]`)
- [ ] Tipografia: par **Inter (body)** + **Sora (display/headings)** com `font-display: swap`
- [ ] Escala tipográfica: 12/14/16/20/24/32/40/56 px (modular 1.25)
- [ ] Espaçamento em escala de 4px: `xs=4, sm=8, md=16, lg=24, xl=32, 2xl=48`
- [ ] Border radius: `sm=4, md=8, lg=12, full=9999`
- [ ] Sombras: `sm`, `md`, `lg` com opacidade baixa (não neon)

**Critérios de aceitação:**
- ✅ `tokens.ts` exporta objeto tipado consumido por Ant `ConfigProvider`
- ✅ Toggle dark/light em < 100ms sem flash
- ✅ Storybook (ou página `/tokens` interna) exibe paleta e tipografia

---

#### 🟠 UX-003 — ConfigProvider Ant Design customizado (5 SP) — P1
**Arquivos:** `front-end-gest-o/src/theme/theme.ts` · `ThemeProvider.tsx`

**Tasks:**
- [ ] `theme.token` do Ant mapeado aos tokens IGA
- [ ] `theme.components.{Button, Input, Table, Card, Tabs, Menu}` customizados
- [ ] Botões com `borderRadius: 8`, `controlHeight: 40`, `fontWeight: 500`
- [ ] Tabelas sem borda dupla, cabeçalho com `--bg-secondary`
- [ ] Cards com sombra sutil (`--shadow-sm`)
- [ ] Menu lateral com item ativo destacado por cor de fundo, não borda

---

#### 🟠 UX-004 — Iconografia consistente (Lucide) (3 SP) — P1
**Arquivos:** toda a base

**Tasks:**
- [ ] Instalar `lucide-react`
- [ ] Substituir ícones Ant (`@ant-design/icons`) por Lucide onde possível
- [ ] Stroke width padrão: 1.75px
- [ ] Size tokens: `16, 20, 24, 32`
- [ ] Manter `@ant-design/icons` apenas onde Lucide não tem equivalente

---

#### 🟠 UX-005 — Logo IGA animado (SVG) (5 SP) — P1
**Arquivos:** `front-end-gest-o/src/assets/logo.tsx` (novo) · `desktop-app/`

**Tasks:**
- [ ] Logo em SVG com 3 variantes: mono, colorido, inverso
- [ ] Versão animada: `stroke-dashoffset` para traçado + fade-in
- [ ] Componente `<Logo animated={false} size="md" variant="color" />`
- [ ] Ícone app Electron (.ico 256×256, .icns para macOS)
- [ ] Favicon (.ico + .svg + apple-touch-icon)

---

#### 🟠 UX-006 — Header + sidebar redesenhados (8 SP) — P1
**Arquivos:** `front-end-gest-o/src/layouts/AppLayout.tsx` · `navigation/`

**Tasks:**
- [ ] Sidebar colapsável com animação spring (Framer Motion)
- [ ] Indicador visual de item ativo (barra lateral + fundo sutil)
- [ ] Agrupar itens por seção: "Análise", "Operacional", "Administração"
- [ ] Header com breadcrumb + tenant picker + user menu + theme toggle
- [ ] Search `⌘K` placeholder (implementado em S5)
- [ ] Mobile: sidebar vira drawer (abre com ícone hambúrguer)

**Critérios de aceitação:**
- ✅ Lighthouse "Best Practices" ≥ 95
- ✅ Transição sidebar expand/collapse com spring 60fps
- ✅ Em 1366×768 ocupa no máximo 240px aberta / 64px fechada

---

#### 🟠 UX-007 — Splash screen Electron animada (5 SP) — P1
**Arquivos:** `desktop-app/splash.html` (novo) · `desktop-app/main.mjs`

**Tasks:**
- [ ] Janela splash 400×400, frameless, transparent, `alwaysOnTop`
- [ ] Animação SVG do logo (traçado → preenchimento → pulse)
- [ ] Barra de progresso sutil mostrando "Iniciando servidor..." → "Carregando interface..."
- [ ] Fecha quando backend health responde OK
- [ ] Durar no mínimo 1.2s (evitar flash)

---

#### 🟡 UX-008 — Dark mode real com paleta própria (6 SP) — P2
**Tasks:**
- [ ] Tokens `[data-theme="dark"]` com contrastes validados WCAG AA
- [ ] Testar em todas as 20+ telas
- [ ] Persistir preferência em cookie (não localStorage)
- [ ] Respeitar `prefers-color-scheme` no 1º load

**Critérios de aceitação:**
- ✅ Contraste texto/fundo ≥ 4.5:1 em todos os tokens
- ✅ Zero hardcoded `#fff` ou `#000` no código

---

### 📊 Sprint 3 — Total: 40 SP

| ID | Título | SP | Prioridade |
|---|---|:---:|:---:|
| UX-002 | Design tokens | 8 | 🟠 P1 |
| UX-003 | ConfigProvider Ant | 5 | 🟠 P1 |
| UX-004 | Iconografia Lucide | 3 | 🟠 P1 |
| UX-005 | Logo animado | 5 | 🟠 P1 |
| UX-006 | Header + sidebar | 8 | 🟠 P1 |
| UX-007 | Splash Electron | 5 | 🟠 P1 |
| UX-008 | Dark mode real | 6 | 🟡 P2 |

### 🎁 Entregáveis Sprint 3
- 🎨 Paleta e tokens de marca IGA
- 📝 Tipografia Inter + Sora
- 🔣 Ícones Lucide unificados
- 🎬 Logo animado (SVG + Electron icon)
- 🧭 Header + sidebar redesenhados
- 💫 Splash screen animada
- 🌗 Dark mode com identidade

---

## 🏃 Sprint 4 — "Motion Design e Micro-interações"

**Período:** 2026-06-01 → 2026-06-14 (14 dias)
**Tema:** Framer Motion + animações funcionais
**Capacidade:** 40 SP · **Objetivo:** Nota UX 8.0 → 9.0 · Nota Front 8.5 → 9.0

### 🎯 Meta da sprint
> Introduzir motion design intencional — transições entre telas, micro-interações em cards/botões e feedback visual claro para todos os estados.

### 📋 Backlog

#### 🟠 UX-009 — Framer Motion + transições de página (8 SP) — P1
**Arquivos:** `front-end-gest-o/src/routes/AppRouter.tsx` · `components/PageTransition.tsx` (novo)

**Tasks:**
- [ ] `npm i framer-motion`
- [ ] `<AnimatePresence mode="wait">` no router
- [ ] Componente `<PageTransition>` com fade + slide-up 8px (duração 250ms, ease `[0.22, 1, 0.36, 1]`)
- [ ] Respeitar `prefers-reduced-motion`
- [ ] Shared layout em cards de KPI (quando clicados expandem)

**Critérios de aceitação:**
- ✅ Navegação login → dashboard tem transição suave sem flash
- ✅ `prefers-reduced-motion: reduce` desativa animações
- ✅ 60fps em máquinas modestas (Intel i3 8ª gen)

---

#### 🟠 UX-010 — Micro-interações em botões e cards (5 SP) — P1
**Arquivos:** `front-end-gest-o/src/components/*`

**Tasks:**
- [ ] Botões: `whileTap={{ scale: 0.97 }}`, `whileHover={{ y: -1 }}`
- [ ] KPI cards: leve elevação no hover (sombra + translate-y -2)
- [ ] Inputs: label flutuante animado (`motion` com `y` + `scale`)
- [ ] Checkbox/switch: spring physics
- [ ] Feedback de erro em formulário: shake horizontal (6px, 3 ciclos, 80ms)

---

#### 🟠 UX-011 — Loading states com Lottie ou SVG animado (5 SP) — P1
**Tasks:**
- [ ] Loading principal: logo IGA rotacionando + pulsando
- [ ] Loading inline: `<Spinner size="sm" />` com 3 dots em cascata
- [ ] Empty states com ilustração (undraw.co ou custom) + texto amigável
- [ ] 404, 403, 500 pages com ilustrações consistentes

---

#### 🟠 UX-012 — Gráficos com animação de entrada (3 SP) — P1
**Arquivos:** `front-end-gest-o/src/components/charts/*`

**Tasks:**
- [ ] Recharts `isAnimationActive={true}` + `animationDuration={600}`
- [ ] Ease customizado (`animationEasing="ease-out"`)
- [ ] Bars crescem do 0 → valor final
- [ ] Lines desenham do X inicial → X final
- [ ] Respeitar `prefers-reduced-motion`

---

#### 🟠 UX-013 — Comparativo de período em telas analíticas (8 SP) — P1
**Arquivos:** `front-end-gest-o/src/pages/DashboardPage.tsx` · `VendasAnaliticoPage.tsx` · `FinancePage.tsx`

**Tasks:**
- [ ] Toggle "Comparar com" com opções: período anterior, mesmo período ano passado, custom
- [ ] Badge ao lado de cada KPI com delta % (verde se melhor, vermelho se pior) + seta
- [ ] Animação de "contagem" de 0 → valor (`useMotionValue` + `animate`)
- [ ] Gráficos mostram série atual + série comparativa (linha tracejada)

---

#### 🟠 UX-014 — Feedback tátil em ações (toast system unificado) (5 SP) — P1
**Arquivos:** `front-end-gest-o/src/components/feedback/Toast.tsx` (novo)

**Tasks:**
- [ ] Toast system próprio com `sonner` ou `react-hot-toast`
- [ ] 4 variantes: success, error, warning, info — cada uma com ícone animado
- [ ] Posição: top-right, stack até 3, auto-dismiss 4s
- [ ] Ação "Desfazer" em operações destrutivas (criar/editar datasource)
- [ ] Substituir `message.*` do Ant pela nova camada

---

#### 🟡 UX-015 — Atalhos de teclado globais (6 SP) — P2
**Arquivos:** `front-end-gest-o/src/hooks/useKeyboardShortcuts.ts` (novo)

**Tasks:**
- [ ] `⌘/Ctrl + K` — abrir busca global (placeholder para S5)
- [ ] `⌘/Ctrl + /` — abrir modal de atalhos
- [ ] `g + d` — ir para dashboard · `g + v` — vendas · `g + f` — financeiro
- [ ] `esc` — fecha modais e drawers
- [ ] Modal listando todos os atalhos com `kbd` tags

---

### 📊 Sprint 4 — Total: 40 SP

| ID | Título | SP | Prioridade |
|---|---|:---:|:---:|
| UX-009 | Framer Motion + transições | 8 | 🟠 P1 |
| UX-010 | Micro-interações | 5 | 🟠 P1 |
| UX-011 | Loading states Lottie/SVG | 5 | 🟠 P1 |
| UX-012 | Animação de gráficos | 3 | 🟠 P1 |
| UX-013 | Comparativo de período | 8 | 🟠 P1 |
| UX-014 | Toast system unificado | 5 | 🟠 P1 |
| UX-015 | Atalhos de teclado | 6 | 🟡 P2 |

### 🎁 Entregáveis Sprint 4
- 🎬 Transições entre telas
- ✨ Micro-interações em botões/cards/inputs
- 🌀 Loading states animados
- 📊 Gráficos com animação de entrada
- 📈 Comparativo de período com delta
- 🍞 Toast system próprio
- ⌨ Atalhos de teclado globais

---

# 🔵 BLOCO 3 — Escala e Diferenciação (Sprints 5-6)

## 🏃 Sprint 5 — "Escalabilidade e Funcionalidades Premium"

**Período:** 2026-06-15 → 2026-06-28 (14 dias)
**Tema:** Migração SQLite + funcionalidades de valor
**Capacidade:** 40 SP · **Objetivo:** Nota Back-end 8.0 → 9.0 · abrir caminho para enterprise

### 🎯 Meta da sprint
> Substituir JSON por SQLite (better-sqlite3) preservando API de repositórios e entregar 3 funcionalidades de alto valor: auto-update, export Excel, alertas proativos.

### 📋 Backlog

#### 🔴 TECH-004 — Migração JSON → SQLite (13 SP) — P0
**Arquivos:** `back-end-gest-o/src/db/` (novo) · `userStorage.ts` · `storage.ts`

**Tasks:**
- [ ] `npm i better-sqlite3` + `@types/better-sqlite3`
- [ ] Schema SQL em `src/db/schema.sql`:
  - `users` (id, email UNIQUE, password_hash, role, status, permissions JSON, created_at, updated_at)
  - `datasources` (id, tenant_id, name, api_url, ..., auth_credentials_encrypted, created_at, updated_at)
  - `sessions` (token PK, user_id FK, expires_at, created_at) — **tokens agora persistem**
  - `audit_log` (id, user_id, action, resource, metadata JSON, created_at)
- [ ] Índices em `users.email`, `datasources.tenant_id`, `sessions.expires_at`
- [ ] Migrations com `node-pg-migrate` ou manual versionado em `src/db/migrations/`
- [ ] Repositórios: `UserRepository`, `DataSourceRepository`, `SessionRepository`
- [ ] Script `scripts/migrate-json-to-sqlite.ts` lê `data/*.json` → popula SQLite
- [ ] Backup automático do JSON original antes da migração
- [ ] Sessões agora sobrevivem a restart do backend ✨
- [ ] Atualizar `AGENTS.md` sobre nova persistência

**Critérios de aceitação:**
- ✅ `data/iga.db` criado na 1ª execução
- ✅ Dados do JSON existente migrados sem perda
- ✅ Login mantém sessão após restart do servidor
- ✅ Queries `SELECT * FROM users WHERE email = ?` em < 5ms mesmo com 10k users
- ✅ Testes de regressão passando

---

#### 🟠 FEAT-001 — Auto-update Electron (8 SP) — P1
**Arquivos:** `desktop-app/main.mjs` · `desktop-app/package.json` · `.github/workflows/release.yml` (novo)

**Tasks:**
- [ ] `npm i electron-updater` em `desktop-app/`
- [ ] Release feed: GitHub Releases
- [ ] Verificar update ao iniciar (com delay 30s após startup)
- [ ] Notificar via toast no front quando houver atualização
- [ ] Download em background, instalar no próximo start
- [ ] Workflow CI `release.yml`: build Windows → assinar → publish GitHub Release
- [ ] Assinatura de código com certificado (autossinado inicialmente, EV futuro)

**Critérios de aceitação:**
- ✅ Update v1.0.0 → v1.0.1 funciona em máquina com versão antiga
- ✅ Rollback possível se update corromper

---

#### 🟠 FEAT-002 — Export Excel (xlsx) (5 SP) — P1
**Arquivos:** `front-end-gest-o/src/utils/excelExport.ts` (novo) · `ReportsPage.tsx`

**Tasks:**
- [ ] `npm i exceljs` (não `xlsx` — licença)
- [ ] Função `exportToExcel(data, { sheetName, columns, title, subtitle })`
- [ ] Cabeçalho com nome da empresa, período, logo
- [ ] Formatação: moeda, data, percentual
- [ ] Células totalizadoras com `=SUM()`
- [ ] Lazy load da lib (como jsPDF)
- [ ] Botão "Exportar" passa a ter dropdown: PDF · Excel · CSV

---

#### 🟠 FEAT-003 — Alertas proativos (SSE) (13 SP) — P1
**Arquivos:** `back-end-gest-o/src/routes/alerts.ts` (novo) · `front-end-gest-o/src/services/alertsService.ts` · `components/AlertsBell.tsx` (novo)

**Tasks:**
- [ ] Backend: `GET /api/v1/alerts/stream` via Server-Sent Events
- [ ] Engine de alertas roda a cada 5 min (node-cron):
  - Contas a pagar vencendo em < 3 dias
  - Estoque abaixo do mínimo (flag `estoque.minimo`)
  - Queda de vendas > 20% vs mesmo período semana passada
  - Erros de proxy SGBR nas últimas 10 min
- [ ] Persistir alertas em SQLite (`alerts` table)
- [ ] Front: `<AlertsBell />` no header com badge de count
- [ ] Dropdown com últimos 10 alertas + "Ver todos" → `/alertas`
- [ ] Toast em tempo real quando novo alerta chega (SSE)
- [ ] Preferências: usuário escolhe quais tipos quer receber

**Critérios de aceitação:**
- ✅ SSE funciona mesmo com proxy reverso (nginx buffering off)
- ✅ Badge atualiza em < 2s quando alerta é gerado
- ✅ Alertas persistem entre sessões

---

#### 🟡 FEAT-004 — Preferências de usuário persistidas no back (3 SP) — P2
**Tasks:**
- [ ] Endpoint `GET/PUT /api/v1/users/me/preferences`
- [ ] Campos: theme, sidebar collapsed, default date range, favorite reports, alert subscriptions
- [ ] Substituir uso de `tenantStorage` para estas preferências

---

### 📊 Sprint 5 — Total: 42 SP (2 de overflow negociável)

| ID | Título | SP | Prioridade |
|---|---|:---:|:---:|
| TECH-004 | Migração SQLite | 13 | 🔴 P0 |
| FEAT-001 | Auto-update Electron | 8 | 🟠 P1 |
| FEAT-002 | Export Excel | 5 | 🟠 P1 |
| FEAT-003 | Alertas proativos SSE | 13 | 🟠 P1 |
| FEAT-004 | Preferências usuário | 3 | 🟡 P2 |

### 🎁 Entregáveis Sprint 5
- 🗄 SQLite no lugar de JSON (com migração automática)
- 🔄 Auto-update Electron funcional
- 📊 Export Excel com formatação profissional
- 🔔 Alertas proativos em tempo real (SSE)
- 👤 Preferências de usuário persistidas

---

## 🏃 Sprint 6 — "Diferenciação com IA e Produtividade"

**Período:** 2026-06-29 → 2026-07-12 (14 dias)
**Tema:** Copiloto IA, busca global, dashboard configurável
**Capacidade:** 40 SP · **Objetivo:** transformar em produto de destaque no mercado PME

### 🎯 Meta da sprint
> Entregar 3 funcionalidades "wow" que diferenciam o produto: busca global (⌘K), dashboard configurável (drag-and-drop) e copiloto com IA.

### 📋 Backlog

#### 🟠 FEAT-005 — Busca global ⌘K (8 SP) — P1
**Arquivos:** `front-end-gest-o/src/components/CommandPalette.tsx` (novo) · `back-end-gest-o/src/routes/search.ts` (novo)

**Tasks:**
- [ ] `npm i cmdk` (biblioteca do Vercel, excelente UX)
- [ ] Backend: `GET /api/v1/search?q=...` indexa:
  - Clientes (nome, CNPJ)
  - Produtos (código, descrição)
  - Fornecedores
  - Pedidos recentes (últimos 90 dias)
  - Páginas do app
  - Usuários (admin)
- [ ] Índice FTS5 do SQLite (`CREATE VIRTUAL TABLE search_index USING fts5(...)`)
- [ ] Front: atalho `⌘K` / `Ctrl+K` abre palette
- [ ] Resultados agrupados por categoria com ícones Lucide
- [ ] Navegação teclado (↑↓ enter esc)
- [ ] Histórico de buscas recentes
- [ ] Ações rápidas ("Criar usuário", "Nova datasource", "Exportar relatório")

**Critérios de aceitação:**
- ✅ Palette abre em < 50ms
- ✅ Busca responde em < 200ms com 10k registros
- ✅ Fuzzy matching funciona ("cli" encontra "cliente")

---

#### 🟠 FEAT-006 — Dashboard configurável (drag-and-drop) (13 SP) — P1
**Arquivos:** `front-end-gest-o/src/pages/DashboardPage.tsx` · `components/widgets/*` (novo)

**Tasks:**
- [ ] `npm i @dnd-kit/core @dnd-kit/sortable`
- [ ] Grid 12 colunas responsivo com widgets arrastáveis
- [ ] 10 widgets iniciais:
  - KPI: Vendas mês · Contas a pagar · Contas a receber · Estoque crítico
  - Gráficos: Vendas 30d · Top 5 produtos · Top 5 clientes · Fluxo de caixa
  - Lista: Últimas NFs · Alertas recentes
- [ ] Cada widget com: título, ícone, ação "Remover", "Configurar", "Tela cheia"
- [ ] Redimensionável (1x1, 2x1, 2x2, 3x1, 3x2)
- [ ] Layout persistido no back (preferências)
- [ ] Biblioteca de widgets (drawer lateral) para adicionar
- [ ] Export de layout para compartilhar

**Critérios de aceitação:**
- ✅ Drag-and-drop 60fps
- ✅ Layout persiste entre sessões
- ✅ Mobile: widgets em coluna única (drag desativado)

---

#### 🟠 FEAT-007 — Copiloto IA com Claude API (13 SP) — P1
**Arquivos:** `front-end-gest-o/src/components/Copilot.tsx` (novo) · `back-end-gest-o/src/routes/copilot.ts` (novo)

**Tasks:**
- [ ] Usar **Claude Sonnet 4.6** (`claude-sonnet-4-6`) via Anthropic SDK com prompt caching
- [ ] Backend: `POST /api/v1/copilot/chat` com streaming (SSE)
- [ ] Tools (function calling):
  - `get_vendas_analitico(periodo, filtros)` → chama datasource SGBR
  - `get_contas_pagar(periodo)` → idem
  - `get_estoque(filtros)` → idem
  - `create_report(tipo, parametros)` → gera PDF/Excel
  - `list_alerts(status)` → consulta alerts table
- [ ] System prompt com contexto do negócio (indústria, módulos disponíveis)
- [ ] Drawer lateral no app (abre com ícone de balão ou `⌘I`)
- [ ] Histórico de conversas persistido por usuário
- [ ] Markdown no response com gráficos inline (mermaid ou recharts)
- [ ] Cache de system prompt (economia de tokens)
- [ ] Env var `ANTHROPIC_API_KEY` documentada

**Casos de uso:**
- "Qual cliente mais comprou em março?"
- "Gere um relatório de vendas do Q1 em PDF"
- "Quais contas vencem na próxima semana?"
- "Compare vendas de fevereiro vs janeiro"
- "Mostre os 5 produtos com menor margem"

**Critérios de aceitação:**
- ✅ Resposta em streaming (tokens chegam 1-a-1)
- ✅ Tools executam e dados aparecem formatados
- ✅ Primeiro token em < 2s
- ✅ Prompt caching ativo (cache hit rate > 70% em uso normal)

---

#### 🟡 FEAT-008 — Envio agendado de relatórios por email (5 SP) — P2
**Arquivos:** `back-end-gest-o/src/jobs/scheduledReports.ts` (novo) · `routes/scheduledReports.ts`

**Tasks:**
- [ ] `npm i node-cron nodemailer`
- [ ] UI: criar agendamento (relatório + frequência + destinatários + formato)
- [ ] Frequências: diário, semanal (dia da semana), mensal (dia do mês)
- [ ] Engine roda minuto-a-minuto, verifica agendamentos devidos
- [ ] SMTP via env (host, port, user, pass, from)
- [ ] Anexa PDF ou Excel
- [ ] Log de envios em `scheduled_reports_log`

---

#### 🟡 DX-004 — Documentação final e release v1.0 (3 SP) — P2
**Tasks:**
- [ ] Atualizar `RELATORIO_ANALISE_TECNICA.md` com nota atualizada (meta 9.0+)
- [ ] `RELEASE_NOTES_v1.0.md` com todas as mudanças
- [ ] Screenshots do produto final
- [ ] Demo video curto (GIF/MP4)
- [ ] Atualizar AGENTS.md com novas arquiteturas

---

### 📊 Sprint 6 — Total: 42 SP (2 de overflow negociável)

| ID | Título | SP | Prioridade |
|---|---|:---:|:---:|
| FEAT-005 | Busca global ⌘K | 8 | 🟠 P1 |
| FEAT-006 | Dashboard drag-and-drop | 13 | 🟠 P1 |
| FEAT-007 | Copiloto IA (Claude API) | 13 | 🟠 P1 |
| FEAT-008 | Relatórios agendados email | 5 | 🟡 P2 |
| DX-004 | Documentação + release v1.0 | 3 | 🟡 P2 |

### 🎁 Entregáveis Sprint 6
- 🔍 Busca global instantânea
- 📐 Dashboard totalmente configurável
- 🤖 Copiloto IA com Claude + function calling
- 📧 Relatórios por email agendados
- 🎉 Release v1.0 documentado

---

# 📊 Visão consolidada

## Total de 90 dias

| Sprint | Tema | SP | Foco |
|:---:|---|:---:|---|
| S1 | Blindagem de Segurança | 40 | SEC · DX · TEST |
| S2 | Polimento Técnico | 40 | PERF · TEST · DX |
| S3 | Design System + Marca | 40 | UX |
| S4 | Motion e Micro-interações | 40 | UX |
| S5 | Escalabilidade + Premium | 42 | TECH · FEAT |
| S6 | Diferenciação com IA | 42 | FEAT |
| **Total** | | **244 SP** | |

## Evolução prevista da nota

| Dimensão | Atual | S1-2 | S3-4 | S5-6 |
|---|:---:|:---:|:---:|:---:|
| Arquitetura | 8.5 | 8.5 | 8.5 | **9.5** |
| Back-End | 8.0 | 8.5 | 8.5 | **9.5** |
| Front-End | 8.5 | 8.8 | **9.5** | 9.5 |
| Desktop | 8.0 | 8.0 | 8.5 | **9.2** |
| Segurança | 7.0 | **9.0** | 9.0 | 9.2 |
| DX | 8.5 | **9.3** | 9.3 | 9.5 |
| Docs | 9.5 | 9.5 | 9.5 | 9.5 |
| Performance | 8.0 | **8.8** | 9.0 | 9.2 |
| Testes | 6.5 | **8.5** | 8.8 | **9.2** |
| CI/CD | 8.5 | 8.8 | 8.8 | **9.3** |
| UX/Motion | 6.5 | 7.2 | **9.2** | 9.5 |
| **NOTA GERAL** | **7.9** | **8.6** | **9.0** | **9.4** |

## 🎯 Marcos (Milestones)

- **🏁 M1** — Fim Sprint 2 (2026-05-17): Sistema hardened, sem débitos técnicos críticos
- **🎨 M2** — Fim Sprint 4 (2026-06-14): Identidade visual e motion completos
- **🚀 M3** — Fim Sprint 6 (2026-07-12): Release v1.0 enterprise-ready

---

## ⚙ Cerimônias ágeis sugeridas

| Cerimônia | Frequência | Duração | Objetivo |
|---|---|:---:|---|
| **Planning** | Início de sprint | 1h | Revisar backlog, estimar, comprometer |
| **Daily** | Diária | 10min | Bloqueios e sincronização |
| **Review** | Fim de sprint | 30min | Demo dos entregáveis |
| **Retro** | Fim de sprint | 30min | O que funcionou, o que melhorar |
| **Refinement** | Meio de sprint | 45min | Refinar próximos itens do backlog |

---

## ⚠ Riscos e mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|---|:---:|:---:|---|
| Migração SQLite corrompe dados existentes | 🟡 Média | 🔴 Alto | Backup automático antes da migração + rollback |
| CSP quebra funcionalidades em prod | 🟡 Média | 🟠 Médio | Testar em staging com CSP report-only antes de enforcing |
| Claude API custo alto | 🟠 Baixa | 🟡 Baixo | Prompt caching + limites por usuário + modelo Haiku para queries simples |
| Dark mode tem regressão em alguma tela | 🟠 Alta | 🟡 Baixo | Checklist de telas + screenshot tests Playwright |
| Electron auto-update falha em máquinas antigas | 🟡 Média | 🟠 Médio | Fallback manual + log detalhado + suporte a instalar por cima |

---

## 🚀 Próximos passos imediatos (antes do Sprint 1)

1. [ ] Stakeholder valida paleta de marca proposta (Sprint 3 depende)
2. [ ] Gerar `IGA_SECRETS_KEY` para ambientes dev/staging/prod
3. [ ] Configurar GitHub Releases + secret para assinatura de código
4. [ ] Criar conta Anthropic e provisionar `ANTHROPIC_API_KEY` (Sprint 6)
5. [ ] Configurar SMTP para relatórios agendados (Sprint 6)
6. [ ] Definir tooling de sprint (Jira, Linear, GitHub Projects?)
7. [ ] Kick-off com time alinhando este plano

---

> **Este plano é vivo.** Ajuste SP, reorganize itens entre sprints e mova para P3 o que não couber.
> Manter o DoD intacto — velocity real importa mais que velocity prometida.

*Plano gerado em 2026-04-15 · baseado no `RELATORIO_ANALISE_TECNICA.md` v1.0*
