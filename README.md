<div align="center">

<img src="apps/landing/public/iga-logo.png" alt="IGA Gestão" width="120" />

# IGA Gestão

**SaaS multi-tenant de Business Intelligence para indústria, comércio, serviços e distribuição.**

Conecta a ERPs via proxy de API, entrega dashboards em tempo real e responde perguntas em linguagem natural com IA Copilot.

[![CI](https://img.shields.io/github/actions/workflow/status/Maykesantos98/gest-o-Analisededados/ci.yml?branch=master&label=CI&logo=github&style=flat-square)](https://github.com/Maykesantos98/gest-o-Analisededados/actions/workflows/ci.yml)
[![Security](https://img.shields.io/github/actions/workflow/status/Maykesantos98/gest-o-Analisededados/security.yml?branch=master&label=security&logo=github&style=flat-square)](https://github.com/Maykesantos98/gest-o-Analisededados/actions/workflows/security.yml)
[![CodeQL](https://img.shields.io/github/actions/workflow/status/Maykesantos98/gest-o-Analisededados/codeql.yml?branch=master&label=CodeQL&logo=github&style=flat-square)](https://github.com/Maykesantos98/gest-o-Analisededados/actions/workflows/codeql.yml)
[![Node](https://img.shields.io/badge/node-22%20LTS-43853d?logo=node.js&logoColor=white&style=flat-square)](.nvmrc)
[![License](https://img.shields.io/badge/license-Proprietary-1f2937?style=flat-square)](#-licença)

[**Visão geral**](#-visão-geral) · [**Stack**](#-stack) · [**Quick start**](#-quick-start) · [**Arquitetura**](#-arquitetura) · [**Comandos**](#-comandos) · [**Deploy**](#-deploy)

</div>

---

## ✨ Visão geral

IGA Gestão é uma plataforma multi-tenant que **substitui planilhas** e dashboards genéricos de ERP por uma camada moderna de BI operacional.

| | |
|--|--|
| **🏭 Multi-segmento** | 4 perfis de negócio (indústria, comércio, serviços, distribuição) com módulos, conectores e templates pré-configurados. |
| **🔌 Conectores plugáveis** | SGBR Espuma, IGA Custom API, Bling, Tiny, Omie, CSV upload — cada cliente escolhe o que conecta. |
| **🤖 Copilot IA** | Chat com tool-calling, multi-provider (OpenAI / Anthropic / Gemini / Groq / OpenRouter / Ollama). RAG via pgvector. |
| **🔐 Multi-tenant real** | Postgres com RLS, RBAC granular (19 permissões), MFA/TOTP, API keys com 4 escopos, audit log com hash chain. |
| **💳 Billing pronto** | Stripe checkout + customer portal + webhook validado. Trial 14 dias com extensão pelo super-admin. |
| **📊 Frontend rápido** | React 19 + AntD v6 + TanStack Query, lazy routing, virtual scrolling, code splitting agressivo. |

> **Estado atual:** SaaS multi-tenant em produção. Beta Fechada gerenciada manualmente pelo super-admin via `/beta`.

---

## 🧱 Stack

<table>
<tr>
<td valign="top" width="50%">

### Backend
- **Runtime** — Node.js 22 + TypeScript
- **Framework** — Express 5
- **Banco** — Postgres com RLS (prod) ou SQLite (dev)
- **Auth** — JWT cookie httpOnly + CSRF + Argon2id
- **Filas** — BullMQ (Redis) com fallback `setInterval`
- **Validação** — Zod
- **Email** — Nodemailer

### Backend AI (`services/ai`)
- **Framework** — FastAPI + uvicorn
- **LLM** — OpenAI (default) / Anthropic / multi-provider
- **RAG** — Postgres + pgvector + tsvector híbrido
- **Auth** — JWT shared secret HS256 (5 min)

</td>
<td valign="top" width="50%">

### Frontend (`apps/web`)
- **Framework** — React 19 + Vite 8
- **UI** — Ant Design v6 + Lucide icons
- **State** — TanStack Query v5 + Zustand pontual
- **Routing** — React Router v7 (lazy + permission-based)
- **Charts** — Recharts
- **Animação** — Framer Motion
- **Tabelas** — TanStack Virtual
- **Tema** — Dark/light com tokens CSS

### Super Admin (`apps/admin`)
- **Framework** — Next.js 15 (App Router)
- **UI** — Ant Design v6 + Tailwind 4 + Lucide
- **Cross-tenant** — `/beta`, `/tenants`, `/users`, `/ai-usage`

### Landing (`apps/landing`)
- **Framework** — Next.js 15 + Tailwind 4
- **Conteúdo** — Editorial light com 14 screenshots reais

</td>
</tr>
</table>

---

## 🗂 Arquitetura

```
sistema-de-gestao/
├── apps/
│   ├── web/                # React 19 + Vite + AntD v6 (cliente final)
│   ├── admin/              # Next.js 15 (super admin cross-tenant)
│   └── landing/            # Next.js 15 + Tailwind 4 (site institucional)
├── services/
│   ├── api/                # Express + TypeScript + Postgres + Redis
│   │   └── src/
│   │       ├── routes/     # auth, proxy, erp, finance, copilot, super-admin...
│   │       ├── connectors/ # 7 connectors (sgbr, bling, tiny, omie, csv, custom)
│   │       ├── db/         # SQLite (dev) + Postgres migrations + RLS
│   │       └── services/   # ai/, jobs/, billing/, audit/, crypto
│   └── ai/                 # Python FastAPI (Copilot V2 + RAG)
├── tests/load/             # k6 smoke + load
├── docs/                   # PLANO-IGA-IA, DEPLOY-TODAY, beta/, compliance/
├── .github/workflows/      # CI, CodeQL, security, lighthouse, db-backup
├── docker-compose.yml      # Stack completo (postgres+pgvector, redis, backend, web, admin, landing, worker)
└── render.yaml             # Deploy Render
```

### Fluxo de dados

```
┌─────────────────┐    proxy     ┌──────────────────┐   render
│  ERP do cliente │◄────────────►│   services/api   │◄──────────┐
└─────────────────┘  REST/JWT    │  (Express + RLS) │           │
                                 └────────┬─────────┘   ┌───────▼────────┐
                                          │             │   apps/web     │
                                ┌─────────┴─────────┐   │  (React + AntD)│
                                │ Postgres+pgvector │   └────────────────┘
                                │     + Redis       │   ┌────────────────┐
                                │                   │◄──┤   apps/admin   │
                                └─────────▲─────────┘   │ (super-admin)  │
                                          │             └────────────────┘
                                ┌─────────┴─────────┐
                                │   services/ai     │
                                │ (FastAPI + LLMs)  │
                                └───────────────────┘
```

### Segurança

| Camada | Implementação |
|--|--|
| **Sessão** | JWT em cookie `httpOnly` + Secure + SameSite=Strict; CSRF via `X-XSRF-TOKEN` |
| **Senhas** | Argon2id; HIBP pwned-password check; account lockout |
| **MFA** | TOTP RFC 6238 + backup codes (8 hex) |
| **API Keys** | SHA-256 timing-safe + prefix `iga_live_` + 4 escopos |
| **Multi-tenant** | Postgres RLS `current_setting('app.current_tenant_id')` em 100% das tabelas tenant |
| **Audit** | Hash chain SHA-256 (cada evento referencia hash do anterior) |
| **At rest** | AES-256-GCM para credenciais sensíveis (`auth_credentials_encrypted`) |
| **CI** | CodeQL + npm audit + Snyk (security workflow) |

---

## 🚀 Quick start

### Pré-requisitos

- **Node.js 22 LTS** — recomendado via [nvm](https://github.com/nvm-sh/nvm) (`.nvmrc` presente)
- **Docker** + Docker Compose
- **Python 3.12+** com [uv](https://docs.astral.sh/uv/) — opcional, só para `services/ai`

### Setup em 60 segundos

```bash
git clone https://github.com/Maykesantos98/gest-o-Analisededados.git
cd gest-o-Analisededados
npm install                          # root + workspaces (Turbo)

# Stack completo via Docker (postgres + redis + backend + web + admin + landing + worker)
npm run dev

# Acesse:
#   http://localhost:5173    → cliente final (apps/web)
#   http://localhost:3003    → super admin (apps/admin)
#   http://localhost:3002    → landing page
#   http://localhost:3000    → backend API
```

### Modo nativo (sem Docker)

```bash
# Terminal 1 — backend
npm --workspace services/api run dev          # :3000

# Terminal 2 — cliente final
npm --workspace apps/web run dev              # :5173

# Terminal 3 — super admin
npm --workspace apps/admin run dev            # :3003
```

### Com Copilot V2 (Python service)

```bash
cd services/ai
cp .env.example .env                          # preencha OPENAI_API_KEY + IGA_AI_SHARED_SECRET
uv venv .venv && source .venv/bin/activate
uv pip install -e ".[dev]"
uv run uvicorn iga_ai.main:app --reload --port 4000

# Backend usa V2 quando COPILOT_USE_V2_TENANTS estiver setado
```

Ou via Docker com profile `ai`:

```bash
npm run dev:ai
```

### Login padrão (dev)

```
email:  admin@iga.com
senha:  IgaGestao@2026!
```

> ⚠️ Em produção, defina `ADMIN_DEFAULT_EMAIL` e `ADMIN_DEFAULT_PASSWORD` no ambiente. Veja [`services/api/.env.example`](services/api/.env.example).

---

## 🛠 Comandos

```bash
# Build & quality
npm run build              # build de todos workspaces (Turbo)
npm run test               # tests unitários (vitest)
npm run check              # lint + tsc em backend e frontend
npm run test:e2e           # Playwright (apps/web)
npm run test:load          # k6 smoke (precisa k6 instalado)

# Banco
npm run db:migrate:pg      # aplica migrations Postgres

# Smoke do backend (34 endpoints)
cd apps/web && npx tsx tests/backend-smoke.ts

# Audit visual completo (43 rotas com screenshots)
cd apps/web && npx tsx tests/webapp-audit.ts
```

---

## 🌍 Variáveis de ambiente

### Backend (obrigatórias em produção)

| Variável | Descrição |
|--|--|
| `NODE_ENV` | `production` |
| `IGA_SECRETS_KEY` | Base64 32 bytes — criptografia at rest |
| `IGA_SESSION_JWT_SECRET` | 32+ bytes — assinatura de sessão |
| `DATABASE_URL` | `postgresql://...` |
| `IGA_STORAGE_DRIVER` | `postgres` |
| `REDIS_URL` | `redis://...` |
| `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` | Billing |
| `STRIPE_PRICE_PRO` + `STRIPE_PRICE_ENTERPRISE` | Preços Stripe |
| `SUPER_ADMIN_EMAILS` | CSV de emails com acesso ao `apps/admin` |
| `SMTP_HOST` / `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM` | Email transacional |

### Frontend

```env
VITE_API_BASE_URL=http://localhost:3000
```

Lista completa em [`services/api/.env.example`](services/api/.env.example).

---

## 🚢 Deploy

Produção atual:

| Componente | Provider |
|--|--|
| Backend (`services/api`) | **Render** |
| Frontend (`apps/web`) | **Vercel** ou servido pelo Express |
| Super admin (`apps/admin`) | **Vercel** |
| Landing (`apps/landing`) | **Vercel** |
| Postgres + pgvector | **Supabase** |
| Redis | **Upstash** |

Runbook completo: **[`docs/DEPLOY-TODAY.md`](docs/DEPLOY-TODAY.md)** (deploy 1-2h em Beta Fechada).

---

## 🧪 Cobertura de testes

| Suite | Quantidade |
|--|--|
| Unitários backend (vitest) | **76 testes** em 11 arquivos |
| Unitários frontend (vitest) | **34 testes** em 11 arquivos |
| E2E Playwright | **5 specs** (a11y, bi-reports, ops-admin, rbac, smoke) |
| Smoke backend (HTTP) | **34 endpoints**, 97% green |
| Audit visual (Playwright) | **43 rotas** com screenshots automáticos |
| Total unitário | **110 testes** |

---

## 📚 Documentação

| Arquivo | O que tem |
|--|--|
| [`CLAUDE.md`](CLAUDE.md) | Guia de contexto para agentes IA (arquitetura, padrões, gotchas) |
| [`CONTRIBUTING.md`](CONTRIBUTING.md) | Como contribuir |
| [`docs/PLANO-IGA-IA.md`](docs/PLANO-IGA-IA.md) | Migração do Copilot para Python (AI-1 a AI-6) |
| [`docs/DEPLOY-TODAY.md`](docs/DEPLOY-TODAY.md) | Runbook 1-2h Beta Fechada |
| [`docs/beta/`](docs/beta/) | Onboarding, emails, runbook operacional |
| [`docs/compliance/`](docs/compliance/) | DPIA, RoPA, DPA template (LGPD) |
| [`SECURITY.md`](SECURITY.md) | Disclosure responsável |

---

## 🛣 Roadmap pós-GA

### Código

- **INT-1** Common Industrial Model — Zod schemas comuns + transformation library
- **INT-2** Multi-protocol/auth — OAuth2 PKCE, Basic, header, cookie, retry/backoff
- **INT-3** Sync Engine v2 — incremental sync, watermarks, dead-letter queue
- **INT-4** Mapping Studio — UI visual para mapping field-by-field
- **INT-5** Write-back — enviar dados de volta ao ERP (Enterprise)
- **INT-6** Universal Data Ingestion — file uploads + CSV drag-drop
- **INT-7** Smart Onboarding com IA — detectar schema do ERP automaticamente

### Operacional / pago

- DPIA + DPA + Termos com advogado
- Pentest externo (bloqueador GA)
- Cloudflare WAF Pro + DAST managed + SSO Enterprise (WorkOS)

---

## 🔒 Segurança

Vulnerabilidades: ver [`SECURITY.md`](SECURITY.md). Reportar via **security@igagestao.com.br**.

Severidade de incidentes:

| Nível | Exemplo | Resposta |
|--|--|--|
| **SEV-0** | Vazamento PII / downtime total | 15 min · ANPD em 48h (LGPD Art.48) · público em 7d |
| **SEV-1** | RCE / SSRF / credential stuffing | 30 min · cliente afetado em 24h |
| **SEV-2** | Brecha contida / audit chain quebrada | 2h · equipe interna |
| **SEV-3** | Bug pontual | 24h · ticket |

---

## 📜 Licença

**Proprietary** — Iga Tecnologia. Todos os direitos reservados.

---

<div align="center">

Feito com ❤️ por **[Iga Tecnologia](https://igagestao.com.br)** · Powered by Claude Code

</div>
