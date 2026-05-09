# IGA Gestao

> SaaS multi-tenant de business intelligence que conecta a ERPs via proxy de API e exibe dashboards de produção, estoque, financeiro, vendas e compras. Inclui Copilot IA com tool-calling.

[![CI](https://github.com/Igatecnologia/iga-gestao/actions/workflows/ci.yml/badge.svg)](https://github.com/Igatecnologia/iga-gestao/actions/workflows/ci.yml)
[![Security](https://github.com/Igatecnologia/iga-gestao/actions/workflows/security.yml/badge.svg)](https://github.com/Igatecnologia/iga-gestao/actions/workflows/security.yml)
[![CodeQL](https://github.com/Igatecnologia/iga-gestao/actions/workflows/codeql.yml/badge.svg)](https://github.com/Igatecnologia/iga-gestao/actions/workflows/codeql.yml)

## Stack

- **Backend (`services/api`)** — Express 5 + TypeScript + Postgres (RLS) + Redis + BullMQ
- **Frontend (`apps/web`)** — React 19 + Vite + Ant Design v6 + TanStack Query v5
- **AI Service (`services/ai`)** — FastAPI + OpenAI (default) ou Anthropic Claude + pgvector RAG (scaffold)
- **Landing (`apps/landing`)** — Next.js 15 + Tailwind 4
- **Super Admin (`apps/admin`)** — App separado para operação cross-tenant
- **Tooling** — Turborepo + npm workspaces + Docker + uv (Python)

## Estrutura

```
.
├── apps/
│   ├── web/              # React 19 + Vite + Ant Design
│   ├── landing/          # Next.js 15 (site institucional)
│   └── admin/            # Super admin (cross-tenant)
├── services/
│   ├── api/              # Express + TypeScript + Postgres
│   └── ai/               # Python FastAPI (Copilot V2)
├── tests/
│   └── load/             # k6 smoke + load tests
├── docs/                 # Plano IGA-IA + DEPLOY-TODAY + beta + compliance
└── .github/workflows/    # ci, codeql, security, lighthouse, db-backup, iga-ai
```

## Quick start

### Pre-requisitos
- Node.js 22+ ([`.nvmrc`](.nvmrc))
- Docker + Docker Compose
- Python 3.12+ ([uv](https://docs.astral.sh/uv/)) — opcional para `services/ai`

### Setup

```bash
git clone https://github.com/Igatecnologia/iga-gestao.git
cd iga-gestao
npm install                      # instala root + workspaces (turbo)

# Stack completo via Docker (postgres + redis + backend + frontend + worker)
npm run dev

# Ou apenas backend + frontend (sem Docker)
npm --workspace services/api run dev   # backend :3000
npm --workspace apps/web run dev       # frontend :5173
```

### Com IA Copilot V2 (Python service)

```bash
cd services/ai
cp .env.example .env             # preencha OPENAI_API_KEY + IGA_AI_SHARED_SECRET
uv venv .venv && source .venv/bin/activate
uv pip install -e ".[dev]"
uv run uvicorn iga_ai.main:app --reload --port 4000

# Em outro terminal — backend usa V2 quando COPILOT_USE_V2_TENANTS estiver setado
```

Ou via Docker compose com profile `ai`:
```bash
npm run dev:ai
```

## Comandos comuns

```bash
npm run build          # build de todos workspaces (turbo)
npm run test           # tests de todos workspaces
npm run check          # lint + tsc
npm run test:e2e       # Playwright (apps/web)
npm run test:load      # k6 smoke (precisa k6 instalado)
npm run db:migrate:pg  # roda migrations Postgres
```

## Deploy

Producao roda no Render (backend) + Vercel (frontend) + Supabase (Postgres) + Upstash (Redis).
Ver [`docs/DEPLOY-TODAY.md`](docs/DEPLOY-TODAY.md) para runbook de Beta Fechada.

## Documentacao

- [`CLAUDE.md`](CLAUDE.md) — Guia de contexto para agentes IA
- [`CONTRIBUTING.md`](CONTRIBUTING.md) — Como contribuir
- [`docs/PLANO-IGA-IA.md`](docs/PLANO-IGA-IA.md) — Plano de migracao do Copilot para Python
- [`docs/DEPLOY-TODAY.md`](docs/DEPLOY-TODAY.md) — Runbook de deploy
- [`docs/beta/`](docs/beta/) — Onboarding cliente, emails, runbook operacional
- [`docs/compliance/`](docs/compliance/) — DPIA, RoPA, DPA template (LGPD)

## Seguranca

Vulnerabilidades: ver [SECURITY.md](SECURITY.md). Reportar via security@igagestao.com.br.

## Licenca

Proprietary — Iga Tecnologia.
