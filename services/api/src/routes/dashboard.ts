import { Router } from 'express'
import { z } from 'zod'
import { resolveTenantId } from '../utils/tenant.js'
import { ConnectorRegistry } from '../connectors/connectorRegistry.js'
import { findTenantBySlug } from '../tenantStorage.js'
import { findDsIdForAreaAsync } from '../connectors/findDsIdForArea.js'
import { fetchProxyDataForTool } from './proxy.js'
import { comparePeriods, previousRangeOf, type PeriodRange } from '../services/periodComparison.js'

export const dashboardRouter = Router()

dashboardRouter.get('/', (_req, res) => {
  res.json({
    kpis: [],
    sales: [],
    revenue: [],
    heatmap: [],
    latest: [],
  })
})

/**
 * P1-09 (audit 2026-05-12): GET /dashboard/compare?metric=vendas&from=YYYY-MM-DD&to=YYYY-MM-DD
 *
 * Retorna comparativo período-a-período pro front renderizar como "▲ 5.2% vs mês anterior".
 * Funciona pra 3 métricas: vendas, compras, contas-pagas. Busca dados via proxy/ERP.
 */
const compareQuerySchema = z.object({
  metric: z.enum(['vendas', 'compras', 'contas']),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'from precisa ser YYYY-MM-DD'),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'to precisa ser YYYY-MM-DD'),
})

const VALUE_KEYS_BY_METRIC: Record<'vendas' | 'compras' | 'contas', string[]> = {
  vendas: ['total', 'valor', 'valortotal', 'valor_total', 'totalvenda'],
  compras: ['valortotal', 'valor', 'total', 'valor_total'],
  contas: ['valor', 'valorpago', 'valor_pago', 'valortotal'],
}
const GROUP_KEYS_BY_METRIC: Record<'vendas' | 'compras' | 'contas', string[]> = {
  vendas: ['codprod', 'codproduto', 'sku', 'produto', 'decprod'],
  compras: ['codprod', 'codproduto', 'fornecedor', 'codfornecedor'],
  contas: ['categoria', 'fornecedor', 'codfornecedor'],
}
const LABEL_KEYS_BY_METRIC: Record<'vendas' | 'compras' | 'contas', string[]> = {
  vendas: ['decprod', 'produto', 'nomeproduto'],
  compras: ['nomeproduto', 'produto', 'fornecedor', 'nomefornecedor'],
  contas: ['categoria', 'fornecedor', 'nomefornecedor'],
}

function pickFirst(row: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = row[k]
    if (typeof v === 'string' && v.trim()) return v
    if (typeof v === 'number' && Number.isFinite(v)) return String(v)
  }
  return ''
}
function pickNumber(row: Record<string, unknown>, keys: string[]): number {
  for (const k of keys) {
    const v = row[k]
    if (typeof v === 'number' && Number.isFinite(v)) return v
    if (typeof v === 'string') {
      const n = Number(v.replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.'))
      if (Number.isFinite(n)) return n
    }
  }
  return 0
}

function toSgbrDate(iso: string): string { return iso.replace(/-/g, '.') }

dashboardRouter.get('/compare', async (req, res) => {
  const parsed = compareQuerySchema.safeParse(req.query)
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'Parâmetros inválidos' })
  }
  const tenantId = resolveTenantId(req)
  const metric = parsed.data.metric
  const current: PeriodRange = { from: parsed.data.from, to: parsed.data.to }
  const previous = previousRangeOf(current)

  const tenant = await findTenantBySlug(tenantId)
  const connector = ConnectorRegistry.get(tenant?.connectorId)
  const area = metric === 'contas' ? 'contas' : metric
  const dsId = await findDsIdForAreaAsync(tenantId, area, connector)
  if (!dsId) {
    return res.json({
      metric, current, previous,
      result: null,
      reason: 'no_datasource',
      message: `Nenhum datasource configurado para ${metric}`,
    })
  }

  const fetchRange = async (range: PeriodRange) => {
    const result = await fetchProxyDataForTool({
      tenantId, dsId,
      query: { requireDsId: '1', dt_de: toSgbrDate(range.from), dt_ate: toSgbrDate(range.to) },
    })
    return result.ok ? result.rows.filter((r): r is Record<string, unknown> => Boolean(r && typeof r === 'object')) : []
  }
  const [currentRows, previousRows] = await Promise.all([fetchRange(current), fetchRange(previous)])

  const valueKeys = VALUE_KEYS_BY_METRIC[metric]
  const groupKeys = GROUP_KEYS_BY_METRIC[metric]
  const labelKeys = LABEL_KEYS_BY_METRIC[metric]

  const result = comparePeriods({
    current: currentRows,
    previous: previousRows,
    getValue: (row) => pickNumber(row, valueKeys),
    getGroupKey: (row) => pickFirst(row, groupKeys),
    getGroupLabel: (row) => pickFirst(row, labelKeys) || pickFirst(row, groupKeys),
  })

  res.json({ metric, current, previous, result })
})
