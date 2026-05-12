import { Router } from 'express'
import { fetchProxyDataForTool } from './proxy.js'
import { resolveTenantId } from '../utils/tenant.js'
import { createSharedCache } from '../services/sharedCache.js'
import { ConnectorRegistry } from '../connectors/connectorRegistry.js'
import { findTenantBySlug } from '../tenantStorage.js'
import { findDsIdForAreaAsync } from '../connectors/findDsIdForArea.js'
import type { ConnectorArea, IndustryConnector } from '../connectors/industryConnector.js'
import {
  demoLotesProducao,
  demoPedidos,
  demoOrdensProducao,
} from '../fixtures/erpDemoData.js'

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

// GET /erp/lotes-producao — fixtures de demonstracao (ate haver integracao real)
erpRouter.get('/lotes-producao', (_req, res) => res.json(demoLotesProducao))

// GET /erp/pedidos — fixtures de demonstracao
erpRouter.get('/pedidos', (_req, res) => res.json(demoPedidos))

// GET /erp/ordens-producao — fixtures de demonstracao
erpRouter.get('/ordens-producao', (_req, res) => res.json(demoOrdensProducao))

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

// GET /erp/movimentos-estoque — fixtures de demonstracao
const demoMovimentosEstoque = [
  { id: 'ME-001', data: '2026-05-10', nivelEstoque: 'Insumo' as const, item: 'MDI Polimerico', tipoMovimento: 'Entrada' as const, origem: 'Compra' as const, referenciaId: 'CMP-0042', quantidade: 500, unidade: 'KG', custoUnitario: 18.5, custoTotal: 9250, saldoAnterior: 320, saldoAtual: 820 },
  { id: 'ME-002', data: '2026-05-09', nivelEstoque: 'Produto Base' as const, item: 'Espuma D28 Premium', tipoMovimento: 'Saída' as const, origem: 'Venda' as const, referenciaId: 'PED-2298', quantidade: 4.5, unidade: 'M3', custoUnitario: 168, custoTotal: 756, saldoAnterior: 32, saldoAtual: 27.5 },
  { id: 'ME-003', data: '2026-05-08', nivelEstoque: 'Produto Base' as const, item: 'Espuma D33 Alta Resiliencia', tipoMovimento: 'Entrada' as const, origem: 'Produção' as const, referenciaId: 'LP-2026-004', quantidade: 18.2, unidade: 'M3', custoUnitario: 195, custoTotal: 3549, saldoAnterior: 12, saldoAtual: 30.2 },
  { id: 'ME-004', data: '2026-05-07', nivelEstoque: 'Insumo' as const, item: 'Poliol Padrao Flexivel', tipoMovimento: 'Saída' as const, origem: 'OP' as const, referenciaId: 'OP-1078', quantidade: 120, unidade: 'KG', custoUnitario: 14.2, custoTotal: 1704, saldoAnterior: 980, saldoAtual: 860 },
  { id: 'ME-005', data: '2026-05-06', nivelEstoque: 'Insumo' as const, item: 'Catalisador Amina A33', tipoMovimento: 'Entrada' as const, origem: 'Compra' as const, referenciaId: 'CMP-0041', quantidade: 80, unidade: 'L', custoUnitario: 45, custoTotal: 3600, saldoAnterior: 22, saldoAtual: 102 },
  { id: 'ME-006', data: '2026-05-05', nivelEstoque: 'Produto Base' as const, item: 'Aglomerado AD-18 Premium', tipoMovimento: 'Entrada' as const, origem: 'Produção' as const, referenciaId: 'LP-2026-003', quantidade: 9.4, unidade: 'M3', custoUnitario: 108, custoTotal: 1015.2, saldoAnterior: 4, saldoAtual: 13.4 },
  { id: 'ME-007', data: '2026-05-04', nivelEstoque: 'Insumo' as const, item: 'TDI Toluenodiisocianato', tipoMovimento: 'Saída' as const, origem: 'Produção' as const, referenciaId: 'LP-2026-003', quantidade: 180, unidade: 'KG', custoUnitario: 22, custoTotal: 3960, saldoAnterior: 420, saldoAtual: 240 },
  { id: 'ME-008', data: '2026-05-03', nivelEstoque: 'Produto Base' as const, item: 'Espuma D23 Confort', tipoMovimento: 'Saída' as const, origem: 'Venda' as const, referenciaId: 'PED-2294', quantidade: 6.8, unidade: 'M3', custoUnitario: 138, custoTotal: 938.4, saldoAnterior: 22, saldoAtual: 15.2 },
  { id: 'ME-009', data: '2026-05-02', nivelEstoque: 'Insumo' as const, item: 'Silicone Surfactante L-580', tipoMovimento: 'Entrada' as const, origem: 'Compra' as const, referenciaId: 'CMP-0040', quantidade: 60, unidade: 'L', custoUnitario: 38.5, custoTotal: 2310, saldoAnterior: 12, saldoAtual: 72 },
  { id: 'ME-010', data: '2026-05-01', nivelEstoque: 'Produto Base' as const, item: 'Espuma D40 Firme', tipoMovimento: 'Saída' as const, origem: 'OP' as const, referenciaId: 'OP-1077', quantidade: 8, unidade: 'M3', custoUnitario: 222, custoTotal: 1776, saldoAnterior: 18, saldoAtual: 10 },
  { id: 'ME-011', data: '2026-04-30', nivelEstoque: 'Insumo' as const, item: 'Pigmento Branco TiO2', tipoMovimento: 'Saída' as const, origem: 'Produção' as const, referenciaId: 'LP-2026-002', quantidade: 25, unidade: 'KG', custoUnitario: 12, custoTotal: 300, saldoAnterior: 180, saldoAtual: 155 },
  { id: 'ME-012', data: '2026-04-28', nivelEstoque: 'Produto Base' as const, item: 'Espuma D26 Standard', tipoMovimento: 'Entrada' as const, origem: 'Produção' as const, referenciaId: 'LP-2026-002', quantidade: 22.5, unidade: 'M3', custoUnitario: 152, custoTotal: 3420, saldoAnterior: 8, saldoAtual: 30.5 },
]
erpRouter.get('/movimentos-estoque', (_req, res) => res.json(demoMovimentosEstoque))

// GET /erp/custo-real — fixtures alinhados com fichas-tecnicas
const demoCustoReal = [
  { fichaTecnicaId: 'FT-3001', produto: 'Espuma D18 Soft', densidade: 'D18', custoMateriaPrima: 78, custoEnergia: 12, custoMaoDeObra: 14, custoPerdas: 4, custoIndiretos: 8, custoRealTotal: 116, custoRealPorM3: 116, precoVenda: 145, margemRealPct: 20.0, margemAlvoPct: 25, alertaMargem: true },
  { fichaTecnicaId: 'FT-3002', produto: 'Espuma D20 Flexivel', densidade: 'D20', custoMateriaPrima: 88, custoEnergia: 14, custoMaoDeObra: 16, custoPerdas: 5, custoIndiretos: 9, custoRealTotal: 132, custoRealPorM3: 132, precoVenda: 170, margemRealPct: 22.4, margemAlvoPct: 25, alertaMargem: true },
  { fichaTecnicaId: 'FT-3003', produto: 'Espuma D23 Confort', densidade: 'D23', custoMateriaPrima: 96, custoEnergia: 15, custoMaoDeObra: 17, custoPerdas: 5, custoIndiretos: 10, custoRealTotal: 143, custoRealPorM3: 143, precoVenda: 198, margemRealPct: 27.8, margemAlvoPct: 25, alertaMargem: false },
  { fichaTecnicaId: 'FT-3004', produto: 'Espuma D26 Standard', densidade: 'D26', custoMateriaPrima: 108, custoEnergia: 17, custoMaoDeObra: 19, custoPerdas: 6, custoIndiretos: 11, custoRealTotal: 161, custoRealPorM3: 161, precoVenda: 225, margemRealPct: 28.4, margemAlvoPct: 25, alertaMargem: false },
  { fichaTecnicaId: 'FT-3005', produto: 'Espuma D28 Premium', densidade: 'D28', custoMateriaPrima: 122, custoEnergia: 19, custoMaoDeObra: 21, custoPerdas: 7, custoIndiretos: 12, custoRealTotal: 181, custoRealPorM3: 181, precoVenda: 259, margemRealPct: 30.1, margemAlvoPct: 28, alertaMargem: false },
  { fichaTecnicaId: 'FT-3006', produto: 'Espuma D33 Alta Resiliencia', densidade: 'D33', custoMateriaPrima: 142, custoEnergia: 22, custoMaoDeObra: 24, custoPerdas: 8, custoIndiretos: 14, custoRealTotal: 210, custoRealPorM3: 210, precoVenda: 299, margemRealPct: 29.8, margemAlvoPct: 30, alertaMargem: true },
  { fichaTecnicaId: 'FT-3007', produto: 'Espuma D40 Firme', densidade: 'D40', custoMateriaPrima: 162, custoEnergia: 25, custoMaoDeObra: 27, custoPerdas: 9, custoIndiretos: 16, custoRealTotal: 239, custoRealPorM3: 239, precoVenda: 339, margemRealPct: 29.5, margemAlvoPct: 30, alertaMargem: true },
  { fichaTecnicaId: 'FT-3008', produto: 'Espuma D45 Extra Firme', densidade: 'D45', custoMateriaPrima: 182, custoEnergia: 28, custoMaoDeObra: 30, custoPerdas: 10, custoIndiretos: 18, custoRealTotal: 268, custoRealPorM3: 268, precoVenda: 378, margemRealPct: 29.1, margemAlvoPct: 30, alertaMargem: true },
  { fichaTecnicaId: 'FT-3102', produto: 'Aglomerado AD-15 Standard', densidade: 'AD15', custoMateriaPrima: 62, custoEnergia: 9, custoMaoDeObra: 11, custoPerdas: 3, custoIndiretos: 6, custoRealTotal: 91, custoRealPorM3: 91, precoVenda: 138, margemRealPct: 34.1, margemAlvoPct: 32, alertaMargem: false },
  { fichaTecnicaId: 'FT-3103', produto: 'Aglomerado AD-18 Premium', densidade: 'AD18', custoMateriaPrima: 72, custoEnergia: 11, custoMaoDeObra: 12, custoPerdas: 4, custoIndiretos: 7, custoRealTotal: 106, custoRealPorM3: 106, precoVenda: 162, margemRealPct: 34.6, margemAlvoPct: 32, alertaMargem: false },
]
erpRouter.get('/custo-real', (_req, res) => res.json(demoCustoReal))

// GET /erp/alertas — fixtures de demonstracao
const demoAlertasOperacionais = [
  { id: 'ALT-001', data: '2026-05-12', tipo: 'estoque_critico' as const, severidade: 'alta' as const, titulo: 'MDI Polimerico abaixo do minimo', descricao: 'Saldo de 80kg, abaixo do minimo de 200kg. Programar compra urgente.', referenciaId: '1001', lido: false },
  { id: 'ALT-002', data: '2026-05-11', tipo: 'margem_baixa' as const, severidade: 'alta' as const, titulo: 'Espuma D18 com margem abaixo do alvo', descricao: 'Margem real 20% vs alvo 25%. Revisar precificacao ou custos.', referenciaId: 'FT-3001', lido: false },
  { id: 'ALT-003', data: '2026-05-10', tipo: 'producao_atrasada' as const, severidade: 'media' as const, titulo: 'OP-1078 com atraso de 2 dias', descricao: 'Producao de Espuma D40 Firme atrasada — risco de quebra de estoque.', referenciaId: 'OP-1078', lido: true },
  { id: 'ALT-004', data: '2026-05-09', tipo: 'vazamento_lucro' as const, severidade: 'media' as const, titulo: 'Variacao de custo materia-prima > 8%', descricao: 'Poliol Padrao com aumento de 12% no ultimo lote. Negociar com fornecedor.', referenciaId: 'CMP-0041', lido: false },
  { id: 'ALT-005', data: '2026-05-08', tipo: 'inadimplencia' as const, severidade: 'baixa' as const, titulo: '3 titulos vencidos < 7 dias', descricao: 'Cliente Magnifica Estofados com R$ 12.480 em atraso.', referenciaId: '5003', lido: false },
  { id: 'ALT-006', data: '2026-05-06', tipo: 'estoque_critico' as const, severidade: 'media' as const, titulo: 'Pigmento Branco TiO2 proximo do minimo', descricao: 'Saldo 155kg, minimo 120kg. Comprar nas proximas semanas.', referenciaId: '2003', lido: true },
]
erpRouter.get('/alertas', (_req, res) => res.json(demoAlertasOperacionais))
