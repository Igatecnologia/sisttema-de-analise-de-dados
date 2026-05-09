import { getPostgresPool, hasPostgresConfig } from '../../db/postgres.js'

/**
 * Persiste uma linha de uso do Copilot na tabela ai_usage para billing/quota
 * tracking. Apenas Postgres — em SQLite (dev) eh no-op.
 *
 * Custos sao calculados pelo proprio Node baseado em tokens reportados pelo
 * provider (futuramente vai vir do iga-ai service via webhook).
 */

export type AiUsageRecord = {
  tenantId: string
  userId: string | null
  conversationId: string | null
  provider: string
  model: string
  tokensIn: number
  tokensOut: number
  tokensCached?: number
  costUsd?: number
  latencyMs: number
  hadError: boolean
}

const RATES_USD_PER_1M_TOKENS: Record<string, { input: number; output: number; cached?: number }> = {
  // Anthropic — atualizar conforme tabela oficial
  'claude-opus-4-7': { input: 15, output: 75, cached: 1.5 },
  'claude-sonnet-4-6': { input: 3, output: 15, cached: 0.3 },
  'claude-haiku-4-5': { input: 0.8, output: 4, cached: 0.08 },
  // OpenAI
  'gpt-4o': { input: 2.5, output: 10 },
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  // Gemini
  'gemini-2.0-flash': { input: 0.075, output: 0.3 },
  // Groq — free tier nao cobra; mantemos em 0 para tracking comparativo
  'llama-3.3-70b-versatile': { input: 0, output: 0 },
}

export function estimateCostUsd(model: string, tokensIn: number, tokensOut: number, tokensCached = 0): number {
  const rate = RATES_USD_PER_1M_TOKENS[model]
  if (!rate) return 0
  const inputCost = ((tokensIn - tokensCached) / 1_000_000) * rate.input
  const cachedCost = (tokensCached / 1_000_000) * (rate.cached ?? rate.input)
  const outputCost = (tokensOut / 1_000_000) * rate.output
  return Number((inputCost + cachedCost + outputCost).toFixed(6))
}

export async function recordAiUsage(record: AiUsageRecord): Promise<void> {
  if (!hasPostgresConfig() || process.env.IGA_STORAGE_DRIVER !== 'postgres') return
  const cost = record.costUsd ?? estimateCostUsd(record.model, record.tokensIn, record.tokensOut, record.tokensCached ?? 0)
  await getPostgresPool().query(
    `INSERT INTO ai_usage
       (tenant_id, user_id, conversation_id, provider, model, tokens_in, tokens_out, tokens_cached, cost_usd, latency_ms, had_error)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [
      record.tenantId,
      record.userId,
      record.conversationId,
      record.provider,
      record.model,
      record.tokensIn,
      record.tokensOut,
      record.tokensCached ?? 0,
      cost,
      record.latencyMs,
      record.hadError,
    ],
  )
}

export type TenantUsageSummary = {
  tenantId: string
  totalCostUsd: number
  totalTokensIn: number
  totalTokensOut: number
  conversations: number
  avgLatencyMs: number
  errorRate: number
}

/**
 * Agregacao mensal por tenant — usado pelo dashboard de admin/billing.
 * Filtra desde inicio do mes corrente (UTC).
 */
export async function getTenantUsageThisMonth(tenantId: string): Promise<TenantUsageSummary | null> {
  if (!hasPostgresConfig() || process.env.IGA_STORAGE_DRIVER !== 'postgres') return null
  const result = await getPostgresPool().query<{
    total_cost_usd: string
    total_tokens_in: string
    total_tokens_out: string
    conversations: string
    avg_latency_ms: string
    error_rate: string
  }>(
    `SELECT
       COALESCE(SUM(cost_usd), 0)::text AS total_cost_usd,
       COALESCE(SUM(tokens_in), 0)::text AS total_tokens_in,
       COALESCE(SUM(tokens_out), 0)::text AS total_tokens_out,
       COALESCE(COUNT(DISTINCT conversation_id), 0)::text AS conversations,
       COALESCE(AVG(latency_ms), 0)::text AS avg_latency_ms,
       COALESCE(AVG(CASE WHEN had_error THEN 1.0 ELSE 0.0 END), 0)::text AS error_rate
     FROM ai_usage
     WHERE tenant_id = $1 AND created_at >= date_trunc('month', now())`,
    [tenantId],
  )
  const row = result.rows[0]
  if (!row) return null
  return {
    tenantId,
    totalCostUsd: Number(row.total_cost_usd),
    totalTokensIn: Number(row.total_tokens_in),
    totalTokensOut: Number(row.total_tokens_out),
    conversations: Number(row.conversations),
    avgLatencyMs: Number(row.avg_latency_ms),
    errorRate: Number(row.error_rate),
  }
}
