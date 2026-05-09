# PLANO-FRONTEND-BETA.md

Plano objetivo pra deixar o front-end principal (`front-end-gest-o`) pronto pra entrar em Beta com empresas reais. Foca em **bloqueadores reais**, não em refactor por refactor.

**Stack alvo:** React 19 + Vite 8 + Ant Design v6 + React Query v5 + lucide-react.
**Apps fora deste plano:** `landing-page` (Next.js, marketing) e `super-admin-app` (Next.js, ops cross-tenant) — ambos já em pé.

---

## Status atual (o que já está pronto)

✅ Refresh token rotation (sessão sobrevive expiração do access token)
✅ document.title por página + breadcrumb global
✅ Dark mode tokenizado (sem hex hardcoded em estilos críticos)
✅ ErrorBoundary global + por página
✅ OfflineBanner + TrialBanner com dias visíveis sempre
✅ 2FA UI completo (setup, disable, regenerate backup codes)
✅ LGPD UI (export, anonymize, erase)
✅ Bulk invite por email (`/auth/invite`)
✅ ScheduledReportsPage (CRUD agendamentos com cron friendly)
✅ CsvDatasetsSection (upload + preview + listagem)
✅ Logout em todos dispositivos
✅ Audit chain integrity check
✅ BillingPortalPage premium (hero gradient, ring progress, usage cards)
✅ Export tenant data (admin pode baixar JSON)
✅ Super Admin movido pra app separado (separação de privilégio)
✅ Plan limit modal automático em 402

---

## Princípios

1. **Nada quebra silenciosamente** — toda falha tem feedback visível.
2. **First impression > feature breadth** — empresa abre, entende em 60s, faz a primeira coisa útil.
3. **Mobile first 375px** — Beta inclui telas pequenas (gestor olha no carro).
4. **Zero regressão** — typecheck limpo é pré-condição de qualquer PR.
5. **Auditável** — toda mudança deixa pista (audit log, analytics, sentry).

---

## Fase 1 — Bloqueadores Beta (P0)

Tudo aqui é **must-have** antes de mandar convite pra empresa real.

### 1.1 Observabilidade real em produção
**Por quê:** Hoje erros silenciam após `console.error` virar `if (DEV)`. Em prod, ninguém vê.
- [ ] Plugar Sentry (frontend SDK) em `src/monitoring/errorTracker.ts` — já tem `captureError()` stub
- [ ] `release` versionado por commit hash + sourcemaps no build
- [ ] Filtrar dados sensíveis (email/CPF/token) via `beforeSend`
- [ ] Sample rate: 100% errors, 10% transactions
- [ ] Dashboard separado por tenant (tag `tenantId`)
- **Effort:** 4h. **Owner:** dev sênior. **Bloqueia:** Beta launch.

### 1.2 Mobile responsividade — auditoria das 39 páginas
**Por quê:** Hoje só `OpenTabsBar` mobile foi pensado. Várias páginas têm tabelas largas, modais sem scroll, filtros que vazam viewport.
- [ ] Script: rodar Chrome DevTools 375x667 em cada página, anotar quebras
- [ ] Páginas críticas pra fixar: `DashboardPage`, `FinancePage`, `VendasAnaliticoPage`, `UsersPage`, `DataSourceConfigPage`, `BillingPortalPage`, `RegisterPage`, `LoginPage`
- [ ] Tabelas viram cards stacked < 768px, ou usam `scroll={{ x }}` consistente
- [ ] Modal `width` cap em `min(720px, 92vw)`
- [ ] Drawer 100% width < 600px
- **Effort:** 8h. **Owner:** dev frontend.

### 1.3 Performance: bundle audit + code-split fino
**Por quê:** Bundle inicial provavelmente carrega AntD inteiro + Recharts + Stripe. Pra empresas em 4G, isso atrasa o "tempo até dashboard".
- [ ] `npm run size:check` — registrar baseline
- [ ] Lazy load `CopilotDrawer`, `CommandPalette`, `MfaSetupModal`, `CsvUploadModal` (usados por minoria)
- [ ] Verificar tree-shaking do AntD (usar imports nomeados, não `import * as antd`)
- [ ] Recharts: importar charts específicos, não o pacote inteiro
- [ ] Lighthouse mobile target: **TTI < 3.5s em 4G**
- **Effort:** 6h. **Owner:** dev frontend. **Mede via:** Lighthouse CI.

### 1.4 Onboarding pós-cadastro testável end-to-end
**Por quê:** Já tem `RegisterPage` simplificada + `OnboardingPage` com skip. Mas falta validar que cabe num teste real com usuário não-técnico.
- [ ] Roteiro de teste manual: criar conta → verificar email → primeira fonte → primeiro dashboard com dados (15min target)
- [ ] Vídeo de tela do fluxo (interno) pra detectar fricção
- [ ] Adicionar checkpoints analytics: `register_started`, `register_completed`, `email_verified`, `first_datasource_added`, `first_dashboard_viewed`
- [ ] Funil em PostHog/analytics — saber onde empresas drop-out
- **Effort:** 3h. **Owner:** PM + dev.

### 1.5 Estados de erro consistentes em queries críticas
**Por quê:** Hoje algumas páginas mostram `null` em silêncio quando query falha (sem tela, sem retry).
- [ ] Auditar toda `useQuery` que não tem `error` UI: `DashboardPage`, `FinancePage`, `VendasAnaliticoPage`, `UsersPage`
- [ ] Padrão: `<EmptyState>` ou `<Alert>` com botão "Tentar de novo"
- [ ] Reutilizar `EmptyState` existente em `src/components/EmptyState.tsx`
- **Effort:** 4h.

### 1.6 Sessão / segurança hardening
- [ ] Auto-logout por inatividade já existe (30min) — confirmar funcionamento
- [ ] Banner "Sessão expira em X min" 2min antes do timeout (warning não-bloqueante)
- [ ] CSP headers backend (já tem) — checar se cobre Sentry domain
- [ ] Logout-all UI já existe — ajustar copy pra ser mais claro
- **Effort:** 3h.

**Total Fase 1:** ~28h (3-4 dias 1 dev sênior).

---

## Fase 2 — Polish Beta (P1)

Não bloqueia, mas degrada profissionalismo. Quero entregar antes de escalar pra mais de 5 empresas.

### 2.1 Acessibilidade básica WCAG AA
- [ ] `aria-label` em botões icon-only (existe em `<Tooltip>`, falta ARIA)
- [ ] Skip link "Pular pro conteúdo" no AppLayout
- [ ] Focus ring visível (`outline: 2px solid var(--qc-primary)`)
- [ ] Keyboard nav em modais (Esc fecha, Tab cicla)
- [ ] Contrast ratio ≥ 4.5:1 (auditar tokens dark)
- [ ] `prefers-reduced-motion` respeitado (Framer Motion tem hook)
- **Effort:** 6h.

### 2.2 Loading states customizados
**Por quê:** `<Skeleton active />` genérico não dá pista do que vai aparecer.
- [ ] `<DashboardSkeleton>` (já existe, validar usado)
- [ ] `<TableSkeleton>` reutilizável (5 linhas + header)
- [ ] `<DetailSkeleton>` pra páginas de drilldown
- [ ] Aplicar em: Webhooks, Audit, Reports, ScheduledReports, CsvDatasets
- **Effort:** 4h.

### 2.3 Notificações in-app
**Por quê:** Hoje `message.success` vira/some. Pra ações importantes (relatório enviado, webhook falhou, trial expirando) precisa centralizar.
- [ ] Notification center no header (sino com badge)
- [ ] Backend: novo endpoint `/api/v1/notifications` (lista + mark read)
- [ ] Tipos: `report_sent`, `webhook_failed`, `trial_warning`, `plan_upgrade`, `team_invited`
- [ ] SSE stream igual a `/alerts/stream`
- **Effort:** 12h. **Inclui backend.**

### 2.4 Tour guiado pra novos usuários
- [ ] Tour já tem (`shouldAutoOpenTour`) — auditar se está completo
- [ ] Steps: dashboard → criar fonte → convidar time → abrir copilot
- [ ] Componente que destaca elemento + tooltip (Driver.js ou similar)
- [ ] Skip + "não mostrar de novo" persistente
- **Effort:** 6h.

### 2.5 Feature flags / kill switches
**Por quê:** Pra desligar Copilot se ficar lento, ou só ativar Webhooks pra empresas pagas, sem deploy.
- [ ] Backend: `GET /api/v1/feature-flags` retorna mapa de flags por tenant
- [ ] Frontend: `useFeatureFlag('copilot_v2')` hook
- [ ] Cache 60s, refetch on focus
- **Effort:** 6h.

### 2.6 Help inline + FAQ por contexto
- [ ] Botão "?" em cada PageHeaderCard
- [ ] Popover com 3-5 perguntas frequentes daquela página
- [ ] Link pra docs externas (Notion público?)
- **Effort:** 4h.

### 2.7 Polish visual
- [ ] Hero sections em páginas chave: já tem em SuperAdmin antiga (RIP), Billing (✓). Adicionar em DashboardPage opcional
- [ ] Spacing scale consistente (8/12/16/24/32) — auditar inline `style`
- [ ] Animações sutis (Framer Motion) em transições de modal/drawer
- [ ] Empty states com ilustração (não só `<Empty>` genérico)
- **Effort:** 8h.

### 2.8 Tenant module toggle (com plan-based gating)
**Por quê:** Hoje admin do tenant não consegue ativar/desativar módulos. Bloqueado anteriormente por risco de business model.
- [ ] Backend: definir matriz `MODULES_BY_PLAN` (trial=4, starter=8, pro=todos, enterprise=todos+addons)
- [ ] `tenantSettingsSchema` aceita `enabledModules`
- [ ] Frontend SettingsPage: card "Módulos" com checkboxes; locked por plano com CTA upgrade
- **Effort:** 8h.

**Total Fase 2:** ~54h (~7 dias 1 dev).

---

## Fase 3 — Pós-Beta (backlog)

Não vale gastar antes de validar Beta.

- Multi-idioma (en, es) — i18next + extrair strings
- PWA (cache offline + install prompt)
- Push notifications via FCM
- Custom domain por tenant (DNS + SSL automation)
- WhatsApp configurável por tenant (per-tenant settings)
- Planos vindos do Stripe Products (vs hardcoded em `BillingPlansPage`)
- Zen mode (esconder sidebar)
- Sparklines em métricas (MRR, ativos por dia)
- A/B test framework (PostHog feature flags)
- Sub-tenants / departamentos dentro de tenant

---

## Riscos & decisões pendentes

| Risco | Mitigação |
|---|---|
| **Sentry custa $26/mo no plano team** | Free tier 5k events/mo cobre 5 empresas Beta. Avaliar quando passar disso. |
| **Mobile audit pode revelar refactor grande** | Time-box em 8h — se passar, escalar pra fase 2 e priorizar top 5 páginas |
| **Tour interativo pode ficar irritante** | Skip persistente + mostrar só na primeira sessão |
| **Feature flags acoplam frontend a backend** | Default-on no client se backend retornar erro (fail open) |
| **Tenant module toggle pode liberar features pagas** | Gating server-side rigoroso — UI é só hint visual |

**Decisões abertas pro PO:**
1. Sentry / PostHog / Datadog? — recomendo Sentry (errors) + PostHog (analytics).
2. Feature flags caseiro ou GrowthBook? — caseiro pra Beta, migrar depois se ficar complexo.
3. i18n é P1 ou P2? — depende se tem cliente gringo no Beta.
4. Tour com Driver.js (3KB) ou Shepherd (8KB)? — Driver.js mais leve.

---

## Critérios de aceite

### Pra entrar em Beta (P0 done)
- [ ] Sentry recebe pelo menos 1 erro real e dispara alerta pro Slack
- [ ] Lighthouse mobile score ≥ 80 em DashboardPage
- [ ] 39/39 páginas abrem sem layout broken em 375x667
- [ ] Onboarding completo (cadastro → primeiro dashboard) sob 15min com testador externo
- [ ] Zero `console.log/error` não-DEV em build de produção
- [ ] Typecheck + lint limpos em CI

### Pra sair do Beta (P1 done)
- [ ] aXe DevTools sem violações críticas em 10 páginas-amostra
- [ ] Notification center funcional com pelo menos 3 tipos de evento
- [ ] Tour completou ≥ 60% pra novos usuários (medir via analytics)
- [ ] 0 incidentes Sentry P0 nos últimos 7 dias
- [ ] NPS interno (5 empresas Beta) ≥ 50

---

## Cronograma sugerido

```
Semana 1  — P0 1.1 Sentry + 1.3 Performance
Semana 2  — P0 1.2 Mobile audit + 1.5 Error states
Semana 3  — P0 1.4 Onboarding teste + 1.6 Sessão
              GO/NO-GO Beta launch
Semana 4-5 — Beta com 3 empresas piloto, monitoramento Sentry
Semana 6-9 — P1 conforme feedback Beta
Semana 10  — Saída Beta, abertura geral
```

---

**Última atualização:** 2026-05-08
**Owner:** Mayke Santos
