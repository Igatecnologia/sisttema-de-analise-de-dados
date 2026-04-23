# Relatório de Análise Técnica — Sistema de Gestão IGA

> **Data:** 2026-04-15
> **Escopo:** back-end, front-end, desktop-app, CI/CD, segurança, UX
> **Revisor:** Senior Full Stack + UI/Motion (auditoria técnica completa)

---

## 🏁 Nota Geral: **7.9 / 10** — *Bom, com pontos críticos pontuais*

| # | Dimensão | Nota | Peso |
|---|----------|:----:|:----:|
| 1 | Arquitetura & Organização | **8.5** | 10% |
| 2 | Back-End (qualidade técnica) | **8.0** | 15% |
| 3 | Front-End (qualidade técnica) | **8.5** | 15% |
| 4 | Desktop App (Electron) | **8.0** | 5% |
| 5 | Segurança (OWASP) | **7.0** | 15% |
| 6 | Qualidade de código / DX | **8.5** | 10% |
| 7 | Documentação | **9.5** | 5% |
| 8 | Performance | **8.0** | 10% |
| 9 | Testes automatizados | **6.5** | 5% |
| 10 | CI/CD | **8.5** | 5% |
| 11 | UX / Design System / Motion | **6.5** | 5% |

**Resumo de uma frase:** sistema profissional, arquitetura sólida e documentação exemplar — mas falta polimento visual/motion, cobertura de testes e um punhado de correções de segurança para estar totalmente *production-grade enterprise*.

---

## 1. Visão geral do sistema

**IGA Gestão** é um monorepo composto por três módulos:

| Módulo | Stack | Papel |
|---|---|---|
| `back-end-gest-o/` | Node 20 · Express · TS · Zod · scrypt | API REST + **proxy SGBR BI** + auth + RBAC |
| `front-end-gest-o/` | React 19 · Vite · TS · Ant Design 6 · TanStack Query · Recharts | SPA administrativa (BI, financeiro, vendas, estoque) |
| `desktop-app/` | Electron 37 + Inno Setup 6 | Empacotamento Windows/macOS (1-click install) |

**Propósito do produto:** painel administrativo e **BI** que consome dados da API SGBR via proxy seguro. Módulos principais: Dashboard, Vendas Analítico, Financeiro (Contas a Pagar/Receber, Fluxo), Comercial (NFs), Estoque, Produção, Ficha Técnica, Relatórios, Auditoria, Gestão de Usuários, Fontes de Dados, Alertas.

**Persistência:** JSON em disco (`data/users.json`, `data/datasources.json`), sem SGBD relacional.

---

## 2. Dimensão 1 — Arquitetura & Organização — **8.5 / 10**

### ✅ Pontos fortes
- Separação clara: `routes/` · `middleware/` · `services/` · `storage.ts`.
- Feature-based no front: `api/` · `auth/` · `services/` · `pages/` · `components/` · `query/` · `theme/`.
- Electron com **single-instance lock** e descoberta de porta dinâmica (3001→3010) — evita conflito em dev.
- Dados do usuário persistem em `app.getPath('userData')/data/` (respeita convenções OS).

### ⚠ Pontos a melhorar
- Sem camada de **domínio/casos de uso** no back — lógica de negócio fica nos *route handlers*. Aceitável no porte atual, mas limita testabilidade.
- **Storage em JSON puro** não escala para > 10k registros e impede queries agregadas. Tecnicamente funcional, porém teto baixo.
- Falta *dependency injection* (mesmo leve) — complica mock em testes.

### 💡 Recomendação
Extrair repositórios (`UserRepository`, `DataSourceRepository`) como interface → implementação JSON hoje → implementação Postgres/SQLite depois, sem reescrever handlers.

---

## 3. Dimensão 2 — Back-End — **8.0 / 10**

### ✅ Pontos fortes
- **Stack moderna e limpa:** Express 4 · Zod 4 · TS strict · Helmet · CORS · rate-limit · compression (gzip reduz proxy ~70-80%).
- **Proxy SGBR é o ponto-mais-forte**: paginação automática (`PROXY_DATA_AUTO_PAGINATE`), cache de token, timeout configurável (120s padrão, 600s max), header `x-iga-proxy-truncated` transparente.
- **Validação Zod em todas as entradas** (`auth`, `users`, `datasources`) com `safeParse()` + 400 explícito.
- **scrypt + salt + `timingSafeEqual`** no hash de senhas de usuários locais (`userStorage.ts:71-82`) — correto e sem dependência externa.
- Rate limit: 5 logins/15min · 60 proxy calls/min/IP.
- Cookies `HttpOnly` + `SameSite=Strict` + `Secure` em produção (`middleware/auth.ts:19-26`).

### ⚠ Pontos a melhorar
- **Tokens de sessão em memória** (`Map` em `middleware/auth.ts`) — *restart = logout global*. OK em dev; em produção clusterizada seria quebrado.
- **Sem índices / sem filtros eficientes** — buscas lineares O(n) em arrays JSON.
- **Stubs financeiros** (`routes/finance.ts` devolve `[]`) podem enganar o front se datasource não for casado.
- Sem transações — escrita em `users.json` e `datasources.json` usa lock boolean; risco teórico de race em picos.
- Pouco uso de `async/await` em I/O de storage (usa `readFileSync`/`writeFileSync`) — bloqueia event loop em arquivos grandes.

### 💡 Recomendação prioritária
Migrar storage para **SQLite (better-sqlite3)** mantendo API de repositórios. Benefícios: transações ACID, queries por índice, zero custo de infra (1 arquivo), suporte a clustering.

---

## 4. Dimensão 3 — Front-End — **8.5 / 10**

### ✅ Pontos fortes
- **React 19 + Vite + TS strict** — stack state-of-the-art 2026.
- **TanStack Query** bem estruturado (`query/queryKeys.ts`), stale time de 5 min, invalidação por chave composta `[recurso, sourceId, dt_de, dt_ate]`.
- **Zod valida respostas da API** (`api/schemas.ts`) — campos inesperados são descartados, evita crash por mudança de contrato.
- **Lazy routing** (`routes/AppRouter.tsx`) — cada página é chunk separado, TTI baixo.
- **VirtualTable** com `@tanstack/react-virtual` para tabelas > 10k linhas.
- **RBAC granular** via `routes/RequirePermission.tsx` + `auth/permissions.ts`.
- **Anti open-redirect** em `utils/sanitizeAppRedirectPath.ts`.
- Exportação PDF (jsPDF + html2canvas) e CSV com `sanitizeCsvCell` (escape de fórmulas).

### ⚠ Pontos a melhorar
- **Token em `localStorage`** (persistente) — vulnerável a XSS. Em Electron o risco é menor (single-origin, sem CSP externo), mas em web deployment seria crítico.
- **Sem Error Boundary** global visível — um erro em um chart pode derrubar a página inteira.
- **i18n incompleto** (pasta `i18n/` existe, mas não há PT/EN/ES completos).
- **Sem tema de marca** — usa Ant Design "padrão" com azul #1890ff. Produto comercial deveria ter identidade visual própria.
- **Nenhuma animação significativa** — transições Ant nativas e CSS transitions simples; zero Framer Motion/GSAP.

### 💡 Recomendação
- Migrar token para cookie `HttpOnly` (já há suporte no back — cookie `iga_session`) e remover localStorage.
- Adicionar `<ErrorBoundary>` no layout raiz com telemetria.
- Introduzir Framer Motion para transições de página + micro-interações em botões/cards (ver seção UX).

---

## 5. Dimensão 4 — Desktop App (Electron) — **8.0 / 10**

### ✅ Pontos fortes
- **Single-instance lock** (linha 32-44 em `main.mjs`) — evita múltiplas janelas do mesmo EXE.
- **Descoberta dinâmica de porta** (3001-3010) — fallback elegante se porta ocupada.
- **Logs por dia** em `app.getPath('userData')/logs/iga-YYYY-MM-DD.log`.
- **Mesma origem front+back** dentro do Electron — elimina CORS em produção desktop.
- **Build em 2 etapas**: `build-windows.bat` (portable) + `build-installer.bat` (Inno Setup → `.exe` 1-click).

### ⚠ Pontos a melhorar
- **`nodeIntegration` / `contextIsolation`** não inspecionados no `webPreferences` — confirmar que estão seguros (`contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`).
- **Sem auto-update** (electron-updater) — usuário precisa reinstalar EXE a cada versão.
- **Assinatura de código** não configurada — SmartScreen do Windows vai marcar como "editor desconhecido" em máquinas novas.

### 💡 Recomendação
Adicionar `electron-updater` + assinar o executável com certificado EV ou pelo menos autossinado documentado.

---

## 6. Dimensão 5 — Segurança (OWASP Top 10) — **7.0 / 10**

### 🟢 Correto
- **A01 — Broken Access Control:** `requireAuth()` · `requireAdmin()` · RBAC com `permissions.ts`.
- **A02 — Cryptographic Failures:** scrypt + salt em senhas locais · HTTPS implícito em produção desktop (localhost).
- **A03 — Injection:** sem SQL (JSON); Zod valida schema; front escapa via React/Ant.
- **A07 — Auth Failures:** rate limit de login, TTL 8h, logout real (revoga token), *throttle* no front (`loginThrottle.ts`).

### 🟡 Atenção
- **A05 — Misconfiguration:** `helmet({ contentSecurityPolicy: false })` em `app.ts:35` — CSP **desligado** intencionalmente. Em Electron o risco é baixo, mas seria crítico em web. **Ativar CSP explícito** com allowlist para Ant Design.
- **Token em localStorage** (front) — vulnerável a XSS. Mitigar migrando para cookie HttpOnly (já suportado).
- **Credenciais SGBR em `data/datasources.json` em texto claro** (`"login:senha"`). Arquivo está no `.gitignore`, mas backups não criptografados vazam credenciais. **Criptografar com chave mestra** derivada de env var (PBKDF2/AES-256-GCM).

### 🔴 Correção recomendada (alta prioridade)
- Sem **HSTS** forçado (Strict-Transport-Security) explícito — Helmet default cobre, mas conferir header na produção web.
- Sem **rate limit** em `POST /api/v1/datasources/:id/test` — possível abuso.
- `hashPassword` (`services/passwordHasher.ts`) suporta **`md5`**, **`sha256`**, **`plain`** — **este hasher serve a API SGBR externa**, não senhas locais. ✔ *Isto foi confirmado*: `userStorage.ts:71-82` usa scrypt. Ainda assim, o *modo `plain`* envia senha em texto no request para SGBR — avaliar se o provedor já exige TLS (normalmente sim).

### 💡 Plano de ação (1-2 sprints)
1. Reativar CSP com política permissiva mas explícita.
2. Criptografar `authCredentials` de datasources (AES-256-GCM + key em `SECRETS_KEY` env).
3. Migrar sessão do front para cookie HttpOnly (remover localStorage).
4. Adicionar `express-rate-limit` nas rotas `/datasources/*/test`.
5. Configurar `helmet.hsts({ maxAge: 31536000, includeSubDomains: true })` explícito.
6. Adicionar dependabot/renovate para updates automáticos.

---

## 7. Dimensão 6 — Qualidade de Código / DX — **8.5 / 10**

### ✅ Pontos fortes
- **TypeScript strict** em front e back.
- **ESLint 9** + plugin `jsx-a11y` + `react-hooks` no front.
- **Prettier 3.8** configurado.
- **Zod em tudo** — contratos sempre validados.
- CI falha se `npm audit --audit-level=high` encontrar algo.

### ⚠ Pontos a melhorar
- **Back-end sem ESLint/Prettier** declarado — só TS strict. Adicionar.
- **Sem pre-commit hooks** (husky + lint-staged) — depende do CI para pegar erros.
- **Sem conventional commits** declarado (nem commitlint) — dificulta changelog automatizado.

---

## 8. Dimensão 7 — Documentação — **9.5 / 10**

O **ponto mais forte do projeto**. Raríssimo em projetos privados.

- ✅ `AGENTS.md` na raiz — mapa IA-friendly com armadilhas conhecidas (PDF SGBR vs BI, contas-a-pagar stub, truncagem).
- ✅ `RUNBOOK_INTEGRACOES_DADOS.md` — contrato SGBR, troubleshooting.
- ✅ `docs/MATRIZ_TELA_DATASOURCE.md` — tela × endpoint × datasource.
- ✅ `docs/PERFORMANCE_BUDGETS.md` — metas de latência.
- ✅ READMEs completos em back e front.

### Falta (muito pouco)
- Changelog (`CHANGELOG.md`) versionado.
- Diagrama de arquitetura em imagem (Mermaid ou PNG).
- `CONTRIBUTING.md` com padrão de PR.

---

## 9. Dimensão 8 — Performance — **8.0 / 10**

### ✅ Otimizações presentes
- **Gzip** no proxy (reduz ~70-80% payloads SGBR).
- **Lazy routing** — code splitting por página (Vite).
- **TanStack Query** deduplica requests + cache 5 min.
- **VirtualTable** para tabelas grandes.
- **Cache de token SGBR** no proxy.
- **Cache de users** em memória com `mtimeMs` (evita `readFileSync` por request).

### ⚠ Gaps
- **Sem preload de fontes** (FOIT/FOUT em alguns refreshes).
- **jsPDF + html2canvas** são pesados — carregar sob demanda (`import()` dinâmico) só quando o botão "Exportar PDF" for clicado.
- **Sem service worker / offline** — cache de dashboard poderia sobreviver a dropouts.
- **Sem orçamento de bundle explícito** (`rollup-plugin-visualizer` ou `size-limit`).
- **I/O síncrono** em `userStorage`/`storage` pode bloquear event loop em arquivos grandes.

---

## 10. Dimensão 9 — Testes — **6.5 / 10**

### ✅ O que existe
- Vitest configurado em front e back.
- Playwright e2e (CI com 20min timeout, backend sobe antes).
- MSW (mocks HTTP) no front.
- 5 testes em `back-end-gest-o/src/app.test.ts` cobrindo health, auth e proxy.

### ⚠ O que falta
- **Cobertura baixa** — não há relatório de coverage no CI.
- Sem testes unitários para `userStorage`, `storage`, `seedAdmin`, `permissions`.
- Sem testes de *datasources* CRUD, *connectionTester*, paginação do proxy.
- Sem e2e de fluxos críticos: login → dashboard → filtro de data → export PDF.

### 💡 Recomendação
Meta 30 dias: subir cobertura back para **70%** e adicionar 5 fluxos e2e principais (login, criar usuário, CRUD datasource, visualizar vendas, exportar PDF).

---

## 11. Dimensão 10 — CI/CD — **8.5 / 10**

### ✅ Pontos fortes
- GitHub Actions com 3 jobs paralelos (back, front, e2e).
- Node 22 LTS.
- `npm ci` + build + test + `npm audit` obrigatório.
- E2E em Ubuntu com Playwright + backend em background.

### ⚠ Falta
- **Sem deploy automático** — CI valida, não libera.
- **Sem cache de Playwright browsers** (reinstala a cada run, lento).
- **Sem matriz de SO** — só Ubuntu. Desktop roda em Windows, deveria testar build Windows em CI.
- **Sem code coverage reporting** (Codecov/Coveralls).

---

## 12. Dimensão 11 — UX / Design System / Motion — **6.5 / 10**

Esta é a **maior oportunidade de salto de qualidade percebida** pelo cliente final.

### Estado atual
- Ant Design "padrão" com azul corporativo #1890ff — funcional, mas visualmente genérico.
- Sem identidade de marca forte no app.
- Sem animações de transição entre telas.
- Sem skeletons personalizados (usa Ant default).
- Sem micro-interações (hover, tap, loading states sofisticados).
- Dark/light mode existe, mas paleta é Ant default.

### 💡 Plano de elevação (ver seção 14)
1. Paleta de marca própria + tokens.
2. Tipografia com par de fontes (Display + Body).
3. Framer Motion para transições de página (`AnimatePresence` + `motion.div`).
4. Skeleton screens específicos para dashboard, vendas e financeiro.
5. Splash screen do Electron com logo animado (Lottie).
6. Micro-interações em cards, botões e KPIs (spring physics).

---

## 13. 🚨 Achados críticos (top 7 — ação imediata)

| # | Achado | Severidade | Arquivo | Esforço |
|---|--------|:---:|---|:---:|
| 1 | Token JWT/session em `localStorage` — vulnerável a XSS | 🔴 Alta | `front-end-gest-o/src/auth/authStorage.ts` | M |
| 2 | Credenciais SGBR em texto claro em `data/datasources.json` | 🔴 Alta | `back-end-gest-o/src/storage.ts` | M |
| 3 | CSP desligado no Helmet | 🟠 Média | `back-end-gest-o/src/app.ts:35` | P |
| 4 | Sem rate limit em `/datasources/:id/test` | 🟠 Média | `back-end-gest-o/src/routes/datasources.ts` | P |
| 5 | Sem ErrorBoundary global no front | 🟠 Média | `front-end-gest-o/src/App.tsx` | P |
| 6 | I/O síncrono em storage bloqueia event loop | 🟡 Baixa | `back-end-gest-o/src/userStorage.ts` | M |
| 7 | Cobertura de testes baixa em fluxos críticos | 🟡 Baixa | — | G |

Legenda: P = ≤ 2h · M = ½-2 dias · G = > 3 dias.

---

## 14. 🚀 Novas funcionalidades sugeridas (por prioridade)

### P0 — Impacto alto, esforço baixo
1. **Auto-update do Electron** (electron-updater + release no GitHub).
2. **Dark mode com paleta de marca** (tokens próprios, não defaults Ant).
3. **Splash screen animada** com Lottie/SVG do logo IGA.
4. **Export de relatórios em Excel** (além de PDF/CSV) — `xlsx` ou `exceljs`.
5. **Preferências de usuário persistidas** (layout de dashboard, filtros favoritos).

### P1 — Alto valor de produto
6. **Alertas proativos** (SSE/WebSocket): notificar quando contas a vencer < 3 dias, estoque < mínimo, queda de vendas vs mês anterior.
7. **Dashboard configurável** (drag-and-drop de widgets) — usar `dnd-kit`.
8. **Comparativo de períodos** em todas as telas analíticas (ex: "este mês vs mês passado" com delta visual).
9. **Favoritar relatórios** + **envio agendado por email** (cron + nodemailer).
10. **Multi-tenancy completo** (hoje existe `tenantStorage` no front, falta isolamento forte no back).

### P2 — Diferenciação
11. **Copiloto com IA** — chat lateral que responde "qual cliente mais comprou em março?" consultando os datasources via function calling (Claude API ou OpenAI).
12. **Busca global** (⌘K) — `cmdk` style, indexando clientes, produtos, pedidos, NFs.
13. **Audit trail visual** com timeline (quem fez o quê, quando) — React Flow ou `@vis.gl/react-google-maps`.
14. **App mobile companion** (React Native + Expo) compartilhando serviços via GraphQL/tRPC.
15. **Exportação branded** — PDFs com capa, sumário e cabeçalho da empresa customizáveis.

---

## 15. 🗺 Roadmap sugerido 30-60-90 dias

### 🟢 30 dias — "Corrigir e polir"
- [ ] Corrigir top-7 achados críticos (seção 13).
- [ ] Migrar token para cookie HttpOnly.
- [ ] Criptografar credenciais SGBR.
- [ ] Reativar CSP.
- [ ] Adicionar ErrorBoundary + Sentry/similar.
- [ ] ESLint/Prettier no back.
- [ ] Husky + lint-staged.
- [ ] Cobertura back → 70%.

### 🟡 60 dias — "Identidade e experiência"
- [ ] Design tokens de marca + paleta própria.
- [ ] Framer Motion — transições + micro-interações.
- [ ] Splash screen animada (Electron).
- [ ] Skeleton screens específicos.
- [ ] Auto-update Electron.
- [ ] Export Excel.
- [ ] Alertas proativos (P1 #6).

### 🔵 90 dias — "Escala e diferenciação"
- [ ] Migração JSON → SQLite (better-sqlite3) preservando API de repositórios.
- [ ] Dashboard configurável drag-and-drop.
- [ ] Busca global (⌘K).
- [ ] Envio agendado de relatórios por email.
- [ ] Copiloto com IA (Claude API).
- [ ] E2E Playwright para 5 fluxos críticos.
- [ ] Relatório de cobertura no CI (Codecov).

---

## 16. Conclusão

**IGA Gestão** é um sistema **maduro para seu estágio**: arquitetura limpa, stack moderna (React 19 · Vite · Electron 37 · TS strict), documentação excepcional (AGENTS.md é raro e valioso), CI/CD funcional e proxy SGBR robusto.

As oportunidades de evolução estão em **três eixos**:

1. **Segurança** — fechar os ~5 gaps identificados (token storage, credenciais SGBR, CSP).
2. **Escala** — migrar de JSON para SQLite preserva simplicidade com ganho enorme.
3. **Experiência** — identidade visual, motion design e funcionalidades P1/P2 elevam percepção de valor.

Com o roadmap 30-60-90 executado, o sistema alcança **9.0+** em todas as dimensões e fica pronto para **enterprise-grade deployment**.

---

> Relatório gerado em 2026-04-15 · Versão 1.0 · Baseado na análise técnica completa do repositório `sistema de gestão/`
