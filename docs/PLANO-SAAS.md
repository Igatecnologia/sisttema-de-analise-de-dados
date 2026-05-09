# IGA Gestao — Plano de Transformacao SaaS v3

> **Status do plano (atualizado 2026-05-08 — apos auditoria full)**
>
> | Bloco | % done | Comentario |
> |---|---|---|
> | S0 Ambiente | 100% | Docker, Makefile, CI |
> | S1 Postgres + Redis | 100% | Drizzle, BullMQ, sharedCache |
> | S2 Multi-tenant + RLS | 100% | RLS + 5 cenarios automatizados |
> | S3 Desacoplar SGBR | 100% | ConnectorRegistry, area hints, warm targets |
> | S4 Auth SaaS + Onboarding | 100% | Register/invite/forgot/verify + wizard |
> | **S5 Billing** | 100% | Stripe + webhook + gate + limites + UI de planos/billing/configuracoes |
> | **S6 Deploy Cloud** | **70%** | Beta free configurado: render.yaml + vercel.json + db-backup workflow + observability wiring. Falta executar deploy + Cloudflare WAF (pago) |
> | S7 Super Admin | 100% | CRUD tenants + metricas + impersonation + TenantSwitcher |
> | S8 Connectors marketplace | 100% | Marketplace, schemas, API propria IGA, Bling/Tiny/Omie (stubs OAuth), hot-reload e webhooks enterprise |
> | S9 Landing page | 0% | Next.js separado |
> | **SEC-1 Foundation** | 95% | 1.1-1.3, 1.5-1.6, 1.8 done. 1.4 (Doppler) e 1.7 (file upload) operacional/N-A |
> | **SEC-2 Identity** | 90% | MFA, captcha, HIBP, lockout, session binding, refresh rotation, history, timing-safe, login alerts. So falta SSO Enterprise (2.7) |
> | **SEC-3 DevSecOps** | **65%** | SAST/SCA/SBOM/lockfile/secret scan + COOP/CORP/Reporting + CSP dinamico + CORS + anti-fraud done. Falta CSP nonce, DAST, WAF (pago), CodeQL |
> | **SEC-4 Compliance** | **55%** | LGPD endpoints, cookie consent, security.txt, sub-processors page, IR runbook, aceite versionado de Termos, backup workflow done. Falta DPIA/DPA com advogado + pentest (R$ 10-30k) |
> | INT-1 a INT-7 | 0% | pos-GA |
> | OPS-1 OPS-2 OPS-3 | 0% | OPS-1 operacional, OPS-2 carga, OPS-3 a11y |
> | **OPS-4 Analytics** | **40%** | PostHog/Sentry wiring + 4 eventos basicos + endpoint backend. Falta 30+ eventos + funnels + cohorts |
>
> **Caminho minimo para Beta Fechado FREE (~1 dia executando `DEPLOY-FREE.md`)**: criar contas Vercel/Render/Supabase/Upstash + setar envs + deploy. Custo: R$ 0/mes.
>
> **Caminho para 1o pagante (~4 sem + R$ 10-30k)**: validar Beta -> contratar advogado (DPIA/Termos/DPA) -> pentest externo -> Stripe KYC + CNPJ.
>
> **Caminho para GA (+~4 sem alem do minimo)**: CSP nonce + OPS-3 (a11y) + OPS-4 completo (30+ eventos) + Cloudflare WAF + WCAG audit externo.

## Visao Geral

Transformar o IGA Gestao de um aplicativo desktop single-tenant (focado em industria de espuma + SGBR BI) em um **SaaS multi-tenant premium** que atende qualquer segmento industrial — com experiencia de produto de classe mundial, onboarding self-service, billing automatico e design system coeso.

### Escopo de cobertura — o que cada fase entrega

| Capacidade | GA (S0-S9 + SEC) | Pos-GA + INT |
|---|---|---|
| Multi-tenant SaaS com isolamento RLS | OK | OK |
| Auth + onboarding self-service + billing | OK | OK |
| Seguranca OWASP ASVS Level 2 + LGPD + pentest | OK | OK |
| ERPs REST + JSON (SGBR, Bling, Tiny, Omie) + CSV + REST generica | OK (~70% mercado SMB) | OK |
| **Qualquer ERP/API** (SOAP, OData, GraphQL, SFTP, EDI) | **Nao** | **OK (INT-2)** |
| **Modelo canonico de dados** (frontend agnostico ao ERP) | **Nao** | **OK (INT-1)** |
| **Mapping Studio visual** + auto-discover OpenAPI | **Nao** | **OK (INT-4)** |
| **Sync incremental + resumable + dedup** | Polling basico | **OK (INT-3)** |
| **Write-back** (criar pedido IGA -> push pro ERP) | **Nao** | **OK (INT-5, Enterprise)** |

> Resumo: **GA cobre ~70% do mercado SMB com ERP REST popular**. **Pos-INT cobre 100% do mercado industrial brasileiro + Enterprise com ERPs legados**. INT nao bloqueia GA — vendido como upgrade Pro+/Enterprise apos validar tracao.

### Principios de Design do Produto

| Principio | Descricao |
|---|---|
| **Clareza instantanea** | Qualquer tela deve comunicar seu proposito em < 3 segundos |
| **Zero-config first** | Defaults inteligentes — usuario configura so o que precisa |
| **Progressive disclosure** | Complexidade revelada conforme necessidade, nunca antecipada |
| **Dark-first, light-ready** | Dark mode como experiencia primaria (industrial = ambientes de producao), light como alternativa |
| **Motion com proposito** | Animacoes comunicam estado e guiam atencao — nunca decorativas |
| **Densidade informacional** | Dashboards industriais precisam de dados densos com hierarquia visual clara |

---

## Diagnostico do Estado Atual

### O que JA esta pronto para SaaS

| Componente | Status | Detalhe |
|---|---|---|
| Proxy generico de APIs | OK | Suporta qualquer REST API com auth, paginacao, field mappings |
| Infraestrutura de tenant no frontend | OK | TenantContext, localStorage isolado, subdomain detection |
| Sistema de permissoes | OK | 19 permissoes granulares com roles (admin/manager/viewer) |
| Criptografia de segredos | OK | AES-256-GCM para credenciais at rest |
| Copilot IA (TypeScript atual) | OK (sera migrado) | Provider-agnostico, tool-based, tenant-aware. **Sera migrado para Python pos-GA — ver "Arquitetura do Servico de IA (Python)"** |
| Audit logging | OK | Eventos de seguranca registrados |
| UI premium | OK | Dark/light mode, Sora + Inter, componentes reutilizaveis, responsivo |
| Design tokens | OK | Spacing, radius, tipografia, cores semanticas ja definidos |
| Code splitting | OK | Chunks separados: vendor-antd, vendor-charts, vendor-pdf |
| Command palette | OK | Cmd+K com cmdk, navegacao rapida |

### O que esta HARDCODED para espuma/SGBR

| Componente | Problema |
|---|---|
| routes/erp.ts | 10 referencias hardcoded a `/sgbrbi/*` e classificacao espuma/aglomerado |
| routes/finance.ts | `classifyEstoqueItem()` (L149-167) hardcoded para grupo espuma/aglomerado |
| routes/proxy.ts | Fallback `SGBR_CREDENTIALS` (L203), token retry SGBR-specific (L949-957) |
| warmCache.ts | Endpoints SGBR hardcoded, `tenantId='default'` hardcoded (L73) |
| app.ts | CSP whitelist `*.sgbrbi.com.br` |
| Frontend schemas | `estoqueEspumaSchema`, `vendaEspumaSchema` com tipos fixos |
| 4 arquivos SGBR no frontend | sgbrContasPagasMap (.ts + .test.ts), sgbrNotasFiscaisNormalize, sgbrVendaAnaliticoNormalize |
| Codigo morto | ~~ComercialPage.tsx~~ (deletado), ~~erpDemoData.ts~~ (deletado) — zero imports confirmado |

### O que FALTA para SaaS

| Item | Criticidade |
|---|---|
| Tabela de tenants com config | CRITICA |
| Users com tenant_id | CRITICA |
| Migracao SQLite -> PostgreSQL | CRITICA |
| Billing/assinaturas (Stripe/Asaas) | CRITICA |
| Self-service registration | ALTA |
| Feature flags por plano/tenant | ALTA |
| Docker + deploy cloud | ALTA |
| Redis para cache compartilhado | ALTA |
| Worker dedicado para background jobs | ALTA |
| Versionamento consistente de API | ALTA |
| Admin super-panel | MEDIA |
| Rate limiting por tenant | MEDIA |
| Usage metering | MEDIA |
| Webhooks para integracao enterprise | MEDIA |
| Export de dados (portabilidade LGPD) | MEDIA |
| Tela de "Importando dados..." (sync longo) | ALTA |
| Notificacoes in-app de billing events | MEDIA |
| Centro de ajuda / documentacao in-app | MEDIA |
| Programa de referral | MEDIA |
| Degraded mode quando API do ERP cai | ALTA |
| Rollback strategy para migrations de banco | ALTA |
| Health check de schema nos connectors | MEDIA |

### Nota sobre TenantContext

O TenantContext **ja existe e funciona** no frontend (TenantContext.ts, TenantProvider.tsx, tenantStorage.ts). Ja e usado em AppLayout, LoginPage e ReportsPage com deteccao de subdomain. O trabalho real na Sprint 2 e apenas **trocar o source de dados**: mock/localStorage → API `/api/v1/tenants/:slug/config`.

### Nota sobre Nodemailer

Nodemailer **ja esta instalado** no backend (v8.0.5). Usado para scheduled reports. A decisao tecnica lista Resend como provider de email — **definicao necessaria**:
- **Opcao A**: Manter Nodemailer com SMTP (Resend como transporte SMTP) — menos mudanca de codigo
- **Opcao B**: Substituir Nodemailer por Resend SDK — DX melhor, webhook de delivery status nativo
- **Recomendacao**: Opcao B para emails transacionais (registro, convite, reset). Manter Nodemailer para scheduled reports (ja funciona)

### Nota sobre testes

| Projeto | Arquivos de teste | Tipo |
|---|---|---|
| Backend | 4 (app, permissions, localProvider, crypto) | Unit |
| Frontend | 11 (contracts, normalizers, utils) | Unit |
| E2E | 3 specs Playwright (auth, rbac, bi-reports) | E2E (nao executados em CI) |

Cobertura atual e **baixa**. Sprint 0 deve incluir setup de CI que roda vitest + playwright.

---

## Design System — Evolucao para SaaS

### Estado atual do design

O sistema ja possui uma base solida: Ant Design v6, tema dark/light com tokens semanticos (`Sora` display + `Inter` body), paleta de 8 cores para charts, spacing scale (4-48px), radius scale, e componentes como `MetricCard`, `ChartShell`, `VirtualTable`, `CommandPalette`.

### Evolucao necessaria

O SaaS exige novas camadas visuais que o sistema desktop nao precisava:

```
CAMADAS NOVAS DO DESIGN SYSTEM
================================

1. PUBLIC LAYER (pre-login)
   ├── Landing page (projeto separado, Next.js)
   ├── Login multi-tenant (com branding dinamico)
   ├── Registro self-service
   ├── Verificacao de email
   ├── Reset de senha
   └── Pagina de precos

2. ONBOARDING LAYER (pos-registro, pre-uso)
   ├── Wizard de 3 passos
   ├── Tour guiado (primeira visita)
   └── Empty states com CTAs educativos

3. BILLING LAYER (gestao de assinatura)
   ├── Pagina de planos + comparacao
   ├── Portal de billing (status, historico, cartao)
   ├── Modais de upgrade/limite atingido
   ├── Banners de trial/pagamento pendente
   └── Tela de plano Free com upsell

4. ADMIN LAYER (super-admin cross-tenant)
   ├── Dashboard de MRR e metricas
   ├── Lista de tenants com filtros
   ├── Detalhe do tenant
   └── Impersonation UI

5. TENANT SETTINGS LAYER
   ├── Configuracoes da empresa (branding)
   ├── Gerenciamento de equipe (convites)
   ├── Fontes de dados (connectors)
   └── Preferencias e notificacoes

6. MARKETPLACE LAYER
   ├── Catalogo de connectors
   ├── Wizard de configuracao dinamico
   └── Status de integracao

7. PORTAL LAYERS (pos-GA)
   ├── Portal do Cliente (externo)
   └── Portal do Fornecedor (externo)
```

### Paleta de cores estendida

```
CORES ATUAIS (manter)
─────────────────────
Brand Primary:     #1A7AB5 (light) / #4AABE0 (dark)
Brand Accent:      #E8930C (orange)
Success:           #10B981
Warning:           #F59E0B
Error/Danger:      #F43F5E
Info:              #3B82F6
Surface Dark:      #111920
Surface Elevated:  #1A2332
Border Dark:       #243344

CORES NOVAS (adicionar)
───────────────────────
Brand Gradient:    linear-gradient(135deg, #1A7AB5, #4AABE0)  → CTAs primarios
Premium Gradient:  linear-gradient(135deg, #7C3AED, #4AABE0)  → Planos premium/Enterprise
Gold Accent:       #F5A623                                     → Trial, badges "Pro"
Emerald SaaS:      #059669                                     → Status ativo, billing OK
Slate Muted:       #64748B                                     → Texto secundario, labels
Surface Glass:     rgba(26, 35, 50, 0.85)                      → Backdrop blur overlays
```

### Tipografia estendida

```
EXISTENTE
─────────
Display:   Sora (700, 600)    → titulos, metricas grandes
Body:      Inter (400, 500)   → texto corrido, labels

ADICIONAR
─────────
Mono:      JetBrains Mono     → codigos, IDs de tenant, tokens, logs de audit
Números:   Sora Tabular       → font-variant-numeric: tabular-nums (metricas, billing)
```

### Novos componentes do Design System

```
COMPONENTES NOVOS NECESSARIOS
══════════════════════════════

PricingCard          → Card de plano com badge, features, CTA, toggle mensal/anual
OnboardingStep       → Step indicator + content area + navigation
BrandingPreview      → Preview em tempo real do branding do tenant
ConnectorCard        → Card de integracao com logo, status, badge
TrialBanner          → Banner sticky no header com countdown + CTA de upgrade
PaymentStatusBadge   → Badge semantico: active, trial, past_due, suspended
UpgradeModal         → Modal quando atinge limite do plano
InviteTeamForm       → Form com multiplos emails + role picker
TenantSwitcher       → Dropdown para super-admin trocar entre tenants
UsageBar             → Barra de progresso de uso (3/5 datasources, 7/10 usuarios)
EmptyStateIllustration → Ilustracoes SVG para empty states educativos
FeatureGate          → Wrapper que mostra blur + lock icon + "Upgrade para Pro"
StepWizard           → Wizard generico com steps, validacao, navegacao
ConnectionTester     → Componente que testa conexao com API em tempo real
StatusPulse          → Indicador pulsante de status (online/offline/syncing)
```

---

## Novas Telas — Especificacoes de Design

### T1. Login Multi-Tenant

**Contexto**: O login atual e single-tenant. O SaaS precisa resolver o tenant antes de autenticar.

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│         ┌─────────────────────────────────────────┐             │
│         │                                         │             │
│         │     [Logo do Tenant — dinamico]          │             │
│         │     Nome da Empresa (do config)          │             │
│         │                                         │             │
│         │  ┌─────────────────────────────────┐    │             │
│         │  │  Email                          │    │             │
│         │  └─────────────────────────────────┘    │             │
│         │  ┌─────────────────────────────────┐    │             │
│         │  │  Senha                     [👁]  │    │             │
│         │  └─────────────────────────────────┘    │             │
│         │                                         │             │
│         │  [  Entrar  ] ← Brand gradient do       │             │
│         │                  tenant como bg          │             │
│         │                                         │             │
│         │  Esqueceu a senha?    Criar conta        │             │
│         │                                         │             │
│         │  ─── ou ───                             │             │
│         │                                         │             │
│         │  Entrar em outra empresa                 │             │
│         │  (abre input de slug/subdomain)          │             │
│         │                                         │             │
│         └─────────────────────────────────────────┘             │
│                                                                 │
│    Background: mesh gradient sutil + noise texture              │
│    (cores derivadas da primary_color do tenant)                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Comportamento**:
- Tenant resolvido por subdomain (`acme.igagestao.com.br`) → carrega logo + cores automaticamente
- Fallback: tela neutra (logo IGA) com campo "Qual sua empresa?" que busca o slug
- Transicao: fade-in do branding do tenant com spring animation (300ms)
- Erro de login: shake no form (200ms, translateX ±8px) + toast vermelho
- Loading: botao com spinner interno (nao desabilita, mostra progresso)
- `prefers-reduced-motion`: sem shake, sem fade — transicoes instantaneas

**Design**:
- Card centralizado com `backdrop-filter: blur(16px)` sobre background
- Background: gradient mesh animado (CSS `@keyframes mesh-shift`, 20s loop, sutil)
- Sem sidebar, sem header — tela isolada full-viewport
- Mobile: card ocupa 100% da largura, padding 24px

---

### T2. Registro Self-Service

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  [Logo IGA]                          Ja tem conta? Entrar →     │
│                                                                 │
│  ┌──────────────────────────┐  ┌──────────────────────────────┐ │
│  │                          │  │                              │ │
│  │  "Comece a transformar   │  │  PASSO 1 de 2               │ │
│  │   sua gestao industrial" │  │                              │ │
│  │                          │  │  Sobre voce                  │ │
│  │  ✓ Dashboard em tempo    │  │  ┌──────────────────────┐   │ │
│  │    real                  │  │  │ Seu nome             │   │ │
│  │  ✓ Conecte qualquer ERP  │  │  └──────────────────────┘   │ │
│  │  ✓ IA integrada          │  │  ┌──────────────────────┐   │ │
│  │  ✓ 14 dias gratis        │  │  │ Email corporativo    │   │ │
│  │                          │  │  └──────────────────────┘   │ │
│  │  "Sem cartao de credito" │  │  ┌──────────────────────┐   │ │
│  │                          │  │  │ Senha (min 8 chars)   │   │ │
│  │  ┌─────────────────┐    │  │  └──────────────────────┘   │ │
│  │  │ Depoimento de   │    │  │  Forca: ████░░░░ Boa        │ │
│  │  │ cliente com foto │    │  │                              │ │
│  │  │ + cargo + empresa│    │  │  Sobre a empresa             │ │
│  │  └─────────────────┘    │  │  ┌──────────────────────┐   │ │
│  │                          │  │  │ Nome da empresa      │   │ │
│  │                          │  │  └──────────────────────┘   │ │
│  │                          │  │  ┌──────────────────────┐   │ │
│  │                          │  │  │ Segmento industrial ▼│   │ │
│  │                          │  │  └──────────────────────┘   │ │
│  │                          │  │  Segmentos: Espumas,        │ │
│  │                          │  │  Metalurgia, Alimentos,     │ │
│  │                          │  │  Quimico, Textil, Outro     │ │
│  │                          │  │                              │ │
│  │                          │  │  □ Aceito os Termos de Uso   │ │
│  │                          │  │    e Politica de Privacidade │ │
│  │                          │  │                              │ │
│  │                          │  │  [  Criar conta gratis  ]    │ │
│  │                          │  │                              │ │
│  └──────────────────────────┘  └──────────────────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Design**:
- Layout split: 50% social proof (esquerda) + 50% form (direita)
- Mobile: social proof esconde, form ocupa 100%
- Background esquerda: gradiente premium (brand → roxo escuro) com ilustracao SVG de dashboard
- Campo de senha: medidor de forca em tempo real (vermelho → amarelo → verde)
- Segmento: Select com icones por industria (engrenagem, tubo quimico, etc.)
- Ao submeter: confetti burst sutil (canvas, 1.5s) + redirect para verificacao de email
- Validacao: inline em tempo real (email formato, slug disponibilidade via debounce 500ms)

---

### T3. Verificacao de Email

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│                     [Logo IGA]                                  │
│                                                                 │
│              ┌──────────────────────┐                           │
│              │                      │                           │
│              │    ┌──────────┐      │                           │
│              │    │  ✉ →  ✓  │      │   Animacao: envelope      │
│              │    └──────────┘      │   abre e check aparece    │
│              │                      │   (Lottie, 2s loop)       │
│              │  Verifique seu email  │                           │
│              │                      │                           │
│              │  Enviamos um link     │                           │
│              │  para joao@acme.com   │                           │
│              │                      │                           │
│              │  Nao recebeu?         │                           │
│              │  [Reenviar email]     │  ← Cooldown 60s          │
│              │                      │     com countdown         │
│              │  [Trocar email]       │                           │
│              │                      │                           │
│              └──────────────────────┘                           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

### T4. Onboarding Wizard (3 passos)

**Aparece apos verificacao de email. Primeira vez no app.**

```
STEP INDICATOR
═══════════════
  ● Empresa ──── ○ Dados ──── ○ Equipe
     ativo         proximo       futuro

Cores: ativo = brand gradient, proximo = border, futuro = muted
Animacao: circulo preenche com spring ao avancar
```

**Passo 1 — Dados da Empresa**:
```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  ● Empresa ──── ○ Dados ──── ○ Equipe                          │
│                                                                 │
│  Personalize sua empresa                                        │
│  Essas informacoes aparecem para toda sua equipe.               │
│                                                                 │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ PREVIEW EM TEMPO REAL                                      │ │
│  │ ┌──────────────────────────────────┐                       │ │
│  │ │ [Logo]  Acme Industria          │  ← Sidebar mini       │ │
│  │ │ ──────────────────              │     com branding       │ │
│  │ │  Dashboard                      │     do tenant          │ │
│  │ │  Producao                       │     preview            │ │
│  │ │  Estoque                        │                       │ │
│  │ └──────────────────────────────────┘                       │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌──────────────────┐  ┌──────────────────┐                    │
│  │ Nome da empresa  │  │ Slug (URL)    🔗 │                    │
│  └──────────────────┘  └──────────────────┘                    │
│  acme.igagestao.com.br ← preview do URL                       │
│                                                                 │
│  [Upload logo]  Arraste ou clique (PNG/SVG, max 2MB)           │
│  ┌──────────────┐                                              │
│  │ Cor primaria │  [■ #1A7AB5]  → Color picker                │
│  └──────────────┘                                              │
│                                                                 │
│  Modulos ativos (todos habilitados no trial):                   │
│  ☑ Dashboard  ☑ Producao  ☑ Estoque  ☑ Financeiro             │
│  ☑ Vendas  ☑ Compras  ☑ Notas Fiscais  ☑ Copilot IA          │
│                                                                 │
│                           [Pular]  [Proximo →]                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Passo 2 — Conectar Fonte de Dados**:
```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  ● Empresa ──── ● Dados ──── ○ Equipe                          │
│                                                                 │
│  Conecte seu ERP                                                │
│  O IGA se conecta ao seu sistema para importar dados            │
│  automaticamente.                                               │
│                                                                 │
│  Escolha seu sistema:                                           │
│                                                                 │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐          │
│  │ [SGBR]   │ │ [Bling]  │ │ [Tiny]   │ │ [Omie]   │          │
│  │ SGBR BI  │ │ Bling    │ │ Tiny ERP │ │ Omie     │          │
│  │          │ │          │ │          │ │          │          │
│  │ ● Ativo  │ │ Em breve │ │ Em breve │ │ Em breve │          │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘          │
│                                                                 │
│  ┌──────────┐ ┌──────────┐                                     │
│  │ [CSV]    │ │ [API]    │                                     │
│  │ CSV/Excel│ │ API REST │                                     │
│  │          │ │ Generica │                                     │
│  │ ● Ativo  │ │ ● Ativo  │                                     │
│  └──────────┘ └──────────┘                                     │
│                                                                 │
│  ── Configurar SGBR BI ──                                      │
│                                                                 │
│  ┌──────────────────────────────────────┐                      │
│  │ URL da API   https://api.sgbrbi...  │                      │
│  └──────────────────────────────────────┘                      │
│  ┌──────────────────┐  ┌──────────────────┐                    │
│  │ Usuario          │  │ Senha         🔒 │                    │
│  └──────────────────┘  └──────────────────┘                    │
│                                                                 │
│  [🔌 Testar conexao]                                           │
│                                                                 │
│  Resultado:                                                     │
│  ● Conexao OK (240ms)                                          │
│  ● 5 endpoints encontrados                                     │
│  ● 1.247 registros disponiveis                                 │
│                                                                 │
│                     [← Voltar]  [Pular]  [Proximo →]           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Animacao do teste de conexao**:
- Botao "Testar" → spinner rotativo interno
- Sucesso: check verde com scale-in (spring, 400ms) + resultados stagger-in (100ms delay entre itens)
- Falha: shake + mensagem vermelha com sugestao ("Verifique URL e credenciais")

**Passo 3 — Convidar Equipe**:
```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  ● Empresa ──── ● Dados ──── ● Equipe                          │
│                                                                 │
│  Convide sua equipe                                             │
│  Voce pode convidar ate 10 pessoas no trial Pro.                │
│                                                                 │
│  ┌──────────────────────────────────────┬──────────┬────┐      │
│  │ Email                               │ Cargo  ▼ │  × │      │
│  ├──────────────────────────────────────┼──────────┼────┤      │
│  │ maria@acme.com                      │ Gerente  │  × │      │
│  ├──────────────────────────────────────┼──────────┼────┤      │
│  │ carlos@acme.com                     │ Viewer   │  × │      │
│  └──────────────────────────────────────┴──────────┴────┘      │
│  [+ Adicionar outro]                                            │
│                                                                 │
│  Cargos disponiveis:                                            │
│  Admin — acesso total                                           │
│  Gerente — tudo menos configuracoes                             │
│  Viewer — somente leitura                                       │
│                                                                 │
│  Convites expiram em 48h. Reenvie a qualquer momento            │
│  em Configuracoes → Equipe.                                     │
│                                                                 │
│              [← Voltar]  [Pular]  [Comecar a usar →]           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Transicao final**: ao clicar "Comecar a usar":
1. Overlay com checkmarks aparecendo em sequencia (stagger 300ms):
   - ✓ Empresa configurada
   - ✓ Dados conectados
   - ✓ Equipe convidada
2. Transicao morphing para o Dashboard (View Transitions API, 500ms)
3. Tour guiado inicia automaticamente (tooltip spotlight nos elementos-chave)

---

### T5. Pagina de Planos e Precos

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  [← Voltar ao app]                                              │
│                                                                 │
│        Escolha o plano ideal para sua industria                  │
│        Cancele quando quiser. Sem surpresas.                     │
│                                                                 │
│        ┌─────────────────────┐                                  │
│        │ Mensal  [●] Anual   │  ← Toggle pill                  │
│        │         20% OFF     │     com badge de desconto        │
│        └─────────────────────┘                                  │
│                                                                 │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐  │
│  │            │ │            │ │ ★ POPULAR  │ │            │  │
│  │   FREE     │ │  STARTER   │ │    PRO     │ │ ENTERPRISE │  │
│  │            │ │            │ │            │ │            │  │
│  │   R$ 0     │ │  R$ 197    │ │  R$ 497    │ │  R$ 997    │  │
│  │   /mes     │ │  /mes      │ │  /mes      │ │  /mes      │  │
│  │            │ │  R$ 157    │ │  R$ 397    │ │  R$ 797    │  │
│  │            │ │  /mes anual│ │  /mes anual│ │  /mes anual│  │
│  │            │ │            │ │            │ │            │  │
│  │ 1 usuario  │ │ 3 usuarios │ │ 10 usuarios│ │ Ilimitado  │  │
│  │ 1 fonte    │ │ 2 fontes   │ │ 5 fontes   │ │ Ilimitado  │  │
│  │ Dashboard  │ │ + Estoque  │ │ Todos      │ │ Todos      │  │
│  │ Vendas     │ │ + Compras  │ │ Copilot IA │ │ + API      │  │
│  │            │ │            │ │            │ │ + Webhooks │  │
│  │            │ │ Email      │ │ Email+Chat │ │ + SLA      │  │
│  │            │ │            │ │            │ │ Dedicado   │  │
│  │            │ │            │ │            │ │            │  │
│  │ [Atual]    │ │ [Assinar]  │ │ [Assinar]  │ │ [Falar com │  │
│  │            │ │            │ │            │ │  vendas]   │  │
│  └────────────┘ └────────────┘ └────────────┘ └────────────┘  │
│                                                                 │
│  ─── Comparacao detalhada ───                                   │
│                                                                 │
│  ┌──────────────────────┬──────┬─────────┬──────┬────────────┐ │
│  │ Feature              │ Free │ Starter │ Pro  │ Enterprise │ │
│  ├──────────────────────┼──────┼─────────┼──────┼────────────┤ │
│  │ Usuarios             │ 1    │ 3       │ 10   │ Ilimitado  │ │
│  │ Fontes de dados      │ 1    │ 2       │ 5    │ Ilimitado  │ │
│  │ Dashboard            │ ✓    │ ✓       │ ✓    │ ✓          │ │
│  │ Vendas               │ ✓    │ ✓       │ ✓    │ ✓          │ │
│  │ Estoque              │ ─    │ ✓       │ ✓    │ ✓          │ │
│  │ Compras              │ ─    │ ✓       │ ✓    │ ✓          │ │
│  │ Producao             │ ─    │ ─       │ ✓    │ ✓          │ │
│  │ Financeiro           │ ─    │ ─       │ ✓    │ ✓          │ │
│  │ Notas Fiscais        │ ─    │ ─       │ ✓    │ ✓          │ │
│  │ Copilot IA           │ ─    │ ─       │ ✓    │ ✓ Premium  │ │
│  │ Relatorios agendados │ ─    │ ─       │ ✓    │ ✓          │ │
│  │ API REST             │ ─    │ ─       │ ─    │ ✓          │ │
│  │ Webhooks             │ ─    │ ─       │ ─    │ ✓          │ │
│  │ Export LGPD          │ ─    │ ─       │ ─    │ ✓          │ │
│  │ SLA                  │ ─    │ ─       │ ─    │ 99.5%      │ │
│  │ Suporte              │ Docs │ Email   │ Chat │ Dedicado   │ │
│  └──────────────────────┴──────┴─────────┴──────┴────────────┘ │
│                                                                 │
│  Perguntas frequentes                                           │
│  ┌──────────────────────────────────────────────┐              │
│  │ ▸ Posso trocar de plano a qualquer momento?  │              │
│  │ ▸ Como funciona o trial de 14 dias?          │              │
│  │ ▸ Quais formas de pagamento aceitam?         │              │
│  │ ▸ Preciso instalar alguma coisa?             │              │
│  │ ▸ Meus dados estao seguros?                  │              │
│  └──────────────────────────────────────────────┘              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Design**:
- Card "Popular" com borda gradiente (brand → roxo), elevado com `box-shadow` extra
- Toggle mensal/anual: pill com slide animation (spring, 200ms), badge "20% OFF" pulsa 1x ao aparecer
- Precos: animacao de numero ao trocar mensal/anual (countUp, 400ms, ease-out)
- Cards hover: translateY(-4px) + shadow aumenta (200ms ease)
- FAQ: accordion com height animation (300ms ease) + rotacao do chevron
- Mobile: cards em scroll horizontal snap, tabela vira cards empilhados

---

### T6. Portal de Billing

```
┌─────────────────────────────────────────────────────────────────┐
│  Sidebar │                                                      │
│          │  Assinatura e Pagamentos                             │
│          │                                                      │
│          │  ┌────────────────────────────────────────────────┐  │
│          │  │ Plano atual: PRO                 [Trocar plano]│  │
│          │  │                                                │  │
│          │  │ Status: ● Ativo                                │  │
│          │  │ Proxima cobranca: 15/05/2026     R$ 497,00     │  │
│          │  │ Metodo: Cartao **** 4242                       │  │
│          │  │                                                │  │
│          │  │ Uso do plano:                                  │  │
│          │  │ Usuarios    ████████░░ 8/10                    │  │
│          │  │ Fontes      ██████░░░░ 3/5                     │  │
│          │  │ Copilot     ████░░░░░░ 12/20 msgs hoje         │  │
│          │  └────────────────────────────────────────────────┘  │
│          │                                                      │
│          │  Historico de pagamentos                              │
│          │  ┌────────────────────────────────────────────────┐  │
│          │  │ Data       │ Valor     │ Status  │ NF          │  │
│          │  │ 15/04/2026 │ R$ 497,00 │ ● Pago  │ [Download]  │  │
│          │  │ 15/03/2026 │ R$ 497,00 │ ● Pago  │ [Download]  │  │
│          │  │ 15/02/2026 │ R$ 497,00 │ ● Pago  │ [Download]  │  │
│          │  └────────────────────────────────────────────────┘  │
│          │                                                      │
│          │  [Atualizar cartao]  [Cancelar assinatura]           │
│          │                                                      │
└──────────┴──────────────────────────────────────────────────────┘
```

**Design**:
- UsageBar: gradiente que muda de cor conforme uso (verde → amarelo → vermelho nos ultimos 20%)
- Quando uso > 80%: badge "Quase no limite" com link de upgrade
- Badge de status: pulsante verde quando ativo, amarelo quando past_due
- Botao "Cancelar" em vermelho muted, abre modal de retencao com motivo + oferta de desconto

---

### T7. Banners e Modais de Estado do Billing

**Banner de Trial** (fixo no topo, dentro do header):
```
┌─────────────────────────────────────────────────────────────────┐
│ ⏱ Seu trial Pro expira em 7 dias.  [Escolher plano →]          │
└─────────────────────────────────────────────────────────────────┘

Cores por urgencia:
> 7 dias:  background brand-gradient, texto branco (informativo)
3-7 dias:  background warning (#F59E0B), texto dark (urgencia moderada)
< 3 dias:  background error (#F43F5E), texto branco (urgencia alta)
0 dias:    background error, pulsante, CTA "Assinar agora"
```

**Modal de Limite Atingido** (aparece ao tentar criar usuario/fonte alem do plano):
```
┌───────────────────────────────────────────┐
│                                           │
│  🔒 Limite de usuarios atingido           │
│                                           │
│  Seu plano Starter permite ate            │
│  3 usuarios. Faca upgrade para            │
│  adicionar mais membros.                  │
│                                           │
│  Starter (atual): 3 usuarios              │
│  Pro:             10 usuarios    ← badge  │
│  Enterprise:      Ilimitado      ← badge  │
│                                           │
│  [Ver planos]         [Fechar]            │
│                                           │
└───────────────────────────────────────────┘

Animacao: scale-in do centro (spring, 300ms) + backdrop blur fade
```

**FeatureGate Inline** (sobre funcionalidades bloqueadas):
```
Quando usuario navega para modulo nao disponivel no plano:

┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│     ┌────────────────────────────────────────────┐              │
│     │  [Blur do conteudo real com filter:blur(8px)]             │
│     │                                            │              │
│     │         🔒                                 │              │
│     │   Producao disponivel                      │              │
│     │   a partir do plano Pro                    │              │
│     │                                            │              │
│     │   [Fazer upgrade →]                        │              │
│     │                                            │              │
│     └────────────────────────────────────────────┘              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

### T8. Configuracoes do Tenant

```
┌─────────────────────────────────────────────────────────────────┐
│  Sidebar │  Configuracoes                                       │
│          │                                                      │
│          │  [Empresa] [Equipe] [Integrações] [Preferencias]     │
│          │  ─────────                                           │
│          │                                                      │
│          │  ── Tab: Empresa ──                                  │
│          │                                                      │
│          │  ┌─────────────┐  Nome: Acme Industria               │
│          │  │  [Logo]     │  Segmento: Espumas                  │
│          │  │  [Trocar]   │  Slug: acme                         │
│          │  └─────────────┘  URL: acme.igagestao.com.br         │
│          │                                                      │
│          │  Cor primaria: [■ #1A7AB5]  [Alterar]                │
│          │  ┌────────────────────────────────┐                  │
│          │  │ Preview do sidebar + header    │                  │
│          │  │ com a nova cor aplicada        │                  │
│          │  └────────────────────────────────┘                  │
│          │                                                      │
│          │  ── Tab: Equipe ──                                   │
│          │                                                      │
│          │  Membros (8/10)                    [Convidar +]      │
│          │  ┌──────────────────────────────────────────────┐   │
│          │  │ Avatar │ Nome     │ Email        │ Cargo │ ⋮ │   │
│          │  │ MS     │ Mayke S. │ m@acme.com   │ Admin │   │   │
│          │  │ JC     │ Joao C.  │ j@acme.com   │ Ger.  │   │   │
│          │  │ ✉      │ Pendente │ ana@acme.com │ View. │   │   │
│          │  └──────────────────────────────────────────────┘   │
│          │                                                      │
│          │  ── Tab: Integracoes ──                               │
│          │                                                      │
│          │  Fontes de dados ativas (3/5)                         │
│          │  ┌──────────────────────────────────────────────┐   │
│          │  │ [SGBR] SGBR BI Producao  ● Online  [Editar] │   │
│          │  │ [CSV]  Planilha Vendas   ● Online  [Editar] │   │
│          │  │ [API]  API Financeiro    ● Offline [Testar] │   │
│          │  └──────────────────────────────────────────────┘   │
│          │  [+ Adicionar fonte]                                 │
│          │                                                      │
│          │  ── Tab: Preferencias ──                              │
│          │                                                      │
│          │  Tema: [● Dark] [○ Light] [○ Sistema]                │
│          │  Idioma: Portugues (BR) ▼                            │
│          │  Fuso horario: America/Sao_Paulo ▼                   │
│          │  Notificacoes por email: [toggle ON]                  │
│          │                                                      │
│          │  Zona de perigo                                       │
│          │  ┌─ border-red ─────────────────────────────────┐   │
│          │  │ [Exportar todos os dados]  [Excluir empresa] │   │
│          │  └──────────────────────────────────────────────┘   │
│          │                                                      │
└──────────┴──────────────────────────────────────────────────────┘
```

**Design**:
- Tabs com underline animado (translateX + scaleX, 200ms spring)
- StatusPulse: circulo pulsante verde/vermelho ao lado de cada fonte de dados
- Preview de branding: atualiza em tempo real conforme muda a cor (debounce 100ms)
- "Zona de perigo": border vermelha, botoes ghost red, confirmacao com digitacao do nome da empresa
- Avatar com iniciais: cores geradas deterministicamente a partir do nome (hash → hue)

---

### T9. Marketplace de Integrações

```
┌─────────────────────────────────────────────────────────────────┐
│  Sidebar │  Integracoes                                         │
│          │                                                      │
│          │  Conecte seu ERP e comece a importar dados            │
│          │  em minutos.                                          │
│          │                                                      │
│          │  ┌──────────────────────────────────────────────┐   │
│          │  │ 🔍 Buscar integracoes...                     │   │
│          │  └──────────────────────────────────────────────┘   │
│          │                                                      │
│          │  [Todos] [Ativos] [Disponiveis] [Em breve]           │
│          │                                                      │
│          │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ │
│          │  │ ┌──┐         │ │ ┌──┐         │ │ ┌──┐         │ │
│          │  │ │SG│ SGBR BI │ │ │BL│ Bling   │ │ │TN│ Tiny    │ │
│          │  │ └──┘         │ │ └──┘         │ │ └──┘         │ │
│          │  │              │ │              │ │              │ │
│          │  │ ERP para     │ │ ERP para     │ │ ERP para     │ │
│          │  │ industria de │ │ e-commerce e │ │ pequenas     │ │
│          │  │ espumas e    │ │ varejo       │ │ empresas     │ │
│          │  │ derivados    │ │              │ │              │ │
│          │  │              │ │              │ │              │ │
│          │  │ ● Conectado  │ │ Disponivel   │ │ EM BREVE     │ │
│          │  │ [Gerenciar]  │ │ [Conectar]   │ │ [Notificar]  │ │
│          │  └──────────────┘ └──────────────┘ └──────────────┘ │
│          │                                                      │
│          │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ │
│          │  │ ┌──┐         │ │ ┌──┐         │ │ ┌──┐         │ │
│          │  │ │OM│ Omie    │ │ │XL│ CSV/     │ │ │AP│ API     │ │
│          │  │ └──┘         │ │ └──┘ Excel   │ │ └──┘ REST    │ │
│          │  │              │ │              │ │ Generica     │ │
│          │  │ ERP completo │ │ Importacao   │ │              │ │
│          │  │ para PME     │ │ manual de    │ │ Conecte      │ │
│          │  │              │ │ planilhas    │ │ qualquer API │ │
│          │  │              │ │              │ │ REST         │ │
│          │  │ EM BREVE     │ │ Disponivel   │ │ Disponivel   │ │
│          │  │ [Notificar]  │ │ [Conectar]   │ │ [Conectar]   │ │
│          │  └──────────────┘ └──────────────┘ └──────────────┘ │
│          │                                                      │
│          │  Nao encontrou seu ERP?                              │
│          │  [Solicitar integracao →]                             │
│          │                                                      │
└──────────┴──────────────────────────────────────────────────────┘
```

**Design**:
- Cards com hover lift (translateY -4px, shadow expand, 200ms)
- Badge "NOVO" em cards recem-lancados (gradiente gold, 8px radius)
- Badge "EM BREVE" em cinza com opacity 0.6, card com subtle desaturate
- "Conectado" com StatusPulse verde
- Logo de cada ERP: icone SVG estilizado no circulo (48x48)
- Grid responsivo: 3 colunas desktop, 2 tablet, 1 mobile
- Stagger animation ao carregar cards (50ms delay entre cada)

---

### T10. Super Admin Dashboard

```
┌─────────────────────────────────────────────────────────────────┐
│  ┌──────────┐                                                   │
│  │ IGA      │  Admin Panel          [Tenant: —] [Sair admin]   │
│  │ ADMIN    │                                                   │
│  ├──────────┤  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌────────┐ │
│  │ Overview │  │ MRR     │ │ Tenants │ │ Churn   │ │ Trials │ │
│  │ Tenants  │  │R$12.500 │ │ 34      │ │ 2.1%   │ │ 8      │ │
│  │ Metricas │  │ +15%▲   │ │ +3 ▲    │ │ -0.5%▼ │ │ 3 exp. │ │
│  │ Alerts   │  └─────────┘ └─────────┘ └─────────┘ └────────┘ │
│  │ Logs     │                                                   │
│  │          │  ┌──────────────────────┐ ┌──────────────────────┐│
│  │          │  │ MRR ao longo do tempo│ │ Tenants por plano    ││
│  │          │  │ [Area chart 6 meses] │ │ [Donut chart]        ││
│  │          │  │                      │ │  Free: 12            ││
│  │          │  │                      │ │  Starter: 10         ││
│  │          │  │                      │ │  Pro: 9              ││
│  │          │  │                      │ │  Enterprise: 3       ││
│  │          │  └──────────────────────┘ └──────────────────────┘│
│  │          │                                                   │
│  │          │  Tenants recentes                    [Ver todos →]│
│  │          │  ┌────────────────────────────────────────────┐   │
│  │          │  │ Tenant     │ Plano  │ Status │ MRR  │ Acao │   │
│  │          │  │ Acme Ind.  │ Pro    │ ● Ativo│ R$497│ [👤] │   │
│  │          │  │ Beta Ltda  │ Start. │ ● Ativo│ R$197│ [👤] │   │
│  │          │  │ Gamma SA   │ Free   │ ● Trial│ R$  0│ [👤] │   │
│  │          │  └────────────────────────────────────────────┘   │
│  │          │  [👤] = Impersonar (abre sessao como admin do tenant)│
│  └──────────┘                                                   │
└─────────────────────────────────────────────────────────────────┘
```

**Design**:
- Sidebar diferenciada: background mais escuro (#0D1117), badge "ADMIN" em vermelho
- MetricCards com sparkline inline (Recharts mini, 60x20px)
- MRR chart: area gradient preenchido (brand azul, opacity 0.3 → 0)
- Donut chart: cores por plano (Free=slate, Starter=blue, Pro=brand, Enterprise=purple)
- Botao impersonar: icone de usuario, abre modal de confirmacao com alerta "Acao registrada no audit log"
- Durante impersonation: banner fixo vermelho no topo "Voce esta como admin de Acme Ind. [Sair]"

---

### T11. Forgot / Reset Password

**Forgot (solicitar reset)**:
```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│              ┌───────────────────────────┐                      │
│              │                           │                      │
│              │  [Logo IGA / Tenant]       │                      │
│              │                           │                      │
│              │  Recuperar senha           │                      │
│              │                           │                      │
│              │  Digite o email da sua     │                      │
│              │  conta para receber um     │                      │
│              │  link de redefinicao.      │                      │
│              │                           │                      │
│              │  ┌───────────────────┐    │                      │
│              │  │ Email             │    │                      │
│              │  └───────────────────┘    │                      │
│              │                           │                      │
│              │  [Enviar link]            │                      │
│              │                           │                      │
│              │  ← Voltar para o login    │                      │
│              │                           │                      │
│              └───────────────────────────┘                      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Reset (nova senha)**:
```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│              ┌───────────────────────────┐                      │
│              │                           │                      │
│              │  Criar nova senha          │                      │
│              │                           │                      │
│              │  ┌───────────────────┐    │                      │
│              │  │ Nova senha        │    │                      │
│              │  └───────────────────┘    │                      │
│              │  Forca: ████████░░ Forte  │                      │
│              │                           │                      │
│              │  ┌───────────────────┐    │                      │
│              │  │ Confirmar senha   │    │                      │
│              │  └───────────────────┘    │                      │
│              │                           │                      │
│              │  [Redefinir senha]         │                      │
│              │                           │                      │
│              └───────────────────────────┘                      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

### T12. Empty States Educativos

**Quando um modulo nao tem dados ainda** (primeiro acesso apos onboarding):

```
┌─────────────────────────────────────────────────────────────────┐
│  Sidebar │                                                      │
│          │                                                      │
│          │              ┌─────────────────────────┐             │
│          │              │                         │             │
│          │              │   [Ilustracao SVG]       │             │
│          │              │   (grafico vazio com     │             │
│          │              │    seta apontando para   │             │
│          │              │    cima — crescimento)   │             │
│          │              │                         │             │
│          │              │   Seu dashboard esta     │             │
│          │              │   quase pronto            │             │
│          │              │                         │             │
│          │              │   Conecte uma fonte de   │             │
│          │              │   dados para ver seus    │             │
│          │              │   indicadores aqui.      │             │
│          │              │                         │             │
│          │              │   [Conectar fonte →]     │             │
│          │              │                         │             │
│          │              └─────────────────────────┘             │
│          │                                                      │
└──────────┴──────────────────────────────────────────────────────┘
```

**Variantes por modulo**:
- Dashboard: "Conecte uma fonte para ver indicadores"
- Producao: "Configure seus produtos para acompanhar a producao"
- Relatorios: "Seus relatorios aparecao aqui conforme os dados chegam"
- Copilot: "Pergunte qualquer coisa sobre seus dados" + exemplos de perguntas

**Design**:
- Ilustracoes SVG monocromaticas (brand color + opacity 0.2 para fill)
- Animacao sutil: ilustracao float up/down (4px, 3s, ease-in-out, infinite)
- CTA com brand gradient
- Texto em 2 niveis: titulo (Sora 600, lg) + descricao (Inter 400, sm, muted)

---

### T13. Tour Guiado (Primeira Visita)

**Implementacao**: react-joyride com customizacao visual

```
SEQUENCIA DO TOUR (5 pasos):

1. Sidebar → "Navegue pelos modulos da sua empresa"
2. Header → "Alterne tema, abra o Copilot IA, e veja alertas"
3. Cmd+K → "Use Ctrl+K para navegar rapido"
4. MetricCard → "Seus KPIs principais aparecem aqui"
5. CopilotDrawer → "Pergunte em linguagem natural sobre seus dados"

TOOLTIP DESIGN:
┌───────────────────────────────────┐
│  Passo 2 de 5                     │
│                                   │
│  Barra de ferramentas             │
│                                   │
│  Alterne entre tema escuro e      │
│  claro, veja alertas, e abra o    │
│  assistente IA.                   │
│                                   │
│  [← Anterior]  [Proximo →]  [×]  │
│                                   │
│  ● ● ○ ○ ○                       │
└───────────────────────────────────┘
     △ (seta apontando para o elemento)

- Background: surface-glass com blur
- Spotlight: overlay escuro com recorte no elemento alvo
- Transicao entre steps: translateX + fade (300ms)
- Pular: fecha tour + salva preferencia (nunca mais mostra)
```

---

### T14. Importando Dados (Sync Longo)

**Contexto**: O primeiro sync com o ERP pode demorar 5-30 minutos. O usuario nao pode ficar olhando uma tela em branco.

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│              ┌───────────────────────────────────┐              │
│              │                                   │              │
│              │   ┌───────────────────────┐       │              │
│              │   │  ⟳  (spinner animado) │       │              │
│              │   └───────────────────────┘       │              │
│              │                                   │              │
│              │   Importando seus dados...         │              │
│              │                                   │              │
│              │   SGBR BI - Producao              │              │
│              │   ████████████░░░░░░ 67%          │              │
│              │                                   │              │
│              │   ✓ Estoque (1.247 registros)     │              │
│              │   ✓ Vendas (3.891 registros)       │              │
│              │   ⟳ Producao (importando...)      │              │
│              │   ○ Compras                        │              │
│              │   ○ Notas Fiscais                  │              │
│              │                                   │              │
│              │   Tempo estimado: ~4 minutos       │              │
│              │                                   │              │
│              │   Voce pode fechar esta pagina.    │              │
│              │   Enviaremos um email quando       │              │
│              │   estiver pronto.                  │              │
│              │                                   │              │
│              │   [Notificar por email]            │              │
│              │                                   │              │
│              └───────────────────────────────────┘              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Comportamento**:
- Sync roda no Worker (BullMQ job), nao no app server
- Frontend faz polling a cada 5s via React Query (`refetchInterval: 5000`)
- Ao completar: notificacao in-app (AlertsBell) + email se solicitado
- Progress bar: verde gradient, animacao shimmer enquanto importando
- Cada endpoint completado: check verde com scale-in animation (spring, 300ms)
- Se falhar: icone vermelho + "Erro ao importar Producao. [Tentar novamente]"

---

## Melhorias de Design nas Telas Existentes

### M1. Dashboard — Melhorias para SaaS

- **Branding do tenant**: logo no header, cor primaria no sidebar active state
- **Trial banner**: integrado no topo do conteudo (nao no header global) quando aplicavel
- **Widgets personalizaveis**: drag-and-drop ja implementado, adicionar "Adicionar widget" button
- **Skeleton loading**: ja existe DashboardSkeleton, garantir que o shimmer use a cor do tenant
- **Welcome card** (primeira vez): card especial no topo "Bem-vindo, Mayke! Aqui estao seus proximos passos" com checklist
- **Data freshness indicator**: "Atualizado ha 5 min" com StatusPulse no header de cada card

### M2. Login — Upgrade para Multi-Tenant

- Trocar background estatico por mesh gradient animado (derivado da cor do tenant)
- Adicionar deteccao de subdomain → carregar branding automaticamente
- Campo "Email" com autocomplete de dominio da empresa (se tenant ja resolvido)
- Social proof rotativo no rodape: "500+ empresas confiam no IGA"

### M3. Sidebar — Evolucao

- **Modulos condicionais**: mostrar/esconder itens baseado em `enabled_modules` do tenant
- **Lock icon**: modulos bloqueados pelo plano mostram cadeado + tooltip "Disponivel no Pro"
- **Tenant logo**: no topo do sidebar, clicavel → abre configuracoes
- **Workspace switcher**: manter o pattern atual (Financeiro/Comercial/Operacional) + adicionar "Admin" para super-admin
- **Collapse animation**: sidebar collapsa com translateX + width animation (300ms spring)

### M4. Command Palette — Expansao

- Adicionar comandos SaaS: "Convidar membro", "Ver plano", "Configurar fonte de dados"
- Secao "Acoes rapidas" com icones
- Super-admin: adicionar "Trocar para tenant..." com busca

### M5. Mobile Responsivo — Polimento

- Bottom navigation bar (5 itens: Dashboard, Vendas, Estoque, Copilot, Menu)
- Drawer lateral para sidebar completa
- Cards de metricas em scroll horizontal snap
- Pull-to-refresh nos dashboards
- FAB (Floating Action Button) para Copilot IA

### M6. Micro-Interacoes Globais

- **Page transitions**: View Transitions API entre rotas (fade + slide 200ms)
- **Number animations**: metricas grandes animam de 0 ao valor (countUp 800ms, easeOutExpo)
- **Chart appear**: graficos fazem draw-in da esquerda para direita ao entrar na viewport (IntersectionObserver)
- **Table row hover**: background highlight com border-left colorida (brand, 3px, scaleY spring)
- **Toast notifications**: slide-in da direita + slide-out (300ms), stacking com gap
- **Tab switch**: conteudo faz crossfade (opacity 150ms) ao trocar de tab
- **Skeleton shimmer**: gradiente linear animado (brand color 5% opacity, 1.5s loop)

---

## Arquitetura SaaS Alvo

```
                           Internet
                              |
                       [Cloudflare WAF + CDN]
                              |
                       [Load Balancer]
                         /         \
                  [App Server 1]  [App Server 2]     [Worker]
                     Node.js        Node.js          BullMQ
                         \         /                    |
                       [PostgreSQL] ─── [Read Replica]  |
                            |                           |
                         [Redis] ──────────────────────┘
                       (cache + sessions + queues)
                            |
                 [APIs Externas por tenant]
                 SGBR BI | Bling | Tiny | ...
```

### Modelo de dados multi-tenant

```sql
-- Tenant
tenants (
  id UUID PK,
  slug VARCHAR(64) UNIQUE,     -- usado no subdomain
  name VARCHAR(200),
  industry VARCHAR(100),        -- 'espuma', 'limpeza', 'metalurgia', 'geral'
  plan VARCHAR(20),             -- 'free', 'starter', 'pro', 'enterprise'
  connector_id VARCHAR(60),     -- qual IndustryConnector usar
  logo_url TEXT,
  primary_color VARCHAR(7),
  enabled_modules JSONB,        -- ['dashboard','producao','estoque','financeiro',...]
  limits JSONB,                 -- { max_users: 3, max_datasources: 2, copilot: false }
  billing_status VARCHAR(20),   -- 'trial', 'active', 'past_due', 'cancelled', 'suspended'
  trial_ends_at TIMESTAMPTZ,
  data_retention_days INT DEFAULT 365,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)

-- Users (tenant-scoped)
users (
  id UUID PK,
  tenant_id UUID FK -> tenants(id),
  name, email (UNIQUE per tenant), role, permissions JSONB,
  password_hash, must_change_password, status,
  last_login_at TIMESTAMPTZ,
  created_at, updated_at
)

-- Todas as tabelas com tenant_id
datasources      (id, tenant_id FK, ...)
sessions         (token, user_id FK, tenant_id FK, ...)
alerts           (id, tenant_id FK, ...)
audit_log        (id, tenant_id FK, user_id, action, resource, metadata, created_at)
copilot_messages (id, tenant_id FK, user_id, role, content, created_at)
scheduled_reports(id, tenant_id FK, user_id, ...)
app_settings     (key, tenant_id FK, value_json, is_secret, ...)

-- Billing
subscriptions (
  id UUID PK,
  tenant_id UUID FK UNIQUE,
  plan VARCHAR(20),
  status VARCHAR(20),           -- 'trialing','active','past_due','cancelled'
  payment_provider VARCHAR(20), -- 'stripe','asaas'
  external_id VARCHAR(200),     -- ID no Stripe/Asaas
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ
)

-- Usage metering
usage_events (
  id BIGSERIAL PK,
  tenant_id UUID FK,
  event_type VARCHAR(40),       -- 'api_call','copilot_message','datasource_sync'
  quantity INT DEFAULT 1,
  created_at TIMESTAMPTZ
)
-- Indice particionado por mes para performance

-- Row Level Security
ALTER TABLE datasources ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON datasources
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
-- Repetir para TODAS as tabelas com tenant_id
```

### Versionamento de API

```
/api/v1/auth/*           -- autenticacao
/api/v1/tenants/*        -- gestao de tenant
/api/v1/users/*          -- usuarios
/api/v1/datasources/*    -- fontes de dados
/api/v1/data/*           -- proxy de dados (substitui /api/proxy/ e /erp/)
/api/v1/finance/*        -- financeiro
/api/v1/copilot/*        -- IA (proxy para servico Python `iga-ai`)
/api/v1/billing/*        -- cobranca
/api/v1/admin/*          -- super-admin
/api/v1/webhooks/*       -- eventos para integracao enterprise
```

---

## Arquitetura do Servico de IA (Python)

> **DECISAO ARQUITETURAL**: TODO o codigo de IA do sistema (Copilot, AI mapping, OCR/Document AI, agentes autonomos, RAG, embeddings) e escrito em **Python 3.12** como microsservico separado. O backend Node.js NAO contem mais logica de IA — apenas faz proxy para o servico Python.

### Por que Python para AI?

| Capacidade | TypeScript / Node.js | Python |
|---|---|---|
| Anthropic SDK | OK (basico) | OK + Pydantic AI integration |
| LangChain / LangGraph | LangChain.js (parcial) | **LangChain + LangGraph completos** |
| Vector stores (Chroma, Qdrant, Weaviate, Milvus) | Drivers parciais | **SDKs first-class** |
| RAG frameworks (LlamaIndex, Haystack) | Nao | **Maduros** |
| Eval frameworks (DSPy, Ragas, deepeval) | Nao | **Estado-da-arte** |
| Observability (Langfuse, LangSmith, Phoenix) | Limitado | **Suporte completo** |
| Document AI (Unstructured, PyMuPDF, pdfplumber) | Limitado | **Ecossistema maduro** |
| ML libs (numpy, pandas, scikit-learn, torch) | Nao | **Padrao da industria** |
| Comunidade AI/ML | Pequena | **Maioria absoluta** |

**Conclusao**: forcar AI em Node.js seria reinventar a roda. Python paga seu peso so no Copilot atual; vai pagar 10x mais com agentes autonomos pos-GA (F7), document AI (INT-6), AI mapping (INT-7).

### Topologia

```
                     [Internet]
                        |
                  [Cloudflare]
                        |
                  [Load Balancer]
                  /             \
        [App Node.js]       [Worker Node.js]
        (Express)           (BullMQ)
              \                  |
               \                 |
                \--- HTTP REST ---\
                                   \
                              [iga-ai Python]
                              FastAPI + Pydantic
                              + LangGraph
                              + Anthropic SDK
                              + pgvector client
                                   |
                              [Celery Worker Python]
                              (jobs longos: OCR, embeddings, agents)
                                   |
                          ┌────────┼────────┐
                          |                 |
                    [PostgreSQL]        [Redis]
                    + pgvector ext.     (filas + cache)
```

### Estrutura do repositorio (apos migracao)

```
sistema de gestão/
├── back-end-gest-o/        # Node.js (Express) — backend principal, auth, billing, dados
├── front-end-gest-o/       # React 19 — frontend
├── iga-ai/                 # NOVO — Python 3.12 — servico de IA
│   ├── pyproject.toml      # uv + ruff + mypy
│   ├── src/iga_ai/
│   │   ├── main.py         # FastAPI app entry
│   │   ├── api/
│   │   │   ├── copilot.py  # endpoints do chat
│   │   │   ├── mapping.py  # AI-assisted mapping (INT-7)
│   │   │   ├── ocr.py      # document AI (INT-6)
│   │   │   ├── agents.py   # agentes autonomos (F7)
│   │   │   └── embeddings.py
│   │   ├── core/
│   │   │   ├── auth.py     # JWT shared secret com backend Node.js
│   │   │   ├── tenant.py   # tenant context propagation
│   │   │   ├── llm.py      # provider abstraction (Anthropic default)
│   │   │   └── vectors.py  # pgvector client
│   │   ├── domain/         # Pydantic models (espelham canonical model)
│   │   ├── tools/          # tools que o agente pode chamar (query DB, call API)
│   │   ├── prompts/        # system prompts por feature, versionados
│   │   ├── workers/        # Celery tasks (OCR async, batch embeddings)
│   │   └── observability/  # Langfuse client, traces
│   ├── tests/              # pytest
│   └── Dockerfile
├── PLANO-SAAS.md
└── docker-compose.yml      # adiciona servico iga-ai
```

### Stack Python detalhada

| Camada | Lib | Por que |
|---|---|---|
| Web framework | **FastAPI** | Async native, OpenAPI auto, integra Pydantic |
| Validacao | **Pydantic v2** | Type-safe, fast, parity com canonical model |
| Package manager | **uv** | 10-100x mais rapido que pip/poetry |
| Lint + format | **ruff** | Substitui black + isort + flake8, ultra-rapido |
| Type check | **mypy** strict | Cobertura total |
| LLM SDK | **anthropic** Python SDK | Default Claude. Fallback OpenAI/Groq abstrato |
| Agent framework | **LangGraph** (workflows) + **Pydantic AI** (type-safe) | LangGraph para agentes autonomos pos-GA, Pydantic AI para tasks discretas |
| RAG | **LlamaIndex** + **pgvector** | Indexacao tenant-scoped no PostgreSQL ja deployado |
| Document AI | **PyMuPDF** + **pdfplumber** + **Unstructured** + Claude vision | NF-e em XML: parser nativo. PDF: Claude vision com bounding boxes |
| Background tasks | **Celery + Redis** | Roda no Redis ja deployado, fila `iga-ai-jobs` separada |
| Observability | **Langfuse** (self-hosted) + **OpenTelemetry** | Traces de cada agent run, custo por tenant |
| Tests | **pytest + pytest-asyncio + httpx** | Padrao Python |
| HTTP client | **httpx** (async) | Para chamadas para o backend Node.js |
| Cache | **redis-py** (mesmo Redis) | Cache de respostas determinaisticas |

### Comunicacao Node.js <-> Python

#### Backend Node.js -> Python (chamada sincrona)

```typescript
// back-end-gest-o/src/services/aiClient.ts
const aiResponse = await fetch(`${IGA_AI_URL}/api/v1/copilot/chat`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${signServiceJwt({ tenantId, userId })}`,
    'X-Tenant-Id': tenantId,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ messages, context }),
})
```

- [ ] **JWT shared secret** entre Node.js e Python (`IGA_INTERNAL_JWT_SECRET` em ambos)
- [ ] **Service-to-service mTLS** opcional (Enterprise / SEC-3)
- [ ] **Rede privada VPC** — Python NAO exposto a internet
- [ ] **Rate limit interno** para evitar Node.js sobrecarregar Python

#### Python -> Node.js (callback / tool calling)

Python precisa chamar o backend para:
- Ler dados canonicos (`GET /api/v1/canonical/products?...`)
- Executar tools do Copilot (Sprint 4 / atual)
- Escrever resultados de OCR no banco

Mesma camada JWT interno. Tools sao expostos como endpoints REST autenticados.

#### Streaming (Copilot chat)

- [ ] FastAPI usa `StreamingResponse` com SSE (Server-Sent Events)
- [ ] Backend Node.js faz proxy do stream para o frontend (mantem cookie + auth)
- [ ] Frontend ja consome SSE no `CopilotDrawer` — zero mudanca

### Migracao do Copilot atual (TypeScript -> Python)

> O Copilot atual esta em `back-end-gest-o/src/services/ai/` (TypeScript). Sera migrado em **3 fases**:

#### Fase 1 — Strangler pattern (1 sprint, paralelo a INT-1)

- [ ] Criar `iga-ai/` como projeto Python novo
- [ ] Implementar **so 1 endpoint** novo em Python: `/api/v1/copilot/chat-v2`
- [ ] Frontend tem feature flag: `useCopilotV2` (default false)
- [ ] 5 tenants beta usam V2 — comparar qualidade, latencia, custo

#### Fase 2 — Migrar tools e prompts (2 sprints)

- [ ] Portar todos os tools (`back-end-gest-o/src/services/ai/tools.ts`) para Python
- [ ] Portar prompts e provider abstraction (Groq, Anthropic) para Python
- [ ] Adicionar capacidades novas que nao tinham em TS:
  - RAG sobre dados canonicos do tenant (pgvector)
  - LangGraph agent com multiplos tools encadeados
  - Eval automatizado em CI (DSPy)

#### Fase 3 — Cutover + deprecate TypeScript (1 sprint)

- [ ] Feature flag default true para todos os tenants
- [ ] Monitorar 2 semanas
- [ ] Deletar `back-end-gest-o/src/services/ai/` e `routes/copilot.ts` (vira so proxy)
- [ ] Doc `AI-MIGRATION.md` com aprendizados

### Deploy

- [ ] Container Docker separado (`iga-ai:latest`)
- [ ] `docker-compose.yml` adiciona servico `iga-ai` com network compartilhada
- [ ] Producao: container roda no mesmo cluster (mesma VPC) que Node.js — comunicacao interna baixa-latencia
- [ ] Health check: `GET /health` retorna status + provider availability + pgvector OK
- [ ] Resource: comeca com 512MB RAM / 0.5 CPU; escala vertical conforme uso
- [ ] Logs: structlog -> Datadog/Loki

### Custos adicionais

| Item | Custo |
|---|---|
| Container Python adicional (VPS) | ~R$ 50-100/mes |
| Langfuse self-hosted (Postgres + container) | R$ 0 (mesmo banco) |
| Engenharia: dev Python (1 dev sr 6 meses) | R$ 90-120k para implementar AI features |
| Tokens Anthropic (Claude Sonnet/Haiku) | Variavel por uso — projetado: R$ 50/tenant Pro/mes |

### Justificativa final (para socios / stakeholders)

Migrar AI para Python e **investimento que paga em features**:
- Copilot atual: limitado a tool-calling simples
- Com Python: agentes autonomos, RAG sobre dados do tenant, OCR de NF, AI mapping, document understanding, eval automatizado
- Sem Python: cada feature de AI custa 3-5x mais para construir em TypeScript (ecosistema imaturo)
- Dev hire: muito mais facil contratar AI engineer Python no Brasil que Node.js+AI

---

## Modelo de Negocios

| Plano | Preco | Anual (20% OFF) | Usuarios | Fontes | Modulos | IA | Suporte |
|---|---|---|---|---|---|---|---|
| Free | R$ 0 | R$ 0 | 1 | 1 | Dashboard + Vendas | Nao | Docs |
| Starter | R$ 197/mes | R$ 157/mes | 3 | 2 | + Estoque + Compras | Nao | Email |
| Pro | R$ 497/mes | R$ 397/mes | 10 | 5 | Todos | Copilot (20 msgs/dia) | Email + Chat |
| Enterprise | R$ 997/mes | R$ 797/mes | Ilimitado | Ilimitado | Todos + API + Webhooks | Copilot Premium | Dedicado + SLA |

**Trial**: 14 dias do plano Pro, sem cartao. Ao expirar, cai para Free.

### Custo por tenant (estimativa)

| Componente | Free | Starter | Pro | Enterprise |
|---|---|---|---|---|
| Infra (proporcional) | R$ 5 | R$ 15 | R$ 30 | R$ 50 |
| IA Copilot (Groq API) | — | — | R$ 10 | R$ 30 |
| Suporte (tempo) | R$ 0 | R$ 20 | R$ 40 | R$ 100 |
| **Custo total** | **R$ 5** | **R$ 35** | **R$ 80** | **R$ 180** |
| **Margem** | **-R$ 5** | **R$ 162 (82%)** | **R$ 417 (84%)** | **R$ 817 (82%)** |

---

## Sprints

### Sprint 0 — Preparacao de Ambiente (1 semana)

**Objetivo**: Infraestrutura de desenvolvimento pronta.

- [x] Branch strategy: `main` (prod) → `develop` (staging) → `feature/*`
- [x] Docker Compose local: postgres 17 + redis 7 + app
- [x] Dockerfile multi-stage para backend (build + runtime)
- [x] Makefile ou scripts: `make dev`, `make test`, `make build`, `make deploy`
- [x] CI basico: GitHub Action que roda lint + tsc + vitest em cada PR
- [x] .env.example atualizado com todas as variaveis necessarias

**Entrega**: `docker compose up` sobe ambiente completo local.

---

### Sprint 1 — Banco PostgreSQL + Redis (2 semanas)

**Objetivo**: Migrar de SQLite para PostgreSQL. Sem mudar funcionalidade.

**Backend**:
- [x] Instalar Drizzle ORM + pg driver
- [x] Criar migrations para TODAS as tabelas
- [x] Adapter pattern: `DatabaseAdapter` interface com `SqliteAdapter` (dev) e `PostgresAdapter` (prod)
  - [x] Adapter incremental de `users` com fallback SQLite e modo PostgreSQL por `IGA_STORAGE_DRIVER=postgres`
  - [x] Adapter incremental de `datasources` com fallback SQLite e modo PostgreSQL por `IGA_STORAGE_DRIVER=postgres`
  - [x] Adapter incremental de `audit_log` (`services/auditLog.ts` + `routes/audit.ts`)
  - [x] Adapter incremental de `alerts` (`routes/alerts.ts` — listar, marcar lida, contar nao lidos)
  - [x] Adapter incremental de `scheduled_reports` (`routes/scheduledReports.ts` + `jobs/scheduledReports.ts`)
  - [x] Adapter incremental de `app_settings` (`services/ai/copilotConfigStore.ts`)
  - [x] Adapter incremental de `copilot_messages` (`routes/copilot.ts` + `jobs/copilotRetention.ts`)
  - [x] Adapter incremental de `users.preferences_json` (`routes/userPreferences.ts` + `services/ai/tools.ts`)
  - [x] Adapter incremental de queries do Copilot tools (`get_users`, `get_alerts`, `search_entities`, `get_scheduled_reports`, `get_audit_log` em `services/ai/tools.ts`)
- [x] Migrar TODOS os `db.prepare(...)` para o adapter — Todos os 37 prepares agora estao envoltos por helpers/branches que verificam `usePostgresStorage()` primeiro e usam SQLite como fallback dev. `sessionStore.ts` mantem SQLite como fallback dev (Redis cobre producao).
- [x] Connection pooling (`pg.Pool`, configuravel via `POSTGRES_POOL_MAX`)
- [x] Substituir `Map` caches por Redis
  - [x] Sessions no Redis
  - [x] Cache de tokens do proxy no Redis com fallback em memoria
  - [x] Cache de respostas do proxy no Redis com fallback em memoria
  - [x] Migrar caches locais restantes de ERP/finance para Redis (`services/sharedCache.ts` + erp.ts (5 caches) + finance.ts (2 caches))
- [x] Health check: testar PostgreSQL + Redis connectivity

**Worker**:
- [x] Criar worker process separado (`npm run worker`; BullMQ instalado para a fila)
- [x] Migrar jobs para filas BullMQ: warmCache, dbBackup, copilotRetention, scheduledReports, alertsEngine
- [x] Zero schedulers no processo web quando `IGA_PROCESS_ROLE=web`

**Testes**:
- [x] `npm run check`
- [x] `npm run test`
- [x] Docker Compose: backend healthy com PostgreSQL + Redis
- [x] Docker Compose: worker em modo BullMQ (`queue: bullmq`) com chaves `bull:iga-background-jobs:*` no Redis
- [x] Teste automatizado de failover Redis (`services/sharedCache.test.ts` — 10 cenarios cobrindo memoria pura, TTL, LRU, failover de get/set, Redis caindo no meio da operacao)

---

### Sprint 2 — Fundacao Multi-Tenant (2 semanas)

**Objetivo**: Sistema de tenants com isolamento real no PostgreSQL.

**Backend**:
- [x] Tabela `tenants` + `tenant_id` em todas as tabelas
- [x] Row Level Security no PostgreSQL
- [x] Middleware: `SET LOCAL app.current_tenant_id = ?` em cada request
- [x] CRUD `/api/v1/tenants` (super-admin only)
- [x] `GET /api/v1/tenants/:slug/config` (publico, retorna branding)

**Frontend**:
- [x] TenantProvider real (consumir API)
- [x] Resolver tenant por subdomain OU path OU query param
- [x] Branding dinamico (logo, cor, nome)
- [x] Modulos condicionais baseados em `enabled_modules`

**Testes**: isolamento RLS testado entre tenants A e B

- [x] Teste automatizado do endpoint publico de config do tenant default
- [x] Teste RLS A/B em PostgreSQL real com `SET LOCAL app.current_tenant_id`

---

### Sprint 3 — Desacoplar Industria (3 semanas)

**Objetivo**: Eliminar hardcoding de espuma/SGBR. Connector pattern.

**Backend**:
- [x] Interface `IndustryConnector` (classifyProduct, getProductTypes, normalizeRow, etc.)
- [x] Implementar `SgbrEspumaConnector` + `GenericConnector`
- [x] `ConnectorRegistry.get(tenant.connector_id)`
- [x] Refatorar rotas erp, finance, proxy para usar connector do tenant
- [x] CSP dinamico baseado no connector
- [x] Dados de demonstracao por connector (trials)

**Frontend**:
- [x] Labels dinamicos baseados no connector (via API)
- [x] Schemas Zod genericos (sem enums hardcoded)
- [x] Remover `sgbr*Normalize.ts`

---

### Sprint 4 — Auth SaaS + Onboarding + Design (3 semanas)

**Objetivo**: Registro self-service, onboarding premium, telas publicas.

**Backend**:
- [x] `POST /api/v1/auth/register` — cria tenant + admin + trial 14 dias
- [x] `POST /api/v1/auth/invite` — convite com token 48h
- [x] `POST /api/v1/auth/accept-invite`
- [x] `POST /api/v1/auth/forgot-password` — token 1h
- [x] `POST /api/v1/auth/reset-password`
- [x] `POST /api/v1/auth/verify-email`
- [x] Rate limiting por tenant (Redis)
- [x] JWT com claims: `sub`, `tid`, `role`, `plan`

**Frontend — Novas Telas**:
- [x] **T1**: Login multi-tenant (branding dinamico, mesh gradient, subdomain detection)
- [x] **T2**: Registro self-service (layout split, social proof, validacao inline)
- [x] **T3**: Verificacao de email (animacao Lottie, cooldown reenvio)
- [x] **T4**: Onboarding wizard 3 passos (empresa + dados + equipe)
- [x] **T11**: Forgot/reset password
- [x] **T12**: Empty states educativos (SVG + CTA por modulo)
- [x] **T13**: Tour guiado (react-joyride customizado)
- [x] **T14**: Tela "Importando dados" (progress bar, sync background, notificacao ao concluir)

**Frontend — Melhorias Existentes**:
- [x] **M1**: Dashboard welcome card + data freshness indicator
- [x] **M2**: Login mesh gradient + tenant detection
- [x] **M3**: Sidebar modulos condicionais + lock icon
- [x] **M5**: Mobile bottom nav + pull-to-refresh
- [x] **M6**: Micro-interacoes globais (page transitions, countUp, chart draw-in)

**Email Templates** (Nodemailer, HTML responsivo):
- [x] Boas-vindas + verificacao
- [x] Convite de equipe
- [x] Reset de senha
- [x] Trial expirando (3 dias antes)
- [x] Trial expirado

---

### Sprint 5 — Billing e Planos (2 semanas)

**Objetivo**: Cobranca automatica, planos, limites, upgrade/downgrade.

**Backend**:
- [x] Integracao Stripe (Checkout + Portal + webhook signature)
- [x] Tabela `subscriptions` (SQLite + Postgres com FK + RLS)
- [x] Webhooks de pagamento (`checkout.session.completed`, `customer.subscription.created/updated/deleted`, `invoice.payment_failed`)
- [x] Middleware de feature gating (`subscriptionGate` 402 com allowlist /auth, /billing, /onboarding, /tenants/:slug/config)
- [x] Limites enforced no backend por plano (quantidade de users/datasources/copilot calls)
- [x] Grace period 7 dias (status `grace` + `grace_until` em invoice.payment_failed)
- [x] Endpoints: `GET /billing/status`, `POST /billing/checkout-session`, `POST /billing/portal-link` (change-plan via portal)
- [x] Export LGPD: `GET /api/v1/tenants/:id/export`

**Frontend — Novas Telas**:
- [x] **T5**: Pagina de planos (cards, toggle mensal/anual, tabela comparativa, FAQ accordion)
- [x] **T6**: Portal de billing (status, uso, historico, NF download)
- [x] **T7**: Banners de trial + modais de limite + FeatureGate inline (blur + lock)
- [x] **T8**: Configuracoes do tenant (empresa, equipe, integracoes, preferencias)

**Frontend — Melhorias**:
- [x] **M4**: Command palette com comandos SaaS
- [x] UsageBar nos modais e configuracoes

**Backlog Growth (fora do fechamento S5)**:
- [ ] Modal de retencao ao cancelar

---

### Sprint 6 — Deploy Cloud e Operacoes (2 semanas) — DONE (parcial Beta free)

**Objetivo**: Sistema rodando na nuvem com monitoramento e CI/CD.

**Infra (Beta free zero-gasto — ver `DEPLOY-FREE.md`)**:
- [x] **Render free** (backend Node) — `render.yaml` configurado com healthCheckPath, autoDeploy, envVars completas
- [x] **Supabase free** (Postgres 0.5GB) — connection string via `DATABASE_URL` no Render
- [x] **Upstash free** (Redis 10k req/dia) — `REDIS_URL` no Render
- [x] **Vercel free** (frontend) — `vercel.json` com SPA rewrites + CSP/HSTS/COOP/CORP
- [x] **SSL automatico** Let's Encrypt via Render + Vercel
- [ ] Dominio `app.igagestao.com.br` + subdomains — Beta usa `iga-gestao.onrender.com` + `iga-gestao.vercel.app` (R$ 0)
- [ ] Wildcard SSL + Cloudflare WAF/CDN/DDoS — pendente (Cloudflare Pro R$ 100/mes)
- [ ] Dados no Brasil — Supabase regiao `sa-east-1` quando criar projeto

**CI/CD**:
- [x] GitHub Action `ci.yml`: lint → tsc → test → build (back+front+docker config)
- [x] GitHub Action `security.yml`: SAST + SCA + SBOM + secret scan + lockfile lint
- [x] GitHub Action `db-backup.yml`: pg_dump diario as 03:00 UTC
- [x] Render `autoDeploy: true` faz deploy a cada push em master
- [ ] Blue-green deployment — Render free nao suporta (upgrade Starter R$ 35/mes)
- [x] Database migrations idempotentes (`db/postgresMigrations.ts` aplicadas no boot)

**Monitoramento (Beta free)**:
- [x] **Sentry** wiring condicional (CDN loader em `observabilityBootstrap.ts`)
- [x] **PostHog Cloud** wiring condicional (mesmo arquivo)
- [x] **UptimeRobot** documentado (5min ping mantem Render acordado)
- [ ] Metricas p50/p95/p99 — depende APM (OPS-2)
- [ ] Alertas Slack/email — Sentry email basta no Beta
- [x] Backup PostgreSQL diario (retencao 30 dias) — workflow GitHub Actions

---

### Sprint 7 — Super Admin Panel (2 semanas)

**Objetivo**: Painel interno para gerenciar todos os tenants.

**Backend**:
- [x] Role `super_admin` (cross-tenant via `SUPER_ADMIN_EMAILS`)
- [x] CRUD de tenants com metricas (usuarios, datasources, billing)
- [x] MRR, churn rate, tenants por plano/segmento
- [x] Suspender/ativar/impersonar tenant (audit logged)

**Frontend — Nova Tela**:
- [x] **T10**: Super admin dashboard (MRR chart, donut por plano, lista tenants, impersonation)
- [x] Sidebar diferenciada (dark + badge ADMIN)
- [x] Banner de impersonation (vermelho fixo no topo)
- [x] TenantSwitcher no command palette

---

### Sprint 8 — Connectors e Marketplace (3 semanas)

**Objetivo**: Suportar ERPs alem do SGBR. Sistema de plugins.

**Connectors**:
- [x] Connector generico REST/API propria IGA para ERPs sem API oficial
- [x] Connector generico CSV/Excel (upload manual com mapeamento)
- [x] Connector Bling (API REST v3)
- [x] Connector Tiny ERP (API REST)
- [x] Connector Omie (API REST)

**Backend**:
- [x] `GET /api/v1/connectors` + `GET /api/v1/connectors/:id/schema`
- [x] Hot-reload de connectors

**Frontend — Nova Tela**:
- [x] **T9**: Marketplace de integracoes (cards, busca, schema modal, presets de configuracao)
- [x] ConnectionTester integrado no wizard de datasources
- [x] Badge "PRONTO" / "EM BREVE"

**Webhooks (Enterprise)**:
- [x] Registrar/gerenciar webhooks + retry com backoff exponencial
- [x] Dashboard de entregas

---

### Sprint 9 — Landing Page e Go-to-Market (2 semanas)

> Sprint separada — pode rodar em PARALELO com qualquer sprint.

- [ ] Landing page Next.js + Tailwind (ver PLANO-LANDING-PAGE.md)
- [ ] Dominio igagestao.com.br
- [ ] GA4 + Hotjar
- [ ] Lead capture → CRM
- [ ] Blog com 3 artigos SEO
- [ ] Video demo de 2 minutos
- [ ] Status page publica

---

## Trilha de Seguranca — Sprints SEC-1 a SEC-4

> Sprints dedicadas de seguranca rodando em PARALELO as sprints de feature. Cada uma tem owner unico (Security Champion) e funciona como **gate** para a fase seguinte.
>
> **Por que sprints dedicadas**: o plano original espalha seguranca em 6 sprints. Sem owner unico, controles ficam pela metade. Trilha dedicada garante que (a) ninguem lanca o GA sem pentest aprovado, (b) compliance LGPD nao vira "depois", (c) DevSecOps entra no CI desde o S0.

### Mapa da trilha

```
Semana:  1    2    3    4    5    6    7    8    9   10   11   12   13   14   15

S0       [==]
S1            [========]
S2                       [========]
S3                                  [==============]
S4                                  [==============]
S5                                                  [========]
S6                                                           [========]
S7                                                                    [====]
S8                                                                    [========]

SEC-1         [===============]      ← Foundation hardening (paralelo S1-S2)
SEC-2                              [===============]   ← Identity hardening (paralelo S4)
SEC-3                                                  [===============]   ← AppSec/DevSecOps (paralelo S5-S6)
SEC-4                                                              [===========]   ← Compliance + Pentest (gate GA)

GATES:    [SEC-1 done = libera S3/S4]   [SEC-2 done = libera Beta Fechada]   [SEC-3 done = libera Beta Aberta]   [SEC-4 done + pentest aprovado = libera GA]
```

---

### Sprint SEC-1 — Foundation Security Hardening (2 semanas)

**Objetivo**: Resolver gaps criticos de baseline antes de qualquer codigo multi-tenant ou feature publica entrar em producao.

**Owner**: Security Champion + 1 backend dev
**Paralelo a**: S1 (PostgreSQL+Redis) e S2 (Multi-tenant)
**Gate**: nada que processe credenciais ou faca proxy para APIs externas vai pra prod sem SEC-1 done

#### 1.1 SSRF protection no proxy (CRITICA) — DONE

- [x] Validar `apiUrl` de datasources em `routes/datasources.ts` no momento do CRUD:
  - [x] Bloquear schemes nao-http(s) (`utils/urlSafety.ts:validateExternalApiUrl`)
  - [x] Bloquear IPv4 RFC1918, loopback, link-local, CGNAT 100.64/10
  - [x] Bloquear IPv6 privado/loopback (`::1`, `fe80::`, `fc00::/7`, IPv4-mapped)
  - [x] Bloquear hostnames sentinela (`localhost`, `metadata.google.internal`)
  - [x] Allowlist override via env `ALLOW_PRIVATE_HOSTS` (CSV)
- [x] No fetch (proxy + connectionTester):
  - [x] Wrapper `safeUFetch` em `routes/proxy.ts` valida URL antes de cada uFetch externo (8 sites cobertos)
  - [x] `selectDataSource` rejeita datasource com URL ruim (defense-in-depth)
  - [ ] Disable redirects automaticos / validar `Location` (futuro — undici default segue 20 redirects)
- [x] Auditoria: erro registrado em `markProxyError` + log estruturado

#### 1.2 Hash de senha — argon2id — DONE

- [x] `argon2` instalado (binario nativo, suporta Windows)
- [x] `hashUserPasswordAsync` usa argon2id com `memoryCost=65536, timeCost=3, parallelism=4`
- [x] `verifyUserPasswordAsync` detecta formato (`$argon2`, `scrypt$2$`, `salt:hash`); legado scrypt v1/v2 mantido
- [x] Rehash automatico no proximo login bem-sucedido (`isLegacyPasswordHash` -> `hashUserPasswordAsync`)
- [ ] Forcar reset apos 90 dias para hashes ainda legados (futuro — job de retencao)

#### 1.3 Audit log integrity (hash chain) — DONE

- [x] Colunas `prev_hash` + `row_hash` (SHA-256 de canonical row com `prev_hash` incluido)
- [x] Insercao atomica: SQLite via `db.transaction`; Postgres via `pg_advisory_xact_lock('iga_audit_chain')`
- [x] Postgres: `REVOKE UPDATE, DELETE` em `audit_log` para `iga_app` (migration 006)
- [x] `GET /audit/verify` recalcula chain ASC; retorna 409 com `brokenAt` em mismatch
- [ ] Job mensal: snapshot ultimo `row_hash` para S3 Object Lock (operacional)

#### 1.4 Secrets management — pendente (operacional)

- [ ] Decisao: **Doppler** (mais simples, R$ 0 ate 10 users) OU **AWS Secrets Manager** (R$ 0,40/secret/mes)
- [ ] Migrar `.env` -> Doppler/SM: `DB_*`, `REDIS_*`, `IGA_SECRETS_KEY`, `IGA_SESSION_JWT_SECRET`, `STRIPE_*`, `GROQ_API_KEY`, `TURNSTILE_SECRET`
- [ ] Backend boota lendo do Doppler CLI (dev) ou SM SDK (prod)
- [ ] Rotacao automatica de `IGA_SECRETS_KEY`: envelope encryption — DEK por tenant, KEK rotacionada anualmente

#### 1.5 PII redaction em logs — DONE

- [x] `utils/redactSecrets`: redaction recursiva de `password|token|authorization|cookie|secret|apiKey|jwt|x-csrf|set-cookie`
- [x] `services/structuredLog`: `logInfo/logWarn/logError` com redaction automatica antes de `console.log`
- [x] Aplicado em `routes/proxy.ts` (`proxy.data` event); `requestLog.ts` ja era seguro
- [x] `utils/piiMask` mascara CPF/CNPJ/email/telefone/cartao em strings (combina com redactSecrets)
- [ ] Logs centralizados em Datadog/Loki com retencao 90 dias e RBAC (operacional)

#### 1.6 Input sanitization e validacao centralizada — DONE

- [x] Bloqueio de keys perigosas (`__proto__`, `constructor`, `prototype`) em `req.body`: `middleware/blockPrototypePollution`
- [x] Limite por rota:
  - [x] auth (`/login`, `/register`, etc): `maxBodySize(4*1024)`
  - [x] copilot: `maxBodySize(32*1024)`
  - [x] global JSON parser: `1mb`
- [ ] Content-Type strict (futuro)
- [ ] Helper `safeParse` global com trim/lowercase de email (cada endpoint faz inline hoje)

#### 1.7 File upload security — N/A no momento

- [ ] Multer + magic bytes + sanitize SVG + storage S3 — sera necessario quando feature de upload de logo/CSV chegar (Sprint 4 ja tem branding mas sem upload, Sprint 8 connector CSV)

#### 1.8 Rate limiting com Redis store — DONE

- [x] `middleware/redisRateLimit` factory: usa `rate-limit-redis` quando `REDIS_URL` setado, fallback `memory`
- [x] Migrado: auth login, change-password, copilot, datasources test, proxy, users:create
- [x] `tenantRateLimit` ja era Redis-backed
- [ ] Limites granulares finos (`/auth/login`: 5/min/IP + 15/15min/IP por email — fino-tuning futuro)

**Entrega SEC-1**:
- [ ] Pentest interno (OWASP ZAP automated scan) sem highs/criticals em endpoints publicos (parte de SEC-4)
- [ ] Documento `SECURITY-BASELINE.md` na raiz do repo (futuro)
- [ ] CI bloqueia merge se SAST encontrar high (SEC-3)

---

### Sprint SEC-2 — Identity & Access Hardening (2 semanas)

**Objetivo**: Auth de SaaS de verdade — MFA, captcha, anti-fraud, SSO, session security.

**Owner**: Security Champion + 1 fullstack
**Paralelo a**: S4 (Auth + Onboarding)
**Gate**: nao abre Beta Fechada sem SEC-2 done

#### 2.1 MFA / TOTP — DONE

- [x] `otplib` para gerar segredos TOTP (RFC 6238); window=1 step para clock skew
- [x] Backend endpoints: `/auth/mfa/status`, `/auth/mfa/setup-init`, `/auth/mfa/setup-confirm`, `/auth/mfa/disable`, `/auth/mfa/backup-codes/regenerate`
- [x] Login flow: `/auth/login` aceita `totp` opcional; sem ele em conta com MFA -> 200 `{mfaRequired:true}`
- [x] Frontend (consome endpoints):
  - [x] `MfaSetupModal` — 3 steps: QR (api.qrserver.com) + confirmar TOTP + backup codes
  - [x] `SecurityPage` (rota `/seguranca`) com status + ativar/desativar/regerar
  - [x] `LoginPage` mostra input TOTP quando backend retorna `mfaRequired`
- [x] Secret cifrado at-rest com AES-256-GCM (`services/crypto.encryptSecret`)
- [x] 10 backup codes (8 hex chars cada) hasheados com SHA-256 + timing-safe compare; consumidos one-time
- [ ] Politica obrigatoria para admin/super_admin (forcar via middleware no S7)
- [x] Audit: `mfa_enabled`, `mfa_disabled`, `mfa_failed`, `mfa_success`, `mfa_backup_code_used`, `mfa_backup_codes_regenerated`

#### 2.2 Captcha em endpoints publicos — DONE

- [x] **Cloudflare Turnstile** (`services/turnstile`) — siteverify com k-anonymity
- [x] Middleware `requireTurnstile` aplicado em `/login`, `/register`, `/forgot-password`
- [x] Frontend: `TurnstileWidget` carrega script sob demanda, habilitado por `VITE_TURNSTILE_SITE_KEY`
- [x] LoginPage injeta token via interceptor axios em header `X-Turnstile-Token`
- [x] `TURNSTILE_SECRET` ausente -> middleware passthrough (skip em dev)
- [ ] Adaptive (so apos 3 falhas no IP) — futuro

#### 2.3 Pwned password check — DONE

- [x] HIBP k-anonymity (`services/pwnedPassword`): SHA-1 prefix 5 chars enviado a `api.pwnedpasswords.com/range`
- [x] `Add-Padding: true` para defesa extra contra fingerprinting
- [x] Bloqueia se `count >= 100` em register/accept-invite/change-password/reset-password
- [x] Fail-open em erro de rede (timeout 3s); `HIBP_DISABLED=1` desliga em air-gapped

#### 2.4 Account lockout adaptativo — DONE

- [x] `services/accountLockout`: 5 falhas/10min -> lock 30min; 3 lockouts/24h -> exige reset (`requireReset:true`)
- [x] Storage Redis com fallback `memStore` (single-process dev)
- [x] Chave por `(tenantId, email-lowercase)` — botnet por IP nao burla
- [x] `clearLoginFailures` chamado apos sucesso (zera contador, mantem lockoutCount24h)
- [x] Audit: `login_blocked_locked`, `login_blocked_reset_required`, `login_failed` com `failuresInWindow`/`nowLocked`/`lockoutCount24h`

#### 2.5 Session binding (IP/UA fingerprint) — DONE (parcial)

- [x] Sessions ganharam `ip_hash`, `ua_hash`, `ua_family` (migration v5/007)
- [x] `buildSessionBinding(ip, ua)` no login + `detectUaFamily` (chrome/firefox/safari/edge/opera/cli/postman/other)
- [x] `requireAuth` revoga sessao quando UA family mudou drasticamente (chrome <-> safari)
- [x] Novo dispositivo (UA hash novo) dispara email `newDeviceLoginTemplate` via `sendNewDeviceAlertIfUnknown`
- [ ] `created_country` via `CF-IPCountry` (precisa Cloudflare em frente — SEC-3)
- [ ] Mudanca de pais -> email + revoga (depende de geo header)
- [ ] IP subnet /16 mudou -> log warning (futuro)

#### 2.6 Refresh token rotation — DONE

- [x] Tabela `refresh_tokens` (token_hash + family_id + parent_hash + revoked_at) — migration v7/009
- [x] `services/refreshTokenStore`: issue/rotate com reuse detection -> `revokeFamily` em hijack + `audit_log refresh_reuse_detected`
- [x] `POST /auth/refresh` rotaciona e emite novo access; reuse retorna 401 + revoked:true
- [x] `/auth/login` retorna `refreshToken` + `refreshExpiresAt` (TTL 7d)
- [x] `/auth/logout-all` revoga refresh tokens da familia + sessoes
- [ ] **Substituir** sessao 8h por access 15min: deferido — refactor maior, hoje os dois sistemas coexistem (frontend continua usando session JWT 8h via cookie, refresh token disponivel para clients que quiserem)
- [ ] Blacklist de access tokens em logout (TTL=15min)

#### 2.7 SSO Enterprise (SAML 2.0 / OIDC) — pendente

- [ ] Integrar via **WorkOS** (R$ 50/conexao) OU **Auth0/Clerk** OU implementar com `passport-saml`/`openid-client`
- [ ] Tela de configuracao em Tenant Settings (so plano Enterprise): IdP metadata XML upload + ACS URL
- [ ] JIT provisioning: cria user no primeiro login se email matches dominio configurado
- [ ] SCIM 2.0 (deprovisioning) — opcional, vendida como add-on

#### 2.8 Password history — DONE

- [x] Tabela `user_password_history` (user_id, password_hash, created_at) — migration v5/007
- [x] Bloquear reuso das ultimas **5** senhas (`isPasswordReused`) em change-password e reset-password
- [x] `cleanupOldPasswordHistory()` remove entries > 1 ano (disponivel para job — falta wirar no agendador)
- [x] `recordPasswordHistory` chamado apos cada mudanca de senha

#### 2.9 Forgot password timing-safe — DONE

- [x] `/auth/forgot-password` sempre retorna 200 + `GENERIC_FORGOT_MESSAGE` ("Se o email existir, enviamos um link...")
- [x] Baseline 600ms via `setTimeout` ate atingir tempo minimo — user existente vs inexistente indistinguivel por timing
- [x] Token de reset: 32 bytes random, hash SHA-256 armazenado, TTL 1h, single-use (`createAuthActionToken`/`consumeAuthActionToken`)
- [x] Erros de DB/email tratados silenciosamente — mesma resposta generica

#### 2.10 Login alerts — DONE

- [x] Templates: `newDeviceLoginTemplate`, `passwordChangedTemplate`, `emailChangedTemplate`, `mfaToggleTemplate`
- [x] Disparado em: novo dispositivo (UA hash novo), senha alterada, MFA habilitado/desabilitado
- [x] CTA "nao fui eu" aponta para `/forgot-password?tenant=...` (revoga + reset)
- [x] Texto inclui: data/hora UTC, IP, dispositivo (UA truncado a 200 chars)
- [ ] Login de novo pais (depende de `CF-IPCountry` — SEC-3)
- [ ] Email da conta alterado (sem fluxo de mudanca de email hoje)

**Entrega SEC-2**:
- [ ] OWASP ASVS Level 2 compliance no modulo de auth (audit formal pendente)
- [ ] Doc `IDENTITY-PLAYBOOK.md` para suporte (como ajudar user que perdeu MFA, como impersonar, etc.)

---

### Sprint SEC-3 — AppSec & DevSecOps (2 semanas)

**Objetivo**: Pipeline de seguranca automatizado, headers e WAF de classe mundial, CSP dinamico multi-tenant.

**Owner**: Security Champion + 1 platform/infra
**Paralelo a**: S5 (Billing) e S6 (Deploy Cloud)
**Gate**: nao abre Beta Aberta sem SEC-3 done

#### 3.1 SAST/DAST/SCA no CI — DONE (parcial)

- [x] **SAST**: Semgrep com `p/owasp-top-ten` + `p/javascript` + `p/typescript` + `p/react` + `p/nodejsscan` + `p/security-audit` (`.github/workflows/security.yml`)
- [x] **SCA**: `npm audit --audit-level=high` (back+front) + Trivy filesystem scan SARIF -> Security tab
- [ ] **DAST**: OWASP ZAP baseline scan em staging URL — pendente (precisa deploy primeiro)
- [ ] **Container scan**: Trivy image scan no Docker build — pendente (precisa Dockerfile finalizado)
- [x] **Lockfile lint**: `lockfile-lint --validate-https --allowed-hosts npm`
- [x] **Secret scan**: `gitleaks-action@v2` + `.gitleaks.toml` com allowlist auditada
- [ ] **CodeQL** habilitado no GitHub — pendente (config no GitHub Settings)

#### 3.2 SBOM (Software Bill of Materials) — DONE (parcial)

- [x] Gerar SBOM em CycloneDX format a cada CI run: `npx @cyclonedx/cyclonedx-npm` para back e front
- [x] Disponibilizado como artifact GitHub (retencao 90 dias)
- [ ] Anexar ao GitHub release — pendente (workflow de release)
- [ ] Disponibilizar em `/security/sbom-{version}.json` — pendente

#### 3.3 Headers A+ (SecurityHeaders.com) — DONE (parcial)

- [ ] **CSP com nonce** — pendente (refactor maior Vite + Helmet)
- [ ] **CSP report-only** primeiro -> enforce — pendente
- [x] Endpoint `POST /api/v1/security/csp-report` rate-limited (10/s/IP) com `application/csp-report` + `application/reports+json`
- [x] Headers extras:
  - [x] `Cross-Origin-Opener-Policy: same-origin`
  - [ ] `Cross-Origin-Embedder-Policy: require-corp` — desabilitado intencionalmente (quebra imagens externas)
  - [x] `Cross-Origin-Resource-Policy: same-origin`
  - [x] `Reporting-Endpoints: csp-endpoint="/api/v1/security/csp-report"`
  - [x] `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload` (Vercel)
- [ ] Meta: A+ no SecurityHeaders.com + A+ no SSL Labs — depende deploy

#### 3.4 CSP dinamico multi-tenant — DONE

- [x] Middleware em `app.ts` le `connector.cspConnectSrc` via `findTenantBySlug(resolveTenantId(req))`
- [x] Cada connector declara hosts: `SgbrEspumaConnector -> ['*.sgbrbi.com.br']`, `BlingConnector -> ['*.bling.com.br', 'api.bling.com.br']`, etc.
- [x] CSP montado por request: `connect-src 'self' ${FRONTEND_URL} ${...connector.cspConnectSrc}`
- [ ] Test cross-tenant automatizado — escrever no SEC-3 testes

#### 3.5 CORS dinamico para subdomains — DONE

- [x] `app.ts` aceita `FRONTEND_URL` + regex configuravel via `CORS_TENANT_DOMAIN_REGEX`
- [x] Default cobre `*.igagestao.com.br` + `*.vercel.app` + `*.onrender.com`
- [x] Audit log: erro `CORS denied: ${origin}` em rejeicao
- [ ] Cache de regex compilado — implicito (RegExp instance reutilizada)

#### 3.6 WAF Cloudflare — regras customizadas

- [ ] **Bot Fight Mode** habilitado
- [ ] **Managed rules**: OWASP Core Rule Set + Cloudflare Managed Ruleset
- [ ] **Rate limiting Cloudflare** (camada extra antes do app):
  - `/api/v1/auth/*`: 30/min/IP
  - `/api/v1/copilot/*`: 100/min/IP
- [ ] **Geo-block** opcional por tenant (tela em Settings: "Acessar so do Brasil")
- [ ] **Challenge** automatico para IPs com score < 30 (Cloudflare reputation)
- [ ] **Anti-scraping**: bloquear UAs sem JS quando `/dashboard` (se tenant ativar modo strict)

#### 3.7 DDoS protection

- [ ] Cloudflare Pro plan (R$ 100/mes) para mitigation L7 ilimitada
- [ ] Anycast DNS + Argo Smart Routing
- [ ] Origin-side: rate limit por IP global (1000/min) como ultima linha

#### 3.8 Subdomain takeover prevention

- [ ] DNS auditado mensalmente: scan `*.igagestao.com.br` por CNAMEs orfaos (apontando para servico nao-claimado)
- [ ] Tenants deletados liberam subdomain so apos 30 dias + DNS quarantine record

#### 3.9 Anti-fraud no registro — DONE (parcial)

- [x] **Disposable email block** — `services/registrationAntiFraud.ts` com 40+ dominios + extensivel via `DISPOSABLE_EMAIL_EXTRA` env
- [x] **MX record validation** — `dns.resolveMx` antes de criar tenant (skipavel via `SKIP_MX_VALIDATION=1`)
- [ ] **Device fingerprinting** (FingerprintJS open-source) — pendente
- [x] **Velocity check** — max 5 registros/IP/1h em memoria, audit `register_blocked_velocity` + `Retry-After`
- [ ] **Email validation real-time** Zerobounce/Hunter — pago, futuro

**Entrega SEC-3**:
- [ ] Score A+ em SecurityHeaders.com (URL publica)
- [ ] Score A+ em SSL Labs
- [ ] Mozilla Observatory >= 90/100
- [ ] Doc `DEVSECOPS-RUNBOOK.md`: como reagir a alerta de SAST/SCA, como lidar com vulnerabilidade reportada

---

### Sprint SEC-4 — Compliance, Incident Response & Audit (2 semanas)

**Objetivo**: LGPD compliant, incident response funcional, pentest externo aprovado. **GATE OBRIGATORIO PARA GA.**

**Owner**: Security Champion + advogado externo + pentester externo
**Paralelo a**: S7 (Super Admin) e S8 (Connectors)
**Gate**: **lancamento GA depende de SEC-4 100% done + relatorio de pentest sem highs/criticals abertos**

#### 4.1 LGPD — DPIA e governanca

- [ ] **DPIA** (Data Protection Impact Assessment) — documento formal listando:
  - Dados pessoais coletados (nome, email, IP, dados do ERP do cliente)
  - Bases legais (Art. 7 LGPD: consentimento, execucao de contrato, legitimo interesse)
  - Riscos identificados + mitigacoes
  - Transferencia internacional (Groq nos EUA — clausulas contratuais padrao)
- [ ] **DPO designado** (pode ser fracionado, ~R$ 1500/mes externo)
- [ ] **Canal LGPD**: `lgpd@igagestao.com.br` + tela `/legal/lgpd` com formulario
- [ ] **RoPA** (Registro de Operacoes de Tratamento) — Art. 37

#### 4.2 Direitos do titular (LGPD Art. 18) — DONE

- [x] **Acesso**: `GET /api/v1/lgpd/my-data` (`routes/lgpd.ts`)
- [x] **Portabilidade**: `GET /api/v1/lgpd/export` + `GET /api/v1/tenants/:id/export` (admin)
- [x] **Correcao**: `SettingsPage` cobre dados pessoais
- [x] **Anonimizacao** (Art. 18 IV): `POST /api/v1/lgpd/anonymize`
- [x] **Eliminacao** (Art. 18 VI): `POST /api/v1/lgpd/erase` (soft + hard delete)
- [ ] SLA 15 dias uteis monitorado — operacional

#### 4.3 Cookie consent + privacy — DONE (parcial)

- [x] Banner de consentimento com categorias essenciais/analytics/marketing (`components/CookieConsent.tsx`)
- [ ] **Cookiebot/Iubenda** — usando implementacao custom (free)
- [x] Tela `/legal/privacidade` (`PrivacyPolicyPage`)
- [x] Tela `/legal/cookies` (`CookiesPolicyPage`)
- [ ] Texto revisado por advogado — pendente (R$ 1.5-3k)

#### 4.4 Termos de Uso e contratos — DONE (parcial)

- [ ] **Termos de Uso** revisados por advogado — pendente (R$ 1.5-3k)
- [ ] **DPA** (Data Processing Agreement) template — pendente (advogado)
- [x] **Aceite eletronico**: tabela `terms_acceptance` (migration v9) com `terms_version`, `privacy_version`, `document_hash`, `accepted_at`, `ip_hash`, `ua_hash`
- [x] **Versionamento**: `services/termsAcceptance.ts` + `routes/legal.ts` (`/terms-status` + `/accept-terms`) + modal blocker `TermsAcceptanceModal` no `AppLayout`

#### 4.5 Pentest externo (BLOQUEADOR DO GA)

- [ ] Contratar pentest **black-box + grey-box** (R$ 8-25k dependendo escopo)
  - Empresas brasileiras: Tempest, Conviso, Hackone (BR)
  - Internacional: Cobalt, HackerOne, Bugcrowd
- [ ] Escopo: web app (api + frontend) + IDP (auth) + landing page
- [ ] Metodologia: OWASP ASVS Level 2 + OWASP Top 10 + WSTG
- [ ] **Criterio de aceite GA**: zero critical, zero high. Mediums podem ser aceitos com plano de correcao em 30 dias.
- [ ] Relatorio publicado parcial (resumo executivo) na `/security` page

#### 4.6 Bug bounty / Responsible Disclosure — DONE (parcial)

- [x] Publicar `/.well-known/security.txt` (`routes/security.ts`) com Contact/Expires/Canonical/Policy
- [x] Pagina `/security/policy` com escopo + safe harbor + SLA
- [x] Pagina `/security` publica com controles implementados
- [ ] **Bug bounty pago** (HackerOne/YesWeHack) — futuro pos-GA

#### 4.7 Incident Response Plan — DONE (parcial)

- [x] **Runbook** `INCIDENT-RESPONSE.md` na raiz (referenciado em CONTINUE.md)
- [ ] **Tabletop exercise** trimestral — operacional
- [ ] **Notificacao ANPD** plantao + template — operacional

#### 4.8 Backups encryption + Disaster Recovery — DONE (parcial Beta)

- [x] Backup PostgreSQL diario via `.github/workflows/db-backup.yml` (pg_dump custom + compress=9)
- [x] Artifact retido 30 dias no GitHub Actions (criptografado em repouso pela GitHub)
- [x] **RPO 24h** atingido (backup diario as 03:00 UTC)
- [ ] Backups em regiao diferente — Supabase free ja faz cross-region storage interno
- [ ] **Object Lock S3** retencao imutavel — pendente (operacional)
- [ ] **Restore test mensal automatizado** — pendente (rodar manualmente uma vez no Beta basta)
- [ ] **RPO 4h** com WAL archiving / PITR — pendente (Supabase Pro)
- [ ] **DR drill** semestral — operacional

#### 4.9 SIEM e alerting de seguranca

- [ ] Datadog Security Monitoring OU Grafana Loki + alertas
- [ ] Detection rules:
  - 10+ login_failed em 5min para mesma conta -> SEV-2
  - 50+ login_failed cross-tenant em 1min -> SEV-1 (possivel credential stuffing)
  - Tentativa SSRF detectada (proxy_blocked_ssrf) -> SEV-2
  - audit_log.verify falha (chain quebrada) -> SEV-0 (tampering)
  - Login de pais bloqueado pelo tenant -> SEV-3
  - Trafego anomalo (>10x baseline) em endpoint -> SEV-2
- [ ] Alertas via PagerDuty (Free 5 users) ou Opsgenie -> SMS + WhatsApp

#### 4.10 Vendor security assessments — DONE (parcial)

- [ ] **DPA assinado** com cada terceiro — operacional (basta clicar em painel de cada vendor)
- [x] **Sub-processor list** publicada em `/legal/sub-processors` (`SubProcessorsPage` com Stripe, Cloudflare, Resend, Groq, Render, Sentry)
- [ ] Sentry `beforeSend` redact PII — pendente (Sentry SDK ainda nao instalado, so loader CDN)

#### 4.11 Compliance readiness — SOC 2 e ISO 27001 (preparacao, sem certificacao no GA)

- [ ] **SOC 2 Type I** gap analysis usando Vanta/Drata trial (~R$ 1500/mes para audit-ready)
- [ ] **ISO 27001 Annex A** controles mapeados — checklist em `COMPLIANCE.md`
- [ ] Politicas formalizadas (PDF assinado pelos socios):
  - [ ] Information Security Policy
  - [ ] Acceptable Use Policy
  - [ ] Access Control Policy
  - [ ] Backup Policy
  - [ ] Incident Response Policy
  - [ ] Data Retention Policy
  - [ ] Vendor Management Policy

**Entrega SEC-4**:
- [ ] **GO/NO-GO meeting** antes do GA — SEC-4 done + pentest sem highs = GO
- [ ] `/security` page publica com: SBOM, SecurityHeaders score, SSL Labs score, status page, security.txt, PDF resumo do pentest, lista de sub-processadores, SLA, contato seguranca
- [ ] Site em status **OK** no [Mozilla Observatory](https://observatory.mozilla.org/) >= 90/100

---

### Resumo da Trilha de Seguranca

| Sprint | Duracao | Paralelo a | Gate destrava | Custo direto |
|---|---|---|---|---|
| SEC-1 — Foundation | 2 sem | S1, S2 | S3, S4 podem ir pra prod | ~R$ 0 (so dev) |
| SEC-2 — Identity | 2 sem | S4 | Beta Fechada | R$ 0-100/mes (Turnstile gratis) |
| SEC-3 — DevSecOps | 2 sem | S5, S6 | Beta Aberta | R$ 100/mes Cloudflare Pro + R$ 0 Snyk OSS |
| SEC-4 — Compliance | 2 sem | S7, S8 | **GA** | R$ 8-25k pentest + R$ 1500/mes DPO + R$ 100/mes Cookiebot |

**Total adicional**: ~8 semanas de esforco em paralelo (nao adiciona ao caminho critico) + ~R$ 12-30k one-shot (pentest + advogado) + R$ 1700/mes recorrente (DPO + ferramentas).

**Justificativa do investimento**:
- 1 vazamento de PII custa em media **R$ 50/registro** (multa LGPD + churn + brand damage). 1.000 users x R$ 50 = R$ 50k.
- 1 mes de SaaS B2B perdido por incidente publico: ~30% do MRR (churn + retraction).
- SEC-4 destrava vendas Enterprise (DPA + SOC 2 readiness sao gating em RFPs B2B medias e grandes).

---

## Trilha de Integracao — Sprints INT-1 a INT-7

> **Pos-GA**. Transforma o IGA de "BI conectado a poucos ERPs REST" em **Integration Platform de verdade** — capaz de receber qualquer ERP/API/protocolo/banco/planilha/email/PDF do mercado brasileiro e internacional. Vendido como diferencial Enterprise.

### Filosofia de Ingestao — "Os dados estao em algum lugar. IGA recebe."

> **Promessa ao cliente**: "Se voce tem dados em **qualquer formato** — API, banco, Excel, Google Sheets, email, PDF de nota — em **3 cliques** o IGA recebe. Sem dev. Sem CSV exportado manualmente toda semana."

**Principios**:
1. **Pull antes de push** — cliente nao precisa configurar webhook, IGA puxa
2. **Auto-detect tudo** — IGA descobre schema, formato, encoding, separador, sugere mapping
3. **IA assistida** — Claude analisa colunas e propoe mapeamento canonico com confidence score
4. **3 cliques** — colar link/upload/conectar -> confirmar mapping sugerido -> importar
5. **Self-healing** — fonte mudou? IGA detecta, sugere ajuste, aplica automatico se confidence > 95%
6. **Universal preview** — qualquer fonte mostra preview real antes de salvar config

### Contexto operacional

> **Por que pos-GA**: Beta/GA inicial roda com SGBR + Bling + Tiny + Omie + CSV + REST generica (Sprint 8). Isso cobre ~70% do mercado SMB. Os 30% restantes (TOTVS Protheus, Senior, SAP B1, banco direto, Excel recorrente, OCR) viram **Pro+/Enterprise** — vale o esforco apos validar tracao GA.
>
> **Owner**: Tech Lead + 2 backend devs + 1 fullstack dedicados a Integration Engineering

### Diagnostico — fontes de dados cobertas

| Categoria | Fonte | Estado pos-GA | Estado pos-INT |
|---|---|---|---|
| **APIs** | REST + JSON | OK | OK |
| | OAuth 2.0 + refresh automatico | Parcial | OK (INT-2) |
| | HMAC signing, mTLS, API Key custom | Nao | OK (INT-2) |
| | **SOAP/XML-RPC** (TOTVS Protheus, Senior, SAP B1) | **Nao** | OK (INT-2) |
| | **OData v2/v4** (SAP S/4HANA, Dynamics) | **Nao** | OK (INT-2) |
| | GraphQL | Nao | OK (INT-2) |
| | Webhook receiver (push do ERP -> IGA) | Nao | OK (INT-2) |
| **Bancos de dados** | **PostgreSQL / MySQL / MariaDB direto** | **Nao** | OK (INT-6) |
| | **SQL Server** (TOTVS RM, sistemas custom) | **Nao** | OK (INT-6) |
| | **Oracle** (EBS, JDE, sistemas grandes) | **Nao** | OK (INT-6) |
| | **MongoDB / Firebird** (Protheus legado) | **Nao** | OK (INT-6) |
| | SSH tunnel + read-only replica + SSL | Nao | OK (INT-6) |
| **Arquivos manuais** | CSV upload one-shot | Sprint 8 | OK |
| | Excel `.xlsx` upload one-shot | Parcial | OK (INT-6) |
| | **SFTP/FTP file drop** (CSV, XML, EDI X12/EDIFACT) | Nao | OK (INT-2) |
| **Planilhas online recorrentes** | **Google Sheets** (watch + auto-resync) | **Nao** | OK (INT-6) |
| | **Excel Online / SharePoint / OneDrive** (Microsoft Graph) | **Nao** | OK (INT-6) |
| | **Dropbox / Box** file watcher | **Nao** | OK (INT-6) |
| **Email** | **Email-to-data** (forward CSV/XLSX/PDF) | **Nao** | OK (INT-6) |
| **Documentos** | **OCR de NF-e / NF-Servico / boleto** (PDF/JPG) | **Nao** | OK (INT-6) |
| | **OCR de contrato** (extracao de clausulas) | Nao | OK (INT-6) |
| | Vision AI extraction (Claude/Document AI) | Nao | OK (INT-6) |
| **Plataforma** | Modelo de dados canonico | **Nao (CRITICO)** | OK (INT-1) |
| | Schema mapping com transformacoes | Field rename apenas | OK (INT-1) |
| | Schema evolution + auto-fix | Quebra | OK (INT-4 + INT-7) |
| | Sync incremental + resumable + dedup | Nao | OK (INT-3) |
| | **Mapping Studio drag-and-drop** | **Nao** | OK (INT-4) |
| | **AI-assisted mapping** (Claude analisa colunas e sugere) | **Nao** | OK (INT-7) |
| | Auto-discover OpenAPI / WSDL / DB schema / planilha | Nao | OK (INT-2/4/6) |
| | **Templates 50+ pre-configurados** (ERPs, bancos, planilhas) | Nao | OK (INT-7) |
| | Sandbox/dry-run de connector | Nao | OK (INT-4) |
| | Versionamento + rollback de mapping | Nao | OK (INT-4) |
| | **Drag-and-drop universal de arquivo** (auto-detect) | Nao | OK (INT-7) |
| | Write-back bidirecional (criar no IGA -> push pro ERP) | Nao | OK (INT-5) |
| | Observability por datasource | Logs basicos | OK (INT-3) |

---

### Sprint INT-1 — Common Industrial Model + Transformation Library (3 semanas)

**Objetivo**: Definir um modelo de dados canonico que **abstrai** ERPs especificos. Frontend consome so canonico — connectors fazem o mapeamento.

**Por que primeiro**: sem modelo canonico, cada connector cria seu proprio formato e o frontend nao consegue ser generico. Esse e o **gap conceitual mais critico** do plano original.

#### 1.1 Common Industrial Model (CIM)

Definir entidades canonicas em `back-end-gest-o/src/domain/canonical/`:

```typescript
// Product (universal — qualquer industria)
type CanonicalProduct = {
  id: string                  // ID interno IGA
  tenantId: string
  sourceSystemId: string      // ID no ERP do cliente
  businessKey: string         // SKU ou codigo de barras (dedup)
  sku: string
  name: string
  description?: string
  category?: string
  unit: string                // 'un', 'kg', 'm', 'm2', 'm3', ...
  price?: { amount: number; currency: string }
  cost?: { amount: number; currency: string }
  stock?: { onHand: number; reserved: number; available: number }
  bom?: BillOfMaterials       // estrutura recursiva
  industrySpecific: Record<string, unknown>  // campos extras por industria (espuma, metalurgia, etc)
  raw: unknown                // payload original do ERP (auditoria)
  syncedAt: string
}

// Outras entidades
CanonicalCustomer, CanonicalSupplier, CanonicalInvoice, CanonicalPayment,
CanonicalProductionOrder, CanonicalStockMovement, CanonicalPurchaseOrder,
CanonicalSalesOrder, CanonicalEmployee, CanonicalAccount, ...
```

- [ ] Definir 12 entidades canonicas (cobrir 95% dos casos industriais)
- [ ] Schema Zod para cada uma + tabela `canonical_records (tenant_id, entity_type, source_id, business_key, data_jsonb, version, synced_at)` particionada por `entity_type + tenant_id`
- [ ] Indices: `(tenant_id, entity_type, business_key)` UNIQUE para dedup
- [ ] Industry extensions: `industrySpecific` JSONB para campos por connector (espuma, lacticinio, autopecas)

#### 1.2 Transformation Library

Biblioteca de funcoes puras encadeaveis para mapping:

```typescript
// Exemplos
transform.path('$.items[*].sku')                    // JSONPath
transform.concat(['$.firstName', ' ', '$.lastName'])
transform.split('$.fullName', ' ', 0)               // pegar primeiro
transform.regex.replace('$.cnpj', /[^\d]/g, '')
transform.date.parse('$.dataEmissao', 'DD/MM/YYYY').toIso()
transform.number.parse('$.valor', { locale: 'pt-BR' })  // "1.234,56" -> 1234.56
transform.lookup('$.codigoCliente', 'customers', 'businessKey')  // join
transform.if('$.status', { 'C': 'cancelled', 'F': 'completed' }, 'pending')
transform.coalesce(['$.email', '$.emailAlt', '$.contato.email'])
transform.pipeline([...])                           // encadear varios
```

- [ ] Implementar 30+ transformacoes puras testadas
- [ ] DSL JSON-serializavel (mappings sao salvos no banco como JSON, executados em runtime)
- [ ] Sandbox seguro: nao permitir `eval`, sem acesso a fs/network/process
- [ ] Performance: streaming sobre payload grande sem carregar tudo na memoria

#### 1.3 Schema validation com fallback

- [ ] Cada transform pipeline declara schema de saida (Zod)
- [ ] Registro malformado: log `canonical_validation_failed` + skip (nao quebra sync inteiro)
- [ ] Limite: 5% de records invalidos -> alerta para o tenant + email para admin

#### 1.4 Migracao do frontend para canonico

- [ ] Frontend consome **so endpoints canonicos** (`/api/v1/canonical/products`, etc.)
- [ ] Pages refatoradas para tipos canonicos (deprecate `estoqueEspumaSchema`, `vendaEspumaSchema`)
- [ ] Industry-specific UI (componentes de espuma) renderizam baseados em `product.industrySpecific.foamType`

**Entrega INT-1**:
- [ ] Doc `CANONICAL-MODEL.md` com cada entidade + exemplos JSON
- [ ] 200+ testes unitarios da transformation library
- [ ] SgbrEspumaConnector portado para o novo formato (regression test do que ja funciona)

---

### Sprint INT-2 — Multi-Protocol + Multi-Auth (3 semanas)

**Objetivo**: Desbloquear 30% do mercado que nao usa REST/JSON.

#### 2.1 SOAP / XML-RPC

- [ ] Cliente SOAP com `strong-soap` ou `easy-soap-request`
- [ ] WSDL parser -> auto-discover de operations
- [ ] XML -> JSON via `fast-xml-parser` antes de transformations
- [ ] Targets: TOTVS Protheus, Senior, SAP B1, RM, Datasul
- [ ] Templates pre-configurados por ERP (URL padrao, nomes de operations comuns)

#### 2.2 OData v2/v4

- [ ] Cliente OData (`@odata/client` ou implementacao custom)
- [ ] Query builder ($filter, $expand, $select, $top, $skip)
- [ ] Suporte a $batch (multiplas operations em uma chamada)
- [ ] Targets: SAP S/4HANA, SuccessFactors, Microsoft Dynamics

#### 2.3 GraphQL

- [ ] Cliente generico (`graphql-request`)
- [ ] Schema introspection para auto-discover
- [ ] Pagination patterns (cursor-based, offset)

#### 2.4 SFTP/FTP file drop

- [ ] `ssh2-sftp-client` para SFTP, `basic-ftp` para FTP
- [ ] Watch directory: poll a cada 5min OR webhook do servidor (se tiver)
- [ ] Parsers: CSV (csv-parse), XML (fast-xml-parser), JSON, Excel (exceljs), EDI X12 (EDI-Parser)
- [ ] Lock file pattern: renomear arquivo apos processar (`pedidos.csv` -> `pedidos.csv.processed`)
- [ ] Retencao: arquivos processados ficam 30d em S3, depois purgados

#### 2.5 Webhook receiver

- [ ] Endpoint `POST /api/v1/webhooks/ingest/:tenantSlug/:connectorSlug/:eventType`
- [ ] Signature validation por connector (HMAC SHA-256, JWT, custom)
- [ ] Idempotencia via `Idempotency-Key` header (Redis dedup 24h)
- [ ] Async processing: enfileira no BullMQ, responde 202 Accepted em < 100ms
- [ ] Retry logic do lado do remetente: documentar status codes esperados (5xx = retry, 4xx = nao retry)

#### 2.6 Multi-auth

| Auth Type | Lib / Implementacao | Connector exemplo |
|---|---|---|
| Basic | nativo | SGBR |
| Bearer estatico | nativo | APIs simples |
| **OAuth 2.0 + refresh** | `simple-oauth2` ou custom | **Bling v3, Omie** |
| API Key custom header | nativo (config-driven) | Tiny ERP |
| **HMAC signing** | `crypto.createHmac` | APIs financeiras |
| **mTLS** | `tls.connect` com cert | Bancos, fiscal |
| Custom session login | connector-specific hook | TOTVS Protheus |
| Cookie-based | sessao mantida por connector | ERPs legados |

- [ ] Cada connector declara `authStrategy` no manifest
- [ ] Token storage por tenant: `connector_credentials` table com AES-256-GCM
- [ ] Refresh automatico em background job (5min antes de expirar)
- [ ] Audit: `connector_auth_refreshed`, `connector_auth_failed`

**Entrega INT-2**:
- [ ] 3 connectors novos funcionais: TOTVS Protheus (SOAP), SAP B1 (SOAP/HANA REST), SFTP-CSV
- [ ] Doc `CONNECTOR-DEVELOPMENT.md` para devs criarem novos connectors

---

### Sprint INT-3 — Sync Engine v2 (2 semanas)

**Objetivo**: Sync robusto, observavel, resumable.

#### 3.1 Incremental sync com cursor

- [ ] Cada `datasource` tem `lastSyncCursor` (timestamp OU ID OU opaque token)
- [ ] Connector declara estrategia: `cursorField`, `cursorType` (`timestamp`, `id`, `etag`, `opaque`)
- [ ] Primeira sync: full backfill. Subsequentes: `?updated_after=<cursor>`
- [ ] Cursor salvo apos cada batch (durabilidade — se cair, retoma)

#### 3.2 Resumable sync

- [ ] Sync state machine: `pending -> running -> paused -> completed | failed`
- [ ] Estado em `sync_runs` table: `last_processed_id`, `last_cursor`, `records_processed`, `errors_count`
- [ ] Job interrompido (deploy, crash) -> retoma do `last_processed_id`
- [ ] Idempotencia: mesmo record processado 2x nao gera duplicata (UPSERT por `business_key`)

#### 3.3 Backfill historico configuravel

- [ ] Tela de configuracao: "Importar dados desde: [Ultimo mes / 3 meses / 1 ano / Tudo / Data customizada]"
- [ ] Backfill em chunks (ex: 1 mes por vez) para nao estourar memoria/limite ERP
- [ ] Progress visivel ao tenant: "Importando 03/2024 — 67% — 12.341 registros"
- [ ] Pausar/retomar: tenant pode pausar backfill se ERP estiver lento

#### 3.4 Rate limit client-side

- [ ] Cada connector declara `rateLimit: { requests: 100, window: '1m' }`
- [ ] Token bucket por datasource (Redis-backed)
- [ ] Backoff exponencial em 429: `delay = base * 2^attempts + jitter`
- [ ] Respeitar `Retry-After` header

#### 3.5 Dedup e conflict resolution

- [ ] Dedup: UPSERT por `(tenant_id, entity_type, business_key)`
- [ ] Conflict policy por connector:
  - `last-write-wins` (default — mais recente vence)
  - `erp-wins` (ERP e source of truth, IGA so le)
  - `iga-wins` (raro — IGA tem dados manuais que prevalecem)
  - `manual` (gera tarefa para admin resolver)
- [ ] Audit de cada conflict resolvido

#### 3.6 Observability por datasource

- [ ] Tabela `sync_runs` com metricas: started_at, finished_at, records_added, records_updated, records_skipped, errors
- [ ] Endpoint `GET /api/v1/datasources/:id/sync-runs?limit=50`
- [ ] **Dashboard por datasource** no frontend:
  - Latencia p50/p95/p99 por endpoint
  - Taxa de erro % nas ultimas 24h
  - Sync runs (timeline + status)
  - Throughput (records/min)
  - Health score (0-100, derivado das metricas)
- [ ] Alertas: tenant recebe email se sync falha 3x consecutivas OU latencia 10x baseline

#### 3.7 Replay

- [ ] Botao "Reexecutar sync run" em cada linha do historico
- [ ] Replay com escopo: so registros que falharam (`only-errors`) OU tudo
- [ ] Audit: `sync_replayed_by_user`

**Entrega INT-3**:
- [ ] SLA: sync incremental < 30s para 95% dos tenants ativos
- [ ] Restart do worker nao perde nenhum registro (idempotencia validada em chaos test)

---

### Sprint INT-4 — Mapping Studio (3 semanas)

**Objetivo**: Usuario comum (nao dev) configura mapping de qualquer API em < 30 minutos.

#### 4.1 Auto-discover

- [ ] **OpenAPI/Swagger**: cliente fornece URL do `swagger.json` -> IGA gera mapping inicial automatico
- [ ] **Sample request**: cliente cola URL + auth -> IGA faz request real, infere schema do response
- [ ] **WSDL** (SOAP): parse + extracao de operations
- [ ] Sugestao automatica: matching fuzzy entre campos do ERP e canonico (ex: `nm_produto` -> `name`, `cd_sku` -> `sku`)

#### 4.2 Visual mapping (drag-and-drop)

```
┌─ ERP source schema ───────────┐    ┌─ Canonical Product ────────┐
│ items[]                      │    │ id: string                  │
│  ├─ codigo  ──────────────────┼───▶│ sku ───◀ codigo            │
│  ├─ nm_produto ───────────────┼───▶│ name ──◀ nm_produto        │
│  ├─ vl_unitario ──[transform]─┼───▶│ price.amount ◀ to_number   │
│  ├─ saldo ────────────────────┼───▶│ stock.onHand ◀ saldo       │
│  └─ tp_espuma                 │    │ industrySpecific.foamType  │
└───────────────────────────────┘    │   ◀ tp_espuma              │
                                     └────────────────────────────┘
```

- [ ] React Flow ou react-dnd para canvas
- [ ] Cada conexao = um transform pipeline
- [ ] Click numa conexao -> abre editor de transformacoes (concat, split, regex, ...)

#### 4.3 Preview real-time

- [ ] Painel lateral: "Preview com 5 records reais"
- [ ] Cada mudanca de mapping atualiza o preview em < 500ms (debounced)
- [ ] Highlight de erros: campo nao mapeado, transform falhou, validacao Zod rejeitou

#### 4.4 Templates pre-configurados

- [ ] Biblioteca de templates por ERP popular: SGBR, Bling v3, Tiny ERP, Omie, TOTVS Protheus, SAP B1
- [ ] "Comecar do template Bling v3" -> 80% mapeado de cara, usuario ajusta os 20% custom
- [ ] Template versioning (Bling v3.1 -> v3.2 quando API muda)
- [ ] Marketplace publico de templates (community-driven, com badge "Verified" para os oficiais)

#### 4.5 Sandbox / dry-run

- [ ] Botao "Testar com 100 registros" -> roda sync isolado, **nao salva no banco canonico**
- [ ] Mostra: quantos OK, quantos com erro, sample de cada categoria
- [ ] So depois de aprovar -> "Promover para producao"

#### 4.6 Versionamento + rollback

- [ ] Cada save cria nova versao: `mapping_versions (id, datasource_id, version, mapping_json, created_by, activated_at)`
- [ ] Tela mostra historico: "v3 ativa desde 12/03 - v2 ativa de 10/02 a 12/03 - v1 inicial 01/01"
- [ ] Rollback em 1 clique: ativa versao anterior + sincroniza dados

#### 4.7 Schema diff / health check

- [ ] Job diario compara schema atual do ERP com o ultimo conhecido
- [ ] Diff visual: "ERP adicionou campo `desc_ampliada`. ERP removeu campo `obs2`."
- [ ] Alerta no AlertsBell + email para admin do tenant
- [ ] Auto-fallback: campo removido -> transform retorna null + warning, nao quebra sync

**Entrega INT-4**:
- [ ] Time-to-first-sync de novo connector custom: < 30min com Studio (vs ~1 dia hoje)
- [ ] 6+ templates oficiais publicados

---

### Sprint INT-5 — Write-back + Webhook reverso (Enterprise, 3 semanas)

**Objetivo**: IGA deixa de ser **read-only** — usuario cria pedido no IGA, sistema empurra pro ERP.

> **Plano**: somente Enterprise (R$ 1.997 com features novas). Justifica preco premium.

#### 5.1 Write-back fundamentos

- [ ] Cada connector declara capabilities: `{ read: true, write: true, writeEntities: ['SalesOrder', 'Customer'] }`
- [ ] Frontend mostra so botoes de criacao para entidades writable
- [ ] Mapping reverso: canonical -> ERP-specific (transformations bidirecionais)

#### 5.2 Idempotencia

- [ ] Cada write tem `idempotencyKey` (UUID gerado client-side)
- [ ] Tabela `write_operations (idempotency_key UNIQUE, tenant_id, status, request_payload, response_payload, created_at)`
- [ ] Retry seguro: mesmo write 2x = mesma resposta (nao cria pedido duplicado no ERP)

#### 5.3 Outbox pattern

- [ ] Write no banco IGA + insert em `outbox` em uma transacao
- [ ] Worker dedicado consome outbox e empurra pro ERP com retry
- [ ] Status: `pending -> sent -> confirmed | failed`
- [ ] Failed apos N retries -> dead letter queue + alerta para tenant

#### 5.4 Webhook reverso (push do ERP -> IGA)

- [ ] Receiver universal `POST /api/v1/webhooks/ingest/:tenantSlug/:connector/:event`
- [ ] Connector declara handler: `onWebhook(event, payload, ctx) -> CanonicalRecord[]`
- [ ] Vantagem: sync near-real-time (vs polling de 5min)

#### 5.5 Bidirectional conflict resolution

- [ ] Se ERP e IGA mudam o mesmo registro entre syncs:
  - Detectar via `version` ou `lastModifiedAt`
  - Aplicar policy: `manual` (default) -> task para admin / `last-write-wins` / `merge` (campos diferentes mesclam)
- [ ] UI: pagina "Conflitos pendentes" com diff side-by-side, botao "Aceitar IGA" / "Aceitar ERP" / "Mesclar manualmente"

**Entrega INT-5**:
- [ ] Use case: criar pedido no IGA -> aparece no Bling em < 30s -> NF emitida -> volta status pra IGA via webhook
- [ ] Doc `WRITE-BACK-PLAYBOOK.md` para vendedores explicarem o diferencial

---

### Sprint INT-6 — Universal Data Ingestion (3 semanas)

**Objetivo**: Ir alem de APIs — receber dados de **qualquer banco, planilha online, email ou documento PDF**.

**Por que importa**: 30-40% do mercado SMB nao tem API exposta — tem SQL Server interno, planilha do Google compartilhada, ou recebe NF por email. Sem ingestao universal, esses clientes ficam de fora.

#### 6.1 Database Connectors diretos

- [ ] Drivers e clients:
  - PostgreSQL (`pg`)
  - MySQL/MariaDB (`mysql2`)
  - SQL Server (`tedious` ou `mssql`) — TOTVS RM, Senior, sistemas custom
  - Oracle (`oracledb`)
  - MongoDB (`mongodb`) — alguns ERPs modernos
  - Firebird (`node-firebird`) — TOTVS Protheus legado
- [ ] **SSH tunnel** obrigatorio (`ssh2`) para clientes que nao expoem porta direto
- [ ] **SSL/TLS obrigatorio** (rejectUnauthorized=true), CA cert configuravel
- [ ] **Read-only replica preferencial**: wizard explicitamente sugere "use uma replica read-only — proteja sua producao"
- [ ] **Schema introspection**: detecta tabelas/views/colunas, tipos, FKs, indices automaticamente
- [ ] **Query builder visual**: cliente escolhe tabela ou view -> IGA gera SELECT, cliente refina filtros (`WHERE`)
- [ ] **Parameterized queries sempre** (nunca concatenacao — SQL injection prevention)
- [ ] **Connection pool** com limite por tenant (max 5 conexoes simultaneas para nao sobrecarregar prod do cliente)
- [ ] **Incremental sync** via:
  - Coluna `updated_at` (timestamp) — preferencial
  - Coluna `id` autoincrement com cursor
  - CDC (PostgreSQL logical replication, SQL Server Change Tracking) — Enterprise
- [ ] **Test connection** com timeout 5s + retry friendly errors ("nao foi possivel conectar — verifique firewall, porta 5432 fechada?")

#### 6.2 Planilhas online recorrentes

- [ ] **Google Sheets** via Google Sheets API:
  - OAuth 2.0 do tenant
  - Selecionar arquivo + aba especifica
  - **Watch via push notifications** (Google envia webhook quando planilha edita)
  - Auto-resync em 30s apos cada edicao
  - Range configuravel (`A1:Z1000`)
- [ ] **Microsoft Graph API** (Excel Online / SharePoint / OneDrive):
  - OAuth com Microsoft 365
  - Tabelas Excel ou ranges nomeados
  - Webhook subscription para mudancas
- [ ] **Dropbox / Box** file watcher:
  - Polling 5min OU webhook (Dropbox file changes API)
  - Re-parse quando arquivo modificado
- [ ] **CSV/Excel parsers** robustos:
  - Auto-detect encoding (UTF-8, ISO-8859-1, Windows-1252) — common no Brasil
  - Auto-detect separador (`,`, `;`, `\t`)
  - Auto-detect tipo de cada coluna (numero, data, texto, booleano)
  - Header detection inteligente (nem sempre na linha 1)
  - Datas em formato BR (`DD/MM/YYYY`) parseadas corretamente
  - Numeros locale-aware (`1.234,56` -> `1234.56`)

#### 6.3 Email-to-data

- [ ] Cada tenant ganha email unico: `{slug}-data@in.igagestao.com.br`
- [ ] Backend ingere via:
  - SES inbound (AWS) OU Mailgun Routes OU Postmark inbound
- [ ] **Whitelist por tenant**: so emails de `@empresadocliente.com.br` sao processados (anti-spam + autenticacao)
- [ ] **SPF/DKIM/DMARC validation** obrigatorio
- [ ] Anexos suportados: CSV, XLSX, PDF, ZIP (descompactar e processar arquivos internos)
- [ ] **Subject como hint de connector**: `pedidos-julho` -> connector `pedidos`, `nfe-2026` -> connector `nfe`
- [ ] **Auto-classify**: se subject vazio, IA analisa anexo e tenta classificar
- [ ] Confirmacao por email: "Recebido. 1.247 registros importados. Ver detalhes -> link"
- [ ] Audit completo: hash do anexo, IP do remetente, headers SPF/DKIM

#### 6.4 OCR / Document AI

- [ ] Provider abstrato `DocumentAIProvider`:
  - **Anthropic Claude vision** (default — Pro/Enterprise)
  - **Google Document AI** (alternativa, especializado em NF brasileira)
  - **Azure Form Recognizer** (alternativa)
- [ ] Templates de extracao por tipo de documento:
  - **NF-e (XML)**: parser nativo, nao precisa OCR
  - **NF-e (PDF/DANFE)**: extracao de chave de acesso, valor, emitente, destinatario, itens
  - **NF-Servico** (varia por municipio): templates por SP, RJ, BH, etc.
  - **Boleto bancario**: linha digitavel, valor, vencimento, beneficiario, pagador
  - **Recibo / cupom fiscal**: itens, total, forma de pagamento
  - **Contrato**: partes, valor, prazo, clausulas-chave (extracao via Claude)
- [ ] **Confidence score** por campo extraido — < 80% gera task para revisao humana
- [ ] **Bounding box visualization**: usuario ve o PDF com highlights mostrando de onde IA extraiu cada campo
- [ ] **Human-in-the-loop UI**: tela de revisao mostra extracao + PDF lado a lado, usuario corrige campos com erro -> feedback treina o template
- [ ] **Volume tier**:
  - Free: 10 docs/mes
  - Starter: 100/mes
  - Pro: 1.000/mes
  - Enterprise: 10.000/mes (custo IA repassado: ~R$ 0,05/doc)

#### 6.5 Drag-and-drop universal

- [ ] Pagina **"Ingestar dados"** com dropzone gigante: "Arraste qualquer arquivo aqui — IGA descobre o que fazer"
- [ ] Auto-detect:
  - Magic bytes (CSV, XLSX, JSON, XML, PDF, JPG, PNG, ZIP)
  - Para CSV/XLSX: amostra 10 linhas, detecta tipo de cada coluna
  - Para PDF: tenta NF-e, depois boleto, depois generico OCR
  - Para JSON: amostra schema, sugere connector REST se looks like API response
- [ ] **Preview imediato**: mostra primeiras 20 linhas/registros + tipos detectados
- [ ] **Sugere mapping** (chama INT-7 AI mapping): "Detectei 'Razao Social' -> Customer.name, 'CNPJ' -> Customer.taxId, ..."
- [ ] Em **3 cliques**: drop -> confirma sugestao -> importa

**Entrega INT-6**:
- [ ] 5 database drivers funcionais (PG, MySQL, SQL Server, Oracle, MongoDB)
- [ ] Google Sheets + Microsoft Graph integrados
- [ ] Email-to-data com endereco unico por tenant
- [ ] OCR de NF-e e boleto com >= 95% accuracy nos templates testados
- [ ] Doc `INGESTION-COOKBOOK.md`: 20 receitas comuns ("conectar SQL Server da TOTVS RM", "watch planilha Google de vendas semanal", "receber NFs por email")

---

### Sprint INT-7 — Smart Onboarding com IA (2 semanas)

**Objetivo**: Reduzir time-to-first-data de 30min (com Mapping Studio) para **3 minutos** (com IA assistida).

**Owner**: 1 fullstack + 1 ML engineer

#### 7.1 AI-assisted mapping (Claude analisa schema do source)

- [ ] Endpoint `POST /api/v1/integration/suggest-mapping`:
  - Input: schema do source (colunas, tipos, samples) + entity canonica alvo
  - Output: mapeamento sugerido com `confidence: 0.0-1.0` por campo + transformations recomendadas
- [ ] Claude prompt: estrutura system prompt com Common Industrial Model como contexto + few-shot examples de mapeamentos validos
- [ ] **Fuzzy matching como fallback** quando Claude indisponivel: Levenshtein distance + sinonimos PT-BR (`razao_social ~ name`, `qtd ~ quantity`, `vlr_unit ~ unitPrice`)
- [ ] **Aprendizado por tenant**: cada mapeamento aprovado vira feedback no proximo prompt (in-context learning, sem fine-tune)
- [ ] **Aprovacao em 1 clique** se confidence media > 90% — caso contrario, abre Mapping Studio para ajustar so os pontos baixos

#### 7.2 Template gallery expandida (50+)

- [ ] Categorias:
  - **ERPs Brasil**: SGBR BI, Bling v3, Tiny ERP, Omie, TOTVS Protheus, TOTVS RM, Senior, ContaAzul, Nibo
  - **ERPs Internacionais**: SAP S/4HANA, SAP B1, Oracle EBS, Microsoft Dynamics 365, NetSuite, Odoo
  - **Bancos**: PostgreSQL generico, MySQL generico, SQL Server generico, Oracle generico
  - **Planilhas**: template "Vendas mensal", "Estoque atual", "Folha de pagamento", "DRE simplificado"
  - **Documentos**: NF-e Sefaz, NF-Servico SP/RJ/BH, Boleto Itau/Bradesco/Santander/BB/Caixa
  - **Plataformas**: Shopify, Mercado Livre, Amazon Seller, RD Station, HubSpot, Pipedrive
- [ ] **Comunidade**: tenant pode publicar template (revisao por IGA antes de aprovar) e ganhar badge "Contributor"
- [ ] **Versionamento**: template Bling v3.1 -> v3.2 quando API muda; tenants em v3.1 recebem prompt de upgrade
- [ ] Busca + filtro por categoria + popularidade (`x tenants usam`)

#### 7.3 Onboarding em 3 cliques

```
PASSO 1: Como voce quer enviar seus dados?
[Conectar API]  [Conectar banco]  [Upload arquivo]  [Planilha online]  [Email]

PASSO 2 (auto-preenchido):
"Detectamos uma planilha de Vendas com 1.247 linhas.
 IGA sugere mapear como Pedidos. Confidence 94%."
[Aprovar e importar]  [Ajustar mapeamento]

PASSO 3:
"1.247 pedidos importados. Quer agendar resync diario as 06h?"
[Sim, agendar]  [Nao, manual]
```

- [ ] Wizard com so 3 telas, cada uma < 10s de interacao
- [ ] Skip Mapping Studio se confidence > 90%
- [ ] Skip schedule se source one-shot

#### 7.4 Self-healing connectors

- [ ] Job diario por datasource: snapshot do schema atual + diff com snapshot anterior
- [ ] Mudancas detectadas:
  - **Coluna nova**: IA sugere mapeamento se relevante OU adiciona em `industrySpecific`
  - **Coluna renomeada**: heuristica + IA detecta (`nm_produto` -> `nome_produto` por similaridade)
  - **Coluna removida**: transform retorna null + alerta "campo X nao existe mais — quer remapear?"
  - **Tipo mudou**: `string -> integer` -> tentar parseint, fallback para erro com confidence
- [ ] **Auto-apply** se confidence > 95% E mudanca nao destrutiva (so acao aditiva)
- [ ] **Caso contrario**: gera task no AlertsBell + email para admin "Schema do connector X mudou. Revisar."
- [ ] Audit completo de cada self-heal action

#### 7.5 Diagnostico inteligente

- [ ] Quando algo da errado (timeout, schema mismatch, auth failure), IA analisa logs e responde em linguagem natural:
  - "API SGBR retornou 503 nas ultimas 5 tentativas. Eles costumam ter manutencao quartas 02h-04h. Vou retry em 30min."
  - "Coluna `valor` agora vem como texto (`R$ 1.234,56`) em vez de numero. Quer aplicar transform de parse-currency?"
- [ ] Botao "Perguntar ao Copilot" abre chat focado no problema do connector

**Entrega INT-7**:
- [ ] Time-to-first-data: meta < 3min (medido em onboarding sessions)
- [ ] >= 80% dos novos datasources usam mapping sugerido sem ajustes manuais
- [ ] Connector self-heal resolve >= 60% das mudancas de schema sem intervencao humana

---

### Resumo da Trilha de Integracao

| Sprint | Duracao | Pre-requisito | Vendido como |
|---|---|---|---|
| INT-1 — Common Industrial Model | 3 sem | GA | Refactor (cobre todos planos) |
| INT-2 — Multi-Protocol + Auth | 3 sem | INT-1 | Pro+ (3 connectors novos) |
| INT-3 — Sync Engine v2 | 2 sem | INT-1 | Pro+ (qualidade do servico) |
| INT-4 — Mapping Studio | 3 sem | INT-3 | **Pro+ diferencial** |
| INT-5 — Write-back | 3 sem | INT-2 + INT-4 | **Enterprise exclusivo** |
| **INT-6 — Universal Data Ingestion** | **3 sem** | **INT-1** | **Pro+ (banco/planilha/email/OCR)** |
| **INT-7 — Smart Onboarding com IA** | **2 sem** | **INT-4 + INT-6** | **Pro+ (3-min onboarding)** |

**Total**: 19 semanas em paralelo com features F1-F15 do roadmap pos-GA. INT-2 e INT-6 podem rodar em paralelo (times diferentes). INT-7 depende de INT-4 e INT-6.

### Impacto comercial

| Antes da INT (pos-GA inicial) | Depois da INT |
|---|---|
| "BI conectado a Bling, Tiny, Omie, SGBR, REST custom" | "Integration Platform: qualquer ERP/API/protocolo" |
| TAM: SMB com ERP popular (~70% mercado) | TAM: SMB + Enterprise + Industrias com ERP legado/SOAP |
| Pricing Enterprise: R$ 997 | Pricing Enterprise: R$ 1.997-2.997 (justificado por write-back + multi-protocol + Studio) |
| Tempo onboarding cliente Enterprise: 1-2 semanas (custom dev por nos) | < 30min self-service via Mapping Studio |

### Riscos especificos da trilha

| Risco | Mitigacao |
|---|---|
| Mapping Studio complexo demais para usuario nao-tecnico | Templates cobrem 80%, suporte concierge para Enterprise |
| Write-back quebra ERP do cliente (cria pedido errado) | Sandbox obrigatorio antes de ativar + audit completo + idempotencia |
| Schema canonico nao cobre industria nicho | `industrySpecific` JSONB + extensoes por connector, nao bloqueia adocao |
| INT-5 muito longo, atrasa features F | INT-5 e Enterprise-only — pode rodar em paralelo com F-features pos-GA |

---

## Trilha de Excelencia Operacional — Sprints OPS-1 a OPS-4

> Sprints que **fecham gaps de execucao** identificados na revisao critica do plano. Nao adicionam features de produto — adicionam **maturidade operacional, rigor de engenharia e governanca** que separam SaaS amador de SaaS de classe mundial.
>
> **Decisao de escopo**: Sistema sera **somente em pt-BR** (sem i18n). Justificativa: foco de execucao + TAM brasileiro suficiente (R$ 35-80k MRR alcancavel so com BR). Internacionalizacao fica explicitamente **fora do roadmap** ate validacao de demanda real (clientes pedindo, nao supondo).

### Mapa da trilha

```
Semana:  -1   0    1    2    3    4    5    6    7    8    9   10   11   12   13   14   15

OPS-1    [==]                                                                              ← Time + Budget + Runway (PRE-S0)
                                                                                                bloqueador para iniciar S0

S0           [==]
S1                [========]
... (sprints S0-S9 + SEC + INT)

OPS-2                                                       [============]                   ← Performance + Load Test
                                                              (paralelo SEC-3 / S6)

OPS-3                                                                  [============]        ← Acessibilidade WCAG 2.2
                                                                         (paralelo S6-S7)

OPS-4                                                                       [======]         ← Analytics + Feature Flags
                                                                              (paralelo S6)
```

---

### Sprint OPS-1 — Time + Orcamento + Runway (1 semana, PRE-S0)

**Objetivo**: definir **quem**, **quanto custa**, **por quanto tempo da pra pagar** antes de comecar o S0.

**Por que e bloqueador**: sem time dimensionado e runway claro, o cronograma de 15 semanas e ficcao. 80% dos SaaS brasileiros falham por desalinhamento entre escopo e capacidade de execucao.

#### 1.1 Definicao de papeis

- [ ] **Tech Lead / CTO** — arquiteto, PR reviewer, decisor tecnico final
- [ ] **Backend Senior** (1-2) — Express + PostgreSQL + integration
- [ ] **Frontend Senior** (1-2) — React 19 + design system + UX
- [ ] **AI Engineer Python** (1) — `iga-ai` service, agentes, RAG (a partir de pos-GA)
- [ ] **Security Champion** — pode ser acumulado pelo Tech Lead nos primeiros 6 meses
- [ ] **DPO** — fracionado/externo (R$ 1.500/mes), assume so a partir da SEC-4
- [ ] **Designer Senior** — telas, design system, motion. Pode ser fracionado nos primeiros 3 meses
- [ ] **Product Manager** — opcional ate Beta Aberta. Pode acumular no founder ate 30 tenants
- [ ] **Suporte / CS** — 1 pessoa a partir da Beta Aberta (10+ tenants)

#### 1.2 Orcamento de pessoas (CLT ou PJ)

| Funcao | Faixa salarial CLT BR (2026) | PJ equivalente | Quando contrata |
|---|---|---|---|
| Tech Lead / CTO | R$ 18-30k + benefits | R$ 22-35k PJ | **Founder** |
| Backend Senior | R$ 12-18k | R$ 15-22k PJ | **S0** |
| Frontend Senior | R$ 12-18k | R$ 15-22k PJ | **S0** |
| AI Engineer Python | R$ 15-25k | R$ 18-30k PJ | **Pos-GA** |
| Designer Senior | R$ 10-15k OU R$ 8-15k/mes fracionado | R$ 12-20k PJ | **S0 (fracionado), full apos S5** |
| DPO fracionado | — | R$ 1.5-3k/mes | **SEC-4** |
| Suporte / CS Pleno | R$ 5-9k | — | **Beta Aberta (S7+)** |

**Cenario base (ate Beta Fechada — 12 semanas)**:
- 1 Tech Lead + 2 backend + 1 frontend + designer fracionado = ~R$ 60-80k/mes (CLT) ou R$ 75-100k PJ
- Total 3 meses: **R$ 180-300k em pessoas**

**Cenario GA (ate semana 15)**:
- + 1 frontend + designer full + AI engineer = R$ 100-130k/mes
- Total 4 meses ate GA: **R$ 350-500k em pessoas**

**Cenario pos-GA com trilha INT (mes 6)**:
- ~R$ 130-160k/mes
- 6 meses pos-GA: **R$ 780k-1M em pessoas**

#### 1.3 Capital de giro e runway

- [ ] **Capital inicial** necessario ate break-even:
  - Cenario conservador (ate Beta Aberta): R$ 400-600k
  - Cenario GA + 6 meses operando ate cobrir custo (50 tenants): **R$ 1.0-1.5M**
- [ ] **Break-even calculado**: ~25 clientes Pro (R$ 497 x 25 = R$ 12.4k/mes) cobre infra. Para cobrir time de R$ 130k/mes, precisa de **~270 clientes Pro** ou mix com Enterprise (R$ 997 + 100 Pro = ~R$ 60k MRR — ainda nao paga time completo).
- [ ] **Conclusao realista**: o plano **exige captacao** (anjo R$ 500k-1M ou seed R$ 1.5-3M) OU **bootstrapping com ritmo mais lento** (1 dev fundador + 1 contratado, ~R$ 25-35k/mes, 24 meses ate break-even).

#### 1.4 Stock options pool

- [ ] Criar pool de **10-15%** do equity para colaboradores chave (vesting 4 anos, cliff 1 ano)
- [ ] Documento ESOP (Employee Stock Option Plan) revisado por advogado tributarista
- [ ] Comunicacao transparente: cada hire chave recebe contrato com numero de opcoes + strike price

#### 1.5 Hiring plan

```
Trimestre 1 (S0-S6): Founder + 2 backend + 1 frontend + designer fracionado
Trimestre 2 (S7-GA): + 1 frontend + designer full + DPO fracionado
Trimestre 3 (pos-GA): + 1 AI engineer Python + 1 CS/Suporte
Trimestre 4 (mes 9-12): + 1 backend (Integration Eng) + 1 PM
Trimestre 5+ (mes 12+): scale conforme MRR
```

#### 1.6 Cap table

- [ ] Cap table inicial documentada (founders, advisors, ESOP pool, futuros investidores)
- [ ] Acordo de socios assinado (clausulas de drag/tag along, vesting de fundadores, lock-up)

**Entrega OPS-1**:
- [ ] Doc `EQUIPE-E-RUNWAY.md` com numeros reais (nao templates)
- [ ] Decisao **GO / NO-GO**: temos capital? temos time? podemos comecar S0?
- [ ] Se NO-GO: revisar escopo ou buscar captacao **antes** de iniciar S0

---

### Sprint OPS-2 — Performance & Load Testing (2 semanas, paralelo SEC-3/S6)

**Objetivo**: garantir que o SaaS aguenta carga real **antes do GA**. Multi-tenant com 50 tenants e 10k req/min nao se valida em desenvolvimento.

**Owner**: 1 backend dev + Tech Lead supervisao

#### 2.1 Performance budget formal

- [ ] Definir SLOs por endpoint (Service Level Objectives):
  - `/api/v1/auth/login`: p95 < 500ms, p99 < 1s
  - `/api/v1/data/*` (proxy): p95 < 2s, p99 < 5s
  - `/api/v1/copilot/chat`: TTFT (time to first token) < 1.5s
  - `/dashboard` (page load): LCP < 2.0s, INP < 200ms, CLS < 0.1
- [ ] Documento `PERFORMANCE-BUDGET.md` com numeros + alertas quando estourar
- [ ] CI bloqueia merge se Lighthouse score < 90 em pages criticas (Sprint S6 ja tem)

#### 2.2 Load testing com k6

- [ ] Stack: **k6** (Grafana) — gratis, scriptavel em JS
- [ ] Cenarios:
  - **Smoke test**: 1 user por endpoint critico, valida que tudo esta de pe
  - **Load test**: 50 tenants concurrent, 200 req/s sustentado por 30min
  - **Stress test**: rampa ate 500 tenants, 2000 req/s — encontrar o ponto de quebra
  - **Spike test**: 1500 req/s em 30s (simular Black Friday) — sistema deve aguentar ou degradar gracefully
  - **Soak test**: 100 req/s por 4h — detectar memory leaks, connection leaks
- [ ] Rodar load test em **staging com dados reais** (anonimizados) — nao em dev
- [ ] Documentar gargalos encontrados + plano de correcao

#### 2.3 Chaos engineering basico

- [ ] **Toxiproxy** ou **Chaos Mesh** para simular falhas:
  - Latencia +500ms no Postgres
  - Drop de 10% das requests Redis
  - Network partition entre app e worker
  - CPU spike a 100% por 1min
- [ ] Validar que sistema **degrada gracefully**: dashboard mostra ultimo cache, banner de "fonte offline", sem crash
- [ ] Game day mensal (1 hora, time inteiro participa)

#### 2.4 APM (Application Performance Monitoring)

- [ ] **Datadog APM** OU **New Relic** OU **Sentry Performance** OU **Grafana Cloud + Tempo + Loki**
- [ ] Decisao recomendada: **Sentry Performance** (R$ 100-200/mes) — ja deployado para errors, integra trace+error+logs
- [ ] Instrumentacao OpenTelemetry no backend Node.js + Python
- [ ] Distributed tracing: Frontend -> Node.js -> Python -> PostgreSQL
- [ ] Slow query log no Postgres: queries > 1s alertam Slack
- [ ] Dashboard publico de status (`status.igagestao.com.br`)

#### 2.5 DORA metrics

- [ ] Tracking de 4 metricas-chave:
  - **Deployment Frequency**: meta 5x/dia
  - **Lead Time for Changes**: commit -> producao < 1h
  - **Change Failure Rate**: < 15%
  - **MTTR** (Mean Time To Restore): < 1h
- [ ] Dashboard Grafana ou Linear analytics
- [ ] Review trimestral em retro

#### 2.6 Otimizacoes baseadas no load test

- [ ] **Index review**: queries lentas detectadas no APM ganham indices ou refactor
- [ ] **N+1 prevention**: detectar com `pg_stat_statements`
- [ ] **Connection pool tuning**: ajustar `POSTGRES_POOL_MAX` baseado em carga real
- [ ] **Bundle optimization**: route-based code splitting, lazy loading de Ant Design components grandes (Table, Calendar)
- [ ] **CDN para assets estaticos**: Cloudflare Pages ou direto no Cloudflare CDN
- [ ] **Image optimization**: AVIF/WebP automatico via Cloudflare Polish

**Entrega OPS-2**:
- [ ] Sistema validado em **500 tenants concurrent** sem degradar SLO
- [ ] APM com traces visiveis no Sentry
- [ ] DORA dashboards atualizados
- [ ] Doc `PERFORMANCE-PLAYBOOK.md`: como diagnosticar e fixar regressao de performance

---

### Sprint OPS-3 — Acessibilidade WCAG 2.2 AA (2 semanas, paralelo S6-S7)

**Objetivo**: tornar o sistema acessivel para usuarios com deficiencia visual, motora ou cognitiva. **Bloqueador para vendas a governo brasileiro e Enterprise com ESG ativo.**

**Owner**: 1 frontend dev + Designer + revisao por consultor a11y externo

**Por que importa**:
- **Lei Brasileira de Inclusao** (LBI 13.146/2015) exige acessibilidade em sistemas digitais
- **eMAG 3.1** (governo federal) — obrigatorio para SaaS pra orgaos publicos
- **Enterprise com ESG**: cada vez mais empresas exigem WCAG 2.2 AA em RFP
- **Mercado**: ~10% da populacao brasileira tem alguma deficiencia (IBGE) — perder esse mercado tambem perde os familiares deles

#### 3.1 Audit inicial

- [ ] Rodar **axe-core** automatizado em todas as paginas (via Playwright integration)
- [ ] **Lighthouse a11y score** >= 95 em todas paginas
- [ ] **NVDA / JAWS / VoiceOver / TalkBack** — testar fluxos criticos manualmente
- [ ] Audit por consultor externo (R$ 5-15k one-shot, ex: Movimento Web Para Todos)

#### 3.2 Correcoes — Perceptible

- [ ] **Color contrast 4.5:1** em todos textos (3:1 para large text e UI components)
- [ ] Tema dark + light: rodar contrast checker em ambos
- [ ] **Nao depender so de cor** para transmitir informacao (status, alerts) — adicionar icones e labels
- [ ] **Texto redimensionavel ate 200%** sem quebrar layout (testar em 200% browser zoom)
- [ ] **Imagens com alt text** — todas. SVG decorativos com `aria-hidden="true"`

#### 3.3 Correcoes — Operable

- [ ] **Keyboard navigation** completa: todo elemento interativo acessivel via Tab/Shift-Tab
- [ ] **Focus visible** em todos elementos focaveis (Ant Design ja tem; customizar para tema dark com contraste)
- [ ] **Skip links** ("Pular para o conteudo principal")
- [ ] **No keyboard traps** (modais fecham com Esc, focus retorna ao trigger)
- [ ] **Touch targets** >= 44x44 px em mobile
- [ ] **Sem dependencia de hover** para informacao critica (mobile + acessibilidade)
- [ ] **Animacoes respeitam `prefers-reduced-motion`** — ja mencionado nas telas, garantir compliance global

#### 3.4 Correcoes — Understandable

- [ ] **`<html lang="pt-BR">`** sempre presente
- [ ] **Form labels** explicitos em todo input (sem placeholder-as-label)
- [ ] **Error messages** programaticamente associados aos campos (`aria-describedby`)
- [ ] **`aria-invalid="true"`** em campos com erro
- [ ] **`aria-required="true"`** em campos obrigatorios
- [ ] **Live regions** (`aria-live="polite"`) para toasts e notificacoes
- [ ] **Linguagem clara**: avaliar legibilidade dos textos UX (Flesch reading ease)

#### 3.5 Correcoes — Robust

- [ ] **Semantic HTML**: `<button>` para acoes, `<a>` para navegacao, `<nav>`, `<main>`, `<aside>`, `<header>`, `<footer>`
- [ ] **ARIA so quando HTML nativo nao basta** (regra ARIA #1)
- [ ] **Roles corretos** em widgets customizados (combobox, dialog, menu, tab)
- [ ] **Compatibilidade com leitores de tela**: NVDA, JAWS, VoiceOver, TalkBack

#### 3.6 Componentes especificos

- [ ] **Tabela virtualizada** (TanStack Virtual): garantir que sort/filter sao anunciados; virtualization nao quebra screen reader
- [ ] **CommandPalette (Cmd+K)**: combobox WAI-ARIA pattern correto
- [ ] **DatePicker / Charts**: usar bibliotecas com a11y nativa (Recharts e parcial — adicionar fallback table com `<table>` semantica)
- [ ] **Drag-and-drop widgets**: alternativa keyboard (mover com setas + space para "agarrar")

#### 3.7 Pipeline de a11y continuo

- [ ] **axe-core no CI**: roda em PRs, bloqueia se regredir
- [ ] **Storybook + storybook-addon-a11y** para componentes do design system
- [ ] **Pa11y CI** monitora paginas chave em staging
- [ ] **Treinamento da equipe**: workshop de 4h com consultor externo
- [ ] Doc `A11Y-CHECKLIST.md` para revisar em cada PR

**Entrega OPS-3**:
- [ ] WCAG 2.2 **Level AA compliance** em todas as paginas core (login, dashboard, formularios principais)
- [ ] Lighthouse a11y >= 95 em todas paginas
- [ ] Audit externo aprovado com selo de conformidade
- [ ] Pagina `/legal/acessibilidade` declarando compliance + canal de feedback

---

### Sprint OPS-4 — Product Analytics + Feature Flags (1 semana, paralelo S6)

**Objetivo**: medir o que importa, fazer rollout gradual de features, A/B testar pricing e onboarding.

**Owner**: 1 fullstack + PM (se contratado)

#### 4.1 Product analytics — DONE (parcial Beta)

- [x] **PostHog Cloud free** (1M events/mes) — wiring condicional via `observabilityBootstrap.ts`
- [x] Backend `POST /api/v1/analytics/event` rate-limited (60/min/tenant) loga estruturado para ETL futuro
- [x] Frontend `services/analytics.ts` — `trackEvent`, `identifyUser`, `resetAnalytics`, `isFeatureEnabled`
- [x] Eventos basicos wirados: `auth_login`, `auth_register`, `terms_accepted`, `mfa_enabled`
- [ ] Eventos completos (30+): `tenant_created`, `connector_added`, `copilot_message_sent`, `payment_succeeded`, etc. — pendente
- [ ] **Funnels** + **Cohort analysis** — configurar no dashboard PostHog quando tenant tiver volume
- [ ] **Heatmaps + session replay** — opcional, exige consent LGPD adicional

#### 4.2 Feature flags — DONE (parcial)

- [x] **PostHog Feature Flags** wirado via `isFeatureEnabled(flag)` em `services/analytics.ts`
- [ ] Flag types implementados: release, permission, experiment, kill switch — falta criar flags concretas no PostHog
- [ ] Flags por tenant_id/user_id/plan — depende setup do dashboard PostHog
- [x] SDK frontend (carregamento via CDN snippet — sem dep no bundle)
- [ ] SDK backend (Node.js) — pendente

#### 4.3 A/B testing infra

- [ ] **Experimentos prioritarios** ja planejados:
  - Pricing: R$ 497 vs R$ 597 vs R$ 397 (qual converte mais Pro?)
  - Onboarding: wizard 3 passos vs wizard guiado por IA
  - CTA da landing: "Comece gratis" vs "14 dias gratis sem cartao"
  - Copy do trial banner em diferentes urgencias
- [ ] Definir **metricas primarias** por experiment (paid_conversion, activation_rate)
- [ ] Significancia estatistica antes de decidir (PostHog calcula)

#### 4.4 Engineering metrics dashboard

- [ ] DORA metrics (de OPS-2) consolidados em PostHog ou Grafana
- [ ] Custo por tenant (infra + AI tokens) — alerta se > R$ 50/tenant Pro

#### 4.5 Cookie consent + LGPD

- [ ] Analytics so dispara apos **opt-in explicito** (Cookiebot/Iubenda da SEC-4)
- [ ] PostHog configurado com `opt_out_tracking_by_default: true`
- [ ] PII redacted (sem capture de input fields, sem URLs com tokens)
- [ ] DPA com PostHog Cloud (se nao self-hosted)

**Entrega OPS-4**:
- [ ] PostHog rodando com 30+ events trackados
- [ ] Feature flag SDK ativo no frontend e backend
- [ ] 1 experimento de pricing rodando ate o GA
- [ ] Dashboard de funil de aquisicao + ativacao + retencao

---

### Resumo da Trilha Operacional

| Sprint | Duracao | Quando | Bloqueador? | Custo direto |
|---|---|---|---|---|
| **OPS-1 — Time + Budget + Runway** | 1 sem | **PRE-S0** | **SIM** — go/no-go pra iniciar | Workshop founder + advogado (R$ 5-10k) |
| **OPS-2 — Performance + Load Test** | 2 sem | Paralelo SEC-3 / S6 | Sim, antes do GA | k6 gratis + Sentry Perf R$ 100-200/mes |
| **OPS-3 — Acessibilidade WCAG 2.2** | 2 sem | Paralelo S6-S7 | Sim, antes do GA (gov + Enterprise) | Audit externo R$ 5-15k one-shot |
| **OPS-4 — Analytics + Feature Flags** | 1 sem | Paralelo S6 | Nao, mas alta ROI | PostHog gratis ate 1M events |

**Total**: 6 semanas em paralelo (nao adiciona ao caminho critico) + ~R$ 10-25k one-shot (audits) + ~R$ 200-300/mes recorrente.

---

## Tabela de custos REVISADA (realista)

> A tabela original de custos subestimava ~3x os custos reais. Esta e a versao revisada com numeros validados.

### Infraestrutura mensal — versao realista

| Componente | Alpha | Beta (10 tenants) | GA (50 tenants) |
|---|---|---|---|
| VPS app + worker (multi-region) | R$ 200 | R$ 350 | R$ 800 |
| Container `iga-ai` Python | R$ 50 | R$ 100 | R$ 200 |
| PostgreSQL gerenciado + replica | R$ 0 (local) | R$ 200 | R$ 500 |
| Redis gerenciado | R$ 0 (local) | R$ 80 | R$ 150 |
| Dominio + SSL wildcard | R$ 50/ano | R$ 50/ano | R$ 50/ano |
| **Cloudflare Pro** (WAF — necessario SEC-3) | gratis | **R$ 100** | **R$ 100** |
| **Sentry Errors + Performance** | gratis | **R$ 100-200** | **R$ 200-400** |
| **Datadog/Loki logging** (opcional ate GA) | — | gratis (Loki free) | R$ 100-200 |
| **WorkOS / SSO Enterprise** (so pos-Beta) | — | — | R$ 250-500 |
| Email (Resend) | gratis | gratis (3k/mes) | R$ 50-100 |
| Backup + S3 Object Lock | R$ 0 | R$ 50 | R$ 120 |
| **Anthropic Claude tokens** (Copilot + OCR + AI mapping) | R$ 50 | R$ 200-400 | R$ 800-1.500 |
| **PostHog self-hosted** | — | R$ 0 (mesmo cluster) | R$ 0 |
| **Doppler / AWS Secrets Manager** | gratis | R$ 50 | R$ 100 |
| **DPO fracionado** (a partir SEC-4) | — | R$ 1.500 | R$ 1.500 |
| **Cookiebot / Iubenda** | — | R$ 100 | R$ 100 |
| **Status page (Better Uptime)** | gratis | R$ 100 | R$ 100 |
| **Total/mes (infra + servicos)** | **~R$ 350** | **~R$ 2.900-3.300** | **~R$ 5.100-6.500** |

### Custos one-shot (realistas)

| Item | Custo | Quando |
|---|---|---|
| Pentest externo (SEC-4) | R$ 8-25k | Antes do GA |
| Audit acessibilidade WCAG (OPS-3) | R$ 5-15k | Antes do GA |
| Advogado: Termos + Privacidade + DPA + ESOP | R$ 8-15k | OPS-1 + SEC-4 |
| Logo + identidade visual + ilustracoes | R$ 5-15k | OPS-1 / S0 |
| Workshop a11y para equipe | R$ 3-5k | OPS-3 |
| **Total one-shot** | **R$ 29-75k** | Pre-GA |

### Pessoas (o maior custo)

| Cenario | MoM | 3 meses (ate Beta) | 12 meses (ate GA + 9m) |
|---|---|---|---|
| Bootstrap (founder + 1 dev) | R$ 25-35k | R$ 90k | R$ 360k |
| Conservador (founder + 3 devs + designer fracionado) | R$ 60-80k | R$ 220k | R$ 850k |
| Realista (founder + 4 devs + designer + AI eng + CS) | R$ 100-130k | R$ 360k | R$ 1.4M |

### Break-even revisado

| Cenario de equipe | Custo mensal total (pessoa + infra) | Clientes Pro necessarios | Clientes Enterprise necessarios |
|---|---|---|---|
| Bootstrap | ~R$ 30k + R$ 3k = R$ 33k | 67 Pro OU 17 Enterprise | mix viavel apos 12 meses |
| Conservador | ~R$ 70k + R$ 5k = R$ 75k | 151 Pro OU 38 Enterprise | mix viavel apos 18 meses |
| Realista | ~R$ 115k + R$ 6k = R$ 121k | 244 Pro OU 61 Enterprise | mix viavel apos 24 meses |

> **Conclusao realista**: o plano original projetava 50 tenants = R$ 20-50k MRR cobrindo R$ 1.4k/mes de infra. **Com pessoas**, 50 tenants pagam infra mas **nao pagam time realista** ate 200+ tenants OU 30+ Enterprise. **Captacao Series A ou crescimento bootstrapped lento** sao os dois caminhos viaveis.

---

## Inventario Completo de Telas

### Telas Novas (SaaS)

| ID | Tela | Sprint | Complexidade |
|---|---|---|---|
| T1 | Login multi-tenant (branding dinamico) | S4 | Media |
| T2 | Registro self-service (split layout) | S4 | Alta |
| T3 | Verificacao de email | S4 | Baixa |
| T4 | Onboarding wizard (3 passos) | S4 | Alta |
| T5 | Pagina de planos e precos | S5 | Media |
| T6 | Portal de billing | S5 | Media |
| T7 | Banners + modais de billing | S5 | Media |
| T8 | Configuracoes do tenant (4 tabs) | S5 | Alta |
| T9 | Marketplace de integracoes | S8 | Media |
| T10 | Super admin dashboard | S7 | Alta |
| T11 | Forgot / reset password | S4 | Baixa |
| T12 | Empty states educativos | S4 | Baixa |
| T13 | Tour guiado | S4 | Media |
| T14 | Importando dados (sync longo) | S4 | Media |
| T13 | Tour guiado | S4 | Media |

### Telas Existentes com Melhorias

| ID | Melhoria | Sprint | Impacto |
|---|---|---|---|
| M1 | Dashboard: welcome card, data freshness | S4 | Alto |
| M2 | Login: mesh gradient, tenant detection | S4 | Alto |
| M3 | Sidebar: modulos condicionais, lock icon | S4 | Alto |
| M4 | Command palette: comandos SaaS | S5 | Medio |
| M5 | Mobile: bottom nav, pull-to-refresh | S4 | Alto |
| M6 | Micro-interacoes globais | S4 | Alto |

### Componentes Novos do Design System

| Componente | Usado em | Sprint |
|---|---|---|
| PricingCard | T5 | S5 |
| OnboardingStep | T4 | S4 |
| BrandingPreview | T4, T8 | S4 |
| ConnectorCard | T4, T9 | S4 |
| TrialBanner | T7, AppLayout | S5 |
| PaymentStatusBadge | T6, T10 | S5 |
| UpgradeModal | T7 | S5 |
| InviteTeamForm | T4, T8 | S4 |
| TenantSwitcher | T10, M4 | S7 |
| UsageBar | T6, T7, T8 | S5 |
| FeatureGate | T7, M3 | S5 |
| StepWizard | T4 | S4 |
| ConnectionTester | T4, T9 | S4 |
| StatusPulse | T8, T9, M1 | S4 |
| EmptyStateIllustration | T12 | S4 |

---

## Cronograma

| Sprint | Duracao | Depende de | Paralelo |
|---|---|---|---|
| Sprint 0 — Preparacao | 1 semana | — | — |
| Sprint 1 — PostgreSQL + Redis | 2 semanas | S0 | SEC-1 |
| Sprint 2 — Multi-Tenant | 2 semanas | S1 | SEC-1 |
| Sprint 3 — Desacoplar Industria | 3 semanas | S2 + SEC-1 | S4, S9 |
| Sprint 4 — Auth + Onboarding + Design | 3 semanas | S2 + SEC-1 | S3, S9, SEC-2 |
| Sprint 5 — Billing | 2 semanas | S4 + SEC-2 | SEC-3 |
| Sprint 6 — Deploy Cloud | 2 semanas | S5 | S9, SEC-3 |
| Sprint 7 — Super Admin | 2 semanas | S6 + SEC-3 | S8, SEC-4 |
| Sprint 8 — Connectors | 3 semanas | S3 | S7, SEC-4 |
| Sprint 9 — Landing + GTM | 2 semanas | — | Qualquer |
| **SEC-1 — Foundation** | **2 semanas** | **S0** | **S1, S2** |
| **SEC-2 — Identity** | **2 semanas** | **SEC-1** | **S4** |
| **SEC-3 — DevSecOps** | **2 semanas** | **SEC-2** | **S5, S6** |
| **SEC-4 — Compliance + Pentest** | **2 semanas** | **SEC-3 + S6** | **S7, S8** |
| **TOTAL ATE GA** | **~15 semanas** (caminho critico com paralelismo; trilhas SEC e INT nao estendem caminho critico) | | |
| **INT-1 — Canonical Model** | **3 semanas** | **GA** | **F1-F2 (pos-GA)** |
| **INT-2 — Multi-Protocol** | **3 semanas** | **INT-1** | **F3-F4 + INT-6** |
| **INT-3 — Sync Engine v2** | **2 semanas** | **INT-1** | **F4-F5** |
| **INT-4 — Mapping Studio** | **3 semanas** | **INT-3** | **F5-F6** |
| **INT-5 — Write-back** | **3 semanas** | **INT-2 + INT-4** | **Enterprise upsell** |
| **INT-6 — Universal Ingestion** | **3 semanas** | **INT-1** | **Paralelo INT-2** |
| **INT-7 — Smart Onboarding (IA)** | **2 semanas** | **INT-4 + INT-6** | **F6-F7** |
| **OPS-1 — Time + Budget + Runway** | **1 semana** | **PRE-S0 (bloqueador)** | **—** |
| **OPS-2 — Performance + Load Test** | **2 semanas** | **SEC-2** | **SEC-3, S6** |
| **OPS-3 — Acessibilidade WCAG 2.2** | **2 semanas** | **S5** | **S6, S7** |
| **OPS-4 — Analytics + Feature Flags** | **1 semana** | **S5** | **S6** |

### Caminho critico
```
S0 (1s) → S1 (2s) → S2 (2s) → S4 (3s) → S5 (2s) → S6 (2s) = 12 semanas
                                S3 (3s) roda em paralelo com S4
                                S9 roda em paralelo desde o inicio
                                S7 + S8 rodam em paralelo apos S6
```

### Timeline visual

```
Semana:  1    2    3    4    5    6    7    8    9   10   11   12   13   14   15

S0       [==]
S1            [========]
S2                       [========]
S3                                  [==============]
S4                                  [==============]   ← PARALELO com S3
S9       [==========================...========================]
S5                                                  [========]
S6                                                           [========]
                                                                    ↓
                                                              LANCAMENTO BETA
S7                                                                    [====]
S8                                                                    [========]
```

---

## Fases de Lancamento

| Fase | Semanas | Sprints | Tenants | MRR alvo |
|---|---|---|---|---|
| Alpha | 1-8 | S0-S3 | 0 (dev/test) | R$ 0 |
| Beta Fechada | 8-12 | S4-S6 | 5-10 piloto | R$ 1.500 |
| Beta Aberta | 12-15 | S7-S8 | 10-30 | R$ 5.000 |
| GA | 15+ | — | 50+ | R$ 20.000+ |

---

## Metricas de Sucesso

| Metrica | Alpha | Beta Fechada | Beta Aberta | GA (6 meses) |
|---|---|---|---|---|
| Tenants ativos | 0 | 5 | 20 | 50+ |
| MRR | R$ 0 | R$ 1.500 | R$ 5.000 | R$ 20.000+ |
| Uptime | 90% | 99% | 99.5% | 99.5% |
| Tempo de onboarding | Manual | 15min | 10min | 5min |
| Segmentos | 1 | 2 | 3 | 5+ |
| Connectors | 1 (SGBR) | 1 | 3 | 5+ |
| NPS | — | — | 40+ | 50+ |
| Churn mensal | — | — | <10% | <5% |
| LCP (Largest Contentful Paint) | — | < 2.5s | < 2.0s | < 2.0s |
| INP (Interaction to Next Paint) | — | < 200ms | < 200ms | < 150ms |
| CLS (Cumulative Layout Shift) | — | < 0.1 | < 0.1 | < 0.05 |
| Bundle size (gzip) | — | < 500KB | < 400KB | < 350KB |

---

## Estimativa de Custos

### Infraestrutura

| Componente | Alpha (0 tenants) | Beta (10 tenants) | GA (50 tenants) |
|---|---|---|---|
| VPS (app + worker) | R$ 100 | R$ 200 | R$ 500 |
| PostgreSQL | R$ 0 (local) | R$ 100 | R$ 300 |
| Redis | R$ 0 (local) | R$ 50 | R$ 100 |
| Dominio + SSL | R$ 50/ano | R$ 50/ano | R$ 50/ano |
| Cloudflare | Gratis | Gratis | R$ 100/mes (Pro) |
| Sentry | Gratis | Gratis | R$ 100/mes |
| Email (Resend) | Gratis | Gratis | R$ 50/mes |
| Backup storage | R$ 0 | R$ 30 | R$ 80 |
| IA (Groq API) | Gratis | R$ 50 | R$ 200 |
| **Total/mes** | **~R$ 10** | **~R$ 440** | **~R$ 1.450** |

### Break-even
- **3 clientes Starter** (3 x R$197 = R$591) > custo Beta (R$440)
- **8 clientes Starter** ou **3 Pro** cobrem custo GA

---

## Riscos e Mitigacoes

| Risco | Prob. | Impacto | Mitigacao |
|---|---|---|---|
| API SGBR lenta (10-30s) | Alta | Alto | Warm cache + background sync + skeleton loading |
| Tenant A sobrecarrega B | Media | Alto | Rate limiting + worker queue isolada |
| Vazamento entre tenants | Baixa | Critico | RLS PostgreSQL + testes automatizados |
| Dados perdidos na migracao | Media | Alto | Backup antes + coexistencia 30 dias |
| Custo > receita (inicio) | Alta | Alto | Free tier barato, escalar conforme MRR |
| Groq API muda pricing | Media | Medio | Abstraction layer — trocar provider |
| Deploy quebra producao | Media | Alto | Blue-green deploy + rollback 1 comando |
| Asaas fora do ar no dia do pagamento | Media | Alto | Retry com backoff + webhook idempotente + fallback manual |
| CSV malicioso (injection, arquivo enorme) | Media | Alto | Validacao de tipo/tamanho, sandbox parsing, limite 50MB |
| Token JWT roubado via XSS | Baixa | Critico | httpOnly cookie (nao localStorage), CSP strict com nonce (SEC-3), SameSite=Strict |
| **SSRF via apiUrl do datasource** | **Alta** | **Critico** | **SEC-1: validar IP resolvido (block RFC1918/loopback/metadata), allowlist por tenant** |
| **Credential stuffing em login** | **Alta** | **Alto** | **SEC-2: account lockout adaptativo + captcha apos 3 falhas + pwned password check** |
| **Vazamento de PII em logs** | **Media** | **Alto (LGPD)** | **SEC-1: pino com redact paths, audit log com email hash (nao plain)** |
| **Sessao roubada usada de outro pais** | **Baixa** | **Alto** | **SEC-2: session binding (IP/UA hash) + login alerts por email** |
| **Audit log adulterado por insider** | **Baixa** | **Critico** | **SEC-1: hash chain + REVOKE UPDATE/DELETE + S3 Object Lock snapshot mensal** |
| **Vulnerabilidade em dependencia npm** | **Alta** | **Alto** | **SEC-3: Snyk + Trivy + Dependabot + lockfile-lint no CI bloqueando merge** |
| **Subdomain takeover (tenant deletado)** | **Baixa** | **Critico** | **SEC-3: 30d quarantine DNS apos deletar + scan mensal de CNAMEs orfaos** |
| **Multa LGPD por incidente nao reportado** | **Baixa** | **Critico** | **SEC-4: IR plan + plantao + template ANPD para notificacao em 48h** |
| Warm cache consome toda a RAM | Media | Medio | Limite de cache por tenant (max 50MB), TTL 5min, eviction LRU |
| ERP do cliente muda API sem avisar | Alta | Alto | Health check de schema no sync, alerta + fallback para ultimo cache |
| Migration de banco quebra em prod | Media | Critico | Migration em transacao, dry-run em staging, script de rollback por migration |
| Primeiro sync demora 30+ min | Alta | Medio | Tela "Importando dados" com progress bar, sync em background, notificacao ao concluir |

### Estrategia de degradacao (quando API do ERP cai)

O dashboard do cliente **nao pode quebrar** porque a API do ERP esta fora do ar. Estrategia em 3 niveis:

1. **Dados em cache (< 5 min)**: Exibir normalmente. Badge "Atualizado ha X min" no header do card.
2. **Cache stale (5-60 min)**: Exibir com banner amarelo "Dados podem estar desatualizados. Ultima sincronizacao ha X min."
3. **Sem cache / API offline (> 60 min)**: Exibir ultimo cache disponivel com banner vermelho "Fonte de dados offline. Mostrando ultimos dados disponiveis." + StatusPulse vermelho na sidebar.
4. **Nunca conectou**: Empty state educativo "Conecte uma fonte de dados para ver indicadores."

Implementar via `staleWhileRevalidate` no React Query + `lastSyncAt` timestamp por datasource.

### Estrategia de JWT e sessoes

**Decisao**: Usar **httpOnly cookies** em vez de localStorage para tokens JWT.
- Previne roubo via XSS (token inacessivel ao JavaScript)
- CSRF protegido pelo middleware existente (ja implementado)
- SameSite=Strict para requests cross-origin
- Refresh token com rotacao: access token 15min, refresh token 7d
- Logout invalida refresh token no Redis (blacklist)

---

## Decisoes Tecnicas

| Decisao | Escolha | Justificativa |
|---|---|---|
| ORM | Drizzle | Type-safe sem code generation, migrations SQL puro, bundle menor |
| Billing | Asaas | Brasileiro, boleto + pix nativo, sem IOF |
| Multi-tenancy | Shared DB + RLS | Menor custo, simples de manter, RLS garante isolamento |
| Job queue | BullMQ | Maduro, Bull Board UI, Redis-based |
| Cache | Redis | Persistencia, pub/sub, BullMQ ja exige |
| Frontend | Manter React + Vite | SPA funciona, Next.js so para landing (separada) |
| Connectors | Plugin in-process | Simples, sem latencia de rede, < 10 connectors |
| Deploy | VPS + Docker | R$200/mes vs R$800+ K8s, suficiente para 50 tenants |
| Email transacional | Resend SDK | DX moderna, 3.000/mes gratis, webhooks de delivery. Substitui Nodemailer para registro/convite/reset |
| Email agendado | Nodemailer (manter) | Ja funciona para scheduled reports. Sem necessidade de migrar |
| Animacoes | Framer Motion (ja instalado) | Ja no projeto, API declarativa, spring physics |
| Tour | react-joyride | Maduro, customizavel, acessivel |
| Auth tokens | httpOnly cookies | Previne XSS (token inacessivel ao JS). CSRF ja implementado |
| **Agente de IA / Copilot** | **Python 3.12 + FastAPI** | **DECISAO: TODO o agente de IA (Copilot, AI mapping INT-7, OCR INT-6, document AI, agentes autonomos pos-GA F7) sera escrito em Python como microsservico separado. Ecosistema AI muito mais maduro: LangChain, LangGraph, LlamaIndex, Anthropic SDK Python, Pydantic AI, vector stores (Chroma, Qdrant, pgvector), DSPy, observability (Langfuse, LangSmith), eval frameworks. Servico `iga-ai/` se comunica com backend Node.js via HTTP REST interno (ou gRPC se latencia importar). Ver secao "Arquitetura do servico de IA (Python)" para detalhes.** |
| **Idioma do produto** | **pt-BR only (sem i18n)** | **Decisao explicita: foco de execucao + TAM brasileiro suficiente. Internacionalizacao FORA do roadmap ate validacao de demanda real (clientes pedindo, nao supondo). Trade-off conscientemente aceito: TAM limitado a Brasil + lusofonos (Portugal, Angola, Mocambique) ~230M habitantes** |
| Stack do servico Python | FastAPI + Pydantic v2 + uv (package manager) + ruff (lint/format) | Mais rapido que Poetry/pip, tipagem forte, async native |
| Framework de agentes | LangGraph (graph-based) ou Pydantic AI | Pydantic AI: type-safe, integra com Pydantic v2 (paridade com FastAPI). LangGraph: stateful agents, melhor para workflows complexos pos-GA |
| Vector store / RAG | pgvector (no PostgreSQL existente) | Sem servico extra — usa o PostgreSQL ja deployado. Suficiente para ate 1M embeddings |
| LLM provider | Anthropic Claude (default) via SDK Python | Claude Sonnet 4.6 para mapping/OCR/agents, Haiku 4.5 para classificacao rapida e barata |
| Comunicacao Node.js -> Python | HTTP REST interno + JWT shared secret | Simples, debugavel, mesma rede privada VPC |
| Background jobs Python | Celery + Redis (compartilha o Redis ja deployado) | Mesma fila do BullMQ via Redis — Celery consome jobs marcados `service: ai` |
| Testes Python | pytest + pytest-asyncio + httpx (test client) | Stack padrao da comunidade Python |

### Versionamento de API — Estrategia de deprecation

```
v1 (lancamento)  →  v2 (quando necessario)  →  v1 EOL

Regras:
- Deprecation header em todas as respostas da versao antiga: Deprecation: true, Sunset: <data>
- Minimo 6 meses de aviso antes de desligar uma versao
- Clientes Enterprise: notificados por email 90 dias antes
- Docs de migracao publicadas junto com a versao nova
- Metricas: monitorar % de requests em cada versao. Desligar v1 quando < 5%
```

### Notificacoes in-app de billing

O AlertsBell existente deve incluir eventos de billing no dropdown:

| Evento | Icone | Cor | Acao |
|---|---|---|---|
| Trial expira em 3 dias | ⏱ | Warning | Link para planos |
| Trial expirou | ⏱ | Error | Link para planos |
| Pagamento confirmado | ✓ | Success | Link para NF |
| Pagamento falhou | ✗ | Error | Link para atualizar cartao |
| Limite de usuarios proximo (80%) | ⚠ | Warning | Link para upgrade |
| Novo membro aceitou convite | 👤 | Info | — |

Implementar via tabela `notifications` com `tenant_id`, `type`, `read_at`, `action_url`.

### Programa de Referral (pos-GA, Mes 1)

Incentivo para crescimento organico:
- **Mecanica**: tenant ativo indica outra empresa → ambos ganham 1 mes do plano atual gratis
- **Limite**: maximo 3 indicacoes por tenant por ano
- **Rastreamento**: link unico `igagestao.com.br/r/{slug}` → registra UTM na tabela `referrals`
- **Validacao**: credito aplicado apos indicado completar 30 dias como pagante (evita fraude)
- **UI**: secao "Indique e ganhe" nas configuracoes do tenant + share button

### Centro de Ajuda

| Fase | Solucao | Custo |
|---|---|---|
| Beta | Notion publico com artigos + link no footer do app | Gratis |
| GA | Centro de ajuda in-app (drawer lateral com busca) | Dev: 1 semana |
| Pos-GA | Intercom ou Crisp para chat + knowledge base | R$ 100-300/mes |

Conteudo minimo para lancamento: 10 artigos cobrindo onboarding, cada modulo, billing, FAQ. Acessivel via `?` no header e Cmd+K "Ajuda".

---

## Juridico e Compliance

- [ ] CNPJ ativo (MEI ou LTDA)
- [ ] Termos de Uso (contrato digital aceito no registro)
- [ ] Politica de Privacidade (LGPD: base legal, direitos, DPO)
- [ ] DPA (Enterprise)
- [ ] Politica de cookies + banner
- [ ] SLA: 99% Pro, 99.5% Enterprise
- [ ] Politica de reembolso (pro-rata 30 dias)
- [ ] Export de dados (LGPD Art. 18, 15 dias uteis)
- [ ] Retencao: dados deletados 90 dias apos cancelamento
- [ ] Data residency: Brasil

---

## Plano de Contingencia Desktop → SaaS

### Coexistencia por 12 meses

| Fase | Desktop (.exe) | SaaS (web) |
|---|---|---|
| Hoje - Semana 12 | Produto principal | Em desenvolvimento |
| Semana 12 - 30 | Manutencao (bugfixes) | Beta + lancamento |
| Semana 30 - 52 | Apenas seguranca critica | Produto principal |
| Apos 1 ano | Descontinuado (EOL 6 meses antes) | Unica versao |

### Versao on-premise (pos-SaaS)
- Opcao Enterprise: R$ 4.970 (licenca perpetua, 1 ano updates)

---

## Features pos-GA — Roadmap

### Prioridade 1 — Quick Wins (2-3 semanas cada)

| # | Feature | Valor | Plano |
|---|---|---|---|
| F1 | **Previsao de Demanda (IA)** — Forecast 3-6 meses, alertas de ruptura | Reduz stockout 30-40% | Pro |
| F2 | **Portal de Fornecedores** — Self-service: pedidos, NF, pagamentos | Reduz 50% tempo procurement | Pro |
| F3 | **Custeio por Ordem** — Custo real por lote (material + mao de obra + overhead) | Identifica ordens nao-lucrativas | Pro |
| F4 | **Dashboard Qualidade (SPC)** — Graficos de controle, defeitos, limites | Compliance ISO 9000 | Pro |
| F5 | **Portal do Cliente** — Status pedido, NFs, entregas, tickets | Reduz 30% volume atendimento | Pro |

### Prioridade 2 — Diferenciacao (3-4 semanas cada)

| # | Feature | Valor | Plano |
|---|---|---|---|
| F6 | **Rastreabilidade de Lotes** — Forward + backward tracking | Recall rapido, compliance | Pro |
| F7 | **Agentes IA Autonomos** — Auto-aprovacao, recompras, reconciliacao | Reduz 40% tarefas manuais | Enterprise |
| F8 | **IoT / Manutencao Preditiva** — OPC UA, MQTT, OEE, previsao falhas | Reduz downtime 35-45% | Enterprise |
| F9 | **BOM com Versionamento** — Estrutura produto multi-nivel + historico | Previne erros de producao | Pro |
| F10 | **Otimizador Producao** — IA sequenciamento, alocacao, setup | Aumenta capacidade 15-20% | Enterprise |

### Prioridade 3 — Premium (3-4 semanas cada)

| # | Feature | Valor | Plano |
|---|---|---|---|
| F11 | **ESG / Sustentabilidade** — CO2, residuos, energia por produto | Compliance ambiental | Enterprise |
| F12 | **Workflow Builder** — Drag-and-drop aprovacoes e regras | Customizacao sem dev | Enterprise |
| F13 | **Benchmarking Anonimo** — KPIs vs media da industria | Identifica oportunidades | Pro |
| F14 | **WIP Tempo Real** — Semi-acabado por estagio, aging, alertas | Reduz capital de giro | Pro |
| F15 | **Analytics Financeiro** — Multi-moeda, multi-filial, variancia | Expansao internacional | Enterprise |

### Cronograma pos-GA

> 3 trilhas paralelas: **Product Eng** (features F), **Integration Eng** (INT), **AI Eng** (Python migration + features de IA).

| Mes | Product Eng (Features) | Integration Eng (INT) | AI Eng (Python `iga-ai`) |
|---|---|---|---|
| 1 | F1 (Previsao IA) + F5 (Portal Cliente) | **INT-1** (Canonical Model) | **AI-1**: Setup `iga-ai/` Python + strangler do Copilot (V2 endpoint) |
| 2 | F3 (Job Costing) + F4 (Qualidade SPC) | **INT-2** (Multi-Protocol) + **INT-6** (Universal Ingestion) | **AI-2**: Migrar tools + prompts. Adicionar RAG com pgvector |
| 3 | F2 (Portal Fornecedor) + F6 (Rastreabilidade) | **INT-3** (Sync v2) | **AI-3**: Cutover Copilot V2 default. Implementar OCR (Document AI para INT-6) |
| 4 | F7 (Agentes IA Autonomos) + F9 (BOM) | **INT-4** (Mapping Studio) | **AI-4**: LangGraph agents para F7 (auto-aprovacao, recompras). AI mapping para INT-7 |
| 5 | F10 (Scheduling) + F14 (WIP) | **INT-5** (Write-back, parte 1) + **INT-7** (Smart Onboarding) | **AI-5**: Eval framework (DSPy) + observability Langfuse + custo por tenant |
| 6 | F8 (IoT) + F11 (ESG) | **INT-5** (Write-back, parte 2) | **AI-6**: Self-healing connectors com IA + diagnostico inteligente |

### Impacto no Pricing pos-Features e pos-INT

| Plano | Preco atual | Pos features F | Pos INT (Integration Platform) | Justificativa |
|---|---|---|---|---|
| Free | R$ 0 | R$ 0 | R$ 0 | Funil |
| Starter | R$ 197 | R$ 297 | R$ 297 | + Portal Cliente |
| Pro | R$ 497 | R$ 797 | **R$ 997** | + Previsao IA + Qualidade + Rastreabilidade + **Multi-protocol + Mapping Studio** |
| Enterprise | R$ 997 | R$ 1.997 | **R$ 2.997** | + Agentes IA + IoT + Workflow Builder + ESG + **Write-back + SLA dedicado** |

**Projecao MRR com features + INT**: 50 tenants mix = R$ 50.000-80.000/mes (Enterprise sobe de 6% para 15% do mix por causa do write-back)

---

## Definition of Done — Checklist de Lancamento

### Tecnico
- [ ] Zero vulnerabilidades criticas/altas (npm audit + OWASP ZAP + Snyk + Trivy)
- [ ] E2E: registro → onboarding → uso → billing → cancelamento
- [ ] Isolamento RLS testado + automatizado
- [ ] Backup PostgreSQL automatico + encriptado + restore testado mensal
- [ ] Health check 200 com todos os servicos
- [ ] Rate limiting ativo por tenant (Redis store, multi-instance safe)
- [ ] SSL A+ (SSL Labs) + Headers A+ (SecurityHeaders.com) + Mozilla Observatory >= 90
- [ ] Response time p95 < 2s
- [ ] LCP < 2.0s, INP < 200ms, CLS < 0.1
- [ ] Zero `console.log` em producao
- [ ] SBOM publicado por release

### Seguranca (gates SEC-1 a SEC-4)
- [ ] **SEC-1 done**: SSRF protection, argon2id, audit log integrity, secrets management, PII redaction
- [ ] **SEC-2 done**: MFA obrigatorio para admin, captcha, pwned password check, refresh token rotation, SSO Enterprise
- [ ] **SEC-3 done**: SAST/DAST/SCA no CI, CSP com nonce, CSP dinamico multi-tenant, CORS dinamico, WAF Cloudflare
- [ ] **SEC-4 done**: DPIA, direitos LGPD implementados, pentest externo sem highs/criticals, IR plan testado, DPA com sub-processadores
- [ ] `/.well-known/security.txt` publicado
- [ ] Pagina `/security` publica com pentest summary, SBOM, sub-processors
- [ ] OWASP ASVS Level 2 compliance no auth
- [ ] Zero secrets em `.env` em prod (tudo em Doppler/AWS Secrets)

### Excelencia operacional (gates OPS-1 a OPS-4)
- [ ] **OPS-1 done**: time dimensionado, runway claro, ESOP definido, GO de capital
- [ ] **OPS-2 done**: load test 500 tenants concurrent passou SLO, APM ativo, DORA metrics rodando
- [ ] **OPS-3 done**: WCAG 2.2 AA compliance, audit externo aprovado, pagina `/legal/acessibilidade` publicada
- [ ] **OPS-4 done**: PostHog tracking 30+ events, feature flags ativos, 1 experimento de pricing rodando
- [ ] Performance budget formal documentado (p95/p99 por endpoint)
- [ ] Lighthouse a11y >= 95 em todas paginas
- [ ] Cookie consent funcionando (analytics so apos opt-in)

### Produto
- [ ] Onboarding wizard < 10 minutos
- [ ] Billing funcionando (trial → pago → cancelamento)
- [ ] 2+ connectors (SGBR + generico)
- [ ] Tour guiado na primeira visita
- [ ] Empty states educativos em todos os modulos
- [ ] Tela "Importando dados" com progress bar e notificacao
- [ ] Mobile responsivo com bottom nav
- [ ] Micro-interacoes implementadas (page transitions, countUp, chart draw-in)
- [ ] Centro de ajuda com 10+ artigos (Notion publico)
- [ ] Notificacoes in-app de billing events no AlertsBell
- [ ] Degraded mode funcional quando API do ERP cai

### Juridico
- [ ] CNPJ ativo
- [ ] Termos de Uso + Politica de Privacidade publicados
- [ ] Cookie banner implementado

### Operacional
- [ ] Sentry + uptime + alertas configurados
- [ ] Canal de suporte (WhatsApp + email)
- [ ] Runbook de incidentes

### Marketing
- [ ] Landing page em igagestao.com.br
- [ ] GA4 configurado
- [ ] 3 artigos SEO + video demo
- [ ] Status page publica
