import type { ReportItem } from '../types/models'
import dayjs from 'dayjs'
import { hasAnySources } from '../services/dataSourceService'
import { nowBr } from '../utils/dayjsBr'
import { http } from './http'
import { getValidated } from '../api/validatedHttp'
import { reportsPagedResponseSchema } from '../api/schemas'
import { getVendasAnalitico } from './vendasAnaliticoService'
import { buildReportItemsFromVendasRows } from '../utils/vendasAnaliticoAggregates'

type GetReportsOptions = {
  q?: string
  cat?: 'all' | ReportItem['categoria']
  type?: 'all' | ReportItem['tipo']
  logic?: 'and' | 'or'
  startDate?: string
  endDate?: string
  page?: number
  pageSize?: number
  sortBy?: 'atualizadoEm' | 'nome' | 'tipo'
  sortOrder?: 'asc' | 'desc'
}

async function getReportsFromSgbrBi(
  options: GetReportsOptions,
): Promise<{ items: ReportItem[]; total: number; page: number; pageSize: number }> {
  const end = options.endDate ? dayjs(options.endDate) : nowBr()
  const start = options.startDate ? dayjs(options.startDate) : end.subtract(90, 'day')
  const { rows } = await getVendasAnalitico({
    dtDe: start.format('YYYY-MM-DD'),
    dtAte: end.format('YYYY-MM-DD'),
  })
  let items = buildReportItemsFromVendasRows(rows)
  const q = (options.q ?? '').trim().toLowerCase()
  const cat = options.cat ?? 'all'
  const type = options.type ?? 'all'
  const logic = options.logic ?? 'and'

  items = items.filter((r) => {
    const textMatch = !q || r.id.toLowerCase().includes(q) || r.nome.toLowerCase().includes(q)
    const catMatch = cat === 'all' || r.categoria === cat
    const typeMatch = type === 'all' || r.tipo === type
    if (logic === 'or') return textMatch || catMatch || typeMatch
    return textMatch && catMatch && typeMatch
  })

  const sortBy = options.sortBy ?? 'atualizadoEm'
  const sortOrder = options.sortOrder ?? 'desc'
  items = items.slice().sort((a, b) => {
    const ak = a[sortBy as keyof ReportItem]
    const bk = b[sortBy as keyof ReportItem]
    if (typeof ak === 'number' && typeof bk === 'number') {
      return sortOrder === 'asc' ? ak - bk : bk - ak
    }
    const av = String(ak ?? '')
    const bv = String(bk ?? '')
    return sortOrder === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
  })

  const page = Math.max(1, options.page ?? 1)
  const pageSize = Math.max(1, options.pageSize ?? 8)
  const total = items.length
  const slice = items.slice((page - 1) * pageSize, page * pageSize)
  return { items: slice, total, page, pageSize }
}

export async function getReports(
  options: GetReportsOptions = {},
): Promise<{ items: ReportItem[]; total: number; page: number; pageSize: number }> {
  if (hasAnySources()) {
    return getReportsFromSgbrBi(options)
  }
  return getValidated(http, '/reports', reportsPagedResponseSchema, {
    params: { ...options },
  })
}
