---
name: iga-copilot
description: Copilot IA do IGA — orchestrator com tool-calling, 18 tools, Groq+LocalProvider, plano de migração para Python. Use ao mexer em services/ai/, tools, prompts, fallback, telemetria, Zod validation, ou quando o usuário falar do "Copilot", "IA do sistema" ou "agente de IA".
---

# IGA Copilot — Referência canônica

## Arquitetura atual (TypeScript)

```
Frontend CopilotDrawer (chat UI streaming SSE)
  ↓
routes/copilot.ts → orchestrator.ts (149 linhas)
  - Loop max 4 rounds de tool-calling
  - Streaming via AsyncGenerator
  - Fallback automático Groq → LocalProvider em rate-limit/quota
  - Audit events: copilot_message_started, copilot_tool_called, copilot_response_completed, copilot_error, copilot_provider_fallback
  ↓
providerFactory.ts → Groq (default) | Local (fallback)
  - Modelo padrão: llama-3.3-70b-versatile via Groq free tier (30 rpm / 14.400 rpd)
  ↓
tools.ts (1.143 linhas) — 18 tools:
  get_overview, get_users, get_datasources, get_alerts, search_entities,
  get_scheduled_reports, get_audit_log, get_proxy_status, get_datasource_details,
  query_proxy_data, get_faturamento_mes, get_faturamento_periodo,
  get_faturamento_comparativo_mensal, set_monthly_revenue_goal,
  clear_monthly_revenue_goal, get_compras_periodo, get_producao_periodo,
  get_contas_pagar_periodo
```

## Validação Zod dos args

`services/ai/toolSchemas.ts` exporta `validateToolArgs(name, args)`. Antes do switch em `executeTool`, args malformados retornam `{ error: "Campo X: <mensagem>" }` e o modelo aprende e tenta de novo na próxima rodada.

## System prompt

`systemPrompt.ts` — 220 linhas com:
- "REGRA DE OURO: tool-first" (modelo é forçado a chamar tool antes de afirmar fato)
- Mapa explícito de intenção → tool
- Resolução de datas relativas ("ontem", "este mês", "Q3") sem perguntar confirmação
- Tradução de erro técnico → linguagem de gestor
- RBAC: tools admin-only retornam erro de acesso para non-admin
- Privacidade: emails mascarados, no-leak de IDs/endpoints

## Telemetria (logs sanitizados)

Em produção (NODE_ENV=production):
- NÃO logar prompt do usuário nem args de tool calls (podem conter dados sensíveis)
- Logar apenas: provider, tenant, user, latency, tool name, round, ok/error

Audit events em `audit_log`:
- `copilot_message_started`: { provider, userPromptLen }
- `copilot_tool_called`: { tool, round, latencyMs, ok }
- `copilot_response_completed`: { provider, rounds, toolsCalled, uniqueTools, latencyMs, hadError, exitReason }
- `copilot_error`: { provider, round, errorClass: 'rate_limit' | 'auth' | 'timeout' | 'network' | 'upstream_5xx' | 'other' }
- `copilot_provider_fallback`: { from, to }

## Plano de migração para Python (`docs/PLANO-IGA-IA.md`)

Microsserviço `iga-ai/` separado:
- FastAPI + Pydantic AI + Anthropic Claude Sonnet 4.6 (default), Haiku 4.5 (classificação)
- LangGraph para agentes complexos pós-GA
- pgvector no Postgres existente para RAG por tenant
- Voyage AI para embeddings
- Langfuse para observability
- DSPy para auto-otimização de prompts

Strangler migration em 6 fases (AI-1 a AI-6, 6 meses). NÃO bloqueia GA — gatilho é feedback de pilotos pedindo features que exigem RAG/agentes.

Comunicação Node→Python: HTTP REST interno + JWT shared secret (HS256, 5 min TTL, carrega tid/role/plan). Tools executam chamando Node REST com mesmo JWT — RLS aplicado pelo Node automaticamente.

## Quick wins prontos antes da migração

✅ Validação Zod nos tool args
✅ Audit events analytics
⏳ Eval framework simples (10-20 casos com Vitest) — pendente
⏳ Tool `forecast_revenue` simples (média móvel) — JÁ EXISTE em `routes/forecast.ts`, falta plug como tool do Copilot
⏳ Custo tracking básico em tabela `ai_usage` — pendente

## Anti-pattern

- Não logar prompt/args do usuário em produção (privacy)
- Não usar Llama para análise multi-step complexa — fallback para Local é stub fraco
- Não criar tool nova sem schema Zod em `toolSchemas.ts`
- Não chamar tools diretamente do front — sempre via orchestrator
- Não enviar histórico ilimitado pro modelo — limitar (max 50 mensagens, max 10K chars)

## Quando subir IGA-IA Python

Trigger: PostHog event `copilot_response_useful=false` >25% OU 30%+ tenants Pro pedindo features tipo "por que minha margem caiu" / "previsão com sazonalidade" / "agente que executa workflow".

Investimento: 1 dev Python full-time × 6 meses + R$ 445/mês infra (mix Haiku+Sonnet pra 50 tenants).
