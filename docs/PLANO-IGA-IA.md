# IGA IA — Plano do Agente em Python

> **Status**: documento canônico de planejamento. Migração ainda não iniciada.
> **Última atualização**: 2026-05-09
> **Decisão arquitetural**: o agente de IA do IGA Gestão será reescrito em Python como microsserviço dedicado (`iga-ai/`), substituindo o Copilot TypeScript atual via strangler pattern.

---

## 1. Por quê migrar

O Copilot atual em TypeScript (em `back-end-gest-o/src/services/ai/`) funciona, mas tem teto baixo para o que o produto precisa virar:

| Limitação atual (TS) | Custo prático |
|----------------------|---------------|
| Modelo: Llama 3.3 70B via Groq free tier | Raciocínio multi-step fraco vs. Claude Sonnet 4.6 / GPT-4o. "Por que minha margem caiu em março?" → resposta superficial |
| Sem RAG / memória de longo prazo | Cada conversa começa do zero. Copilot não aprende padrões do tenant (sazonalidade, top fornecedores, exceções) |
| Sem eval framework | Mudanças no prompt podem regredir silenciosamente. Sem teste automatizado de qualidade |
| Sem custo tracking por tenant | Não sabemos quanto cada Pro/Enterprise gasta de IA |
| Sem agentes (LangGraph) | Copilot é Q&A reativo, não executa workflows multi-step (ex: "diagnostique fonte X, sugira fix, agende relatório") |
| Ecossistema TS para AI é imaturo | LangChain JS, AI SDK Vercel são bons mas atrás do Python: LangGraph, LlamaIndex, DSPy, Pydantic AI, Langfuse, eval frameworks só existem completos em Python |

A migração **não é refactor por estética** — é pré-requisito para entregar features que justificam Pro/Enterprise:
- F1 (Forecast IA), F7 (Agentes Autônomos), F10 (Otimizador de Produção)
- INT-7 (Smart Onboarding com IA: AI-assisted mapping, self-healing connectors, diagnóstico)
- INT-6 (OCR / Document AI para NFe em PDF)

---

## 2. Princípios de design

| Princípio | Decisão |
|-----------|---------|
| **Microsserviço dedicado** | `iga-ai/` é repo/processo separado. Backend Node continua dono de auth/RLS/billing/proxy. Comunicação via HTTP REST interno + JWT shared secret |
| **Strangler pattern** | Copilot TS continua rodando em produção até cutover completo. V2 endpoint Python coexiste, gradualmente migra tools, último passo: deprecar TS |
| **Stateless onde possível** | Estado de conversa volta sempre via histórico no payload — facilita scale-out e debugging |
| **Type-safety end-to-end** | Pydantic v2 (Python) ↔ Zod (frontend) ↔ Zod (Node backend). Schemas compartilhados via JSON Schema gerado |
| **Observability first** | Cada conversa, tool call e LLM call rastreado em Langfuse. Custos por tenant agregados em Postgres |
| **Tenant isolation enforced** | Token de sessão Node → Python carrega `tenant_id`; Python só chama tools que respeitam RLS via Node REST |
| **Vendor-agnostic via abstração** | `LlmProvider` interface aceita Anthropic (default), OpenAI, Gemini, AWS Bedrock |
| **Eval-driven development** | DSPy ou Promptfoo; cada PR roda eval antes de merge — regressão de prompt é bug |
| **Custo controlado** | Cache de prompt cacheado (Anthropic prompt caching), model routing (Haiku para classificação, Sonnet para análise) |

---

## 3. Stack técnico

### Linguagem e runtime
- **Python 3.12+** (3.13 quando estável em produção)
- **uv** para package management e venv (10-100x mais rápido que pip/Poetry)
- **ruff** para lint + format (substitui black, isort, flake8, pylint)
- **mypy --strict** para type checking
- **pytest + pytest-asyncio** para testes; **httpx** como test client

### Framework HTTP
- **FastAPI** — async-native, OpenAPI auto-gen, Pydantic v2 nativo
- **uvicorn** (dev) ou **gunicorn + uvicorn workers** (prod)
- Estrutura: rotas em `iga_ai/routes/`, dependências (auth, db) em `iga_ai/deps/`

### LLM e agentes
- **Anthropic SDK Python** (default provider) — Claude Sonnet 4.6 padrão; Haiku 4.5 para classificação rápida e barata; Opus 4.7 para análises premium (Enterprise)
- **Pydantic AI** — agentes type-safe com tools tipadas, streaming nativo, integra com FastAPI
- **LangGraph** — para workflows complexos pós-GA (F7 agentes autônomos, INT-7 self-healing connectors). NÃO usar no GA — Pydantic AI é suficiente para Q&A e tool-calling simples
- **DSPy** — otimização automática de prompts pós-GA. Não bloqueia migração inicial

### RAG e memória
- **pgvector** no PostgreSQL existente — sem servico extra. Suporta até ~1M embeddings sem dor
- Embeddings: **Voyage AI voyage-3-large** (recomendado pela Anthropic) ou **text-embedding-3-large** da OpenAI como fallback
- Estratégia inicial: indexar audit_log + alerts + scheduled_reports + saved_views + faturamento_mensal (snapshot mensal) por tenant
- Recall híbrido: keyword (Postgres FTS) + vector (pgvector) + reranker (Voyage rerank-2)

### Observability e eval
- **Langfuse** (self-hosted ou cloud free tier) — traces de cada conversa, custo por tenant, latência, retry
- **DSPy** ou **Promptfoo** — eval framework com ~30-50 casos cobrindo perguntas-padrão
- **Sentry** — erros não-tratados (mesmo Sentry do backend Node)
- **PostgreSQL `ai_usage`**: tabela com `tenant_id, conversation_id, tokens_in, tokens_out, cost_usd, latency_ms, model, created_at` — base para billing/quota

### Background jobs
- **Celery + Redis** — compartilha o Redis já deployado para BullMQ. Filas separadas (`celery:iga-ai`)
- Casos de uso: indexação de RAG (após nova venda/alerta), eval framework rodando nightly, retraining de classificador (futuro)

### Auth + RBAC
- **Node → Python**: JWT compartilhado (shared secret HS256, env `IGA_AI_SHARED_SECRET`). Token carrega `sub`, `tid`, `role`, `plan`, `exp` (5 min)
- **Python → Node** (tools): chamada HTTP com mesmo JWT — Node valida e aplica RLS automaticamente

---

## 4. Arquitetura

```
┌────────────────────────────────────────────────────────────────────┐
│  Frontend React (CopilotDrawer)                                    │
│   POST /api/v1/copilot/messages   (sessão usuário, cookie httpOnly)│
└────────────────────┬───────────────────────────────────────────────┘
                     ↓
┌────────────────────────────────────────────────────────────────────┐
│  Backend Node (Express)                                            │
│   - routes/copilot.ts: valida sessão, gera JWT shared (5 min TTL)  │
│   - Roteia para AI service via HTTP interno                        │
│   - Stream de SSE de volta pro frontend                            │
└────────────────────┬───────────────────────────────────────────────┘
                     ↓ HTTP POST /chat (JWT shared)
┌────────────────────────────────────────────────────────────────────┐
│  iga-ai (Python FastAPI)                                           │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │  routes/chat.py                                             │   │
│  │    1. Valida JWT shared, extrai tenant_id, role, plan       │   │
│  │    2. Busca contexto RAG do tenant (pgvector)               │   │
│  │    3. Chama agent.run() (Pydantic AI)                       │   │
│  │    4. Streaming SSE de volta                                │   │
│  └────────────────┬────────────────────────────────────────────┘   │
│                   ↓                                                │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │  Agent (Pydantic AI)                                        │   │
│  │  - System prompt dinâmico (com contexto do tenant)          │   │
│  │  - Tools tipadas (Pydantic Models)                          │   │
│  │  - Provider: Anthropic Claude Sonnet 4.6 (default)          │   │
│  │  - Prompt caching automático (system + tools)               │   │
│  │  - Tool execution: chama Node REST com JWT shared           │   │
│  └────────────────┬────────────────────────────────────────────┘   │
│                   ↓                                                │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │  Observability                                              │   │
│  │  - Langfuse trace por conversa                              │   │
│  │  - Postgres ai_usage: tokens + custo por tenant             │   │
│  │  - Sentry para exceções                                     │   │
│  └────────────────────────────────────────────────────────────┘    │
└────────────────────┬───────────────────────────────────────────────┘
                     ↓ HTTP GET (JWT shared) — quando precisa de dado
┌────────────────────────────────────────────────────────────────────┐
│  Backend Node — endpoints já existentes                            │
│   GET /api/v1/_internal/tools/get_faturamento_mes                  │
│   GET /api/v1/_internal/tools/get_alerts                           │
│   ... (espelho dos 18 tools atuais + novas)                        │
│  RLS aplicado por tenant_id do JWT                                 │
└────────────────────────────────────────────────────────────────────┘
```

### Comunicação Node ↔ Python

#### 4.1 Node → Python (request inicial)
```http
POST https://iga-ai.internal/chat
Authorization: Bearer <JWT_SHARED>
Content-Type: application/json

{
  "user_id": "u_xxx",
  "user_name": "Maria Silva",
  "user_role": "admin",
  "tenant_id": "acme",
  "monthly_goal": 1500000,
  "history": [...últimas 20 mensagens...],
  "user_prompt": "Como está o faturamento de março?",
  "session_id": "uuid",
  "stream": true
}
```

Resposta: `text/event-stream` (SSE) com eventos `token`, `tool_call`, `tool_result`, `done`, `error`.

#### 4.2 Python → Node (chamada de tool)
```http
GET https://api.iga-gestao.com/api/v1/_internal/tools/get_faturamento_mes
  ?year=2026&month=3
Authorization: Bearer <JWT_SHARED>
X-AI-Conversation-Id: uuid
```

Node valida JWT, aplica RLS, retorna JSON. Se a tool exige role específica (ex: `get_users` só admin), JWT já carrega o role.

### JWT shared secret — formato

```json
{
  "iss": "iga-backend",
  "aud": "iga-ai",
  "sub": "u_xxx",
  "tid": "acme",
  "role": "admin",
  "plan": "pro",
  "iat": 1234567890,
  "exp": 1234568190,    // 5 min
  "jti": "uuid"          // para anti-replay opcional
}
```

Algoritmo: HS256 com `IGA_AI_SHARED_SECRET` (gerado por `openssl rand -hex 48`, mesma vida útil que `IGA_SESSION_JWT_SECRET`).

---

## 5. Estrutura do repositório `iga-ai/`

```
iga-ai/
├── pyproject.toml              # uv config + ruff + mypy + pytest
├── uv.lock
├── README.md
├── Dockerfile                  # multi-stage, image final ~150MB
├── docker-compose.yml          # dev local com pgvector + redis
├── .env.example
├── iga_ai/
│   ├── __init__.py
│   ├── main.py                 # FastAPI app entrypoint
│   ├── config.py               # Pydantic Settings (env vars)
│   ├── deps/
│   │   ├── auth.py             # JWT shared validation
│   │   ├── db.py               # asyncpg pool + pgvector
│   │   ├── llm.py              # AnthropicProvider singleton
│   │   └── observability.py    # Langfuse + Sentry init
│   ├── routes/
│   │   ├── chat.py             # POST /chat (SSE streaming)
│   │   ├── eval.py             # POST /eval/run (admin only)
│   │   └── health.py           # GET /health/live, /health/ready
│   ├── agents/
│   │   ├── copilot.py          # agente principal (Pydantic AI)
│   │   ├── prompts.py          # system prompts versionados
│   │   └── tools.py            # tool definitions chamando Node REST
│   ├── rag/
│   │   ├── indexer.py          # job que indexa entidades do tenant
│   │   ├── retriever.py        # busca híbrida (FTS + vector + rerank)
│   │   └── embeddings.py       # Voyage AI client
│   ├── tools/
│   │   ├── client.py           # cliente HTTP para Node REST
│   │   ├── faturamento.py      # tools de faturamento (5)
│   │   ├── compras.py          # tools de compras (1)
│   │   ├── producao.py         # tools de produção (1)
│   │   ├── financeiro.py       # tools financeiras (2)
│   │   ├── alerts.py           # tools de alerts (1)
│   │   ├── system.py           # get_overview, get_users, etc. (4)
│   │   ├── search.py           # search_entities, query_proxy_data (2)
│   │   ├── reports.py          # get_scheduled_reports, get_audit_log (2)
│   │   └── goals.py            # set/clear_monthly_revenue_goal (2)
│   ├── workflows/              # LangGraph (pós-GA)
│   │   └── (vazio na fase inicial)
│   └── eval/
│       ├── cases.yaml          # 30-50 casos de teste
│       ├── runner.py           # executa eval suite
│       └── metrics.py          # accuracy, tool-call precision, etc.
├── tests/
│   ├── unit/
│   ├── integration/
│   └── eval/
└── scripts/
    ├── index_tenant.py         # CLI para reindexar RAG de um tenant
    └── migrate_from_ts.py      # script de cutover (pós-AI-3)
```

---

## 6. Tools migradas + novas

### Tools migradas do Copilot TS (mantém contrato externo)

| Tool atual (TS) | Migração Python | Mudança |
|-----------------|------------------|---------|
| `get_overview` | `tools/system.py::get_overview` | Sem mudança contratual |
| `get_users` | `tools/system.py::get_users` | RBAC mantido |
| `get_datasources` | `tools/system.py::get_datasources` | Sem mudança |
| `get_datasource_details` | `tools/system.py::get_datasource_details` | Sem mudança |
| `get_alerts` | `tools/alerts.py::get_alerts` | Sem mudança |
| `get_scheduled_reports` | `tools/reports.py::get_scheduled_reports` | Sem mudança |
| `get_audit_log` | `tools/reports.py::get_audit_log` | Sem mudança |
| `search_entities` | `tools/search.py::search_entities` | Pós-RAG: combina FTS + vector |
| `query_proxy_data` | `tools/search.py::query_proxy_data` | Sem mudança |
| `get_proxy_status` | `tools/system.py::get_proxy_status` | Sem mudança |
| `get_faturamento_mes` | `tools/faturamento.py::get_faturamento_mes` | + caching server-side |
| `get_faturamento_periodo` | `tools/faturamento.py::get_faturamento_periodo` | + caching |
| `get_faturamento_comparativo_mensal` | `tools/faturamento.py::comparativo` | Sem mudança |
| `set_monthly_revenue_goal` | `tools/goals.py::set` | Sem mudança |
| `clear_monthly_revenue_goal` | `tools/goals.py::clear` | Sem mudança |
| `get_compras_periodo` | `tools/compras.py::get_compras_periodo` | Sem mudança |
| `get_producao_periodo` | `tools/producao.py::get_producao_periodo` | Sem mudança |
| `get_contas_pagar_periodo` | `tools/financeiro.py::contas_pagar` | Sem mudança |

### Tools NOVAS habilitadas pela migração

| Tool nova | O que faz | Habilita |
|-----------|-----------|----------|
| `forecast_revenue(months: int)` | Projeção de faturamento via média móvel + sazonalidade detectada | F1 |
| `forecast_stock_rupture(sku?: str)` | Dias até ruptura por SKU baseado em consumo histórico | F1, alertas inteligentes |
| `analyze_margin_change(period: str)` | Decompõe variação de margem entre períodos (preço, mix, custo) | "Por que margem caiu?" |
| `compare_year_over_year(year_a: int, year_b: int, metric: str)` | YoY com sazonalidade ajustada | Análise estratégica |
| `detect_anomalies(metric: str, period: str)` | Z-score / IQR para detectar outliers em vendas/custos | Alertas proativos |
| `recommend_action(intent: str)` | Recomendação baseada em RAG + estado atual ("o que devo fazer agora?") | Premium UX |
| `summarize_period(period: str)` | Sumário executivo gerado por LLM (não só números, narrativa) | Dashboard de chegada |
| `analyze_customer_churn(months: int)` | Clientes que pararam de comprar nos últimos N meses | F5 portal cliente, retenção |
| `analyze_supplier_dependency()` | Concentração de compras por fornecedor (risk score) | Compras estratégico |

### Tools de mutação (atualmente ausentes)

Hoje só `set/clear_monthly_revenue_goal` mutam estado. Adicionar:

| Tool nova | O que faz |
|-----------|-----------|
| `create_alert(type, severity, title, message)` | Copilot cria alerta para o tenant (ex: "encontrei 3 SKUs com ruptura próxima") |
| `schedule_report(name, type, frequency, recipients)` | Copilot cria scheduled report a partir de pedido do usuário |
| `save_view(page, name, filters)` | Copilot salva visão atual quando usuário pede |
| `mark_alert_read(id)` | Copilot fecha alerta quando usuário diz "ok, ciente" |

---

## 7. RAG por tenant

### O que indexar

| Entidade | Frequência | Granularidade |
|----------|------------|---------------|
| Faturamento mensal | mensal (job) | 1 doc por mês × tenant — campos: total, top 5 produtos, top 5 clientes, margem média, vs mês anterior |
| Alertas | tempo real (trigger) | 1 doc por alerta resolvido — campos: tipo, severidade, descrição, resolução, dias até resolução |
| Audit log de ações administrativas | tempo real | 1 doc por ação relevante (criação de tenant, mudança de plano, etc.) |
| Scheduled reports | mensal | snapshots dos relatórios gerados |
| Saved views | quando criada | views salvas pelo usuário (para sugerir reuso) |
| Notas e descrições do onboarding | uma vez | goal, segment, companySize do tenant |

### Pipeline de indexação

```
Job Celery (`celery:iga-ai`):
  1. Lê delta desde último run via Postgres LSN ou updated_at
  2. Para cada entidade nova/modificada:
     a. Gera texto canônico (template Jinja2)
     b. Calcula embedding via Voyage voyage-3-large (1024 dims)
     c. Insere/upserta em ai_documents (id, tenant_id, entity_type, content, embedding, metadata, updated_at)
  3. Schedule: a cada 15 min para alertas/audit; nightly para faturamento mensal
```

### Schema pgvector

```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE ai_documents (
  id BIGSERIAL PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,           -- 'faturamento_mes', 'alert', 'audit', etc.
  entity_id TEXT NOT NULL,             -- id da entidade original
  content TEXT NOT NULL,               -- texto canônico para RAG
  metadata JSONB NOT NULL DEFAULT '{}',
  embedding vector(1024),              -- voyage-3-large
  content_tsv tsvector GENERATED ALWAYS AS (to_tsvector('portuguese', content)) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, entity_type, entity_id)
);

CREATE INDEX idx_ai_documents_tenant ON ai_documents (tenant_id);
CREATE INDEX idx_ai_documents_embedding ON ai_documents USING hnsw (embedding vector_cosine_ops);
CREATE INDEX idx_ai_documents_tsv ON ai_documents USING gin (content_tsv);

ALTER TABLE ai_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_documents FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_ai_documents ON ai_documents
  USING (tenant_id = current_setting('app.current_tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));
```

### Recall híbrido

```python
async def retrieve(query: str, tenant_id: str, k: int = 8) -> list[Document]:
    # 1. Embedding da query
    q_emb = await voyage.embed(query, input_type='query')

    # 2. Busca paralela: vector + FTS
    vector_hits = await db.fetch_all("""
        SELECT id, content, metadata, 1 - (embedding <=> $1) AS score
        FROM ai_documents
        WHERE tenant_id = $2
        ORDER BY embedding <=> $1
        LIMIT 20
    """, q_emb, tenant_id)

    fts_hits = await db.fetch_all("""
        SELECT id, content, metadata, ts_rank_cd(content_tsv, query) AS score
        FROM ai_documents, plainto_tsquery('portuguese', $1) query
        WHERE tenant_id = $2 AND content_tsv @@ query
        ORDER BY score DESC
        LIMIT 20
    """, query, tenant_id)

    # 3. Reciprocal Rank Fusion + rerank Voyage
    fused = reciprocal_rank_fusion([vector_hits, fts_hits])
    reranked = await voyage.rerank(query, [d.content for d in fused], top_k=k)
    return reranked
```

---

## 8. Migração strangler — fases AI-1 a AI-6

### AI-1 — Setup (mês 1, 2 semanas)
- [ ] Repo `iga-ai/` criado, Docker, CI básico (ruff + mypy + pytest)
- [ ] FastAPI app com `/health/live`, `/health/ready`
- [ ] Auth: validação de JWT shared secret
- [ ] Cliente HTTP para Node (`tools/client.py`) com retry exponencial
- [ ] Endpoint `POST /chat` retornando "hello world" via Anthropic
- [ ] Deploy staging (Render Worker ou Railway)
- [ ] Backend Node: rota `POST /api/v1/copilot/v2/messages` que faz proxy para Python service (feature flag `COPILOT_USE_V2=tenant_id_csv`)
- [ ] Frontend: nenhuma mudança (continua chamando `/api/v1/copilot/messages`)

**Critério de saída**: 1 tenant interno usando V2, métrica de latência e custo coletada.

### AI-2 — Migrar tools (mês 2, 3 semanas)
- [ ] Migrar 18 tools do TS para Python — implementação chamando Node REST (não duplica lógica)
- [ ] System prompt portado, ajustado para Claude (estilo, formato)
- [ ] Pydantic models para args + return de cada tool — type-safe end-to-end
- [ ] Eval framework: 30 casos de teste (yaml) com expectativa de tool-calls
- [ ] Langfuse wired: cada conversa tem trace
- [ ] Postgres `ai_usage` tabela populando

**Critério de saída**: V2 passa eval com ≥85% de accuracy nos 30 casos. Latência p50 < 3s, p95 < 8s.

### AI-3 — Cutover (mês 3, 1 semana)
- [ ] V2 default para 50% dos tenants (feature flag por hash do tenant_id)
- [ ] Monitorar erros, latência, custo, satisfação (thumb up/down)
- [ ] Se métricas OK por 7 dias → 100%
- [ ] Deprecar `services/ai/` no Node (manter por 1 release como fallback)

**Critério de saída**: V1 (TS) desativado em produção. Apenas V2 (Python) ativo.

### AI-4 — RAG + agentes (mês 4, 4 semanas)
- [ ] pgvector schema + migration
- [ ] Indexer Celery job
- [ ] Retriever híbrido (FTS + vector + rerank)
- [ ] Tools novas: forecast_revenue, forecast_stock_rupture, analyze_margin_change
- [ ] LangGraph para agente F7 (auto-aprovação, recompras)

**Critério de saída**: F1 (Forecast IA) entregue. Eval suite expandida para 50 casos.

### AI-5 — Eval + Observability (mês 5, 2 semanas)
- [ ] DSPy ou Promptfoo configurado, rodando nightly
- [ ] Dashboard de custo por tenant (Postgres + Metabase ou Superset)
- [ ] Alertas: tenant gastando >R$ 100/mês de IA → notifica DevOps
- [ ] Cache de prompt (Anthropic prompt caching) no system prompt + tool definitions

**Critério de saída**: Custo médio por conversa < R$ 0,02 (Sonnet) ou < R$ 0,005 (Haiku). Eval >90%.

### AI-6 — Self-healing + Document AI (mês 6, 4 semanas)
- [ ] OCR / Document AI (NFe em PDF, recibos) — INT-6
- [ ] Self-healing connectors (INT-7): copilot detecta API quebrada, sugere fix
- [ ] Diagnóstico inteligente: "minha sync está lenta" → copilot investiga e responde
- [ ] AI-assisted mapping (INT-7): Claude analisa schema do source e sugere field mappings

**Critério de saída**: NPS dos copilots ≥40. Self-healing reduz tickets de suporte em 30%.

---

## 9. Custo estimado

### Por conversa (média)

| Modelo | Tokens in | Tokens out | Custo Anthropic | Custo BRL |
|--------|-----------|------------|-----------------|-----------|
| Haiku 4.5 (classificação simples) | 2.000 (cached) | 200 | $0.0008 | R$ 0,004 |
| Sonnet 4.6 (análise padrão) | 5.000 (cached) | 500 | $0.0095 | R$ 0,047 |
| Opus 4.7 (análise premium Enterprise) | 5.000 | 500 | $0.05 | R$ 0,25 |

### Estimativa por tenant/mês

| Plano | Conversas/mês | Modelo principal | Custo IA estimado |
|-------|---------------|------------------|-------------------|
| Free | 10 | Haiku | R$ 0,04 |
| Starter | 50 | Haiku + Sonnet | R$ 1,50 |
| Pro | 200 | Sonnet | R$ 9,40 |
| Enterprise | 500 | Sonnet + Opus | R$ 25 |

**Comparação atual (Groq free)**: R$ 0/tenant — mas modelo inferior. Trade-off claro: pagar R$ 9-25 por tenant Pro/Enterprise vs. perder o cliente para concorrente com IA melhor.

### Custos de infra adicional

| Item | Mensal |
|------|--------|
| Render Worker para `iga-ai` (Standard 512MB) | R$ 35 |
| Voyage AI embeddings (10M tokens/mês) | R$ 60 |
| Langfuse cloud (free tier suficiente até 50k traces) | R$ 0 |
| Anthropic API (mix de Haiku+Sonnet, 50 tenants) | ~R$ 350 |
| **Total** | **~R$ 445** |

Margem ainda positiva: R$ 445 / 50 tenants = R$ 9 por tenant — passa para o preço (Pro fica R$ 597 em vez de R$ 497, justificado por "IA premium incluso").

---

## 10. Quick wins NO Copilot TS atual (antes da migração)

Para destravar valor sem esperar a migração completa:

| Quick win | Esforço | Quando |
|-----------|---------|--------|
| ✅ Validação Zod nos args de tools | 1 dia | Sprint atual |
| ✅ PostHog events: copilot_message, tool_called, response_completed | 1 dia | Sprint atual |
| Cache de prompt no Groq (manual via system prompt curto) | 2 dias | Mês 1 |
| Eval suite mínima TypeScript (10 casos) com Vitest | 2 dias | Mês 1 |
| Tool `forecast_revenue` com média móvel simples (sem IA) | 2 dias | Mês 1 |
| Custo tracking básico: tabela `ai_usage` populada | 1 dia | Mês 1 |

Esses não atrasam a migração — são "ponte" para evitar regressão de qualidade durante a transição.

---

## 11. Riscos e mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|---------|-----------|
| Migração estourar prazo | Alta | Médio | Strangler — V1 segue funcionando até cutover; nenhum momento de "big bang" |
| Anthropic API cair | Baixa | Alto | Fallback para OpenAI/Gemini via abstração `LlmProvider` |
| Custo por tenant disparar | Média | Alto | Cache prompt + model routing + alerta >R$ 100/mês |
| Latência pior que TS+Groq | Média | Alto | Paralelizar tool calls; cache de response; medir e otimizar |
| Bug em tool causa cross-tenant leak | Baixa | Crítico | RLS em Node REST — Python NUNCA bypassa; eval suite testa isolamento |
| Regressão de qualidade do prompt | Alta | Médio | Eval framework rodando em CI; PR não merge sem ≥90% accuracy |
| Bibliotecas Python para LLM mudam rápido | Alta | Baixo | Pinned versions em `pyproject.toml`; dependabot semanal |
| Time não conhece Python suficiente | Média | Alto | OPS-1: contratar 1 dev Python sênior OU treinar dev TS atual |

---

## 12. Decisão de seguir ou pausar

A migração **NÃO bloqueia** o GA público. O Copilot TS atual + quick wins é "bom o suficiente" para Beta Fechada e os primeiros 6 meses pós-GA.

**Gatilho para iniciar**: quando 30%+ dos tenants Pro pedirem features que exigem RAG ou agentes (forecast complexo, análise multi-step, "por que X aconteceu"). Sinal: tickets de suporte com "perguntei ao Copilot e ele não soube responder".

**Indicador de monitoramento**: PostHog event `copilot_response_useful=false` com taxa >25%.

**Quem decide ir**: produto + eng. Custo previsto: 1 dev Python full-time × 6 meses + R$ 445/mês infra adicional.

---

## 13. Apêndice — Comparação com concorrentes

| Player | Modelo | Tools | RAG | Agentes | Eval | Status IGA hoje (TS) | Status IGA pós-migração (Python) |
|--------|--------|-------|-----|---------|------|----------------------|----------------------------------|
| Conta Azul | — | 0 | ❌ | ❌ | ❌ | Já melhor | Muito melhor |
| Bling Inteligência | GPT-3.5 | poucos | ❌ | ❌ | ❌ | Empate | Muito melhor |
| Power BI Copilot | GPT-4 + Fabric | nativo | ✅ | parcial | ? | Atrás | Empate |
| Tableau Pulse | custom | nativo | ✅ | ✅ | ✅ | Muito atrás | Empate |
| Hex Notebooks | GPT-4 + RAG | rich | ✅ | ✅ | ✅ | Muito atrás | Empate (em Q&A; Hex tem code generation) |

**Veredito**: pós-migração, IGA IA fica em paridade com líderes globais para o caso de uso "BI conversacional B2B SMB", e claramente acima de qualquer concorrente brasileiro.

---

## 14. Referências

- Anthropic Claude Sonnet 4.6 docs: https://docs.anthropic.com (verificar via Context7 antes de implementar)
- Pydantic AI: https://ai.pydantic.dev (verificar via Context7)
- LangGraph: https://langchain-ai.github.io/langgraph/
- pgvector: https://github.com/pgvector/pgvector
- Voyage AI: https://docs.voyageai.com
- Langfuse: https://langfuse.com
- DSPy: https://dspy.ai
- uv: https://docs.astral.sh/uv/
- ruff: https://docs.astral.sh/ruff/

- deixar o agente para usar qualquer api de ia poor ex openia,gemini etc 

> **Convenção**: ao iniciar a migração (AI-1), criar branch `feat/iga-ai-foundation`, abrir PR draft para acumular trabalho, e revisar este documento conforme decisões mudarem.
