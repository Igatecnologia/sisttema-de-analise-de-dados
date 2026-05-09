import { z } from 'zod'

/**
 * Schemas Zod para validação dos `args` que o LLM passa em cada tool call.
 *
 * Por que existe: modelos (Llama em particular) ocasionalmente passam args
 * malformados — string onde espera number, campo errado, enum inválido. Sem
 * validação, o erro só aparece em runtime na query/proxy, com mensagem
 * técnica que vaza para o usuário.
 *
 * Com Zod, falhamos cedo com mensagem em PT-BR que o modelo entende e pode
 * usar para corrigir na próxima rodada de tool call.
 */

const dateBR = z
  .string()
  .regex(/^\d{4}[.-]\d{2}[.-]\d{2}$/, 'Data deve estar no formato YYYY-MM-DD ou YYYY.MM.DD')

const limit = z.number().int().min(1).max(100).optional()
const boolish = z.union([z.boolean(), z.literal('true'), z.literal('false'), z.literal(0), z.literal(1)]).optional()

export const TOOL_SCHEMAS = {
  get_overview: z.object({}).strict(),

  get_users: z
    .object({
      limit,
      onlyActive: boolish,
    })
    .strict(),

  get_datasources: z
    .object({
      limit,
      onlyActive: boolish,
    })
    .strict(),

  get_alerts: z
    .object({
      limit,
      severity: z.enum(['info', 'warning', 'error']).optional(),
      onlyUnread: boolish,
    })
    .strict(),

  search_entities: z
    .object({
      query: z.string().min(1).max(200),
    })
    .strict(),

  get_scheduled_reports: z
    .object({
      limit,
      onlyActive: boolish,
    })
    .strict(),

  get_audit_log: z
    .object({
      action: z.string().min(1).max(80).optional(),
      resource: z.string().min(1).max(80).optional(),
      limit,
    })
    .strict(),

  get_proxy_status: z.object({}).strict(),

  get_datasource_details: z
    .object({
      id: z.string().min(1).max(64).optional(),
      name: z.string().min(1).max(200).optional(),
    })
    .strict()
    .refine((d) => d.id || d.name, { message: 'Informe id ou name do datasource' }),

  query_proxy_data: z
    .object({
      dsId: z.string().min(1).max(64),
      dtDe: dateBR.optional(),
      dtAte: dateBR.optional(),
    })
    .strict(),

  get_faturamento_mes: z
    .object({
      year: z.number().int().min(2000).max(2100),
      month: z.number().int().min(1).max(12),
      includeNfe: boolish,
    })
    .strict(),

  get_faturamento_periodo: z
    .object({
      dtDe: dateBR,
      dtAte: dateBR,
      includeNfe: boolish,
    })
    .strict(),

  get_faturamento_comparativo_mensal: z
    .object({
      year: z.number().int().min(2000).max(2100),
      month: z.number().int().min(1).max(12),
      includeNfe: boolish,
    })
    .strict(),

  set_monthly_revenue_goal: z
    .object({
      value: z.number().positive().max(1_000_000_000),
    })
    .strict(),

  clear_monthly_revenue_goal: z.object({}).strict(),

  get_compras_periodo: z
    .object({
      dtDe: dateBR,
      dtAte: dateBR,
    })
    .strict(),

  get_producao_periodo: z
    .object({
      dtDe: dateBR,
      dtAte: dateBR,
    })
    .strict(),

  get_contas_pagar_periodo: z
    .object({
      dtDe: dateBR,
      dtAte: dateBR,
    })
    .strict(),
} as const

export type ToolName = keyof typeof TOOL_SCHEMAS

export type ToolValidationResult =
  | { ok: true; data: Record<string, unknown> }
  | { ok: false; error: string }

/**
 * Valida args contra o schema da tool. Retorna `ok: false` com mensagem
 * em PT-BR — o orchestrator reinjeta no histórico como tool result, e o
 * modelo aprende o que fez de errado e tenta de novo.
 */
export function validateToolArgs(name: string, args: Record<string, unknown>): ToolValidationResult {
  const schema = (TOOL_SCHEMAS as Record<string, z.ZodTypeAny>)[name]
  if (!schema) {
    return { ok: false, error: `Tool desconhecida: ${name}` }
  }
  const result = schema.safeParse(args)
  if (!result.success) {
    /** Pega a primeira issue — modelo não precisa de lista completa, só do erro mais óbvio. */
    const issue = result.error.issues[0]
    const path = issue.path.join('.')
    const label = path ? `Campo "${path}"` : 'Argumentos'
    return { ok: false, error: `${label}: ${issue.message}` }
  }
  return { ok: true, data: result.data as Record<string, unknown> }
}
