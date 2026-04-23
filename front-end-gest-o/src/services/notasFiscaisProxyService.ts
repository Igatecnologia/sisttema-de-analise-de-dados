import { getValidated } from '../api/validatedHttp'
import { notasFiscaisRawResponseSchema } from '../api/schemas'
import { http } from './http'
import { normalizeDataEndpointPath } from './dataSourceService'
import { toSgbrBiDateParam } from './vendasAnaliticoService'
import { faturamentoFromVendaAnaliticaRow, normalizeNotaFiscalRow } from '../utils/sgbrNotasFiscaisNormalize'
import type { Faturamento } from '../types/models'

/**
 * Lista de notas fiscais via `GET /api/proxy/data` (fonte SGBR `notasfiscais/*` ou `vendanfe/analitico`).
 */
export async function getFaturamentosFromSgbrBiProxy(params: {
  dtDe: string
  dtAte: string
  dsId: string
  /** Caminho do dataEndpoint da fonte — define o normalizador (NF dedicada vs. analítico vendanfe). */
  dataEndpoint?: string
}): Promise<Faturamento[]> {
  const raw = await getValidated(http, '/api/proxy/data', notasFiscaisRawResponseSchema, {
    params: {
      dt_de: toSgbrBiDateParam(params.dtDe),
      dt_ate: toSgbrBiDateParam(params.dtAte),
      requireDsId: '1',
      dsId: params.dsId,
    },
  })
  const path = normalizeDataEndpointPath(params.dataEndpoint)
  const useVendanfeMapper = path.includes('vendanfe')
  if (useVendanfeMapper) {
    return raw.map((row, i) => faturamentoFromVendaAnaliticaRow(row, i))
  }
  return raw.map((row, i) => normalizeNotaFiscalRow(row, i))
}
