import { Router } from 'express'
import { z } from 'zod'
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth.js'
import { fetchProxyDataForTool } from './proxy.js'
import { readAll as readAllDataSources } from '../storage.js'
import { findTenantBySlug } from '../tenantStorage.js'
import { ConnectorRegistry } from '../connectors/connectorRegistry.js'
import { findDsIdForAreaAsync } from '../connectors/findDsIdForArea.js'

export const forecastRouter = Router()
forecastRouter.use(requireAuth)

/**
 * Forecast simples — sem ML. Estatística básica que serve para Beta:
 *  - revenue: média móvel + projeção linear ate fim do mês corrente
 *  - stock-rupture: dias até ruptura por SKU baseado em consumo histórico
 *
 * Quando IGA-IA (Python) entrar no ar, estes endpoints viram "stub" e a
 * lógica avança para sazonalidade + ML real. Hoje cobre 80% do caso de
 * uso "vou bater minha meta?" / "qual estoque vai acabar primeiro?".
 */

function pickNumber(row: Record<string, unknown>, keys: string[]): number {
  for (const k of keys) {
    const v = row[k] ?? row[k.toLowerCase()] ?? row[k.toUpperCase()]
    if (typeof v === 'number' && Number.isFinite(v)) return v
    if (typeof v === 'string') {
      const n = Number(v.replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.'))
      if (Number.isFinite(n)) return n
    }
  }
  return 0
}

function pickString(row: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = row[k] ?? row[k.toLowerCase()] ?? row[k.toUpperCase()]
    if (typeof v === 'string' && v.trim()) return v.trim()
    if (typeof v === 'number' && Number.isFinite(v)) return String(v)
  }
  return ''
}

function pickDate(row: Record<string, unknown>, keys: string[]): string | null {
  const raw = pickString(row, keys)
  if (!raw) return null
  const d1 = /^(\d{4})[.-](\d{2})[.-](\d{2})/.exec(raw)
  if (d1) return `${d1[1]}-${d1[2]}-${d1[3]}`
  const d2 = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(raw)
  if (d2) return `${d2[3]}-${d2[2]}-${d2[1]}`
  return null
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

function fmtSgbrDate(d: Date): string {
  return `${d.getFullYear()}.${pad2(d.getMonth() + 1)}.${pad2(d.getDate())}`
}

function fmtIso(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

function daysInMonthOf(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
}

function subtractDays(d: Date, days: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() - days)
  return r
}

/**
 * GET /forecast/revenue
 * Projeção de faturamento para o fim do mês corrente baseada em média
 * diária dos últimos 90 dias. Retorna:
 *   - currentMonthSoFar: receita acumulada do mês até hoje
 *   - dailyAverage: média de receita por dia útil (90 dias)
 *   - projectedEndOfMonth: currentMonthSoFar + dailyAverage * dias_restantes
 *   - confidence: 'low' | 'medium' | 'high' baseado em dispersão amostral
 *   - vsGoal: comparação com a meta mensal definida (se houver)
 */
forecastRouter.get('/revenue', async (req, res) => {
  const authReq = req as unknown as AuthenticatedRequest
  const tenantId = authReq.tenantId
  const tenant = await findTenantBySlug(tenantId)
  const connector = ConnectorRegistry.get(tenant?.connectorId)
  const allSources = readAllDataSources()
  const tenantSources = allSources.filter((d) => d.tenantId === tenantId)
  const salesEndpoints = connector.areaHints.vendas ?? []
  const sources = tenantSources.filter((d) => salesEndpoints.some((hint) => (d.dataEndpoint ?? '').toLowerCase().includes(hint.toLowerCase())))

  if (sources.length === 0) {
    return res.json({
      ok: false,
      reason: 'no_sales_source',
      message: 'Nenhuma fonte de vendas configurada para este tenant.',
    })
  }

  const today = new Date()
  const startWindow = subtractDays(today, 90)
  const startMonth = startOfMonth(today)

  /** Agrupa receita por dia. */
  const dailyRevenue = new Map<string, number>()

  await Promise.all(
    sources.map(async (s) => {
      try {
        const r = await fetchProxyDataForTool({
          tenantId,
          dsId: s.id,
          query: { dt_de: fmtSgbrDate(startWindow), dt_ate: fmtSgbrDate(today), requireDsId: '1' },
        })
        if (!r.ok) return
        for (const raw of r.rows) {
          if (!raw || typeof raw !== 'object') continue
          const row = raw as Record<string, unknown>
          const date = pickDate(row, ['data', 'datafec', 'data_fechamento', 'dt_fec', 'dtfechamento', 'dt_emissao', 'dataemissao'])
          if (!date) continue
          const total = pickNumber(row, ['total', 'valor_total', 'vl_total', 'totalliquido', 'valor'])
          if (total <= 0) continue
          dailyRevenue.set(date, (dailyRevenue.get(date) ?? 0) + total)
        }
      } catch {
        /** Falha de fonte não derruba — agregamos as que vierem. */
      }
    }),
  )

  const days = [...dailyRevenue.values()]
  if (days.length < 7) {
    return res.json({
      ok: false,
      reason: 'insufficient_history',
      message: 'Histórico insuficiente para projetar (mínimo 7 dias com vendas).',
      daysWithData: days.length,
    })
  }

  const sumWindow = days.reduce((s, v) => s + v, 0)
  const dailyAverage = sumWindow / days.length

  /** Coeficiente de variação para confidence. */
  const mean = dailyAverage
  const variance = days.reduce((s, v) => s + (v - mean) ** 2, 0) / days.length
  const stdDev = Math.sqrt(variance)
  const cv = mean > 0 ? stdDev / mean : 0
  const confidence: 'high' | 'medium' | 'low' = cv < 0.3 ? 'high' : cv < 0.6 ? 'medium' : 'low'

  /** Soma do mês até agora (filtrando dailyRevenue). */
  const startMonthIso = fmtIso(startMonth)
  let currentMonthSoFar = 0
  for (const [date, value] of dailyRevenue) {
    if (date >= startMonthIso) {
      currentMonthSoFar += value
    }
  }
  const daysElapsed = today.getDate()
  const daysInMonth = daysInMonthOf(today)
  const daysRemaining = Math.max(daysInMonth - daysElapsed, 0)
  const projectedEndOfMonth = currentMonthSoFar + dailyAverage * daysRemaining

  /** Range de incerteza ±1 desvio padrão * dias restantes. */
  const projectionLowerBound = currentMonthSoFar + (dailyAverage - stdDev) * daysRemaining
  const projectionUpperBound = currentMonthSoFar + (dailyAverage + stdDev) * daysRemaining

  res.json({
    ok: true,
    method: 'moving_average_90d',
    confidence,
    daysWithData: days.length,
    currentMonthSoFar: Math.round(currentMonthSoFar * 100) / 100,
    dailyAverage: Math.round(dailyAverage * 100) / 100,
    projectedEndOfMonth: Math.round(projectedEndOfMonth * 100) / 100,
    projectionLowerBound: Math.max(0, Math.round(projectionLowerBound * 100) / 100),
    projectionUpperBound: Math.round(projectionUpperBound * 100) / 100,
    daysElapsed,
    daysRemaining,
  })
})

/**
 * GET /forecast/stock-rupture?topN=10
 * Para cada SKU em estoque, calcula:
 *   - consumo médio diário (a partir de movimentações de produção/vendas dos últimos 90d)
 *   - dias até ruptura = saldo / consumo
 * Retorna top N com menor "dias até ruptura" — admin sabe o que repor primeiro.
 */
const ruptureQuerySchema = z.object({
  topN: z.coerce.number().int().min(1).max(50).optional(),
})

forecastRouter.get('/stock-rupture', async (req, res) => {
  const authReq = req as unknown as AuthenticatedRequest
  const tenantId = authReq.tenantId
  const parsed = ruptureQuerySchema.safeParse(req.query)
  if (!parsed.success) return res.status(400).json({ message: 'Filtros inválidos' })
  const topN = parsed.data.topN ?? 10

  const tenant = await findTenantBySlug(tenantId)
  const connector = ConnectorRegistry.get(tenant?.connectorId)

  /** Saldo atual de cada SKU. */
  const estoqueDsId = await findDsIdForAreaAsync(tenantId, 'estoque', connector)
  if (!estoqueDsId) {
    return res.json({ ok: false, reason: 'no_stock_source', message: 'Nenhuma fonte de estoque configurada.' })
  }

  const estoqueResult = await fetchProxyDataForTool({
    tenantId,
    dsId: estoqueDsId,
    query: { requireDsId: '1' },
  })
  if (!estoqueResult.ok) {
    return res.json({ ok: false, reason: 'stock_fetch_failed', message: 'Falha ao consultar estoque.' })
  }

  /** Mapa SKU → { saldoAtual, custoUnit, descricao }. */
  const stockBySku = new Map<string, { name: string; saldo: number; custoUnit: number }>()
  for (const raw of estoqueResult.rows) {
    if (!raw || typeof raw !== 'object') continue
    const row = raw as Record<string, unknown>
    const sku = pickString(row, ['codigo', 'codprod', 'cod', 'sku', 'controle'])
    if (!sku) continue
    const name = pickString(row, ['produto', 'descricao', 'descprod', 'nomeproduto', 'material', 'item']) || sku
    const saldo = pickNumber(row, ['qtdeatual', 'qtde_atual', 'saldo', 'quantidade', 'qtd', 'qtde', 'estoque'])
    const custoUnit = pickNumber(row, ['custounitario', 'custo_unitario', 'valorcusto', 'preco_custo', 'precocusto'])
    if (saldo > 0) {
      stockBySku.set(sku, { name, saldo, custoUnit })
    }
  }

  if (stockBySku.size === 0) {
    return res.json({ ok: true, items: [], reason: 'no_stock_balances' })
  }

  /** Consumo histórico — preferencialmente por produção (vai virar saída de matéria-prima),
   * fallback por vendas (saída de produto final). */
  const today = new Date()
  const startWindow = subtractDays(today, 90)
  const consumoBySku = new Map<string, number>()

  /** Produção: tenta primeiro. */
  const producaoDsId = await findDsIdForAreaAsync(tenantId, 'produzido', connector)
  if (producaoDsId) {
    try {
      const r = await fetchProxyDataForTool({
        tenantId,
        dsId: producaoDsId,
        query: { dt_de: fmtSgbrDate(startWindow), dt_ate: fmtSgbrDate(today), requireDsId: '1' },
      })
      if (r.ok) {
        for (const raw of r.rows) {
          if (!raw || typeof raw !== 'object') continue
          const row = raw as Record<string, unknown>
          const sku = pickString(row, ['codigo', 'codprod', 'cod', 'sku', 'codcomponente', 'codinsumo'])
          if (!sku) continue
          const qtd = pickNumber(row, ['quantidade', 'qtd', 'qtde', 'qtdeconsumida', 'qtde_consumida'])
          if (qtd > 0) consumoBySku.set(sku, (consumoBySku.get(sku) ?? 0) + qtd)
        }
      }
    } catch {
      /** Falha não derruba — caímos no fallback. */
    }
  }

  /** Fallback vendas: para itens sem dados de produção (produto final). */
  if (consumoBySku.size === 0) {
    const vendasDsId = await findDsIdForAreaAsync(tenantId, 'vendas', connector)
    if (vendasDsId) {
      try {
        const r = await fetchProxyDataForTool({
          tenantId,
          dsId: vendasDsId,
          query: { dt_de: fmtSgbrDate(startWindow), dt_ate: fmtSgbrDate(today), requireDsId: '1' },
        })
        if (r.ok) {
          for (const raw of r.rows) {
            if (!raw || typeof raw !== 'object') continue
            const row = raw as Record<string, unknown>
            const sku = pickString(row, ['codprod', 'codigo', 'cod', 'sku', 'coditem'])
            if (!sku) continue
            const qtd = pickNumber(row, ['qtdevendida', 'qtd', 'quantidade', 'qtde', 'qtdevenda', 'qt'])
            if (qtd > 0) consumoBySku.set(sku, (consumoBySku.get(sku) ?? 0) + qtd)
          }
        }
      } catch {
        /** Sem consumo, calculamos o que dá. */
      }
    }
  }

  const items = [...stockBySku.entries()]
    .map(([sku, info]) => {
      const consumoTotal = consumoBySku.get(sku) ?? 0
      const consumoDiarioMedio = consumoTotal / 90
      const diasAteRuptura =
        consumoDiarioMedio > 0 ? Math.round(info.saldo / consumoDiarioMedio) : null
      return {
        sku,
        name: info.name,
        saldo: info.saldo,
        custoUnitario: info.custoUnit,
        valorEmEstoque: Math.round(info.saldo * info.custoUnit * 100) / 100,
        consumoDiarioMedio: Math.round(consumoDiarioMedio * 100) / 100,
        diasAteRuptura,
        risco: diasAteRuptura == null ? 'sem-consumo' : diasAteRuptura < 7 ? 'critico' : diasAteRuptura < 30 ? 'atencao' : 'ok',
      }
    })
    .filter((x) => x.diasAteRuptura != null)
    .sort((a, b) => (a.diasAteRuptura ?? 0) - (b.diasAteRuptura ?? 0))
    .slice(0, topN)

  res.json({
    ok: true,
    method: 'consumption_avg_90d',
    daysWindow: 90,
    items,
    totalSkus: stockBySku.size,
    skusComConsumo: consumoBySku.size,
  })
})
