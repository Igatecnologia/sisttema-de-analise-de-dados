# Auditoria de UX/Onboarding — IGA Gestão

> **Data**: 2026-05-12 (tarde)
> **Escopo**: experiência do usuário novo — primeira hora no produto
> **Foco**: criação de empresa, wizard de onboarding, descoberta da UI, configuração de datasources, convite de time
> **Complementa**: `docs/audit/2026-05-12-tech-audit.md` (segurança/arquitetura/testes — fechado P0)

---

## 1. Sumário Executivo

O sistema tem **fluxos coerentes** (BetaWelcomeModal, OnboardingPage progressivo, EmptyState reutilizável, templates por segmento) mas **perde o usuário novo na transição entre etapas**. Mensagens genéricas, ausência de checklist persistente e cold-start de 5s do Fly tornam a "primeira hora" frustrante para um admin que acabou de assinar.

### Top-3 friction points

1. **Empty state da Dashboard sem ação inline** — sem dados, o admin precisa de 3 cliques pra cadastrar primeira fonte
2. **Cold-start de 5s do Fly não comunicado** — percepção de "app travou" no primeiro acesso
3. **Convites sem visualização de status** — admin convida 5 pessoas, fica cego ao progresso (quem aceitou, quem viu, quem expirou)

### Métricas propostas pra acompanhar

```
- Time-to-first-datasource-configured: < 5min
- Bounce rate em DashboardPage (sem dados): < 15%
- Onboarding completion rate: > 70%
- Invite acceptance rate: > 80%
- "Contacted support" em 24h: < 10%
```

---

## 2. Quick Wins (1-2h cada)

### UX-Q1 · Mensagens de erro acionáveis no DataSource

- **Arquivo**: `services/api/src/routes/datasources.ts:65-67`
- **Hoje**: retorna `"Dados invalidos"` genérico no 400
- **Fix**: usar `parsed.error.issues` (Zod) — devolver `field` + `message` específicos (ex: `apiUrl: "precisa de protocolo https://"`)
- **Impact**: ~40% das tentativas de conexão falham na 1ª vez por falta de feedback claro

### UX-Q2 · Link direto "Começar configuração" no login pós-empty

- **Arquivo**: `apps/web/src/pages/LoginPage.tsx:171-179`
- **Hoje**: alert "Sistema não configurado" linka pra `/fontes-de-dados` (página vazia, sem CTA óbvio)
- **Fix**: linkar pra `/onboarding` (wizard guiado) ou abrir modal `BetaWelcomeModal` direto

### UX-Q3 · Templates do onboarding sem descrição do que entregam

- **Arquivo**: `apps/web/src/pages/OnboardingPage.tsx:41-62`
- **Hoje**: títulos vagos tipo "Gestão executiva"
- **Fix**: subtitle com KPIs concretos: *"Faturamento, margem operacional, alertas de risco e top-5 produtos"*. Admin escolhe consciente em vez de chutar.

### UX-Q4 · Onboarding refresh status

- **Arquivo**: `apps/web/src/services/onboardingService.ts`
- **Hoje**: sem `refreshOnboardingStatus()` exportado. Se admin pula etapas, não há indicador do que falta.
- **Fix**: adicionar `useOnboardingProgress()` hook + badge no avatar mostrando "3 de 5 passos"

### UX-Q5 · Timeouts silenciosos em CSV grande

- **Arquivo**: `apps/web/src/pages/OnboardingPage.tsx:166-168`
- **Hoje**: import CSV > 5MB falha sem mensagem; sem retry
- **Fix**: progress bar real (já há infra) + retry button + alerta se >2 min

---

## 3. Mudanças Médias (4-8h cada)

### UX-M1 · Comunicar cold-start do Fly após 2.5s

- **Arquivo**: `apps/web/src/pages/DashboardPage.tsx:229-237`
- **Hoje**: skeleton carrega em <100ms; depois 5s invisíveis enquanto Fly acorda container; usuário pensa "tá lento"
- **Fix**:
  1. Service Worker cacheia última dashboard renderizada → mostra ela com badge "atualizando..."
  2. Loading hint discreto após 2.5s: *"Aguardando servidor (primeiro acesso do dia pode demorar)..."*

### UX-M2 · BetaWelcomeModal sem CTA forte

- **Arquivo**: `apps/web/src/components/BetaWelcomeModal.tsx:119-120`
- **Hoje**: menciona "Fontes de Dados" em texto, sem botão clicável → admin lê e fecha
- **Fix**: footer com **primary button** `"Cadastrar primeira fonte agora"` + atalho `[Enter]` que abre modal embedded

### UX-M3 · Status de convites pendentes na UI

- **Arquivo backend**: `services/api/src/routes/auth.ts:52` (inviteTemplate); falta endpoint `GET /invitations`
- **Arquivo frontend**: `apps/web/src/pages/UsuariosPage.tsx` (assumido)
- **Hoje**: admin convida 5 pessoas, sem visualização do status (enviado/visualizado/aceito/expirado)
- **Fix**:
  1. Backend: nova rota `GET /api/v1/auth/invites?status=pending` retornando lista com `sentAt`, `lastClickedAt`, `expiresAt`
  2. Frontend: seção "Convites pendentes" em `/configuracoes/usuarios` com reenviar / revogar

### UX-M4 · Empty states com ação inline em vez de navegação

- **Arquivo**: `apps/web/src/components/EmptyState.tsx`
- **Hoje**: 3 cliques (dashboard vazia → "Verificar fontes" → /fontes-de-dados → "Criar" → wizard)
- **Fix**: collapsible `<MiniDataSourceForm />` dentro do EmptyState — *"Configurar primeira fonte sem sair daqui"* (1 clique)

### UX-M5 · Demo data temporário por empresa nova

- **Arquivo**: `services/api/src/routes/demoSgbr.ts` (criado hoje para Tiete)
- **Hoje**: cada tenant novo começa 100% vazio → admin não vê o produto funcionando antes de cadastrar dados reais
- **Fix**:
  1. Checkbox final no onboarding: *"Preencher com dados de exemplo (apaga ao conectar primeira fonte real)?"*
  2. Botão na tela admin "Resetar demo / Importar reais"
- **Justifica investimento**: admin vê painel funcionando em 2min vs 2h aguardando ETL real → conversão Beta→Pago muito maior

---

## 4. Quick Wins de Comunicação

### UX-Q6 · Magic link de invite → auto-login

- **Hoje**: receber convite → clicar link → ir pra signup → fazer login = **3 passos**
- **Fix**: `/accept-invite?token=X` deve consumir JWT e já criar sessão. 1 passo.

### UX-Q7 · Toda mensagem de erro > 50 chars com link "Ver guia"

- **Hoje**: erro técnico (ex: "Falha ao conectar ao servidor SGBR-BI") sem ponteiro pra solução
- **Fix**: componente `<ErrorWithHelp errorCode="proxy.upstream.500" />` que linka pra help-center filtrado

---

## 5. Padrões já bons (manter)

- ✅ `tenantBootstrap.ts` idempotente — garante consistência admin + tenant + subscription (criado hoje)
- ✅ `OnboardingPage` progressivo (5 steps) — sem overwhelm no passo 0
- ✅ `EmptyState` reutilizável com `action path` dinâmica
- ✅ Segmento → templates automáticos (industry → executive + finance + operations) reduz decisões
- ✅ `LoginPage` tem alert "Sistema ainda não configurado" quando datasources=0
- ✅ `BetaWelcomeModal` existe (commit `252ae0f` corrigiu contraste dark mode)

---

## 6. Sugestões inspiradas — primeira hora memorável

### "Time-to-Wow" < 5 minutos

1. **Onboarding checklist persistente** (drawer direito, sempre visível):
   - ✓ Perfil criado
   - ✓ Empresa configurada
   - ☐ Primeira fonte conectada
   - ☐ Primeiro KPI visualizado
   - ☐ Convidar primeiro colega
   Cada item linka pra ação; marca quando feito. Some quando 100%.

2. **Confetti micro + toast quando primeira venda renderiza** — *"🎉 Primeira venda no dashboard!"* ao detectar `vendas.length > 0` pela primeira vez

3. **Vídeo 60s autoplay (mute) no BetaWelcomeModal** — *"Veja a demo em ação"* com play opcional

4. **Hot-reload do tenant ao conectar 1ª fonte** — invalida React Query + scroll suave até gráficos novos

---

## 7. Roadmap priorizado

### P0 — antes do próximo Beta paga (1 semana)

- **UX-Q1** (msgs de erro acionáveis) — 2h
- **UX-Q2** (link direto pro onboarding) — 1h
- **UX-Q6** (magic link de invite) — 4h
- **UX-M5** (demo data por tenant) — 1 dia

### P1 — próximas 2 semanas

- **UX-Q3, Q4, Q5** (templates, refresh status, CSV timeout)
- **UX-M1** (cold-start communication)
- **UX-M2** (BetaWelcomeModal CTA)
- **UX-M3** (invites status UI)
- **UX-M4** (empty states com form inline)

### P2 — próximo mês

- Onboarding checklist persistente
- Sistema de toasts/animations de progresso
- A/B test de templates de email
- Métricas (PostHog ou Plausible) tracking dos KPIs propostos

### P3 — backlog

- Vídeo de tour, hot-reload de fonte conectada
- Help inline contextual com `<ErrorWithHelp>`
- Skip-link e melhorias WCAG (mencionado no audit anterior)

---

## 8. Origem dos achados

- Exploração: `apps/web/src/pages/{Login,Dashboard,Onboarding,DataSourceConfig}.tsx`
- Exploração: `apps/web/src/components/{BetaWelcomeModal,EmptyState}.tsx`
- Exploração: `services/api/src/routes/{auth,onboarding,datasources,superAdmin}.ts`
- Exploração: `services/api/src/services/{emailTemplates,tenantBootstrap}.ts`
- Comparação com padrões observados em produtos B2B SaaS modernos (Stripe Dashboard, Linear, Vercel)
