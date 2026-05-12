import { Router } from 'express'
import { fetchProxyDataForTool } from './proxy.js'
import { resolveTenantId } from '../utils/tenant.js'
import { createSharedCache } from '../services/sharedCache.js'
import { ConnectorRegistry } from '../connectors/connectorRegistry.js'
import { findTenantBySlug } from '../tenantStorage.js'
import { findDsIdForAreaAsync } from '../connectors/findDsIdForArea.js'
import type { ConnectorArea, IndustryConnector } from '../connectors/industryConnector.js'

export const erpRouter = Router()

/* ── Helpers ── */

function asText(v: unknown, fb = ''): string {
  if (typeof v === 'string') return v.trim() || fb
  if (typeof v === 'number' && Number.isFinite(v)) return String(v)
  return fb
}

function asNumber(v: unknown, fb = 0): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  return fb
}

/* ── Caches Redis (com fallback em memoria local) ── */

type Rows = Record<string, unknown>[]

const estoqueCache = createSharedCache<Rows>({ namespace: 'erp:estoque', ttlMs: 15 * 60_000 })
const produzidoCache = createSharedCache<Rows>({ namespace: 'erp:produzido', ttlMs: 15 * 60_000 })
const producaoDiariaCache = createSharedCache<Rows>({ namespace: 'erp:producao-diaria', ttlMs: 15 * 60_000 })
const comprasCache = createSharedCache<Rows>({ namespace: 'erp:compras', ttlMs: 15 * 60_000 })
const faturamentosCache = createSharedCache<Rows>({ namespace: 'erp:faturamentos', ttlMs: 15 * 60_000 })

async function getTenantConnector(tenantId: string): Promise<IndustryConnector> {
  const tenant = await findTenantBySlug(tenantId)
  return ConnectorRegistry.get(tenant?.connectorId)
}

async function loadCachedProxyByArea(
  tenantId: string,
  area: ConnectorArea,
  cache: ReturnType<typeof createSharedCache<Rows>>,
  extraQuery?: Record<string, string>,
): Promise<Rows> {
  const connector = await getTenantConnector(tenantId)
  const dsId = await findDsIdForAreaAsync(tenantId, area, connector)
  if (!dsId) return []
  const key = `${tenantId}:${dsId}`
  const cached = await cache.get(key)
  if (cached) return cached
  const result = await fetchProxyDataForTool({
    tenantId,
    dsId,
    query: { requireDsId: '1', ...extraQuery },
  })
  if (!result.ok) return []
  const rows = result.rows.filter((r): r is Record<string, unknown> => Boolean(r && typeof r === 'object'))
  await cache.set(key, rows)
  return rows
}

/* ══════════════════════════════════════════════════════════
   GET /erp/fichas-tecnicas — Dados reais: estoque + produzido
   ══════════════════════════════════════���═══════════════════ */

erpRouter.get('/fichas-tecnicas', async (req, res) => {
  const tenantId = resolveTenantId(req)
  const connector = await getTenantConnector(tenantId)

  const [estoqueRows, produzidoRows] = await Promise.all([
    loadCachedProxyByArea(tenantId, 'estoque', estoqueCache),
    loadCachedProxyByArea(tenantId, 'produzido', produzidoCache, {
      dt_de: formatSgbrDate(sixMonthsAgo()),
      dt_ate: formatSgbrDate(new Date()),
    }),
  ])

  if (estoqueRows.length === 0) {
    return res.json([])
  }

  /* Mapa codproduto → componentes (do produzido) */
  const compMap = new Map<number, { codprodcomp: number; nomeprodutocomp: string; qtdeunitaria: number; undcomp: string }[]>()
  for (const pr of produzidoRows) {
    const cod = asNumber(pr.codproduto)
    if (!cod) continue
    const comps = Array.isArray(pr.componentes) ? pr.componentes as { codprodcomp: number; nomeprodutocomp: string; qtdeunitaria: number; undcomp: string }[] : []
    if (comps.length > 0 && !compMap.has(cod)) {
      compMap.set(cod, comps)
    }
  }

  /* Filtrar apenas produtos (PRODUTO BASE + PRODUTO FINAL) */
  const fichas = estoqueRows
    .filter((r) => {
      const cls = connector.classifyProduct(r)
      return cls === 'espuma' || cls === 'aglomerado' || cls === 'produto-final'
    })
    .map((r) => {
      const cod = asNumber(r.controle)
      const produto = asText(r.produto)
      const precocusto = asNumber(r.precocusto)
      const precovenda = asNumber(r.precovenda)
      const grupo = asText(r.grupo)
      const componentes = compMap.get(cod) ?? []
      const consumoM3 = componentes.reduce((s, c) => s + asNumber(c.qtdeunitaria), 0)
      const margem = precovenda > 0 && precocusto > 0
        ? Math.round(((precovenda - precocusto) / precovenda) * 1000) / 10
        : 0

      const classification = connector.classifyProduct(r)
      const tipo = classification === 'aglomerado' ? 'Aglomerado' : connector.labels.product

      return {
        id: `FT-${cod}`,
        produto,
        tipo,
        densidade: '-',
        alturaM: 0,
        larguraM: 0,
        comprimentoM: 0,
        volumeM3: consumoM3,
        pesoEstimadoKg: 0,
        consumoMateriaPrimaKg: 0,
        custoMateriaPrima: precocusto,
        custoConversao: 0,
        custoEstimado: precocusto,
        custoPorM3: consumoM3 > 0 ? Math.round(precocusto / consumoM3 * 100) / 100 : 0,
        precoSugerido: precovenda,
        margemAlvoPct: margem,
        ativo: asText(r.ativo) === 'SIM',
        /* Campos extras para o frontend novo */
        grupo,
        unidade: asText(r.unidade, 'UN'),
        precocusto,
        precovenda,
        componentes: componentes.map((c) => ({
          codigo: c.codprodcomp,
          nome: c.nomeprodutocomp,
          consumoUnitario: c.qtdeunitaria,
          unidade: c.undcomp,
        })),
      }
    })

  res.json(fichas)
})

/* ══════════════════════════════════════════════════════════
   GET /erp/producao-diaria — Produção com data real por produto
   Consulta dia a dia (max 14 dias) para saber QUANDO cada produto foi produzido.
   ══════════════════════════════════════════════════════════ */

erpRouter.get('/producao-diaria', async (req, res) => {
  const tenantId = resolveTenantId(req)
  const dtDe = typeof req.query.dt_de === 'string' ? req.query.dt_de : formatSgbrDate(thirtyDaysAgo())
  const dtAte = typeof req.query.dt_ate === 'string' ? req.query.dt_ate : formatSgbrDate(new Date())

  const connector = await getTenantConnector(tenantId)
  const dsId = await findDsIdForAreaAsync(tenantId, 'produzido', connector)
  if (!dsId) return res.json({ rows: [], truncated: false, periodoReal: { de: dtDe, ate: dtAte } })

  const cacheKey = `${tenantId}:${dsId}:${dtDe}:${dtAte}`
  const cached = await producaoDiariaCache.get(cacheKey)

  let rawRows: Record<string, unknown>[]
  let truncated = false

  if (cached) {
    rawRows = cached
  } else {
    const result = await fetchProxyDataForTool({
      tenantId,
      dsId,
      query: { requireDsId: '1', dt_de: dtDe, dt_ate: dtAte },
    })
    rawRows = result.ok
      ? result.rows.filter((r): r is Record<string, unknown> => Boolean(r && typeof r === 'object'))
      : []
    truncated = result.ok ? result.truncated : false
    await producaoDiariaCache.set(cacheKey, rawRows)
  }

  type ProdRow = { codproduto: number; produto: string; qtdeproduzida: number; unidade: string; componentes: unknown[]; data: string }
  const allRows: ProdRow[] = []

  for (const r of rawRows) {
    const dataRaw = asText(r.data || r.datafec || r.dataproducao || r.dt_producao || r.data_producao)
    const data = dataRaw.includes('T') ? dataRaw.slice(0, 10) : dataRaw.replace(/\./g, '-').slice(0, 10)
    allRows.push({
      codproduto: asNumber(r.codproduto),
      produto: asText(r.produto || r.nome_produto || r.nomeproduto || r.descricao),
      qtdeproduzida: asNumber(r.qtdeproduzida || r.quantidade || r.qtde || r.qtd),
      unidade: asText(r.unidade || r.und, 'UN'),
      componentes: Array.isArray(r.componentes) ? r.componentes : [],
      data: data || dtDe.replace(/\./g, '-'),
    })
  }

  res.json({
    rows: allRows,
    truncated,
    periodoReal: {
      de: dtDe.replace(/\./g, '-'),
      ate: dtAte.replace(/\./g, '-'),
    },
  })
})

/* ══════════════════════════════════════════════════════════
   GET /erp/vendas-sgbr — Vendas reais do vendas/analitico
   ══════════════════════════════════════════════════════════ */

erpRouter.get('/vendas-sgbr', async (req, res) => {
  const tenantId = resolveTenantId(req)
  const dtDe = typeof req.query.dt_de === 'string' ? req.query.dt_de : formatSgbrDate(thirtyDaysAgo())
  const dtAte = typeof req.query.dt_ate === 'string' ? req.query.dt_ate : formatSgbrDate(new Date())

  const connector = await getTenantConnector(tenantId)
  const dsId = await findDsIdForAreaAsync(tenantId, 'vendas', connector)
  if (!dsId) return res.json([])

  const result = await fetchProxyDataForTool({
    tenantId,
    dsId,
    query: { requireDsId: '1', dt_de: dtDe, dt_ate: dtAte },
  })
  if (!result.ok) return res.json([])

  const rows = result.rows
    .filter((r): r is Record<string, unknown> => Boolean(r && typeof r === 'object'))
    .map((r) => ({
      data: asText(r.datafec) || asText(r.data),
      codProduto: asNumber(r.codprod),
      produto: asText(r.decprod),
      qtde: asNumber(r.qtdevendida),
      unidade: asText(r.und, 'UN'),
      valorUnit: asNumber(r.valorunit),
      total: asNumber(r.total),
      custoProduto: asNumber(r.precocustoitem),
      codCliente: asNumber(r.codcliente),
      cliente: asText(r.nomecliente),
      codVendedor: asNumber(r.codvendedor),
      vendedor: asText(r.nomevendedor),
      status: asText(r.statuspedido),
    }))

  res.json(rows)
})

/* ── Date helpers ── */

function sixMonthsAgo(): Date {
  const d = new Date()
  d.setMonth(d.getMonth() - 6)
  return d
}

function thirtyDaysAgo(): Date {
  const d = new Date()
  d.setDate(d.getDate() - 30)
  return d
}

function formatSgbrDate(d: Date): string {
  return d.toISOString().slice(0, 10).replace(/-/g, '.')
}

/* ── Endpoints ERP adicionais ── */

/* ══════════════════════════════════════════════════════════
   GET /erp/compras-materia-prima — Compras via connector.areaHints.compras
   Query: dt_de, dt_ate (formato YYYY.MM.DD)
   ══════════════════════════════════════════════════════════ */

erpRouter.get('/compras-materia-prima', async (req, res) => {
  const tenantId = resolveTenantId(req)
  const dtDe = typeof req.query.dt_de === 'string' ? req.query.dt_de : formatSgbrDate(thirtyDaysAgo())
  const dtAte = typeof req.query.dt_ate === 'string' ? req.query.dt_ate : formatSgbrDate(new Date())

  const connector = await getTenantConnector(tenantId)
  const dsId = await findDsIdForAreaAsync(tenantId, 'compras', connector)
  if (!dsId) {
    return res.json({ rows: [], truncated: false, periodoReal: { de: dtDe, ate: dtAte } })
  }

  const cacheKey = `${tenantId}:${dsId}:${dtDe}:${dtAte}`
  const cached = await comprasCache.get(cacheKey)
  if (cached) {
    return res.json({ rows: cached, truncated: false, periodoReal: { de: dtDe, ate: dtAte } })
  }

  const result = await fetchProxyDataForTool({
    tenantId,
    dsId,
    query: { dt_de: dtDe, dt_ate: dtAte, requireDsId: '1' },
  })

  if (!result.ok) {
    return res.json({ rows: [], truncated: false, periodoReal: { de: dtDe, ate: dtAte } })
  }

  const rows = result.rows.filter((r): r is Record<string, unknown> => Boolean(r && typeof r === 'object'))
  await comprasCache.set(cacheKey, rows)

  res.json({
    rows,
    truncated: result.truncated,
    periodoReal: { de: dtDe, ate: dtAte },
  })
})

// GET /erp/lotes-producao
erpRouter.get('/lotes-producao', (_req, res) => res.json([]))

// GET /erp/pedidos
erpRouter.get('/pedidos', (_req, res) => res.json([]))

// GET /erp/ordens-producao
erpRouter.get('/ordens-producao', (_req, res) => res.json([]))

/* GET /erp/faturamentos — Notas fiscais via proxy SGBR (vendanfe ou notasfiscais) */
erpRouter.get('/faturamentos', async (req, res) => {
  const tenantId = resolveTenantId(req)
  const dtDe = typeof req.query.dt_de === 'string' ? req.query.dt_de : formatSgbrDate(thirtyDaysAgo())
  const dtAte = typeof req.query.dt_ate === 'string' ? req.query.dt_ate : formatSgbrDate(new Date())

  const connector = await getTenantConnector(tenantId)
  const dsId = await findDsIdForAreaAsync(tenantId, 'notasfiscais', connector)
  if (!dsId) return res.json([])

  const cacheKey = `${tenantId}:${dsId}:${dtDe}:${dtAte}`
  const cached = await faturamentosCache.get(cacheKey)
  if (cached) return res.json(cached)

  const result = await fetchProxyDataForTool({
    tenantId,
    dsId,
    query: { dt_de: dtDe, dt_ate: dtAte, requireDsId: '1' },
  })
  if (!result.ok) return res.json([])

  const rows = result.rows.filter((r): r is Record<string, unknown> => Boolean(r && typeof r === 'object'))
  await faturamentosCache.set(cacheKey, rows)
  res.json(rows)
})

// GET /erp/movimentos-estoque
erpRouter.get('/movimentos-estoque', (_req, res) => res.json([]))

// GET /erp/custo-real
erpRouter.get('/custo-real', (_req, res) => res.json([]))

// GET /erp/alertas
erpRouter.get('/alertas', (_req, res) => res.json([]))
