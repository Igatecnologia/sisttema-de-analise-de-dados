import { z } from 'zod'
import dayjs from 'dayjs'
import { getValidated } from '../api/validatedHttp'
import { contaPagarSchema } from '../api/schemas'
import { http } from './http'
import { getContasPagarSgbrDataSource } from './dataSourceService'
import { toSgbrBiDateParam } from './vendasAnaliticoService'
import { mapSgbrContasPagasRows } from '../utils/sgbrContasPagasMap'
import type { ContaPagar } from '../types/models'

/** @deprecated use CONTAS_PAGAR_SGBR_ENDPOINT_HINTS[0] — mantido para imports antigos */
export const SGBR_CONTAS_PAGAS_HINT = '/sgbrbi/contas/pagas'

/** Aceita qualquer array vindo do proxy (linhas podem ser objetos heterogêneos). */
const sgbrContasPagasProxySchema = z.array(z.record(z.string(), z.unknown()))

/** Range > 6 meses em contas/pagas costuma estourar o timeout do proxy — clampamos e avisamos o usuário. */
export const MAX_CONTAS_PAGAR_MONTHS = 6

/** Default otimizado: mês em curso (dia 1 até hoje). Reduz payload/paginação
 *  em ~80% vs multi-mês. Usuário pode ampliar até MAX_CONTAS_PAGAR_MONTHS via filtro. */
export function contasPagarRangeDefault(): { dtDe: string; dtAte: string } {
  const end = dayjs()
  const start = end.startOf('month')
  return { dtDe: start.format('YYYY-MM-DD'), dtAte: end.format('YYYY-MM-DD') }
}

function clampContasPagarRange(range: { dtDe: string; dtAte: string }): { dtDe: string; dtAte: string } {
  const start = dayjs(range.dtDe)
  const end = dayjs(range.dtAte)
  if (!start.isValid() || !end.isValid()) return range
  const minStart = end.subtract(MAX_CONTAS_PAGAR_MONTHS, 'month')
  if (start.isBefore(minStart)) {
    return { dtDe: minStart.format('YYYY-MM-DD'), dtAte: range.dtAte }
  }
  return range
}

/**
 * Informa à UI se o range solicitado excede o limite — permite mostrar banner
 * avisando que só N meses foram consultados.
 */
export function getContasPagarClampInfo(range: { dtDe: string; dtAte: string } | undefined): {
  clamped: boolean
  effective: { dtDe: string; dtAte: string }
  requested: { dtDe: string; dtAte: string } | null
} {
  if (!range?.dtDe || !range?.dtAte) {
    return { clamped: false, effective: contasPagarRangeDefault(), requested: null }
  }
  const effective = clampContasPagarRange(range)
  const clamped = effective.dtDe !== range.dtDe
  return { clamped, effective, requested: range }
}

/**
 * Busca contas via proxy quando existe fonte com endpoint de contas a pagar (vários caminhos SGBR).
 */
export async function fetchContasPagasFromSgbr(params?: { dtDe: string; dtAte: string }): Promise<ContaPagar[]> {
  const src = getContasPagarSgbrDataSource()
  if (!src?.id) {
    throw new Error(
      'Configure uma fonte de dados SGBR com caminho de contas a pagar (ex.: /sgbrbi/contas/pagas ou /sgbrbi/contas/pagar).',
    )
  }
  const requested = params?.dtDe && params?.dtAte ? params : contasPagarRangeDefault()
  const { dtDe, dtAte } = clampContasPagarRange(requested)
  const raw = await getValidated(http, '/api/proxy/data', sgbrContasPagasProxySchema, {
    params: {
      dt_de: toSgbrBiDateParam(dtDe),
      dt_ate: toSgbrBiDateParam(dtAte),
      requireDsId: '1',
      dsId: src.id,
    },
  })
  const objects = raw.filter((r): r is Record<string, unknown> => r != null && typeof r === 'object' && !Array.isArray(r))
  const mapped = mapSgbrContasPagasRows(objects)
  const ok: ContaPagar[] = []
  for (const row of mapped) {
    const p = contaPagarSchema.safeParse(row)
    if (p.success) ok.push(p.data)
  }
  return ok
}

export function hasContasPagasSgbrSource(): boolean {
  return Boolean(getContasPagarSgbrDataSource()?.id)
}
