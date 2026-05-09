# iga-ai — IGA Gestao IA Microservice

Microservico Python (FastAPI) que substitui o Copilot TypeScript do
backend Node via strangler pattern. **Provider default: OpenAI**
(gpt-4o-mini para Free/Pro, gpt-4o para Enterprise). Anthropic Claude
disponivel como fallback configurando `LLM_PROVIDER=anthropic`.

Implementa as fases AI-1 e AI-2 do `docs/PLANO-IGA-IA.md`. Scaffold pronto
para AI-4 (RAG com pgvector + Voyage) e AI-5 (eval + cost tracking).

## Setup local

```bash
# Pre-requisito: Python 3.12+, uv (https://docs.astral.sh/uv/)
cd iga-ai
cp .env.example .env
# Preencha OPENAI_API_KEY (sk-proj-...) e IGA_AI_SHARED_SECRET (32+ bytes random)
# Opcional: LLM_PROVIDER=anthropic + ANTHROPIC_API_KEY para usar Claude

uv venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\Activate.ps1
uv pip install -e ".[dev]"

# Rodar
uv run uvicorn iga_ai.main:app --reload --port 4000
```

## Como o backend Node ativa o V2

No backend Node (`back-end-gest-o`), setar:

```bash
# .env
IGA_AI_BASE_URL=http://localhost:4000
IGA_AI_SHARED_SECRET=<mesmo-valor-do-iga-ai>
COPILOT_USE_V2_TENANTS=tenant_id_1,tenant_id_2  # ou COPILOT_USE_V2=*
```

Quando o tenant esta na lista, `POST /api/v1/copilot/chat` faz proxy para
o iga-ai em vez de rodar o orchestrator TS local.

## Fluxo

```
Frontend → Node /api/v1/copilot/chat
            ↓ (se tenant em COPILOT_USE_V2_*)
            Node assina JWT shared (HS256, aud=iga-ai, exp=5min)
            ↓ POST http://iga-ai/chat
            iga-ai valida JWT, monta system prompt, chama Anthropic
            ↓ tool_use blocks
            iga-ai POST http://node/api/v1/_internal/tools/{name}
                  com mesmo JWT shared
            Node valida JWT, executa tool com RLS aplicado, retorna JSON
            ↓ tool_result block
            iga-ai continua streaming SSE
            ← Node re-emite eventos para o frontend
```

## Estrutura

```
iga-ai/
├── pyproject.toml          # uv + ruff + mypy + pytest
├── Dockerfile              # multi-stage, ~200MB
├── docker-compose.yml      # iga-ai + pgvector
├── .env.example
├── iga_ai/
│   ├── main.py             # FastAPI app
│   ├── config.py           # Pydantic Settings
│   ├── deps/
│   │   ├── auth.py         # JWT shared validation
│   │   ├── db.py           # asyncpg pool + tenant RLS
│   │   ├── llm.py          # AnthropicProvider singleton
│   │   └── observability.py # Sentry + structlog
│   ├── routes/
│   │   ├── chat.py         # POST /chat (SSE)
│   │   └── health.py       # GET /health/{live,ready}
│   ├── agents/
│   │   ├── copilot.py      # Agent loop com tool calling
│   │   ├── prompts.py      # System prompts versionados
│   │   └── tools.py        # 18 tool definitions (Anthropic schema)
│   ├── tools/
│   │   └── client.py       # NodeClient HTTP (httpx + retry)
│   ├── rag/                # AI-4 scaffold
│   │   ├── embeddings.py   # Voyage client
│   │   ├── indexer.py      # popula ai_documents
│   │   └── retriever.py    # FTS + vector + rerank hibrido
│   ├── eval/               # AI-5 scaffold
│   │   ├── cases.yaml      # 30 casos de teste
│   │   └── runner.py       # roda eval suite
│   └── workflows/          # AI-6 (vazio na fase inicial)
└── tests/
    └── (pytest)
```

## Comandos uteis

```bash
# Lint + format
uv run ruff check iga_ai tests
uv run ruff format iga_ai tests

# Type check
uv run mypy iga_ai

# Testes
uv run pytest -v

# Eval suite (precisa ANTHROPIC_API_KEY)
uv run python -m iga_ai.eval.runner

# Dev local com docker-compose (inclui pgvector)
docker compose up --build
```

## Status do plano (PLANO-IGA-IA.md)

- ✅ AI-1 Setup: FastAPI, JWT shared, /health, /chat com Anthropic, Node proxy
- ✅ AI-2 Migrar tools: 18 tools como definitions, Node REST endpoints `/api/v1/_internal/tools/*`, eval cases.yaml, ai_usage table, cost tracking
- ⏳ AI-3 Cutover: precisa de PRODUCAO + feature flag por tenant + monitoramento 7d (operacional)
- ✅ AI-4 RAG scaffold: pgvector schema (migration 016), embeddings.py + retriever.py + indexer.py prontos. Falta rodar com VOYAGE_API_KEY real e popular ai_documents
- ✅ AI-5 Eval scaffold: cases.yaml (30 casos), runner.py funcional, ai_usage tracking + estimateCostUsd no Node
- ⏳ AI-6 Self-healing + Document AI: precisa de OCR provider + connectors reais (operacional)

## Producao

Deploy recomendado: Render Worker, Railway, ou Fly.io. Stack Python eh leve
(~200MB). Escalonamento horizontal via container count — nada de estado em
memoria (todo contexto vem do JWT + RAG no Postgres).

Variaveis obrigatorias em prod:
- `OPENAI_API_KEY` (default) — ou `ANTHROPIC_API_KEY` se `LLM_PROVIDER=anthropic`
- `IGA_AI_SHARED_SECRET` (matching backend Node)
- `NODE_BACKEND_URL`
- `DATABASE_URL` (mesmo Postgres do backend Node, com pgvector instalado)

Opcionais mas recomendadas:
- `VOYAGE_API_KEY` (RAG)
- `SENTRY_DSN`
- `LANGFUSE_PUBLIC_KEY` + `LANGFUSE_SECRET_KEY`

## Custos esperados (AI-5)

OpenAI gpt-4o-mini (default) — preco bem inferior a Anthropic:

| Plano cliente | Modelo | Conv/mes | Custo IA estimado |
|---------------|--------|----------|-------------------|
| Free | gpt-4o-mini | 10 | R$ 0,02 |
| Pro | gpt-4o-mini | 200 | R$ 0,40 |
| Enterprise | gpt-4o | 500 | R$ 10 |

Margem confortavel mesmo no plano Pro (R$ 199/mes).

Comparativo Anthropic Claude (Sonnet 4.6):
- Free Haiku R$ 0,04 / Pro Sonnet R$ 9,40 / Enterprise Opus R$ 25.

Para trocar provider: `LLM_PROVIDER=anthropic` no .env.
