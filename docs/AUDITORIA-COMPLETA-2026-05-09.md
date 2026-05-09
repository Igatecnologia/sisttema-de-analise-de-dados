# Auditoria Completa — IGA Gestão

> **Data**: 2026-05-09
> **Branch**: master @ `31f3e49`
> **Escopo**: 3 frentes paralelas (Segurança+Infra / Produto+Plano / UX+Código+DevOps)
> **Método**: análise estática do código + verificação de testes/build + comparação com `docs/PLANO-SAAS.md` (3.588 linhas)

---

## 1. Resumo executivo

| Dimensão | Nota | Status |
|----------|------|--------|
| **Segurança** | 9/10 | Enterprise-grade. 38 de 42 itens OK. |
| **Multi-tenant isolation** | 10/10 | RLS Postgres + testes A/B + force RLS |
| **Produto vs plano** | 93% | 100% nos blocos críticos (capacidades, conectores, IA); 85-89% nos polish (segmentação visual, S6 deploy, S9 landing) |
| **UX painel** | 8/10 | 6/6 features principais entregues; falta a11y detalhe |
| **Código** | 6/10 | Bons padrões + 2 hotspots grandes (DataSourceConfigPage 1.282L, proxy.ts 1.516L) |
| **Testes** | 7/10 | 90 backend + 34 frontend + 5 e2e. Componentes novos sem cobertura. |
| **Docs** | 8/10 | CLAUDE.md + 25+ docs/. Falta README e Swagger. |
| **DevOps/CI** | 5/10 | Build limpo. Falta pipeline GitHub Actions formal. |
| **Performance** | 7/10 | Code splitting agressivo. Bundle vendor-antd 1.38MB é o teto. |

**Veredito**: pronto para **Beta Fechada** com 1 dia de deploy. Para **GA público** faltam ~4-8 semanas (pentest + advogado + polish CI).

---

## 2. Segurança e Infraestrutura — 42 itens auditados

### ✅ Pontos fortes (38 OK)

**Auth de classe enterprise** — combinação rara em SaaS BR:
- Refresh tokens com rotação + reuse detection (`refreshTokenStore.ts`) → revoga família inteira em caso de comprometimento
- MFA/TOTP com backup codes hasheados (`mfa.ts`, otplib)
- Account lockout adaptativo (5 falhas/10min → 30min trava; 3 lockouts em 24h → reset obrigatório)
- HIBP pwned password check via k-anonymity (`pwnedPassword.ts`)
- Password history últimas 5 (LGPD-aware)
- Session binding por UA family
- Argon2id (OWASP recommended)
- JWT secret obrigatório em produção via `assertEnvValid()`

**Multi-tenant airtight**:
- RLS PostgreSQL `FORCE` em 14+ tabelas
- `current_setting('app.current_tenant_id')` setado por request via AsyncLocalStorage
- Testes A/B em `postgresRls.test.ts` (5 cenários)
- API Keys com `secret_hash` timing-safe + scopes por rota

**Crypto e secrets**:
- AES-256-GCM em credenciais at rest (`crypto.ts`)
- IGA_SECRETS_KEY validado no boot
- Senha admin nunca logada em produção (fix desta sessão em `seedAdmin.ts:94-103`)
- Logs do Copilot IA scrubados em prod (apenas metadata, nunca prompts/args)

**Outros wins**:
- Audit log com hash chain (prev_hash + row_hash SHA-256)
- REVOKE UPDATE/DELETE em audit_log no Postgres (insider tampering bloqueado pelo banco)
- SSRF protection no proxy (`urlSafety.ts` — IPv4/IPv6 private ranges, loopback, metadata)
- CSRF double-submit cookie
- Rate limit Redis por IP + por tenant
- Anti-fraud no registro: disposable email, MX validation, velocity (memory)
- Captcha Turnstile
- Stripe webhook signature validada
- BILLING_GATE_DISABLED só funciona fora de prod (`subscriptionGate.ts:32`)
- helmet + CSP dinâmico por connector + COOP/CORP/Permissions-Policy

### ⚠️ Top 3 gaps de segurança remanescentes

#### 🔴 #1: Velocity check de registro sem Redis backing
**Arquivo**: `services/registrationAntiFraud.ts:76-98`
**Problema**: Map em memória — não compartilhado entre processos. Em produção com 2+ replicas Render (futuro), botnet consegue 5 regs × N instâncias por IP/hora.
**Fix**: ~30 min — mover `velocityByIp` para Redis quando `hasRedisConfig()`.

#### 🟡 #2: Sentry SDK não inicializado
**Arquivo**: `server.ts` carece de `Sentry.init()`
**Problema**: Pacote `@sentry/node` instalado mas não chamado. Erros em prod não chegam ao Sentry → cegueira observacional.
**Fix**: ~1h — wrapper de erro + `Sentry.init()` em server.ts.

#### 🟡 #3: Audit events do Copilot incompletos no `auditLog.ts`
**Arquivo**: `services/ai/orchestrator.ts` já loga via `logAudit()` — mas o `auditLog.ts` não tem evento padrão definido.
**Status**: PARCIAL — já fizemos hoje events `copilot_message_started`, `copilot_tool_called`, `copilot_response_completed`, `copilot_error`. Verificar se chegam em `audit_log`.

---

## 3. Produto vs Plano-SaaS — 93% completo

### Bloco A: Sprints S0-S9 — 89%

| Sprint | Status | Comentário |
|--------|--------|------------|
| S0 Ambiente | ✅ 100% | Docker, Makefile, CI básico |
| S1 PostgreSQL+Redis | ✅ 100% | Drizzle, BullMQ, sharedCache, failover testado |
| S2 Multi-tenant+RLS | ✅ 100% | 5 cenários A/B testados |
| S3 Desacoplar SGBR | ✅ 100% | 7 connectors + segments[] |
| S4 Auth+Onboarding | ✅ 100% | Register, invite, forgot, verify, wizard |
| S5 Billing Stripe | ✅ 100% | Checkout, portal, webhook, gate, grace |
| S6 Deploy Cloud | ⚠️ 70% | render.yaml + DEPLOY-TODAY.md prontos; falta executar deploy + Cloudflare WAF (pago) |
| S7 Super Admin | ✅ 100% | CRUD tenants, MRR, impersonation |
| S8 Connectors | ✅ 100% | Marketplace + 7 connectors + bulk import |
| S9 Landing | ⚠️ 50% | Next.js estruturada (5 commits); falta blog + SEO + domínio |

### Bloco B: Capacidades de Painel (Controle Total) — 100%

20/20 features entregues:

✅ Dashboard Executivo · Alertas críticos integrados no Dashboard · Forecast (receita + ruptura SKU) · Cadastro Clientes A/B/C · Contas a Pagar e a Receber · Estoque (adaptativo por segmento) · Vendas + drill-down contextual · Compras · Produção + OEE · Audit Log · Users + RBAC + MFA · Reports (Excel/PDF + agendamento) · Saved Views · Public Shares (com expiração) · Help Center · Changelog · OrgSwitcher · Notifications · API Keys com scopes · Webhooks · Tenant Settings · Copilot IA com 18 tools

### Bloco C: Conectores e Ingestão — 100%

✅ 7 built-in (Generic, SGBR Espuma, IGA Custom API, Bling, Tiny, Omie, CSV) · 7 áreas mapeadas (estoque, produzido, vendas, compras, contas, recebiveis, notasfiscais) · CSV upload · Importação em lote · Templates locais · Modo guiado vs avançado · Hash SHA-256 visível

### Bloco D: Segmentação Multi-Segmento — 85%

✅ 4 segmentos (industry/commerce/services/distribution) · Connectors com `segments[]` · `/api/v1/segments` público · RegisterPage com card-selector · DEFAULT_TENANT neutro · EstoquePage adaptativa
⚠️ Templates **visuais** de dashboard por segmento — estrutura existe (`OnboardingPage` aplica TEMPLATES_BY_SEGMENT), mas dashboards seguem layout único independente de segmento

### Bloco E: Copilot IA — 100%

✅ Orchestrator com tool-calling (max 4 rounds, fallback Groq→Local) · 18 tools com Zod validation · Analytics events (started/tool_called/completed/error) · System prompt com regra "tool-first" · Plan IGA-IA Python documentado em `docs/PLANO-IGA-IA.md`

### Top 5 features faltantes para "100%"

1. **Templates visuais de dashboard por segmento** — comércio teria foco em Vendas+Margem; serviços em Contratos+Recorrência; distribuição em Logística+Pedidos por filial. Hoje todos usam o mesmo layout do industry.
2. **Deploy executado em produção** — render.yaml/Vercel prontos, falta clicar (1-2h).
3. **Landing page com conteúdo SEO** — estrutura Next.js existe, faltam 3 artigos + video demo.
4. **CSP nonce dinâmico** — bloqueador SEC-3 do plano (path 4 sem para GA público).
5. **DPIA + DPA com advogado** — bloqueador SEC-4 para 1º Enterprise (path 4 sem + R$ 10-30k).

---

## 4. UX e Painel Administrativo — 8/10

### O que está bom

- **CriticalAlertsCard** integrado no topo do Dashboard — admin vê problemas ao chegar, não precisa caçar
- **RevenueForecastCard** logo abaixo — projeção fim do mês com ±intervalo de confiança
- **DataSourceConfigPage** com 6 melhorias entregues nesta sessão:
  - Preset SGBR já com SHA-256 default
  - Hash da senha sempre visível (saiu do collapse)
  - Botão "Duplicar fonte"
  - **Modo Guiado** (wizard 4 passos para admin não-técnico)
  - **Importar lote** (template SGBR Tiete cria 6 fontes em 1 clique)
  - **Meus templates** (localStorage, reusa configurações)
- **Drill-down contextual**: clicar em Top 5 clientes do Dashboard → vai para VendasAnalitico filtrado
- **OrgSwitcher** no header — multi-org acessível em 1 clique
- Stats compactas no topo de cada listagem (X conectados / Y registros / Z latência)
- Diagnóstico de teste de conexão expandível (campos detectados, áreas reconhecidas)

### Gaps remanescentes

- **Acessibilidade ~57% de cobertura** — input/buttons básicos OK, tabelas sem ARIA scope/header
- **Falta wizard nas outras telas** — RegisterPage e OnboardingPage têm steps; outras páginas críticas não
- **Sem dark mode toggle visível** — funciona via OS preference mas não tem switch explícito (verificar se está no menu de usuário)

---

## 5. Código — 6/10

### Hotspots de tamanho

| Arquivo | Linhas | Crítico? |
|---------|--------|----------|
| `routes/proxy.ts` | 1.516 | 🔴 Refator urgente — quebrar em parser/cache/auth/transform |
| `pages/DataSourceConfigPage.tsx` | 1.282 | 🔴 Refator — extrair FormSection, TemplateSelector, WizardSteps |
| `pages/DashboardOperacionalPage.tsx` | 792 | 🟡 Aceitável |
| `pages/ProducaoPage.tsx` | 776 (após OEE) | 🟡 Aceitável |
| `pages/UsersPage.tsx` | 743 | 🟡 Aceitável |
| `pages/DashboardPage.tsx` | 644 | 🟡 OK |
| `pages/ReportsPage.tsx` | 627 | 🟡 OK |

### Outros achados

- **0 `console.log` em produção** ✅ (limpos via fix desta sessão)
- **0 imports duplicados detectados** ✅
- **0 TODO/FIXME/HACK** importantes ✅
- **5 erros ESLint backend** (`no-useless-assignment` em routes — limpeza fácil)
- **4 erros + 14 warnings ESLint frontend** (`no-explicit-any`, `react-refresh/only-export-components`, unused vars)
- **TypeScript `tsc --noEmit` passa em ambos** ✅
- **Production build funcional**: backend `tsc` limpo; frontend Vite build em 1.5s com 1 warning (vendor-antd 1.38MB)

### Bundle frontend

```
vendor-antd-Dw99mIIM.js     1.38 MB    ← 65% do total — bottleneck conhecido
vendor-pdf                  430 KB
vendor-charts               398 KB
index                       286 KB
vendor-html2canvas          200 KB
vendor-zod, vendor-react...  < 70 KB
```

**Lighthouse estimado**: 75-80. FCP impactado pelo vendor-antd; lazy loading + code splitting compensam parcialmente.

---

## 6. Testes — 7/10

### Inventário real

| Camada | Arquivos | Testes | Cobre |
|--------|----------|--------|-------|
| **Backend (Vitest)** | 11 | **90 passing** + 5 skipped | app, permissions, segments, connectorSegments, MFA, account lockout, refresh tokens, RLS Postgres, crypto, registration anti-fraud, shared cache, AI local provider, audit chain hash |
| **Frontend (Vitest)** | 11 | **34 passing** | api/apiEnv, extractDataArray, vendasAnalitico contract, authService, contasPagasService, reportSchedulesService, userFiltersService, dataSourceDiagnostic, sanitizeAppRedirectPath, sgbrContasPagasMap, vendasAnaliticoAggregates |
| **E2E (Playwright)** | 5 specs | (não rodam em CI) | a11y, bi-reports, ops-admin, rbac-and-crud, smoke-saas |

### Gap real

- **Componentes novos sem cobertura**: CriticalAlertsCard, RevenueForecastCard, OrgSwitcher, ClientesPage, OEE Tab, BulkImportDataSourcesModal — todos criados nesta sessão sem testes
- **E2E não rodam em CI**: GitHub Actions ausente
- **Coverage report**: nenhum HTML report gerado/visível

---

## 7. Documentação — 8/10

### O que existe (25 arquivos em `docs/`)

- **PLANO-SAAS.md** (3.588 linhas) — plano canônico
- **PLANO-IGA-IA.md** — arquitetura agente Python (criado nesta sessão)
- **PLANO-LANDING-PAGE.md**, **PLANO-FRONTEND-BETA.md**
- **DEPLOY-TODAY.md** — runbook 1-2h Beta Fechada
- **DEPLOY-FREE.md** — Render+Vercel+Supabase+Upstash detalhado
- **CRITERIO-100.md** — definition of done para release público
- **AUDITORIA-FRONTEND.md** + esta auditoria
- **INCIDENT-RESPONSE.md** — procedimentos
- **SECURITY-BASELINE.md**
- **CONTINUE.md** — handoff entre sessões
- **TROUBLESHOOTING.md**
- **STACK-PROFISSIONAL.md**
- **PROJECT_STRUCTURE.md**
- **BRANCH_STRATEGY.md**
- **BETA-LAUNCH.md**
- `beta/`: emails (boas-vindas, convite, feedback D7), onboarding cliente, runbook operacional, termo Beta
- `compliance/`: DPIA, RoPA, DPA-template (LGPD)

**CLAUDE.md** atualizado com estado SaaS atual, env vars prod separadas de dev, lista SaaS core/segmento/opcional.

### Gaps

- **Sem README** na raiz nem em back-end-gest-o/ ou front-end-gest-o/
- **Sem Swagger/OpenAPI** — API docs não geradas
- **Comentários de código**: existem em `proxy.ts`, `connectors/`, `auth.ts`; pages têm menos contexto

---

## 8. DevOps/CI — 5/10

| Item | Status |
|------|--------|
| `npm run build` em ambos | ✅ |
| `tsc --noEmit` em ambos | ✅ |
| GitHub Actions workflow | ❌ Nenhum `.yml` em `.github/workflows/` |
| Pre-commit hooks (Husky) | ❌ Nenhum `.husky/` |
| Coverage report no CI | ❌ |
| E2E no CI | ❌ |
| Lint passa sem warnings | ⚠️ 5+4 erros, 14 warnings (não-bloqueantes) |
| Docker multi-stage | ✅ Dockerfile presente |
| Health checks | ✅ /health/live e /health/ready |

---

## 9. Bloqueadores reais

### 🔴 Para subir Beta Fechada (próximas 2h)

1. **Setar env vars no Render** (DATABASE_URL Supabase, REDIS_URL Upstash, IGA_SESSION_JWT_SECRET, IGA_SECRETS_KEY, STRIPE_*, RESEND_*, FRONTEND_URL, SUPER_ADMIN_EMAILS, TURNSTILE_SECRET, ADMIN_DEFAULT_*) — sem isso, `assertEnvValid()` aborta o boot.
2. **Criar webhook Stripe** apontando pra URL Render → atualizar STRIPE_WEBHOOK_SECRET.
3. **Smoke test**: signup → onboarding → dashboard.

### 🟡 Para Beta Aberto (próximas 2-4 semanas)

1. **Velocity check no Redis** (~30 min)
2. **Sentry SDK init** (~1h)
3. **GitHub Actions CI** (lint + test + build) (~2-3h)
4. **Cobertura mínima de testes nos componentes novos** (~1 dia)
5. **Refatorar DataSourceConfigPage** em sub-componentes (~1-2 dias)
6. **Templates visuais de dashboard por segmento** (~3-5 dias)
7. **Audit a11y com Axe DevTools** (~1-2 dias correções)

### 🔴 Para GA Público (próximas 4-8 semanas)

1. **Pentest externo** R$ 10-30k (bloqueador GA)
2. **DPIA + DPA + Termos com advogado** R$ 5-15k (bloqueador Enterprise)
3. **CNPJ + Stripe live KYC** (1-2 semanas)
4. **Cloudflare WAF** (~R$ 100/mês — security plus DDoS)
5. **CSP nonce dinâmico** (SEC-3)
6. **Landing page conteúdo final** + 3 artigos SEO + video demo
7. **WCAG 2.2 AA externo** (bloqueador gov/grandes)

---

## 10. Diferencial competitivo no mercado BR SMB

### O que IGA já tem que concorrentes (Conta Azul, Bling, Tagplus) não têm

1. **Copilot IA com 18 tools de tool-calling nativo** — concorrentes têm chatbot genérico sem context. IGA: pergunte "faturamento de fevereiro?" → chama `get_faturamento_mes(2026, 2)` automaticamente.
2. **Segmentação multi-segmento adaptativa** — Conta Azul é varejo-only, Bling é genérico. IGA: usuário escolhe "indústria" no signup → labels mudam, abas adaptam, connector sugerido.
3. **Public Shares com TTL + Saved Views compartilháveis** — concorrentes exigem invite para visualização. IGA: gere link público "Top 10 SKUs" expirando em 30d.
4. **RLS Postgres + audit hash chain** — segurança enterprise raramente vista em SaaS BR SMB. Diferencial real para clientes Pro/Enterprise.
5. **Forecast simples (média móvel + dias até ruptura)** — entrega valor antes da migração Python+IA. Concorrentes não têm.

### O que precisa pós-GA para ser único (trilha INT do plano)

- **Multi-protocol** (SOAP, OData, SFTP, GraphQL) → atende Senior/Datasul/Protheus/Linx (SMB médio R$5-50M)
- **Mapping Studio visual + auto-discover** → cliente conecta qualquer ERP em 3 cliques
- **Write-back** (criar pedido no IGA → push pro ERP) → Enterprise
- **Migração Copilot para Python + Claude + RAG** → "Por que minha margem caiu?" responde com análise multi-step

---

## 11. Benchmark de mercado — concorrentes BR e globais (atualizado 2026-05-09)

Pesquisa em fontes públicas (multise, fintech.com.br, mindconsulting, portalerp, exame, sankhya, eleken, saasframe).

### Mapa do mercado BR — onde IGA se encaixa

| Player | Foco | Ticket SMB | Pontos fortes | Onde perde |
|--------|------|-----------|---------------|------------|
| **Conta Azul** | Financeiro/contábil micro/pequeno | R$ 89-389/mês | Simplicidade, contador integrado | Sem indústria, sem BI sofisticado, sem IA com tools |
| **Bling** | E-commerce/marketplaces | R$ 39-300/mês | Integração nativa Mercado Livre/Shopee/Amazon, NF-e SEFAZ | Sem produção, sem OEE, IA limitada, sem segmentação |
| **Omie** | PME geral comercial+industrial leve | R$ 199-549/mês | Marketplace nativo, NFC-e, conciliação bancária | Sem dashboards profundos, sem RAG/IA agentic |
| **Tiny** | E-commerce SMB | R$ 89-379/mês | Foco e-commerce, ERP enxuto | Genérico, sem segmentação industrial |
| **TagPlus** | Comércio/varejo | R$ 99-449/mês | Vendas + estoque básico | Sem IA, sem multi-tenant verdadeiro |
| **Granatum** | Financeiro PME | R$ 89-249/mês | Fluxo de caixa, conciliação | Não é ERP nem BI |
| **Sankhya** | Indústria média/grande | R$ 4-18 mil/mês + R$ 80-350k implantação | MRP I/II, OEE, multi-plant, recém-lançou Deploy Agent (IA) | Caro, complexo, on-premise/customizado |
| **TOTVS Protheus/Datasul/RM** | Médias e grandes | R$ 5-25 mil/mês + 6 dígitos implantação | Cobertura completa, fiscal BR forte | Legado, lento para inovação, UX ruim |
| **Senior** | Médias e grandes | R$ 5-20 mil/mês | RH forte, fiscal BR | Mesma categoria que TOTVS |

### Concorrentes globais relevantes

| Player | Diferencial | Por que importa pro IGA |
|--------|-------------|-------------------------|
| **NetSuite (Oracle)** | ERP+CRM+E-commerce unificado | Referência de "sistema único" — nosso copilot+segmentação aproxima |
| **SAP Business One** | Dominação europeia em médios | Caro, complexo — IGA pode ser "SAP simples" para BR |
| **Odoo** | Open source modular | 30+ módulos plug-and-play — inspiração para marketplace de connectors |
| **HubCount BI** | BR — IA conversacional para criar dashboards | Concorrente DIRETO no Copilot. Diferenciação: IGA tem ERP-grade + BI; HubCount é só BI |
| **Power BI Copilot** | GPT-4 + Fabric, SSO Microsoft | Acima de IGA hoje em IA. Pós-migração Python, igual |
| **Tableau Pulse** | Auto-ML + storytelling | Acima em ML — IGA precisa AI-4 do plano para igualar |

### IGA vs cada concorrente — análise honesta

#### vs **Conta Azul / Bling / Tagplus** (SMB básico)
- **IGA já está acima**: multi-segmento (4 perfis vs 1), Copilot IA com 18 tools tool-calling (eles têm chatbot genérico), RLS Postgres + audit hash chain (eles não), public shares com TTL, forecast estatístico.
- **Onde perdemos**: integração nativa marketplace (ML/Shopee/Amazon) — eles fizeram. Bling tem NFC-e SEFAZ homologado em todos estados — IGA depende de proxy. Conta Azul tem rede de contadores parceiros — IGA não.
- **Veredito**: vendemos contra Bling/Conta Azul **com IA + segurança + segmentação**. Perdemos em quem já é fanático de marketplace (vai pro Bling).

#### vs **Omie** (SMB médio)
- **IGA já está acima**: Copilot IA real, public shares, segmentação multi-segmento, write-back planejado (INT-5), arquitetura SaaS-native.
- **Onde perdemos**: Omie tem 15+ anos de mercado e 250 mil clientes; conciliação bancária automática integrada com 30+ bancos; integração WhatsApp; integração contábil. IGA depende do ERP do cliente.
- **Veredito**: contra Omie é **batalha real**. Diferencial: IA + segurança Enterprise + multi-segmento. Perde se cliente quer "ERP completo" (vai pro Omie).

#### vs **Sankhya / TOTVS / Senior** (médio/grande industrial)
- **IGA já está acima**: preço (3-10x mais barato), UX moderna, deploy em 1 dia, IA conversacional nativa, multi-tenant cloud-first.
- **Onde perdemos**: MRP I/II completo (Sankhya tem), folha de pagamento (não temos), fiscal BR (NF-e/CT-e/MDF-e nativos — IGA proxy), customização ilimitada.
- **Veredito**: IGA é o **anti-Sankhya** para SMB que recusa pagar R$ 80-350k para implantação. Mas para indústrias grandes (R$ 50M+), Sankhya ainda ganha.

#### vs **HubCount BI** (concorrente direto em IA+BI)
- **IGA já está acima**: ERP integrado (proxy + connectors), multi-segmento, Public Shares, refresh tokens enterprise.
- **Onde perdemos**: HubCount foca 100% em "criar dashboards via conversa com IA" — IGA é mais BI estático com IA conversacional pra perguntas.
- **Veredito**: posicionamento diferente. HubCount é "Power BI brasileiro", IGA é "ERP+BI+IA brasileiro".

### O que IGA precisa adicionar para fechar gaps competitivos

**🔴 Prioridade 1 — features que clientes pedem e concorrentes têm**

1. **Conciliação bancária automática** — 5+ bancos (BB, Itaú, Bradesco, Santander, Caixa) via Open Finance ou OFX. Bling/Omie/Conta Azul têm. Estimativa: 3-4 semanas dev + R$ 0 (Open Finance é grátis pra fintech homologada).
2. **Integração marketplace nativa** (Mercado Livre, Shopee, Amazon, Magalu) — Bling vende isso. Estimativa: 4-6 semanas dev por marketplace. Comece com 1 (Mercado Livre).
3. **WhatsApp Business API integration** — disparo de boleto, NF, ticket de suporte. Omie/Bling têm. Estimativa: 2-3 semanas com Twilio ou ZAPI.
4. **Emissão direta de NF-e via SEFAZ** — Bling/Omie têm. Hoje IGA depende do ERP. Estimativa: 2-3 meses com PlugNotas ou Webmaniabr (R$ 99/mês white-label).
5. **App móvel (PWA mínimo)** — todos os concorrentes têm. Estimativa: 2-3 semanas pra PWA bem feito; 8-12 semanas pra React Native completo.

**🟡 Prioridade 2 — diferenciação premium**

6. **Deploy Agent estilo Sankhya** — Claude analisa CNPJ + faz parametrização inicial automática. Já no plano IGA-IA AI-4 (mês 4).
7. **Gerador de relatórios via conversa** ("crie um relatório mensal de margem por SKU, agendado para todo dia 1") — falta agente de mutação no Copilot. Já planejado em PLANO-IGA-IA.md.
8. **Anomaly detection automática** — Z-score em métricas financeiras com alerta proativo. AI-2 do plano.
9. **Comparativo benchmark anônimo** — "sua margem está 12% abaixo da média do seu setor". F13 do plano (Pro+).
10. **Marketplace de templates da comunidade** — usuários compartilham layouts de dashboards/relatórios. Inspiração Notion/Airtable.

**🟢 Prioridade 3 — moats long-tail**

11. **Plugins customizados** — JavaScript/Python sandbox para clientes Enterprise customizarem cálculos.
12. **Multi-currency / multi-language** — para PMEs que exportam.
13. **Mobile offline-first** — vendedor de campo registra venda no app, sincroniza ao voltar.

### Pricing comparativo (2026)

| Plano IGA atual | Concorrente equivalente | Posicionamento |
|-----------------|--------------------------|-----------------|
| Free R$ 0 | Bling Free, Conta Azul trial | Funil — OK |
| Starter R$ 197 | Bling Starter R$ 39, Omie Easy R$ 199 | **Caro vs Bling**, igual Omie. Sugestão: revisar para R$ 149 |
| Pro R$ 497 | Omie Pro R$ 549, Conta Azul Pro R$ 389 | Competitivo. Adicionar features (conciliação, WhatsApp) |
| Enterprise R$ 997 | Sankhya R$ 4 mil+, TOTVS R$ 5 mil+ | **Subprecificado vs grandes**. Pode subir para R$ 1.997 com features F do plano |

### Veredito do benchmark

**IGA está bem posicionado para SMB Pro/Enterprise (R$ 500-2 mil/mês)** — combinação rara de:
- Segurança enterprise (RLS + MFA + audit hash chain) que Bling/Tagplus não têm
- IA conversacional com tool-calling que Conta Azul/Omie não têm
- Multi-segmento adaptativo (4 perfis) que NENHUM concorrente BR tem
- Preço 3-10x abaixo de Sankhya/TOTVS

**Lacunas que vão doer em conversões**:
- Falta conciliação bancária automática (deal-breaker para muitos)
- Falta WhatsApp Business
- Falta NF-e nativa (depende de ERP)
- Falta integração marketplace

**Recomendação estratégica**: foque os próximos 2-3 meses fechando essas 4 lacunas. Investimento ~R$ 0 (Open Finance grátis) + 8-12 semanas dev. Retorno: paridade competitiva com Omie + diferencial preservado em IA/segurança.

---

## 12. Veredito final

Sistema **93% completo** vs plano original. **Pronto para Beta Fechada hoje** (1-2h de deploy + env vars). Para vender Pro/Enterprise pago, faltam itens **operacionais** (CNPJ, advogado, pentest) — não código.

**Próximas ações recomendadas em ordem**:

1. ✅ **Hoje**: subir Beta Fechada via `docs/DEPLOY-TODAY.md`
2. **Esta semana**: convidar 5-10 pilotos com Stripe test mode
3. **Sem 2-3**: fix dos 3 gaps de segurança remanescentes + Sentry + CI básico
4. **Sem 3-4**: refator de hotspots (proxy.ts, DataSourceConfigPage) + testes nos componentes novos
5. **Mês 2**: contratar advogado em paralelo com agendar pentest
6. **Mês 2-3**: templates visuais de dashboard por segmento + landing SEO
7. **Mês 3-4**: GA público com pentest aprovado

---

*Auditoria executada em paralelo por 3 agents independentes; síntese consolidada com cross-check de evidências.*
