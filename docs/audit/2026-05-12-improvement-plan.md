# Plano de Melhorias — IGA Gestão

> **Data**: 2026-05-12
> **Baseado em**: `2026-05-12-tech-audit.md`, `2026-05-12-ux-onboarding.md`, `2026-05-12-full-system-audit.md`
> **Estado inicial**: commit `d884a17` (P0 técnico fechado, sistema 100% prod operacional)

---

## Como usar este plano

Cada item tem:
- **ID estável** (P0-01, P1-03, etc.) pra rastrear em commits/PRs
- **Esforço** em horas reais de implementação (sem reuniões/discussão)
- **Owner sugerido**: 👤 user (decisão/legal/billing/produto) · 🤖 dev (Claude/eu, código)
- **DoD** (Definition of Done) — como saber que terminou
- **Dependências** — o que precisa estar pronto antes
- **Risco** se não fizer / valor se fizer

Sequenciamento por blocos: P0 → P1 → P2 → P3. Dentro de cada bloco, fazer na ordem listada salvo dependência forçar reordenar.

---

## P0 — Esta semana (5 dias úteis)

Blockers antes da **Beta paga** sair. Sem isso, há risco legal (LGPD), operacional (bugs invisíveis) ou de segurança (escalation viva).

### P0-01 · Configurar `SENTRY_DSN` em produção

- **Owner**: 👤 user (cria conta Sentry + me passa a DSN) → 🤖 dev (aplica)
- **Esforço**: 10 min
- **DoD**: errors em prod aparecem no Sentry dashboard; uma exceção forçada gera alerta
- **Dependências**: conta Sentry (free tier basta)
- **Comandos**:
  ```powershell
  fly secrets set SENTRY_DSN="https://...@sentry.io/..." -a iga-gestao-api
  # restart automático pelo Fly após secrets set
  ```
- **Por quê**: bugs em produção atualmente vivem em silêncio (logs Fly retém 7 dias e ninguém lê). Sem isso, qualquer regression vai ser descoberta pelo cliente.

### P0-02 · Assinar DPAs com sub-processadores

- **Owner**: 👤 user (legal/jurídico) — não posso fazer
- **Esforço**: 4-8 horas (espalhadas em 2-3 semanas pra coletar de cada vendor)
- **DoD**: 5 DPAs assinados (Stripe, Resend, Groq/OpenAI, Sentry, Cloudflare/Vercel)
- **Como**:
  - Stripe: já tem DPA padrão público em stripe.com/legal/dpa — basta arquivar
  - Resend / Sentry / Vercel: cada um tem DPA template no site
  - Groq/OpenAI: solicitar por email se Beta pago
- **Risco se não fizer**: violação LGPD Art. 28 → multa 2-6 % da receita. **Bloqueia Beta paga.**

### P0-03 · Template de notificação ANPD (48 h)

- **Owner**: 🤖 dev (eu escrevo o template) + 👤 user (revisa com legal)
- **Esforço**: 2 h
- **DoD**: `docs/compliance/template-notificacao-anpd.md` com prazos, escalação, dados mínimos (Art. 48 LGPD), processo de ativação por SEV
- **Por quê**: hoje, se incidente acontecer, não há roteiro. Time perde tempo em situação crítica e perde o prazo de 48h.

### P0-04 · Assinar DPIA + RoPA finais

- **Owner**: 👤 user (preenche razão social, CNPJ, nome DPO)
- **Esforço**: 1 h
- **DoD**: `docs/compliance/DPIA.md` e `RoPA.md` com versão final + assinatura digital
- **Dependência**: P0-02 (DPAs precisam estar listados no RoPA)

### P0-05 · Toggle `copilot_opted_out` por usuário

- **Owner**: 🤖 dev
- **Esforço**: 3 h
- **DoD**:
  - Coluna `opted_out_copilot BOOLEAN DEFAULT false` em `users`
  - Endpoint `PATCH /api/v1/auth/me/preferences { copilotOptOut: true }`
  - `routes/copilot.ts` retorna 403 se user opted out
  - Toggle no `/configuracoes` do front
- **Por quê**: LGPD Art. 18 IX (revogação granular de consentimento)
- **Migration** + endpoint + UI = caminho conhecido (~3 h)

### P0-06 · Cleanup de refresh tokens expirados (job)

- **Owner**: 🤖 dev
- **Esforço**: 1 h
- **DoD**: job em `jobs/cleanupExpired.ts` roda diário (`setInterval` 24h fallback ou cron) e faz `DELETE FROM refresh_tokens WHERE expires_at < now() OR used_at < now() - interval '7 days'`
- **Por quê**: hoje 31 tokens válidos acumulados de testes; em escala vira centenas/dia

### P0-07 · `git push` dos 21 commits do dia

- **Owner**: 👤 user
- **Esforço**: 30 segundos
- **DoD**: `origin/master` em paridade com `master` local
- **Comando**: `git push`
- **Por quê**: trabalho do dia não está no GitHub; se PC tiver problema, perdido

### Resumo P0

| Item | Esforço | Owner | Bloqueia Beta? |
|---|---|---|---|
| P0-01 Sentry DSN | 10min | 👤+🤖 | médio |
| P0-02 DPAs vendors | 4-8h | 👤 | **SIM** |
| P0-03 Template ANPD | 2h | 🤖+👤 | **SIM** |
| P0-04 Assinar DPIA/RoPA | 1h | 👤 | **SIM** |
| P0-05 Opt-out Copilot | 3h | 🤖 | médio |
| P0-06 Cleanup tokens | 1h | 🤖 | baixo |
| P0-07 git push | 30s | 👤 | baixo |

**Esforço total dev**: ~6 h · **Esforço user**: ~6-12 h (legal espalhado em 2-3 sem)

---

## P1 — 4 semanas pós-Beta (foco em ROI alto)

Cada item é uma sprint pequena, com valor entregue isolado. Sequência abaixo é a recomendada.

### P1-01 · Slack/Teams integration para alertas (3 dias)

- **Owner**: 🤖 dev
- **DoD**:
  - Tabela `webhook_destinations` (tenant_id, type='slack'|'teams', webhook_url, enabled)
  - UI em `/configuracoes/notificacoes` pra cadastrar webhook
  - `alertsEngine.ts` chama webhook destinations além de email
  - Mensagem Slack formatada com action button "Ver no IGA"
- **Por quê**: alta utilização (admin já está no Slack 8h/dia); reduz atrito de checar IGA pra alertas críticos. **ROI 9/10**.

### P1-02 · Daily AI Digest por email (3 dias) ⭐ DIFERENCIAL

- **Owner**: 🤖 dev
- **DoD**:
  - Job diário (default 08:00 timezone do tenant) chama LLM com últimas métricas
  - Gera HTML com top-3 highlights + 2 alertas + 1 ação recomendada
  - Envia pra admins ativos (opt-in/opt-out por user)
  - Limite: 1 email/dia/admin
- **Por quê**: re-engajamento massivo. Nenhum SaaS BR faz isso. Métrica norte: DAU ↑, churn ↓
- **Custo IA**: ~$0.01/digest com Groq free, ou $0.05 com Anthropic Haiku → escala bem

### P1-03 · OAuth real Bling (4 dias) — desbloqueio do TAM PME

- **Owner**: 🤖 dev
- **DoD**:
  - Implementar OAuth2 PKCE flow com Bling (já tem stub)
  - Endpoint callback `/api/v1/connectors/bling/callback`
  - Mapping de dados Bling → schemas internos (vendas, produtos, contas)
  - Botão "Conectar Bling" no DataSourceConfigPage
  - Teste end-to-end com conta sandbox
- **Por quê**: Bling é o ERP mais usado por PME brasileira (~30% de share). Tiny e Omie depois (P2).
- **Risco**: Bling API tem rate limit baixo (3 req/s) — implementar com retry exponencial

### P1-04 · Multi-region Fly (1 dia) — elimina SPOF

- **Owner**: 🤖 dev (config) + 👤 user (autoriza custo ~$60/mês)
- **DoD**:
  - `fly scale count 2 --region iad,gru` (Brasil + US East)
  - `min_machines_running = 1` (pelo menos uma sempre acordada)
  - Configurar postgres connection pool com retry inter-region
  - Testar failover (matar uma máquina)
- **Por quê**: risco #1 do audit DevOps. Hoje qualquer queda = 100% offline.

### P1-05 · PWA básico (2 dias)

- **Owner**: 🤖 dev
- **DoD**:
  - `manifest.json` com ícones (192, 512)
  - `apple-touch-icon.png` 180×180
  - Service Worker com `vite-plugin-pwa` (estratégia: stale-while-revalidate pro frontend; network-first pra API)
  - "Add to home screen" aparece em mobile
  - Modo offline mostra última dashboard cacheada
- **Por quê**: usuário mobile cresce; PWA cobre 95% dos casos sem app nativo

### P1-06 · Mobile quick wins (1 dia)

- **Owner**: 🤖 dev
- **DoD**:
  - `viewport-fit=cover` + safe-area no bottom navbar
  - Media query: botões mobile `min-height: 44px`, inputs `font-size: 16px`
  - `VirtualTable` com scroll horizontal indicator em telas < 768px
  - `CopilotDrawer` fullscreen em mobile
- **Por quê**: hoje WCAG AA falha; iOS faz zoom indesejado em inputs

### P1-07 · Dependabot + Trivy semanal (1 h)

- **Owner**: 🤖 dev
- **DoD**:
  - `.github/dependabot.yml` habilitado pra npm + pip
  - Workflow `.github/workflows/trivy-weekly.yml` roda domingo 02:00 UTC
  - Auto-merge de patches minor (após CI verde)
- **Por quê**: dívida de dependência cresce silenciosamente

### P1-08 · Logs HTTP retenção 180 dias (3 h)

- **Owner**: 🤖 dev
- **DoD**:
  - Configurar Fly Log Shipper pra S3/Loki (Upstash não atende)
  - Bucket S3 com lifecycle: 180d hot, depois Glacier
  - Documentar como consultar logs em incidente
- **Por quê**: Marco Civil exige 6 meses; hoje só 7 dias em Fly stdout

### P1-09 · Comparativos período-a-período nativos (2 dias)

- **Owner**: 🤖 dev
- **DoD**:
  - Filtro "Comparar com período anterior" em Dashboard + RangePicker
  - Widget mostra ▲5,2% vs mês passado em cada métrica
  - Reports com colunas "atual" e "anterior" automáticas
- **Por quê**: pergunta #1 de PME ("como foi vs mês passado") — feature óbvia ausente

### Resumo P1

| Item | Esforço | Owner | ROI |
|---|---|---|---|
| P1-01 Slack/Teams | 3d | 🤖 | 9/10 |
| P1-02 Daily AI Digest | 3d | 🤖 | 8/10 ⭐ |
| P1-03 OAuth Bling | 4d | 🤖 | 9/10 |
| P1-04 Multi-region Fly | 1d | 🤖+👤 | crítico |
| P1-05 PWA básico | 2d | 🤖 | 6/10 |
| P1-06 Mobile QW | 1d | 🤖 | 7/10 |
| P1-07 Dependabot+Trivy | 1h | 🤖 | 5/10 |
| P1-08 Logs 180d | 3h | 🤖 | compliance |
| P1-09 Comparativos | 2d | 🤖 | 8/10 |

**Esforço total dev**: ~17 dias (3.5 sem com 1 dev FT) · **Custo infra adicional**: +$60-80/mês

---

## P2 — Próximo trimestre (consolidação + diferenciais)

### P2-01 · Quick Insights pré-prontos por segmento (5 dias) ⭐ DIFERENCIAL

- **Owner**: 🤖 dev + 👤 user (validar templates por segmento)
- **DoD**:
  - JSON templates por (segment, connector): dashboards + reports + alerts
  - No onboarding ao conectar 1ª fonte: "Aplicar templates do segmento X?"
  - 4 pacotes: industry/commerce/services/distribution
  - Cada pacote: 1 dashboard executivo + 1 financeiro + 1 operacional + 5 alertas base
- **Por quê**: time-to-value cai de 2 sem → 30 min. **Diferencial absoluto vs Metabase/Tableau.**

### P2-02 · OAuth Tiny + Omie (3 dias cada = 6 dias)

- Após P1-03 (Bling), aplicar mesmo padrão pra Tiny e Omie
- Templates reutilizados; só muda OAuth flow + mapping

### P2-03 · Conta Azul connector (4 dias)

- Diferente dos ERPs: Conta Azul é contabilidade cloud
- Foco em fluxo financeiro + NF-e via Sefaz integrada
- **Segmento services** depende disso

### P2-04 · API Keys com IP allowlist (3 h)

- **DoD**:
  - Coluna `allowed_ips JSONB` em `api_keys`
  - Middleware `apiKeyAuth.ts` valida `req.ip` contra lista
  - UI permite CIDR notation (`200.150.0.0/24`)
- **Por quê**: empresas médias exigem; compliance + governança

### P2-05 · SSO SAML/OIDC básico (1 sprint, 5 dias)

- **DoD**:
  - Provider Clerk ou Auth0 plug-in (não reinventar)
  - Configurável por tenant (`tenants.sso_provider`)
  - Login alternativo: "Entrar com SSO"
  - SCIM provisioning fica P3
- **Por quê**: empresas 100+ funcionários exigem; unlock setor público

### P2-06 · Cache de respostas IA + Dashboard de uso (3 dias)

- **DoD**:
  - Cache LRU por hash(prompt) em Redis, TTL 1h
  - Cache hit não cobra token nem chama provider
  - `/configuracoes/copilot/uso` mostra: tokens mês, custo estimado, top 10 prompts
- **Por quê**: corta 20-30% dos custos IA + transparência

### P2-07 · Citations + deep links no Copilot (5 dias)

- **DoD**:
  - System prompt instrui LLM a citar fontes: `[ver Vendas Jan/2026](/vendas?from=2026-01)`
  - Cada widget exposto via tool retorna metadata pro Copilot
  - UI renderiza link clicável que abre a tela com filtro aplicado
- **Por quê**: transparência + UX premium (Notion AI, Linear AI fazem)

### P2-08 · Feedback 👍/👎 no Copilot (3 dias)

- **DoD**:
  - Tabela `copilot_feedback` (msg_id, user_id, score, comment)
  - Botão na UI após cada resposta
  - Endpoint `/api/v1/copilot/feedback`
  - Dashboard admin mostra taxa de aprovação por modelo
- **Por quê**: data pra melhorar prompts, decidir provider

### P2-09 · Remover V2 Python `iga-ai/` (1 dia)

- **DoD**:
  - `git rm -rf services/ai/iga_ai/` (não-deletar histórico, só working tree)
  - Remover `services/api/src/services/ai/v2Proxy.ts`
  - Documentar decisão em ADR
- **Por quê**: POC abandonado 6+ meses, gera débito técnico

### P2-10 · Worker Fly dedicado (1 dia)

- **DoD**:
  - Provisionar segundo Fly app `iga-gestao-worker` com `IGA_PROCESS_ROLE=worker`
  - Cron jobs movidos pro worker
  - API process libera CPU pra requests
- **Dependência**: P0-01 (Sentry) pra monitorar erros do worker
- **Custo**: +$10-30/mês

### P2-11 · Add-ons dinâmicos no billing (4 dias)

- **DoD**:
  - Tabela `subscription_addons` (tenant, addon_id, qty)
  - Catálogo de add-ons: usuários extras, retention extra, API calls extras
  - Stripe usage-based pricing integrado
  - UI no `/billing` pra adicionar/remover
- **Por quê**: aumenta LTV; PME prefere pagar "5 usuários extras" do que upgrade de plano inteiro

### P2-12 · i18n: EN + ES completos (1 sprint, 5 dias)

- **DoD**:
  - Extrair 262 strings hardcoded pra `i18n/messages/{pt-BR,en,es}.json`
  - `react-i18next` configurado (ou similar)
  - Picker de idioma no `/configuracoes`
- **Por quê**: blocker pra expansão LATAM e clientes multinacionais

### Resumo P2

| Item | Esforço | Valor |
|---|---|---|
| P2-01 Quick Insights segmento | 5d | ⭐ diferencial |
| P2-02 OAuth Tiny+Omie | 6d | TAM PME |
| P2-03 Conta Azul connector | 4d | segmento services |
| P2-04 IP allowlist | 3h | governança |
| P2-05 SSO SAML/OIDC | 5d | enterprise sales |
| P2-06 Cache IA + dashboard | 3d | custo IA -25% |
| P2-07 Citations Copilot | 5d | UX premium |
| P2-08 Feedback Copilot | 3d | melhoria contínua |
| P2-09 Remover V2 Python | 1d | tech debt |
| P2-10 Worker Fly dedicado | 1d | resiliência |
| P2-11 Add-ons billing | 4d | LTV ↑ |
| P2-12 i18n EN/ES | 5d | expansão LATAM |

**Total**: ~45 dias dev (9 sem · 1 dev FT) · **Custo infra**: +$10-30/mês

---

## P3 — Backlog estratégico

Cada item é trabalho grande (1-3 sprints), implementar quando houver tração + capacity. Não comprometer roadmap.

| Item | Tamanho | Quando faz sentido |
|---|---|---|
| **Anomaly detection com IA** | 8 sprints | Após ter 50+ tenants ativos (dados pra baseline) |
| **Forecast com IA (12 meses)** | 6 sprints | Após anomaly detection (mesma infra ML) |
| **RAG empresarial (docs do tenant)** | 5 sprints | Quando clientes pedirem "Copilot que sabe da minha empresa" |
| **SCIM provisioning** | 2 sprints | Quando primeiro cliente Enterprise pedir |
| **NF-e brasileira (emissão fiscal)** | 8 sprints | Quando MRR > R$ 50k/mês (justifica Sefaz integration) |
| **App nativo (Capacitor)** | 4 sprints | Se PWA não converter mobile users (medir DAU mobile vs desktop) |
| **Custom dashboards drag-drop builder** | 6 sprints | Quando clientes pedirem (medir tickets) |
| **Templates PDF editáveis (designer)** | 8 sprints | Quando Enterprise pedirem white-label |
| **Webhook outbound com retry + DLQ** | 2 sprints | Após primeira integração que precise (Zapier?) |
| **Zapier/Make integration** | 3 sprints | Após Slack/Teams (P1-01) — momentum de integrações |
| **Mobile App Store (Capacitor)** | 4 sprints | Justificar com data PWA |

---

## Sequenciamento sugerido (timeline)

```
Semana 1 (atual)
  └─ P0-01 Sentry DSN              [10 min]
  └─ P0-05 Opt-out Copilot         [3h]
  └─ P0-06 Cleanup tokens          [1h]
  └─ P0-03 Template ANPD           [2h]
  └─ P0-07 git push                [30s]
  └─ (paralelo: P0-02 DPAs vendor — começa, vence em 30d)
  └─ (paralelo: P0-04 DPIA assinatura)

Semanas 2-5 (P1 sprint)
  Sem 2: P1-04 Multi-region Fly + P1-07 Dependabot + P1-08 Logs 180d
  Sem 3: P1-01 Slack/Teams
  Sem 4: P1-02 Daily AI Digest ⭐
  Sem 5: P1-03 OAuth Bling

Semanas 6-7
  Sem 6: P1-09 Comparativos período-a-período
  Sem 7: P1-05 PWA + P1-06 Mobile QW

Semanas 8-17 (P2)
  Sem 8-9: P2-01 Quick Insights por segmento ⭐
  Sem 10-12: P2-02 Tiny + Omie OAuth
  Sem 13: P2-03 Conta Azul
  Sem 14: P2-06 Cache IA + dashboard + P2-09 Remover V2 + P2-10 Worker
  Sem 15-16: P2-05 SSO + P2-07 Citations Copilot
  Sem 17: P2-04 IP allowlist + P2-08 Feedback Copilot + P2-11 Add-ons + P2-12 i18n
```

**P0+P1 = ~5 semanas pra Beta paga sólida**
**P0+P1+P2 = ~4 meses pra produto Enterprise-ready**

---

## Critérios de sucesso por bloco

### P0 — Beta paga liberada
- [ ] Zero exceções silenciosas (Sentry capturando)
- [ ] DPAs arquivados com 5 vendors
- [ ] DPIA/RoPA assinados
- [ ] Template ANPD pronto pra acionar
- [ ] Opt-out Copilot funciona
- [ ] origin/master sincronizado

### P1 — Primeiros 50 tenants
- [ ] Multi-region Fly (zero downtime em deploy)
- [ ] Slack integration ativa em 30%+ dos tenants
- [ ] Daily Digest com taxa de abertura > 25%
- [ ] Bling OAuth com pelo menos 10 tenants conectados
- [ ] PWA score Lighthouse > 90
- [ ] Mobile: bounce rate cai pela metade

### P2 — 100-500 tenants
- [ ] Quick Insights aplicado por 70%+ dos novos tenants
- [ ] Tiny + Omie + Conta Azul ativos
- [ ] SSO ativo em pelo menos 5 tenants Enterprise
- [ ] Cache IA: hit rate > 25%
- [ ] V2 Python removido sem regressão
- [ ] Worker Fly: cron jobs sem falha em 30 dias
- [ ] i18n: EN/ES com 100% das strings traduzidas

---

## Riscos do plano

| Risco | Probab | Impacto | Mitigação |
|---|---|---|---|
| Legal demora pra DPAs > 30d | Média | Beta paga atrasa | Começar P0-02 imediatamente, paralelo |
| OAuth Bling/Tiny/Omie quebra API change | Baixa | P1-03 atrasa | Sandbox + monitoring |
| Multi-region Fly traz latência DB cross-region | Média | P1-04 reverte | Testar com synthetic load; pode ficar 1 região + standby |
| AI Digest gera mensagens ruins (LLM erra) | Média | Churn ↑ | A/B test, feedback loop, fallback humano |
| Custo Sentry sobe rápido | Baixa | P0-01 vira P1 | Sample rate 10%, beforeSend filtra |
| Templates segmento ficam genéricos | Média | P2-01 não converte | Validar com 5 customers reais antes |

---

## Onde olhar a próxima etapa

- **Trello/Linear**: ainda não temos board, sugiro criar com esses IDs (P0-01...P3-X)
- **Métricas**: dashboard de progresso em `docs/audit/2026-05-12-full-system-audit.md` seção 9
- **Decisões**: ADRs (Architecture Decision Records) — proposta: criar `docs/adr/` quando começar
- **Status semanal**: short retrospective toda sexta com PRs mergeados + bloqueios

---

## Apêndice — ROI rápido pra decidir trade-off

Se tiver 1 dia livre na sprint, faça pela ordem:

1. P0-01 Sentry DSN (10 min — ROI infinito)
2. P0-06 Cleanup tokens (1h — limpeza)
3. P1-07 Dependabot (1h — automação)
4. P1-08 Logs 180d (3h — compliance Marco Civil)
5. P0-05 Opt-out Copilot (3h — LGPD)
6. P2-04 IP allowlist (3h — vende governança)

Esses 6 itens (~11h) entregam: observability + LGPD compliance + governança + automação. Mais valor por hora do plano inteiro.
