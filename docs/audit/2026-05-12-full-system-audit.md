# Auditoria Completa do Sistema — IGA Gestão

> **Data**: 2026-05-12 (final do dia)
> **Versão analisada**: master @ `99d18e3` (pós-cleanup demo + UX wins)
> **Complementa**: `2026-05-12-tech-audit.md` (técnica) e `2026-05-12-ux-onboarding.md` (UX)
> **Escopo**: 5 auditorias paralelas (features, LGPD, devops, mobile, AI) + testes de produção

---

## 0. TL;DR

**Sistema operacional e estável em produção.** Stack 100% free tier (Fly + Vercel + Supabase + Upstash) — pronto pra absorver primeiros tenants pagos. Maturidade técnica alta em segurança e arquitetura (após P0 fechado hoje), **mas com 3 lacunas estratégicas críticas** antes de Beta paga:

1. **Compliance**: faltam DPAs assinados com sub-processadores (Stripe, Resend, Groq, Sentry) — risco LGPD Art. 28
2. **Failover**: 1 máquina Fly só, sem HA — uma queda = sistema 100% offline
3. **Observabilidade**: `SENTRY_DSN` ausente em prod — bugs vivem em silêncio

**Top diferencial competitivo** que pode ser implementado em 1-2 sprints: **Daily AI Digest por email** + **Quick Insights pré-prontos por segmento** + **Slack/Teams integration**. Nenhum concorrente brasileiro (Metabase, Power BI, Tableau) entrega isso pronto.

---

## 1. Status de Produção (12/05/2026)

### Infraestrutura — todos verdes

| Componente | Latência | Status | Provedor / Plano |
|---|---|---|---|
| Backend (`iga-gestao-api.fly.dev`) | 150-180ms warm | 🟢 200 | Fly.io — shared-cpu-1x 512MB free, region IAD |
| Frontend (`iga-gestao-web.vercel.app`) | 75-110ms | 🟢 200 | Vercel — hobby |
| Postgres (`pxqwbrvkbvuhrvdzvxju`) | n/a | 🟢 ACTIVE_HEALTHY | Supabase — PG 17.6, us-east-2, free (12MB de 500MB) |
| Redis | n/a | 🟢 OK | Upstash — free tier (10k req/dia) |
| Servidor SGBR Tiete (`108.181.223.103:3007`) | 500ms | 🟢 401 (vivo!) | Externo — antes 500, voltou hoje |

### Smoke tests (7/7 OK)

```
OK   Health Live                    267ms  200
OK   Health Ready                   169ms  200
OK   Security.txt                   154ms  200
OK   Frontend home                   75ms  200
OK   Frontend login                  33ms  200
OK   Auth no token (401 esperado)   361ms  401
OK   Bootstrap sem auth (401)       168ms  401
```

### Headers de segurança (front + back)

| Header | Front | Back |
|---|---|---|
| Strict-Transport-Security | ✅ | ✅ |
| X-Frame-Options | ✅ DENY | ✅ |
| X-Content-Type-Options | ✅ nosniff | ✅ |
| Referrer-Policy | ✅ strict-origin-when-cross-origin | ✅ |
| Content-Security-Policy | ✅ | ✅ |
| Permissions-Policy | ✅ | ✅ |

### Banco de dados

| Métrica | Valor |
|---|---|
| Tabelas | 22 | 
| Índices | (validar via pg_indexes) |
| Tabelas com RLS | 16 (FORCE) |
| Políticas RLS | 17 |
| Foreign keys | (validar) |
| Audit log | 55 eventos / 79 nas últimas 24h |
| Tamanho DB | 12 MB / 500 MB (free) |
| Conexões idle in transaction | **0** ✅ (patch A-C1 funcionando) |
| Refresh tokens válidos | 31 (acúmulo de testes — roda cleanup) |

### Latência (warm, 5 amostras)

```
148, 149, 158, 181, 157 ms — p50 ~158ms, p95 ~180ms
```

---

## 2. Auditoria de Gap de Features

### Por categoria

| Categoria | Status | Gaps principais |
|---|---|---|
| **Dashboards & BI** | ⚠️ Parcial | drag-drop builder, comparativos período-a-período, exportar layout JSON |
| **Relatórios** | ⚠️ Parcial | templates PDF editáveis, parametrização pelo usuário |
| **Notificações** | ⚠️ Parcial | Slack/Teams/WhatsApp Business/SMS |
| **Colaboração** | ⚠️ Parcial | comentários, @mentions, activity feed |
| **Integrações ERP** | ⚠️ Parcial | Bling/Tiny/Omie só stubs (sem OAuth real). Falta Conta Azul, SAP B1, Totvs Protheus |
| **AI/Copilot** | ⚠️ Parcial | análise proativa, anomalias, forecast |
| **Mobile / PWA** | ❌ Falta | sem manifest, sem SW, sem app nativo |
| **Self-service onboarding** | ⚠️ Parcial | demo data, tour, video onboarding |
| **Billing** | ⚠️ Parcial | add-ons, usage-based, NF-e brasileira |
| **Governança** | ⚠️ Parcial | sem SSO, sem IP allowlist, sem SCIM |
| **Performance** | ✅ | cache LRU + Redis + lazy loading |
| **i18n** | ❌ Falta | só PT-BR, sem EN/ES, sem múltiplas moedas |

### Top 15 features por ROI

| # | Feature | Impacto | Esforço | ROI |
|---|---|---|---|---|
| 1 | **Slack/Teams integration p/ alertas** | Alto | Baixo | 9/10 |
| 2 | **OAuth real Bling/Tiny/Omie** | Alto | Médio | 8/10 |
| 3 | **Comparativos período-a-período nativos** | Médio | Baixo | 8/10 |
| 4 | **Daily AI Digest por email** | Médio | Médio | 7/10 |
| 5 | **Custom dashboards drag-drop** | Médio | Médio | 7/10 |
| 6 | **Conta Azul connector** | Alto | Médio | 7/10 |
| 7 | **API Keys com IP allowlist** | Médio | Baixo | 8/10 |
| 8 | **Templates PDF editáveis (designer)** | Médio | Alto | 6/10 |
| 9 | **Anomalias automáticas (IA proativa)** | Alto | Alto | 6/10 |
| 10 | **SAML/OIDC SSO** | Médio | Alto | 6/10 |
| 11 | **PWA + Service Worker offline** | Baixo | Médio | 5/10 |
| 12 | **Add-ons dinâmicos no billing** | Médio | Médio | 7/10 |
| 13 | **Faturamento por NF-e brasileira** | Médio | Médio | 7/10 |
| 14 | **Compartilhar relatório com filtros persistentes** | Baixo | Baixo | 7/10 |
| 15 | **UI de background jobs (status)** | Baixo | Baixo | 6/10 |

### 3 diferenciais competitivos viáveis em < 2 sprints

1. **AI Copilot proativo** (não só reativo) — daily digest por email com 3 anomalias semanais. **Nenhum SaaS operacional brasileiro faz isso.**
2. **Data lineage simples** — cada widget mostra de qual ETL veio + última atualização + audit log de quem viu. Compliance + transparência = unlock setor público.
3. **Quick Insights por segmento** — dashboards + relatórios pré-prontos ao conectar ERP. Time-to-value cai de 2 semanas → 30min.

---

## 3. Compliance LGPD & Governança

### Conformidade Art. 18 (direitos do titular): **7/9 ✅ | 2/9 ⚠️**

| Direito | Status | Endpoint |
|---|---|---|
| I Confirmação tratamento | ✅ | `GET /lgpd/my-data` |
| II Acesso aos dados | ✅ | `/lgpd/export` |
| III Correção | ✅ | `/configuracoes` |
| IV Anonimização | ✅ | `POST /lgpd/anonymize` |
| V Portabilidade | ✅ | `/lgpd/export` (caveat: omite credenciais ERP) |
| VI Eliminação | ✅ | `POST /lgpd/erase` (soft + hard delete 7d + backup purge 30d) |
| VII Info compartilhamento | ✅ | `/legal/sub-processors` lista 7 vendors |
| VIII Negação consentimento | ⚠️ | cookies opt-out ok; **Copilot só `disabled per-tenant`** (não por user) |
| IX Revogação consentimento | ⚠️ | cookies ok; **Copilot sem revogação granular em runtime** |

### Documentos ANPD

| Documento | Status |
|---|---|
| DPIA | ✅ rascunho (falta assinar controlador/DPO) |
| RoPA | ✅ rascunho (falta razão social + CNPJ) |
| **DPA** | ❌ **CRÍTICO** — sem DPA assinado com Stripe/Resend/Groq/Sentry/Cloudflare |
| Template notificação ANPD (48h) | ❌ não criado |

### Riscos legais

| Severidade | Item | Ação |
|---|---|---|
| 🔴 CRÍTICO | DPA não assinados com sub-processadores | Coletar/assinar em 30d |
| 🔴 CRÍTICO | Sem template de notificação ANPD em 48h (Art. 48) | Criar `template-notificacao-anpd.md` |
| 🟠 ALTO | Logs HTTP < 6 meses (Marco Civil exige) | Implementar retenção 180d (Loki/S3) |
| 🟠 ALTO | Copilot sem opt-out granular por user | Toggle `copilot_opted_out` |
| 🟠 ALTO | Credenciais ERP omitidas em portabilidade | Flag opcional `?include-secrets` com re-MFA |
| 🟡 MÉDIO | DPIA/RoPA sem assinatura final | Preencher + assinar (15d) |
| 🟡 MÉDIO | PII em prompts Copilot sem redaction | `maskPii()` antes de enviar pro provider |
| 🟡 MÉDIO | NF-e brasileira não emitida | Integrar Sefaz ou Dominio (pos-GA) |

---

## 4. DevOps, Infra & Custos

### Custo mensal (estimado)

```
Hoje (1 tenant, free tier)
  Total: ~$0/mês (+ Stripe 2.9% + $0.30/tx)

50 tenants (~1-5 req/min avg, 500-1k QPS peak)
  Fly.io 2x standard-1x:    $60
  Supabase starter:         $25  
  Upstash Pro:              $25
  Worker Fly dedicated:     $30
  Email (Resend/SendGrid):  $10
  Sentry Performance:       $29
  ─────────────────────────────
  Total:                  ~$179/mês

500 tenants (multi-region)
  Fly multi-region 4x:     $240
  Vercel Pro:               $20
  Supabase Pro 5GB:         $90
  Upstash Premium:          $99
  Worker x2:                $60
  Email 100k/mês:           $30
  Sentry Business:          $99
  DataDog/Grafana Cloud:    $50
  ─────────────────────────────
  Total:                  ~$589/mês
```

### Top riscos operacionais

| Risco | Prob | Impacto | Mitigação |
|---|---|---|---|
| **1 máquina Fly → app down 100% se cair** | Alta | Crítico | Multi-region (+$60/mo) ou failover Render |
| Pool Postgres exaurido < 15 conexões | Média | Alto | Aumentar Supabase plan + tuning |
| Webhook retry backlog perdido | Média | Alto | Worker service dedicado |
| Backup não restaurável (nunca testado) | Baixa | Crítico | Testar restore mensal (script) |
| `SENTRY_DSN` vazio → bugs silenciosos | Alta | Médio | `fly secrets set SENTRY_DSN=...` (10 min) |
| Trial expiry scheduler missed | Média | Alto | Mover pra worker ou GH Actions cron |
| Redis Upstash free (10k/dia) | Baixa | Médio | Escalar Pro (10x) |

### Quick wins DevOps (1-2h cada)

| Ação | Esforço |
|---|---|
| Add `SENTRY_DSN` secret no Fly | 10min |
| Habilitar Dependabot (GitHub) | 5min |
| Trivy scan semanal (cron action) | 30min |
| Testar restore de backup Postgres | 1h |
| Mover trial scheduler pra GitHub Actions | 45min |
| Documentar runbook de incidente | 1h |

---

## 5. Mobile, Responsividade & PWA

### Mobile Readiness Score: **5.5/10**

### Top 10 problemas

1. **Sem `manifest.json`** + sem PWA plugin → "Add to home screen" não funciona
2. **Sem `apple-touch-icon`** em `index.html` → iOS sem ícone certo
3. **Sem `viewport-fit=cover`** + safe-area CSS → notch iPhone come UI
4. **`VirtualTable.tsx` não trunca em mobile** — colunas estouram em < 768px (Vendas, Estoque inutilizáveis)
5. **`CopilotDrawer` sem fullscreen mobile** — compositor fica abaixo do teclado
6. **`Cmd+K` sem alternativa mobile** — usuário mobile sem busca rápida
7. **`DatePickerPtBR` enorme em xs** — quebra layout
8. **Bottom navbar 50px sem safe-area** — toolbar do browser come viewport
9. **Touch targets < 44×44px** (AntD `size="small"` espalhado) — falha WCAG AA
10. **`OfflineBanner` detecta offline mas não cacheia** — sem SW, app falha em 3G

### Quick wins mobile (1-2h cada)

| Ação | Esforço |
|---|---|
| Criar `manifest.json` + `apple-touch-icon` 180×180 | 30min |
| Adicionar `viewport-fit=cover` + `padding: max(0px, env(safe-area-inset-bottom))` | 15min |
| Media query: botões mobile `min-height: 44px`, inputs `font-size: 16px` | 45min |
| `VirtualTable` com scroll horizontal indicator | 1h |

### Recomendação: **PWA como MVP** (2 sprints)

- React Native overkill pra B2B dashboard
- Capacitor adiciona App Store depois se precisar
- PWA cobre 95% dos casos (drawer nav + offline + push web)

---

## 6. AI Copilot — Maturidade Score: **3.4/5**

### Por dimensão

| Dimensão | Score |
|---|---|
| Arquitetura (multi-provider, fallback) | 4/5 |
| Tools (18 function-calls) | 4.5/5 |
| Custo/telemetria | 3.5/5 |
| UX/features | 3.5/5 |
| Casos de uso cobertos | 4/5 |
| **Migração V2 Python** | **2/5 (POC abandonado)** |
| **Proatividade** | **1/5 (só reativo)** |
| RBAC/segurança | 4.5/5 |

### 10 casos cobertos vs. 10 que faltam

✅ **Cobertos**: faturamento mês, vendas 7 dias, comparativo mês×mês, alertas críticos, usuários ativos, datasources status, meta mensal, relatórios agendados, audit log

❌ **Não cobertos**: forecast vendas, produto vendendo menos, "por quê" compras subiram, criar alerta via Copilot, gerar PDF, histórico temporal, detecção de outliers, sumarização da auditoria, recomendação de ações, health metrics

### Decisão estratégica: **V2 Python (`iga-ai/`) está morto** — recomendação: descontinuar

- Pasta `services/ai/iga_ai/` existe há 6+ meses, sem deploy em produção
- `IGA_AI_BASE_URL` e `IGA_AI_SHARED_SECRET` não setados → fallback sempre V1
- Nenhum tenant em `COPILOT_USE_V2_TENANTS`
- Tools Python desincronizadas das 18 TS — duplicação cresce
- **Ação**: remover pasta, consolidar esforço no V1 TS (estável)

### Top melhorias prioritárias

1. **Cache de respostas por hash(prompt)** — corta 20-30% dos custos (~3 dias)
2. **Citations + deep links** nas respostas — cada resposta aponta pra tela origem (5 dias)
3. **Feedback 👍/👎** — coleta signals pra refiner (3 dias)
4. **Dashboard de uso de IA** — expor `getTenantUsageThisMonth` na UI (2 dias)
5. **Rate limit por custo** ($/mês em vez de # msgs) (2 dias)
6. **Quick reply suggestions** após cada resposta (3 dias)
7. **Daily AI Digest por email** (resumo automático top-5) — **diferencial competitivo** (3 sprints)
8. **RAG empresarial** (indexa docs do tenant, retriever híbrido) (5 sprints)
9. **Forecast com IA** (12 meses com IC 95%) (6 sprints)
10. **Anomaly detection** (≥ 2σ vs baseline 30d) (8 sprints)

---

## 7. Roadmap consolidado P0/P1/P2/P3

### P0 — antes de Beta paga (esta semana, blockers compliance)

- [ ] Assinar DPAs com Stripe, Resend, Groq, Sentry, Cloudflare *(legal, 30d max)*
- [ ] Criar `template-notificacao-anpd.md` (48h SLA)
- [ ] Setar `SENTRY_DSN` no Fly (`fly secrets set SENTRY_DSN=...`) — 10 min
- [ ] Assinar DPIA + RoPA finais (razão social + CNPJ + DPO)
- [ ] Adicionar toggle `copilot_opted_out` por user

### P1 — primeiras 4 semanas após Beta (foco em diferencial)

- [ ] **Slack/Teams integration p/ alertas** (UX-Q1 do roadmap features)
- [ ] **Daily AI Digest** por email (proativo) — diferencial competitivo
- [ ] **OAuth real Bling/Tiny/Omie** — desbloqueia 60% do TAM PME
- [ ] **Multi-region Fly** ou failover Render (HA) — risco operacional #1
- [ ] **PWA básico** (manifest + SW + safe-area iOS)
- [ ] **Mobile quick wins** (touch targets 44px, font 16px em inputs)
- [ ] **Dependabot + Trivy schedule semanal**
- [ ] **Logs HTTP retenção 180d** (Marco Civil)

### P2 — próximo trimestre

- [ ] **Quick Insights por segmento** (dashboards pré-prontos por industry/commerce/services/distribution)
- [ ] **Comparativos período-a-período** nativos
- [ ] **API Keys com IP allowlist** + SAML/OIDC SSO básico
- [ ] **Conta Azul connector**
- [ ] **Add-ons dinâmicos no billing** (usage-based)
- [ ] **Citations + feedback no Copilot**
- [ ] **Cache de respostas IA + dashboard de uso**
- [ ] **Remover V2 Python iga-ai** (descontinuar)
- [ ] **Worker Fly dedicado** (separar de API)
- [ ] **i18n: EN + ES completos**

### P3 — backlog estratégico

- [ ] Anomaly detection com IA
- [ ] Forecast com IA
- [ ] RAG empresarial (docs do tenant)
- [ ] SCIM provisioning
- [ ] NF-e brasileira
- [ ] App nativo (Capacitor) se PWA não bastar
- [ ] Custom dashboards drag-drop builder
- [ ] Templates PDF editáveis (designer)

---

## 8. Funções novas sugeridas (não no audit anterior)

### Categoria "diferencial sem esforço"

1. **`/api/v1/insights/digest`** — endpoint que gera o "daily AI digest" sob demanda + agendado via worker
2. **`/api/v1/datasources/:id/lineage`** — retorna histórico de refresh, ETL trail, queries SQL (data lineage simples)
3. **`/api/v1/templates/segment/:segment`** — pacote de dashboards + reports + alerts pré-configurados por segmento
4. **`/api/v1/copilot/feedback`** — POST 👍/👎 por mensagem com observação opcional
5. **`/api/v1/copilot/cache`** — GET hit-rate + cost saved no mês

### Categoria "compliance"

6. **`POST /api/v1/auth/me/opt-out`** — usuário desativa Copilot/PostHog/email marketing
7. **`POST /api/v1/super-admin/dpa-tracking`** — registra DPAs assinados com vendors (com data e versão)
8. **`/api/v1/audit/verify-chain`** — endpoint admin que recalcula chain hash e detecta tampering

### Categoria "produtividade"

9. **`POST /api/v1/datasources/bulk-test`** — testa todos os datasources do tenant em paralelo, retorna status por DS
10. **`POST /api/v1/reports/:id/schedule-once`** — agenda envio único pra uma data específica (one-off, não recorrente)
11. **`GET /api/v1/alerts/templates`** — lista templates de alertas comuns por segmento (margem baixa, estoque crítico, etc.)

### Categoria "integração externa"

12. **Webhook outbound** com retry automático e dead-letter queue (UI de status)
13. **Slack/Teams app oficial** com slash commands (`/iga vendas`, `/iga alertas`)
14. **Zapier/Make integration** via API keys (autodescoberta de triggers)

---

## 9. Métricas pra acompanhar

```
[Produto]
- Time-to-first-datasource-configured:  < 5min
- Onboarding completion rate:           > 70%
- Bounce rate em DashboardPage vazia:   < 15%
- Invite acceptance rate:               > 80%
- Daily active admins:                  ↑

[Receita]
- Trial → paid conversion:              > 25%
- Churn mensal:                         < 5%
- MRR growth:                           ↑
- LTV / CAC:                            > 3

[Técnico]
- Backend p95 latência:                 < 500ms
- Health/ready uptime:                  > 99.5%
- Error rate (5xx):                     < 0.1%
- Idle in transaction (conexões PG):    0 sustentado
- Bugs novos em prod / mês:             < 3

[AI]
- Copilot tokens consumidos / mês:      monitor
- Custo IA por tenant:                  < $5/mês
- Tool error rate:                      < 5%
- Cache hit rate (após implementar):    > 20%

[Compliance]
- Tempo resposta /lgpd/erase:           < 5s
- DPAs assinados:                       7/7
- Chain hash integrity:                 100% (job hourly)
```

---

## 10. Conclusão

| Pergunta | Resposta |
|---|---|
| **Sistema pronto pra Beta?** | ✅ Sim — após P0 (DPAs + Sentry DSN + opt-out Copilot) |
| **Pronto pra escalar p/ 50 tenants?** | ⚠️ Depois de multi-region Fly + worker dedicado (~$180/mo) |
| **Pronto pra 500 tenants?** | ❌ Precisa de refactor de infra (~$590/mo + DBA part-time) |
| **Maturidade técnica geral** | 7/10 — sólido, mas com 3 grandes lacunas (HA, AI proativo, mobile) |
| **Diferencial competitivo viável** | ✅ Copilot proativo + Quick Insights + Slack integration |
| **Maior risco hoje** | DPAs sub-processadores (CRÍTICO LGPD) |
| **Maior oportunidade hoje** | OAuth real Bling/Tiny/Omie (60% TAM PME) |

**Total commits hoje**: 20 commits cobrindo bugs prod, P0 da auditoria técnica, helper de criação de empresa, UX wins, e cleanup de demo. Suite de testes: **134 passing / 5 skipped** (+44 desde de manhã).

---

## Apêndice — Origens dos achados

- **Status produção**: smoke tests + SQL Supabase + headers Vercel/Fly
- **Gap features**: análise de `apps/web/src/pages/`, `routes/`, comparação B2B SaaS BR
- **LGPD**: `routes/lgpd.ts`, `docs/compliance/{DPIA,RoPA}.md`, mapeamento Art. 18 LGPD
- **DevOps**: `fly.toml`, `render.yaml`, `.github/workflows/`, plano de custos
- **Mobile**: `apps/web/src/{layouts,components,pages}/`, `index.html`, `vite.config.ts`
- **AI Copilot**: `services/api/src/services/ai/*`, `routes/copilot.ts`, `iga-ai/` Python
