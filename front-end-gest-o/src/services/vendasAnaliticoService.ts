import type { AxiosResponse } from 'axios'
import { vendasAnaliticoRawResponseSchema } from '../api/schemas'
import type { VendaAnaliticaRow } from '../api/schemas'
import { ApiContractError } from '../api/validatedHttp'
import type { AnaliticoFetchMeta } from '../types/models'
import { normalizeVendaAnaliticaRow } from '../utils/sgbrVendaAnaliticoNormalize'
import { http } from './http'
import { resolveVendasAnaliticoDataSourceIds } from './vendasAnaliticoSourceSelection'

/** Converte `YYYY-MM-DD` para `YYYY.MM.DD` */
export function toSgbrBiDateParam(isoDay: string): string {
  return isoDay.replaceAll('-', '.')
}

function readProxyMeta(res: AxiosResponse<unknown>): Pick<AnaliticoFetchMeta, 'truncated' | 'pagesFetched'> & { headerRowCount: number } {
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

async function fetchVendasAnaliticoChunk(params: Record<string, string | undefined>): Promise<{
  rows: VendaAnaliticaRow[]
  meta: Pick<AnaliticoFetchMeta, 'truncated' | 'pagesFetched'> & { headerRowCount: number }
}> {
  const res = await http.get<unknown>('/api/proxy/data', { params })
  const parsed = vendasAnaliticoRawResponseSchema.safeParse(res.data)
  if (!parsed.success) {
    throw new ApiContractError('Resposta da API fora do contrato.', parsed.error)
  }
  const rows = parsed.data.map((row) => normalizeVendaAnaliticaRow(row))
  return { rows, meta: readProxyMeta(res) }
}

/**
 * Busca dados de vendas via backend proxy.
 * O backend lê a config da fonte e chama a API do cliente.
 * Retorna metadados do proxy (truncamento / paginação) para avisar na UI.
 */
export async function getVendasAnalitico(params: {
  dtDe: string
  dtAte: string
}): Promise<{ rows: VendaAnaliticaRow[]; meta: AnaliticoFetchMeta }> {
  const ids = resolveVendasAnaliticoDataSourceIds()
  const base: Record<string, string | undefined> = {
    dt_de: toSgbrBiDateParam(params.dtDe),
    dt_ate: toSgbrBiDateParam(params.dtAte),
    requireDsId: '1',
  }

  if (ids.length === 0) {
    const { rows, meta } = await fetchVendasAnaliticoChunk(base)
    return {
      rows,
      meta: {
        truncated: meta.truncated,
        pagesFetched: meta.pagesFetched,
        rowCount: rows.length || meta.headerRowCount,
      },
    }
  }

  const parts = await Promise.all(ids.map((dsId) => fetchVendasAnaliticoChunk({ ...base, dsId })))
  const merged = parts.flatMap((p) => p.rows)
  const truncated = parts.some((p) => p.meta.truncated)
  const pagesFetched = parts.reduce((s, p) => s + p.meta.pagesFetched, 0)

  return {
    rows: merged,
    meta: {
      truncated,
      pagesFetched,
      rowCount: merged.length,
    },
  }
}
