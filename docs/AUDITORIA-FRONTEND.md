# Auditoria Front-end — IGA Gestão

**Escopo:** `front-end-gest-o/` (React 19 + Vite + Ant Design v6 + TanStack Query)
**Data:** 2026-05-08
**Objetivo:** Mapear o estado atual, identificar fluxos quebrados/incompletos, propor melhorias premium e telas novas.

---

## 1. Inventário

| Categoria | Quantidade |
|---|---|
| Pages | 56 |
| Components compartilhados | 44 |
| Services | 23 |
| Hooks | 6 |
| Utils | 9 |
| Total de linhas em pages | 11.740 |

**Quebra das pages:**
- 10 auth/legal: Login, Register, Forgot/Reset, VerifyEmail, AcceptInvite, Onboarding, ImportingData, NotFound, Legal, Lgpd
- 5 dashboards: DashboardPage, DashboardDataPage, DashboardOperacionalPage, DashboardInsightsPage, GestaoExecutivaPage
- 6 ERP: FichaTecnica, Producao, Estoque, Compras, VendasAnalitico, NotasFiscais
- 9 Finance/sub-tabs: FinancePage + ContasPagar/Receber, Conciliacao, SuperavitDeficit, Estoque×3, VendasEspuma
- 12 SaaS/Admin: Settings, Users, Security, Audit, Webhooks, DataSourceConfig, ConnectorsMarketplace, BillingPlans, BillingPortal, ScheduledReports, Alertas, SuperAdminMoved
- 4 Suporte: FaleConosco, SuporteTecnico, OpsStatus, DesignTokens, Reports
- 8 charts em `/pages/charts/`

---

## 2. Hotspots arquiteturais (refactor urgente)

| Arquivo | Linhas | Problema |
|---|---|---|
| `pages/DataSourceConfigPage.tsx` | **1.026** | Wizard de conexão inteiro num arquivo só |
| `layouts/AppLayout.tsx` | **891** | Sidebar + Header + MobileNav + atalhos misturados |
| `pages/DashboardOperacionalPage.tsx` | 792 | Lógica de chart + KPIs + tabs |
| `pages/UsersPage.tsx` | 743 | CRUD + permissões + invites no mesmo lugar |
| `pages/DashboardPage.tsx` | 644 | Estado, charts, tooltips inline |
| `pages/ReportsPage.tsx` | 627 | Gerador + lista + filtros |
| `pages/FinancePage.tsx` | 564 | Tabs + filtros + agregações |
| `pages/ComprasPage.tsx` | 559 | — |
| `pages/BillingPortalPage.tsx` | 546 | — |
| `pages/VendasAnaliticoPage.tsx` | 521 | — |

> Regra prática: pages com > 400 linhas devem ser quebradas em `pages/<nome>/sections/`.

---

## 3. Análise de fluxos (UX funcional)

### 3.1 Fluxos funcionais (com gaps)

| Fluxo | Status | Gap principal |
|---|---|---|
| Login → Dashboard | ✓ | Sem social login (Google/Microsoft), avatar genérico, sem magic link |
| Trial → Pago | ✓ | Sem countdown visual no banner, sem upgrade contextual em features bloqueadas |
| Sidebar → Página | ✓ | Grupo "Suporte técnico" mistura usuário (Fale conosco) com dev (Design Tokens, Webhooks, Operação) |
| Dark/Light | ✓ | Cookie persiste mas alguns componentes têm cor hardcoded (`#0F172A` no DashboardPage) |
| Permissões + Tenant Modules | ✓ | RBAC sólido com `RequirePermission` + `RequireTenantModule` |
| Code splitting + lazy | ✓ | Lazy + prefetch no hover (excelente!) |

### 3.2 Fluxos quebrados ou incompletos

| Fluxo | Defeito | Severidade |
|---|---|---|
| **Onboarding** | Apenas 3 steps shallow. "SGBR BI" hardcoded no select. Sem upload de logo, sem brand color picker, sem preview, sem celebração | 🔴 Alta |
| **`/perfil`** | Listado em `pageTitlesByMenuKey` mas **não existe rota nem página** — dead link no header | 🔴 Alta |
| **Forgot password** | Sem botão "reenviar e-mail", sem feedback de rate-limit visual | 🟡 Média |
| **MFA setup** | Apenas TOTP via modal — falta WebAuthn/passkey, recovery codes não exportam como PDF | 🟡 Média |
| **AcceptInvite** | Não exibe branding do tenant que está convidando | 🟡 Média |
| **Mobile bottom nav** | 4 itens fixos sem badges/active state, não é tenant-aware | 🟡 Média |
| **OpenTabsBar** | Persistência incerta, sem indicação de "alterações não salvas" | 🟢 Baixa |

---

## 4. Design System — gaps premium

`theme/tokens.ts` é minimalista demais para "premium":

```ts
// EXISTE HOJE
scale: { spacing, radius, typography, font }   // OK, básico
themes: { brand500, brand600, brand50, success, warning, danger,
          bgPrimary, bgSecondary, textPrimary, textMuted,
          borderSubtle, borderDefault, surfaceElevated }

// FALTANDO PARA SER PREMIUM
shadow:   { xs, sm, md, lg, xl, glow, inset }      // elevation system
motion:   { duration: { fast, base, slow }, easing }// timing tokens
zIndex:   { base, dropdown, modal, toast, tooltip }
gradient: { brandHero, premium, subtle, glass }
accent:   { gold, violet }                          // upgrade signals
surface:  { 0, 1, 2, 3 }                            // múltiplas elevações
blur:     { sm, md, lg }                            // glassmorphism
```

**Outras inconsistências:**
- Mistura de iconografia: `@ant-design/icons` + `lucide-react` no mesmo Header
- Cores hardcoded fora do theme: `#0F172A` (DashboardPage), `#b42318` (impersonation banner em AppLayout)
- Sem typography line-height tokens

---

## 5. Telas faltando (top 13)

| Prioridade | Tela | Path sugerido | Justificativa |
|---|---|---|---|
| 🔴 P0 | **ProfilePage** | `/perfil` | Link existe no header, está quebrado |
| 🔴 P0 | **NotificationsPage** | `/notificacoes` | AlertsBell só dropdown — falta histórico/filtro |
| 🟡 P1 | **WelcomeTourPage / Empty First-Run states** | inline | Onboarding termina em dashboard vazio |
| 🟡 P1 | **TenantSwitcherPage** | `/orgs` | Necessário ao ativar org plugin do Better Auth |
| 🟡 P1 | **APIKeysPage** | `/api-keys` | B2B SaaS sem isso é amador |
| 🟡 P1 | **SavedViewsPage** | `/visoes-salvas` | `useSavedViews` hook existe sem UI dedicada |
| 🟡 P1 | **HelpCenterPage** | `/ajuda` | Hoje só tem `/suporte` técnico — sem KB pública |
| 🟢 P2 | **ChangelogPage** | `/novidades` | "What's new" estilo Linear/Vercel — sinal premium |
| 🟢 P2 | **IntegrationHealthPage** | `/integracoes/saude` | Status visual de todos os datasources |
| 🟢 P2 | **PlanComparisonWizard** | `/planos/recomendar` | Recomenda plano baseado no uso |
| 🟢 P2 | **ReportsGalleryPage** | `/relatorios/galeria` | Cards com preview de relatórios disponíveis |
| 🟢 P2 | **PublicShareLinkPage** | `/p/:token` | Compartilhar dashboard read-only |
| 🟢 P2 | **AuditLogPerUserPage** | `/usuarios/:id/historico` | "O que esse usuário fez?" |

---

## 6. Plano de melhorias premium (5 sprints)

### Sprint A — Foundation premium (1 semana)
1. Expandir `theme/tokens.ts` com **shadow/motion/zIndex/gradient/accent/blur/surface**
2. Quebrar `AppLayout.tsx` (891 linhas) em `<AppShell>`, `<AppSidebar>`, `<AppHeader>`, `<AppMobileNav>`, `<AppShortcutsModal>` (~250 linhas cada)
3. **ProfilePage** completa (`/perfil`): avatar upload, info pessoal, sessões ativas, dispositivos conectados, preferências UX, atalhos personalizados
4. Substituir cores hardcoded por tokens (`#0F172A` → `token.colorBgElevated`, `#b42318` → `token.colorErrorBg`)

### Sprint B — Premium nav & shell (1 semana)
5. **Sidebar redesign:** grupos coerentes (Dashboards, Operação, Análise, Conta, Ajuda). Mover dev tools (Design Tokens, Webhooks) para `/admin` route gated
6. **Header premium:** avatar com foto + indicator online, breadcrumb dinâmico, env badge refinado
7. **Mobile bottom nav 2.0:** 5 itens com badges, swipe entre tabs, PWA install prompt
8. **NotificationsPage** + redesign do AlertsBell com agrupamento por tipo

### Sprint C — Onboarding premium (1 semana)
9. **OnboardingPage redesign:** 5 steps (Empresa → Branding com upload logo + color picker → Dados → Equipe → Tour interativo)
10. **Industry templates:** ao escolher segmento, pre-popular KPIs e dashboards
11. **GettingStartedChecklist 2.0:** progress radial, integração com analytics (cada step = evento)
12. **Welcome tour interativo** com Driver.js ou Shepherd substituindo o GuidedTour atual

### Sprint D — Telas críticas faltando (1 semana)
13. **APIKeysPage** (`/api-keys`) — gerar/revogar/escopos
14. **TenantSwitcherPage** (`/orgs`) — preparar para Better Auth org plugin
15. **SavedViewsPage** (`/visoes-salvas`) — listar + criar + compartilhar views
16. **HelpCenterPage** (`/ajuda`) — search + categorias + artigos + chat IA
17. **ChangelogPage** (`/novidades`) — feed cronológico

### Sprint E — Polish premium (1 semana)
18. **Skeletons consistentes** em TODAS as páginas (hoje só 3 têm)
19. **EmptyState premium** com ilustração SVG + 3 CTAs por estado vazio
20. **Animações de página** (refinar PageTransition com stagger nos cards)
21. **Loading states inteligentes:** optimistic UI em mutations, prefetch agressivo no hover
22. **Toast premium** com ações inline (undo, view details)
23. **Refactor das 6 pages > 500 linhas** quebrando em sub-components em `/pages/<page>/sections/`

---

## 7. Quick wins (< 2 horas cada)

| # | Quick win | Impacto |
|---|---|---|
| 1 | Adicionar `/perfil` route + página básica | Corrige dead link |
| 2 | Substituir `#0F172A` no DashboardPage por `token.colorBgElevated` | Consistência dark |
| 3 | Mover Design Tokens, Webhooks, Operação para grupo `/admin` | Limpa "Suporte" |
| 4 | Adicionar shadow tokens (xs/sm/md/lg) ao theme | Base para premium |
| 5 | Avatar com foto no header dropdown (usa `session.user.avatarUrl`) | Premium feel |
| 6 | Trocar Form do LoginPage por react-hook-form + zod (libs já instaladas) | DX moderna |
| 7 | Bottom nav mobile com badges (alertas, mensagens) | Mobile UX |
| 8 | "Reenviar e-mail" no ForgotPassword | Reduz tickets |
| 9 | Loading state com `<DashboardSkeleton/>` em mais páginas | Perceived perf |
| 10 | Substituir hardcoded SGBR no OnboardingPage Select por lista do `/connectors` | Multi-tenant correto |

---

## 8. Recomendação de priorização

Ordem sugerida:

1. **Quick wins #1, #3, #4, #5** — corrige dead link + estabiliza design system (1 dia)
2. **Sprint A** — foundation premium, sem isso os outros viram retrabalho (1 semana)
3. **Sprint C** — onboarding premium (melhor primeira impressão = retenção) (1 semana)
4. **Sprint B + D** — shell premium + telas faltando (2 semanas)
5. **Sprint E** — polish final (1 semana)

**Total estimado:** ~5 semanas para o app sair de "funcional" para "premium SaaS B2B".

---

## 9. Métricas de qualidade pós-implementação

Sucesso do plano deve ser medido por:

- 📉 **Pages > 400 linhas:** de 10 para ≤ 2
- 📈 **Cobertura de skeletons:** de 3 para 100% das pages com loading
- 📈 **Tokens de design:** de 13 propriedades para 40+
- 📈 **Lighthouse Performance:** medir baseline e melhorar 15+ pontos
- 📈 **Time-to-interactive na primeira sessão (onboarding):** medir e reduzir 30%
- ✅ **Zero cores hardcoded** fora de `theme/`
- ✅ **Zero dead links** no menu/header
