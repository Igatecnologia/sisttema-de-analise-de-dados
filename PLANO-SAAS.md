# IGA Gestao — Plano de Transformacao SaaS v2

## Visao Geral

Transformar o IGA Gestao de um aplicativo desktop single-tenant (focado em industria de espuma + SGBR BI) em um SaaS multi-tenant generico que atende qualquer segmento industrial.

---

## Diagnostico do Estado Atual

### O que JA esta pronto para SaaS

| Componente | Status | Detalhe |
|---|---|---|
| Proxy generico de APIs | OK | Suporta qualquer REST API com auth, paginacao, field mappings |
| Infraestrutura de tenant no frontend | OK | TenantContext, localStorage isolado, subdomain detection |
| Sistema de permissoes | OK | 19 permissoes granulares com roles (admin/manager/viewer) |
| Criptografia de segredos | OK | AES-256-GCM para credenciais at rest |
| Copilot IA | OK | Provider-agnostico, tool-based, tenant-aware |
| Audit logging | OK | Eventos de seguranca registrados |
| UI premium | OK | Dark/light mode, componentes reutilizaveis, responsivo |

### O que esta HARDCODED para espuma/SGBR

| Componente | Problema |
|---|---|
| routes/erp.ts | 8 referencias hardcoded a `/sgbrbi/*` (estoque, produzido, vendas, compras, vendanfe, notasfiscais, notafiscal) e classificacao espuma/aglomerado |
| routes/finance.ts | `classifyEstoqueItem()` hardcoded para espuma |
| routes/proxy.ts | Fallbacks SGBR (pagina/tamanho), `SGBR_CREDENTIALS` |
| warmCache.ts | Endpoints SGBR hardcoded, `tenantId='default'` |
| app.ts | CSP whitelist `*.sgbrbi.com.br` |
| Frontend schemas | `estoqueEspumaSchema`, `vendaEspumaSchema` com tipos fixos |
| 3 utils de normalize | sgbrContasPagasMap, sgbrNotasFiscaisNormalize, sgbrVendaAnaliticoNormalize |
| Paginas | FichaTecnicaPage, EstoquePage com terminologia de espuma |
| Codigo morto | ComercialPage.tsx (removida do router, substituida por NotasFiscaisPage) e erpDemoData.ts (nao importado por nenhum modulo) — ambos devem ser deletados |

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
| Dados de demonstracao por segmento (trial) | MEDIA |

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
/api/v1/copilot/*        -- IA
/api/v1/billing/*        -- cobranca
/api/v1/admin/*          -- super-admin
/api/v1/webhooks/*       -- eventos para integracao enterprise
```

Todas as rotas legadas (`/erp/*`, `/finance/*`, `/api/proxy/*`) redirecionam para `/api/v1/*` com deprecation header.

---

## Modelo de Negocios

| Plano | Preco | Usuarios | Fontes | Modulos | IA | Suporte |
|---|---|---|---|---|---|---|
| Free | R$ 0 | 1 | 1 | Dashboard + Vendas | Nao | Comunidade |
| Starter | R$ 197/mes | 3 | 2 | + Estoque + Compras | Nao | Email |
| Pro | R$ 497/mes | 10 | 5 | Todos | Copilot | Email + Chat |
| Enterprise | R$ 997/mes | Ilimitado | Ilimitado | Todos + API + Webhooks | Copilot Premium | Dedicado + SLA |

**Trial**: 14 dias do plano Pro, sem cartao. Ao expirar, cai para Free.

### Custo por tenant (estimativa)

| Componente | Free | Starter | Pro | Enterprise |
|---|---|---|---|---|
| Infra (proporcional) | R$ 5 | R$ 15 | R$ 30 | R$ 50 |
| IA Copilot (Groq API) | — | — | R$ 10 | R$ 30 |
| Suporte (tempo) | R$ 0 | R$ 20 | R$ 40 | R$ 100 |
| **Custo total** | **R$ 5** | **R$ 35** | **R$ 80** | **R$ 180** |
| **Margem** | **-R$ 5** | **R$ 162 (82%)** | **R$ 417 (84%)** | **R$ 817 (82%)** |

Free tem custo marginal baixo (R$5/mes) e serve como funil para conversao.

---

## Sprints

### Sprint 0 — Preparacao de Ambiente (1 semana)

**Objetivo**: Infraestrutura de desenvolvimento pronta.

- [ ] Branch strategy: `main` (prod) → `develop` (staging) → `feature/*`
- [ ] Docker Compose local: postgres 17 + redis 7 + app
- [ ] Dockerfile multi-stage para backend (build + runtime)
- [ ] Makefile ou scripts: `make dev`, `make test`, `make build`, `make deploy`
- [ ] CI basico: GitHub Action que roda lint + tsc + vitest em cada PR
- [ ] .env.example atualizado com todas as variaveis necessarias
- [ ] Documentar arquitetura atual em ARCHITECTURE.md

**Entrega**: `docker compose up` sobe ambiente completo local.

---

### Sprint 1 — Banco PostgreSQL + Redis (2 semanas)

**Objetivo**: Migrar de SQLite para PostgreSQL. Sem mudar funcionalidade.

> Reordenada para antes do multi-tenant — sem banco escalavel, nao da para testar isolamento real.

**Backend**:
- [ ] Instalar Drizzle ORM (ou Knex) + pg driver
- [ ] Criar migrations para TODAS as tabelas (users, datasources, sessions, alerts, audit_log, copilot_messages, scheduled_reports, app_settings)
- [ ] Adapter pattern: `DatabaseAdapter` interface com implementacoes `SqliteAdapter` (dev) e `PostgresAdapter` (prod)
- [ ] Migrar TODOS os `db.prepare(...)` para o adapter
- [ ] Connection pooling (pg-pool, max 20 connections)
- [ ] Substituir `Map` caches por Redis: tokenCache, proxyCache, estoqueCache, contasPagarCache, faturamentosCache, producaoCache, comprasCache
- [ ] Sessions no Redis (em vez de tabela SQL para reads frequentes)
- [ ] Health check: testar PostgreSQL + Redis connectivity

**Worker**:
- [ ] Criar worker process separado com BullMQ
- [ ] Migrar jobs: warmCache, dbBackup, copilotRetention, scheduledReports, alertsEngine
- [ ] Jobs nao rodam mais no app server (zero `setInterval` no processo web)

**Testes**:
- [ ] Todos os testes existentes passando com PostgreSQL (atualmente 22 test cases em 4 test files via vitest)
- [ ] Teste de backup e restore do PostgreSQL
- [ ] Teste de Redis failover (app funciona sem Redis, fallback para memory)

**Cobertura minima**: 80% das rotas cobertas por testes

---

### Sprint 2 — Fundacao Multi-Tenant (2 semanas)

**Objetivo**: Sistema de tenants funcionando com isolamento real no PostgreSQL.

**Backend**:
- [ ] Criar tabela `tenants` (schema completo acima)
- [ ] Adicionar `tenant_id` em: users, audit_log, copilot_messages, scheduled_reports, app_settings
- [ ] Row Level Security no PostgreSQL para TODAS as tabelas com tenant_id
- [ ] Middleware: `SET LOCAL app.current_tenant_id = ?` em cada request (ativa RLS)
- [ ] Criar CRUD `/api/v1/tenants` (super-admin only)
- [ ] Implementar `GET /api/v1/tenants/:slug/config` (publico, retorna branding)
- [ ] Refatorar `seedAdmin` para criar tenant 'default' + admin juntos
- [ ] Validar que usuario pertence ao tenant da sessao (middleware)
- [ ] Warm cache: iterar por todos os tenants ativos

**Frontend**:
- [ ] TenantProvider: consumir `/api/v1/tenants/:slug/config` real
- [ ] Resolver tenant por subdomain OU path OU query param
- [ ] Aplicar branding do tenant (logo, cor primaria, nome)
- [ ] Modulos visiveis baseados em `enabled_modules` do tenant

**Testes**:
- [ ] Criar tenant A e B com usuarios e datasources separados
- [ ] Verificar que usuario do tenant A NAO consegue ver dados do tenant B (RLS)
- [ ] Verificar que admin do tenant A NAO consegue listar usuarios do tenant B
- [ ] Teste de SQL injection tentando bypassar RLS

**Cobertura minima**: testes de isolamento em TODAS as tabelas

---

### Sprint 3 — Desacoplar Industria (3 semanas)

**Objetivo**: Eliminar todo hardcoding de espuma/SGBR. Sistema funciona com qualquer ERP.

**Backend — Criar padrao "Connector"**:
- [ ] Interface `IndustryConnector`:
  ```typescript
  interface IndustryConnector {
    id: string                    // 'sgbr-espuma', 'bling-limpeza', 'generic'
    label: string                 // 'SGBR BI (Espumas)'
    supportedEndpoints: EndpointHint[]
    classifyProduct(row): string  // 'materia-prima', 'produto-final', etc.
    getProductTypes(): string[]   // ['Espuma', 'Aglomerado'] ou ['Detergente', 'Sabao']
    getProductCategories(): CategoryConfig[]
    getPaginationDefaults(): PaginationConfig
    normalizeRow(endpoint, row): NormalizedRow
    getCSPHosts(): string[]       // hosts para whitelist no CSP
    getSampleData(): SampleDataset // dados de demonstracao para trial
  }
  ```
- [ ] Implementar `SgbrEspumaConnector` (extrair codigo atual)
- [ ] Implementar `GenericConnector` (fallback sem classificacao)
- [ ] Registro de connectors: `ConnectorRegistry.get(tenant.connector_id)`
- [ ] Refatorar `routes/erp.ts`: endpoints usam connector do tenant
- [ ] Refatorar `routes/finance.ts`: `classifyEstoqueItem()` usa connector
- [ ] Refatorar `routes/proxy.ts`: remover branches `source.type === 'sgbr_bi'`
- [ ] CSP dinamico: whitelist baseada nos hosts do connector do tenant
- [ ] Warm cache: ler endpoints do connector do tenant
- [ ] `getSampleData()`: cada connector fornece dados de demonstracao para trials

**Frontend**:
- [ ] Renomear "Ficha Tecnica" → "Cadastro de Produtos" (generico)
- [ ] Renomear "Estoque Espuma" → categorias dinamicas do connector
- [ ] API `/api/v1/tenants/:id/modules` retorna modulos + labels do tenant
- [ ] Paginas renderizam labels/colunas baseado na config do tenant
- [ ] Schemas Zod: remover enums hardcoded, usar `z.string()` generico
- [ ] Remover `sgbr*Normalize.ts` — normalizacao via connector no backend

**Testes**:
- [ ] Tenant com connector 'sgbr-espuma': mesma funcionalidade de hoje
- [ ] Tenant com connector 'generic': telas sem terminologia de espuma
- [ ] Teste de regressao: NENHUMA tela quebra com connector generico

---

### Sprint 4 — Autenticacao SaaS e Onboarding (3 semanas)

**Objetivo**: Registro self-service, onboarding de tenant, convite de equipe.

**Backend**:
- [ ] `POST /api/v1/auth/register` — cria tenant + admin em uma transacao
  - Validacao: email unico global, slug unico, senha forte
  - Cria trial de 14 dias automaticamente
  - Envia email de boas-vindas
- [ ] `POST /api/v1/auth/invite` — admin convida usuarios para seu tenant
  - Gera token de convite (24h TTL)
  - Envia email com link de aceite
  - Verifica limite de usuarios do plano
- [ ] `POST /api/v1/auth/accept-invite` — usuario aceita convite e define senha
- [ ] `POST /api/v1/auth/forgot-password` — envia email com token de reset (1h TTL)
- [ ] `POST /api/v1/auth/reset-password` — confirma reset com token
- [ ] `POST /api/v1/auth/verify-email` — confirma email do registro
- [ ] Rate limiting por tenant (Redis-based, configuravel por plano)
- [ ] JWT com claims: `sub` (user_id), `tid` (tenant_id), `role`, `plan`

**Frontend**:
- [ ] Pagina de registro: nome empresa, segmento, email, senha
- [ ] Verificacao de email (tela "Verifique seu email")
- [ ] Wizard de onboarding (3 passos):
  1. Dados da empresa (nome, logo, segmento industrial)
  2. Conectar fonte de dados (URL, credenciais, testar conexao)
  3. Convidar equipe (emails, roles)
- [ ] Tela de convite aceito (definir nome + senha)
- [ ] Tela de forgot/reset password
- [ ] Loading state premium durante onboarding
- [ ] Tour guiado na primeira visita (react-joyride)

**Email (Nodemailer — ja usado para scheduled reports, expandir para templates HTML)**:
- [ ] Template de boas-vindas com link de verificacao
- [ ] Template de convite de equipe
- [ ] Template de reset de senha
- [ ] Template de trial expirando (3 dias antes)
- [ ] Template de trial expirado

**Testes**:
- [ ] Fluxo completo: registro → verificar email → onboarding → convidar → aceitar
- [ ] Tentativa de registro com email existente
- [ ] Tentativa de convite alem do limite do plano
- [ ] Token expirado de reset/convite

---

### Sprint 5 — Billing e Planos (2 semanas)

**Objetivo**: Cobranca automatica, planos, limites, upgrade/downgrade.

**Backend**:
- [ ] Integracao com Asaas (brasileiro, boleto + pix + cartao) OU Stripe
- [ ] Tabela `subscriptions` (schema acima)
- [ ] Webhooks de pagamento:
  - `payment_confirmed` → ativa plano
  - `payment_failed` → marca `past_due`, envia email
  - `subscription_cancelled` → agenda downgrade para Free em 7 dias
- [ ] Middleware de feature gating:
  ```typescript
  // Antes de cada request autenticado:
  // 1. Verificar billing_status do tenant
  // 2. Verificar se modulo esta em enabled_modules
  // 3. Verificar limites (max_users, max_datasources)
  // Se falhar: retorna 402 Payment Required ou 403 Forbidden
  ```
- [ ] Limites por plano enforced no backend:
  - Free: 1 user, 1 datasource, sem copilot
  - Starter: 3 users, 2 datasources, sem copilot
  - Pro: 10 users, 5 datasources, copilot basico (20 msgs/dia)
  - Enterprise: ilimitado
- [ ] Grace period: 7 dias apos falha de pagamento antes de suspender
- [ ] `GET /api/v1/billing/status` — plano atual, proxima cobranca, uso
- [ ] `POST /api/v1/billing/checkout` — gera link de pagamento
- [ ] `POST /api/v1/billing/portal` — abre portal do provedor (historico, cartao)
- [ ] `POST /api/v1/billing/change-plan` — upgrade/downgrade
- [ ] Export de dados (LGPD): `GET /api/v1/tenants/:id/export` — gera ZIP com todos os dados do tenant

**Frontend**:
- [ ] Pagina de planos (comparacao visual com toggle mensal/anual)
- [ ] Pagina de billing (status, proxima cobranca, historico, trocar plano)
- [ ] Banner de trial expirando (header do app)
- [ ] Modal de upgrade quando atinge limite ("Voce atingiu o limite de 3 usuarios")
- [ ] Modal de pagamento pendente ("Atualize seu pagamento para continuar")
- [ ] Tela de "Plano Free" com CTA de upgrade

**Testes**:
- [ ] Fluxo: trial → expirar → Free → upgrade Starter → pagar → ativo
- [ ] Fluxo: Pro → falha pagamento → past_due → grace period → suspender
- [ ] Fluxo: Enterprise → cancel → downgrade para Free em 7 dias
- [ ] Webhook replay (idempotencia)

---

### Sprint 6 — Deploy Cloud e Operacoes (2 semanas)

**Objetivo**: Sistema rodando na nuvem com monitoramento e CI/CD.

**Infra**:
- [ ] VPS (Hetzner ou DigitalOcean) ou AWS ECS com Docker
- [ ] PostgreSQL gerenciado (Supabase, Neon, ou RDS)
- [ ] Redis gerenciado (Upstash ou ElastiCache)
- [ ] Nginx reverse proxy com SSL (Let's Encrypt via Certbot)
- [ ] Dominio principal: `app.igagestao.com.br`
- [ ] Subdomains por tenant: `{slug}.igagestao.com.br`
- [ ] Wildcard SSL certificate (*.igagestao.com.br)
- [ ] Cloudflare na frente: WAF + CDN + DDoS protection
- [ ] Dados hospedados no Brasil (LGPD compliance)

**CI/CD**:
- [ ] GitHub Action: lint → tsc → test → build → deploy staging
- [ ] Deploy staging automatico em push para `develop`
- [ ] Deploy producao manual (approval) em push para `main`
- [ ] Blue-green deployment: novo container sobe, health check OK, troca o load balancer
- [ ] Rollback em 1 comando se deploy falhar
- [ ] Database migrations rodam automaticamente no deploy (com rollback script)

**Monitoramento**:
- [ ] Sentry para error tracking (source maps do frontend)
- [ ] Uptime monitoring (BetterUptime ou UptimeRobot)
- [ ] Metricas de aplicacao: response time p50/p95/p99, error rate, throughput
- [ ] Alertas: Slack ou email para erros criticos, pagamento falhado, tenant inativo 30d
- [ ] Log aggregation: stdout → Cloudwatch ou Grafana Loki
- [ ] Dashboard operacional: Grafana com metricas de todos os tenants

**Seguranca**:
- [ ] Penetration test basico (OWASP ZAP automated scan)
- [ ] Backup automatico do PostgreSQL (diario, retencao 30 dias)
- [ ] Backup testado: restore mensal verificado
- [ ] Secrets em variavel de ambiente do container (nunca em .env no servidor)
- [ ] Acesso SSH restrito por IP (apenas devs autorizados)

**Testes**:
- [ ] Stress test: 50 requests simultaneos de 10 tenants diferentes
- [ ] Failover test: matar container, verificar que outro assume
- [ ] Backup restore test: restaurar backup em staging, verificar dados

---

### Sprint 7 — Super Admin Panel (2 semanas)

**Objetivo**: Painel interno para gerenciar todos os tenants e a operacao.

**Backend**:
- [ ] Role `super_admin` (acima de admin, cross-tenant, nao pertence a nenhum tenant)
- [ ] `GET /api/v1/admin/tenants` — listar todos com metricas (usuarios, datasources, ultimo login, plano, billing status)
- [ ] `GET /api/v1/admin/tenants/:id/usage` — uso detalhado (API calls, copilot msgs, storage)
- [ ] `GET /api/v1/admin/metrics` — MRR, churn rate, tenants por plano, tenants por segmento
- [ ] `POST /api/v1/admin/tenants/:id/suspend` — suspender tenant
- [ ] `POST /api/v1/admin/tenants/:id/activate` — reativar tenant
- [ ] `POST /api/v1/admin/tenants/:id/change-plan` — alterar plano manualmente
- [ ] `POST /api/v1/admin/tenants/:id/impersonate` — gerar sessao temporaria como admin do tenant (audit logged)

**Frontend**:
- [ ] Dashboard: MRR, total tenants, ativos/trial/cancelados, grafico de crescimento
- [ ] Lista de tenants com filtros (plano, industria, billing status, ultimo login)
- [ ] Detalhe do tenant (usuarios, fontes, uso, billing, timeline de eventos)
- [ ] Acoes: suspender, reativar, impersonar, alterar plano, enviar email
- [ ] Log de impersonacao visivel no audit

---

### Sprint 8 — Novos Connectors e Marketplace (3 semanas)

**Objetivo**: Suportar ERPs alem do SGBR BI. Sistema de plugins.

**Connectors**:
- [ ] Connector Bling (API REST v3)
- [ ] Connector Tiny ERP (API REST)
- [ ] Connector Omie (API REST)
- [ ] Connector generico CSV/Excel (upload manual com mapeamento)

**Backend**:
- [ ] `GET /api/v1/connectors` — listar connectors disponiveis
- [ ] `GET /api/v1/connectors/:id/schema` — campos, endpoints, config necessaria
- [ ] Cada connector auto-registra no `ConnectorRegistry` ao iniciar
- [ ] Hot-reload de connectors (sem restart do servidor)

**Frontend**:
- [ ] Tela "Marketplace de Integracoes" — cards por ERP
- [ ] Status: ativo, disponivel, em breve
- [ ] Wizard de configuracao por connector (campos dinamicos baseados no schema)
- [ ] Documentacao inline de campos por connector
- [ ] Badge "Novo" para connectors recem-lancados

**Webhooks (Enterprise)**:
- [ ] `POST /api/v1/webhooks` — registrar URL de webhook
- [ ] Eventos: `datasource.synced`, `alert.created`, `report.generated`
- [ ] Retry com backoff exponencial (3 tentativas)
- [ ] Dashboard de webhooks (entregas, falhas, retry)

---

### Sprint 9 — Landing Page e Go-to-Market (2 semanas)

**Objetivo**: Presenca online e funil de aquisicao.

> Sprint separada (nao misturada com produto) — pode rodar em PARALELO com Sprint 6.

- [ ] Landing page Next.js + Tailwind (ver PLANO-LANDING-PAGE.md)
- [ ] Dominio igagestao.com.br configurado
- [ ] Google Analytics 4 + Hotjar
- [ ] Formulario de lead capture conectado ao CRM (Hubspot free ou Notion)
- [ ] Blog com 3 artigos SEO iniciais
- [ ] Video demo de 2 minutos
- [ ] Perfil LinkedIn da empresa
- [ ] Status page publica (BetterUptime)

---

## Cronograma Revisado

| Sprint | Duracao | Depende de | Pode rodar em paralelo |
|---|---|---|---|
| Sprint 0 — Preparacao | 1 semana | — | — |
| Sprint 1 — PostgreSQL + Redis | 2 semanas | Sprint 0 | — |
| Sprint 2 — Multi-Tenant | 2 semanas | Sprint 1 | — |
| Sprint 3 — Desacoplar Industria | 3 semanas | Sprint 2 | Sprint 9 (landing) |
| Sprint 4 — Auth + Onboarding | 3 semanas | Sprint 2 | — |
| Sprint 5 — Billing | 2 semanas | Sprint 4 | — |
| Sprint 6 — Deploy Cloud | 2 semanas | Sprint 5 | Sprint 9 (landing) |
| Sprint 7 — Super Admin | 2 semanas | Sprint 6 | Sprint 8 (connectors) |
| Sprint 8 — Connectors | 3 semanas | Sprint 3 | Sprint 7 (admin) |
| Sprint 9 — Landing + GTM | 2 semanas | — | Qualquer sprint |
| **TOTAL** | **~18 semanas** (caminho critico) | | |

### Caminho critico (sequencial obrigatorio)
```
S0 (1s) → S1 (2s) → S2 (2s) → S3 (3s) → S4 (3s) → S5 (2s) → S6 (2s)
                                                                    ↓
                                                              LANCAMENTO BETA
```

### Paralelo
```
S9 (landing) pode rodar a qualquer momento
S7 (admin) e S8 (connectors) podem rodar em paralelo apos S6
```

---

## Fases de Lancamento

**Fase Alpha — Semanas 1-10** (Sprints 0-3)
- Multi-tenant + PostgreSQL + desacoplamento
- Resultado: sistema generico rodando, testavel internamente
- Tenants: 0 (apenas dev/test)

**Fase Beta Fechada — Semanas 10-17** (Sprints 4-6)
- Auth + billing + deploy cloud
- Resultado: SaaS online com cobranca
- Tenants: 5-10 (piloto com clientes selecionados)
- Landing page online (Sprint 9 em paralelo)

**Fase Beta Aberta — Semanas 17-22** (Sprints 7-8)
- Admin panel + connectors + polish
- Resultado: produto completo
- Tenants: 10-30 (aberto para leads da landing page)

**GA (General Availability) — Semana 22+**
- Aberto ao publico
- Trial de 14 dias self-service
- Marketing ativo (Google Ads, LinkedIn, conteudo)

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
| Email (SendGrid) | Gratis | Gratis | R$ 50/mes |
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
| Tenant A sobrecarrega tenant B | Media | Alto | Rate limiting por tenant + worker queue isolada |
| Vazamento de dados entre tenants | Baixa | Critico | RLS no PostgreSQL + testes automatizados de isolamento |
| Cliente perde dados na migracao | Media | Alto | Backup antes + periodo de coexistencia 30 dias |
| Concorrente lanca antes | Media | Medio | Focar no nicho SGBR antes de generalizar |
| Custo de infra > receita | Alta (inicio) | Alto | Free tier barato, escalar infra conforme MRR |
| Groq API muda pricing/limites | Media | Medio | Abstraction layer — trocar provider sem mudar codigo |
| Deploy quebra producao | Media | Alto | Blue-green deploy + rollback em 1 comando |
| Cliente pede feature que nao existe | Alta | Baixo | Roadmap publico + votacao de features |

---

## Juridico e Compliance

- [ ] **CNPJ** — empresa prestadora de servico (MEI ou LTDA)
- [ ] **Termos de Uso** — contrato digital aceito no registro
- [ ] **Politica de Privacidade** — LGPD: base legal, direitos do titular, DPO
- [ ] **DPA (Data Processing Agreement)** — para Enterprise
- [ ] **Politica de cookies** — banner de consentimento
- [ ] **SLA** — 99% Pro, 99.5% Enterprise (com creditos em caso de violacao)
- [ ] **Politica de reembolso** — pro-rata nos primeiros 30 dias
- [ ] **Export de dados** — LGPD Art. 18: portabilidade em ate 15 dias uteis
- [ ] **Retencao de dados** — dados deletados 90 dias apos cancelamento
- [ ] **Data residency** — dados armazenados no Brasil

---

## Definition of Done — Checklist de Lancamento

### Tecnico
- [ ] Zero vulnerabilidades criticas ou altas (npm audit + OWASP ZAP)
- [ ] Testes E2E: registro → onboarding → uso → billing → cancelamento
- [ ] Isolamento de tenant testado (RLS + testes automatizados)
- [ ] Backup PostgreSQL automatico com restore testado
- [ ] Health check 200 com status de todos os servicos
- [ ] Rate limiting ativo por tenant
- [ ] SSL A+ no SSL Labs
- [ ] Headers A no SecurityHeaders.com
- [ ] Response time p95 < 2s (exceto proxy para API externa)
- [ ] Zero `console.log` em producao (logger estruturado)

### Produto
- [ ] Onboarding wizard < 10 minutos
- [ ] Billing funcionando (trial → pago → cancelamento)
- [ ] 2+ connectors (SGBR + generico no minimo)
- [ ] Documentacao com 10+ artigos de ajuda
- [ ] Video demo publicado
- [ ] Tour guiado na primeira visita

### Juridico
- [ ] CNPJ ativo
- [ ] Termos de Uso publicados e aceitos no registro
- [ ] Politica de Privacidade (LGPD)
- [ ] Cookie banner implementado

### Operacional
- [ ] Monitoramento: Sentry + uptime + alertas
- [ ] Runbook de incidentes documentado
- [ ] Canal de suporte (WhatsApp + email)
- [ ] Processo de onboarding documentado
- [ ] Playbook de vendas (para os primeiros clientes)

### Marketing
- [ ] Landing page online em igagestao.com.br
- [ ] Google Analytics configurado
- [ ] 3 artigos SEO publicados
- [ ] Perfil LinkedIn ativo
- [ ] Status page publica

---

## Decisoes Tecnicas e Trade-offs

| Decisao | Escolha | Alternativa | Justificativa |
|---|---|---|---|
| ORM | Drizzle | Prisma, Knex | Drizzle: type-safe sem code generation, migrations SQL puro, bundle menor. Prisma gera client pesado e Knex nao tem type-safety |
| Billing | Asaas | Stripe | Asaas: brasileiro, suporta boleto + pix nativamente, API simples, sem IOF em transacoes. Stripe: superior global mas taxa de 3.99% + IOF |
| Multi-tenancy DB | Shared database + RLS | Database-per-tenant, Schema-per-tenant | Shared: menor custo de infra, mais simples de manter, RLS garante isolamento. DB-per-tenant nao escala alem de 50 tenants |
| Job queue | BullMQ | Agenda.js, pg-boss | BullMQ: mais maduro, dashboard UI (Bull Board), retry/backoff nativo, Redis-based (ja temos). Agenda.js usa MongoDB, pg-boss acoplado ao Postgres |
| Cache | Redis | Memcached, in-memory Map | Redis: persistencia, pub/sub (util para invalidacao), estruturas de dados ricas, BullMQ ja exige Redis |
| Frontend framework | Manter React + Vite | Migrar para Next.js | Manter: SPA ja funciona, migrar para Next.js = rewrite desnecessario. Next.js so se precisar de SSR (landing page e separada) |
| Connector pattern | Plugin in-process | Microservicos por connector | In-process: simples, sem latencia de rede, facil de debugar. Microservicos: overengineering para <10 connectors |
| Deploy | VPS + Docker | Kubernetes, Serverless | VPS: mais barato (R$200/mes vs R$800+ K8s), suficiente para 50 tenants. K8s quando precisar de auto-scaling (100+ tenants) |
| Email | Resend | SendGrid, AWS SES | Resend: DX moderna, 3.000/mes gratis, API simples. SendGrid: mais robusto mas setup complexo |

---

## Plano de Contingencia Desktop ↔ SaaS

### Estrategia: Coexistencia por 12 meses

| Fase | Desktop (.exe) | SaaS (web) |
|---|---|---|
| **Hoje - Semana 17** | Produto principal, recebe updates | Em desenvolvimento |
| **Semana 17 - Semana 30** | Manutencao (bugfixes only) | Beta + lancamento |
| **Semana 30 - Semana 52** | Apenas seguranca critica | Produto principal |
| **Apos 1 ano** | Descontinuado (EOL anunciado 6 meses antes) | Unica versao |

### Migracoes de clientes desktop

- [ ] Script `migrate-to-cloud.ts`: exporta SQLite local → importa no PostgreSQL cloud
- [ ] O script preserva: usuarios, datasources, preferencias, historico de audit
- [ ] O script NAO migra: sessoes ativas, cache, tokens
- [ ] Periodo de coexistencia: 30 dias rodando desktop + SaaS simultaneamente
- [ ] Documentacao passo a passo para cliente migrar
- [ ] Videochamada de suporte para primeiros 10 clientes

### Versao desktop pos-SaaS

- Manter como opcao "on-premise" para Enterprise que nao aceita cloud
- Licenca perpetua: R$ 4.970 (equivalente a 10 meses do Pro)
- Inclui 1 ano de updates, sem suporte dedicado

---

## Paralelismo otimizado entre Sprints

```
Semana:  1    2    3    4    5    6    7    8    9   10   11   12   13   14   15   16   17

S0       [==]
S1            [========]
S2                       [========]
S3                                  [==============]
S4                                  [==============]     ← PARALELO com S3
S9       [========================...========================]  ← PARALELO desde o inicio
S5                                                       [========]
S6                                                                [========]
                                                                         ↓
                                                                   LANCAMENTO BETA
S7                                                                         [========]
S8                                                                         [==============]

Sprint 3 (backend connector) e Sprint 4 (auth frontend) podem rodar em paralelo
porque alteram camadas diferentes:
  - S3: routes/erp.ts, routes/finance.ts, routes/proxy.ts (backend puro)
  - S4: paginas de registro, onboarding, email (frontend + auth endpoints)
  - Unica dependencia comum: ambas precisam de Sprint 2 (multi-tenant) pronta

Com paralelismo: 15 semanas no caminho critico (em vez de 18)
```

---

## Features Novas — Roadmap pos-GA

Pesquisa de mercado: funcionalidades que competidores (Bling, Tiny, Omie, TOTVS) oferecem e o IGA ainda nao tem.

### Prioridade 1 — Quick Wins (2-3 semanas cada, alto impacto)

| # | Feature | Descricao | Valor | Plano |
|---|---|---|---|---|
| F1 | **Previsao de Demanda (IA)** | Forecast 3-6 meses usando historico de vendas + sazonalidade. Grafico de tendencia + alertas de ruptura | Reduz stockout em 30-40%, melhora planejamento de compras | Pro |
| F2 | **Portal de Fornecedores** | Area self-service para fornecedores: acompanhar pedidos, enviar NF, ver status de pagamento | Reduz 50% do tempo de procurement, melhora relacionamento | Pro |
| F3 | **Custeio por Ordem (Job Costing)** | Rastrear custo real (material + mao de obra + overhead) por ordem/lote. Lucro real por produto | Identifica ordens nao-lucrativas, justifica precificacao | Pro |
| F4 | **Dashboard de Qualidade (SPC)** | Graficos de controle estatistico, tracking de defeitos por linha/produto, limites de controle | Reduz defeitos via deteccao precoce, compliance ISO 9000 | Pro |
| F5 | **Portal do Cliente** | Clientes consultam status de pedido, NFs, entregas, abrem tickets | Reduz 30% do volume de atendimento, aumenta satisfacao | Pro |

### Prioridade 2 — Diferenciacao (3-4 semanas cada)

| # | Feature | Descricao | Valor | Plano |
|---|---|---|---|---|
| F6 | **Rastreabilidade de Lotes** | Tracking completo materia-prima → produto final. Rastreio bidirecional (forward + backward) | Recall rapido, compliance regulatorio (alimentos/farmaceutico) | Pro |
| F7 | **Agentes IA Autonomos** | Bots que auto-aprovam pedidos de baixo risco, sugerem recompras, reconciliam estoque, escalam excecoes | Reduz 40% de tarefas manuais, resposta mais rapida | Enterprise |
| F8 | **Integracao IoT / Manutencao Preditiva** | Conectar sensores de maquinas (OPC UA, MQTT), capturar OEE, prever falhas 2-4 semanas antes | Reduz downtime nao-planejado em 35-45%, estende vida util de equipamentos | Enterprise |
| F9 | **BOM (Bill of Materials) com Versionamento** | Gestao de estrutura de produto multi-nivel com historico de alteracoes e analise de impacto | Previne erros de producao por specs desatualizadas | Pro |
| F10 | **Otimizador de Programacao de Producao** | IA que otimiza sequenciamento de maquinas, alocacao de mao de obra, minimiza setup | Aumenta capacidade em 15-20%, melhora on-time delivery | Enterprise |

### Prioridade 3 — Premium / Enterprise (3-4 semanas cada)

| # | Feature | Descricao | Valor | Plano |
|---|---|---|---|---|
| F11 | **Tracking ESG / Sustentabilidade** | Rastrear emissoes CO2, residuos, consumo de energia por produto. Dashboard de sustentabilidade | Compliance ambiental, marketing verde, requisito de clientes grandes | Enterprise |
| F12 | **Workflow Builder (Low-Code)** | Interface drag-and-drop para criar fluxos de aprovacao, notificacoes, regras de negocio sem codigo | Customizacao sem dev, adaptacao rapida a mudancas de processo | Enterprise |
| F13 | **Benchmarking Anonimo** | Comparar KPIs (margem, giro de estoque, OEE) com media anonima da industria | Identifica oportunidades de melhoria, justifica investimento na plataforma | Pro |
| F14 | **WIP (Work-in-Process) em Tempo Real** | Visibilidade de estoque semi-acabado por estagio, localizacao, aging. Alertas para WIP parado | Reduz capital de giro preso, identifica gargalos | Pro |
| F15 | **Analytics Financeiro Avancado** | Multi-moeda, consolidacao multi-filial, reconciliacao intercompany, analise de variancia | Expansao internacional, simplifica contabilidade multi-entidade | Enterprise |

### Cronograma de Features pos-GA

| Mes | Features | Tema |
|---|---|---|
| Mes 1 pos-GA | F1 (Previsao IA) + F5 (Portal Cliente) | Retencao + diferenciacao |
| Mes 2 pos-GA | F3 (Job Costing) + F4 (Qualidade SPC) | Valor para industria |
| Mes 3 pos-GA | F2 (Portal Fornecedor) + F6 (Rastreabilidade) | Supply chain |
| Mes 4 pos-GA | F7 (Agentes IA) + F9 (BOM) | Automacao + engenharia |
| Mes 5 pos-GA | F10 (Scheduling) + F14 (WIP) | Producao avancada |
| Mes 6 pos-GA | F8 (IoT) + F11 (ESG) | Enterprise premium |

### Impacto no Pricing

Quando as features F1-F15 estiverem implementadas, o pricing se justifica:

| Plano | Preco atual | Preco futuro (pos-features) | Justificativa |
|---|---|---|---|
| Free | R$ 0 | R$ 0 | Funil (sem mudanca) |
| Starter | R$ 197 | R$ 297 | + Portal Cliente |
| Pro | R$ 497 | R$ 797 | + Previsao IA + Qualidade + Rastreabilidade + Fornecedor |
| Enterprise | R$ 997 | R$ 1.997 | + Agentes IA + IoT + Workflow Builder + ESG |

**Projecao de MRR com features:**
- 50 tenants x mix de planos = R$ 35.000-50.000/mes (vs R$ 20.000 sem features novas)
