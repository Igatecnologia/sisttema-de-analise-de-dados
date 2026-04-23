import type { AxiosResponse } from 'axios'
import { z } from 'zod'
import { ApiContractError } from '../api/validatedHttp'
import type { AnaliticoFetchMeta } from '../types/models'
import { http } from './http'
import { getProduzidoSgbrDataSource } from './dataSourceService'
import { toSgbrBiDateParam } from './vendasAnaliticoService'

const produzidoRawResponseSchema = z.array(z.record(z.string(), z.unknown()))

function readProxyMeta(
  res: AxiosResponse<unknown>,
): Pick<AnaliticoFetchMeta, 'truncated' | 'pagesFetched'> & { headerRowCount: number } {
  const h = res.headers as Record<string, string | number | undefined>
  const get = (name: string): string => {
    const direct = h[name] ?? h[name.toLowerCase()]
    if (direct != null) return String(direct)
    const lower = name.toLowerCase()
    for (const [k, v] of Object.entries(h)) {
      if (k.toLowerCase() === lower && v != null) return String(v)
    }
    return ''
  }
  const truncated = get('x-iga-proxy-truncated') === '1'
  const pagesFetched = Math.max(1, parseInt(get('x-iga-proxy-pages-fetched') || '1', 10) || 1)
  const headerRowCount = Math.max(0, parseInt(get('x-iga-proxy-row-count') || '0', 10) || 0)
  return { truncated, pagesFetched, headerRowCount }
}

/**
 * Dados do relatório **Produzido** via `GET /api/proxy/data` (fonte com `dataEndpoint` `/sgbrbi/produzido`).
 */
export async function getProduzidoSgbr(params: {
  dtDe: string
  dtAte: string
}): Promise<{ rows: Record<string, unknown>[]; meta: AnaliticoFetchMeta }> {
  const src = getProduzidoSgbrDataSource()
  if (!src?.id) {
    throw new Error(
      'Configure uma fonte SGBR com caminho de dados /sgbrbi/produzido (Fontes de dados).',
    )
  }
  const res = await http.get<unknown>('/api/proxy/data', {
    params: {
      dt_de: toSgbrBiDateParam(params.dtDe),
      dt_ate: toSgbrBiDateParam(params.dtAte),
      requireDsId: '1',
      dsId: src.id,
    },
  })
  const parsed = produzidoRawResponseSchema.safeParse(res.data)
  if (!parsed.success) {
    throw new ApiContractError('Resposta da API Produzido fora do contrato (esperado array de objetos).', parsed.error)
  }
  const meta = readProxyMeta(res)
  return {
    rows: parsed.data,
    meta: {
      truncated: meta.truncated,
      pagesFetched: meta.pagesFetched,
      rowCount: parsed.data.length || meta.headerRowCount,
    },
  }
}

export function hasProduzidoSgbrSourceConfigured(): boolean {
  return Boolean(getProduzidoSgbrDataSource()?.id)
}
