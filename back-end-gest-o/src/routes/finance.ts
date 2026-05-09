import { Router } from 'express'
import { randomBytes } from 'node:crypto'
import { fetchProxyDataForTool } from './proxy.js'
import { resolveTenantId } from '../utils/tenant.js'
import { createSharedCache } from '../services/sharedCache.js'
import { ConnectorRegistry } from '../connectors/connectorRegistry.js'
import { findTenantBySlug } from '../tenantStorage.js'
import { findDsIdForArea } from '../connectors/findDsIdForArea.js'
import type { IndustryConnector } from '../connectors/industryConnector.js'

export const financeRouter = Router()

// GET /finance — visão geral
financeRouter.get('/', (_req, res) => {
  res.json({
    receita: 0,
    custos: 0,
    lucro: 0,
    margemPct: 0,
    monthlyFlow: [],
    entries: [],
  })
})

async function getContasPagarDataSourceId(tenantId: string): Promise<string | null> {
  const connector = await getTenantConnector(tenantId)
  return findDsIdForArea(tenantId, 'contas', connector)
}

const contasPagarCache = createSharedCache<Record<string, unknown>[]>({
  namespace: 'finance:contas-pagar',
  ttlMs: 15 * 60_000,
})

// GET /finance/contas-pagar — dados reais via proxy do connector do tenant
financeRouter.get('/contas-pagar', async (req, res) => {
  const tenantId = resolveTenantId(req)
  const dtDe = typeof req.query.dt_de === 'string' ? req.query.dt_de : ''
  const dtAte = typeof req.query.dt_ate === 'string' ? req.query.dt_ate : ''
  const dsId = await getContasPagarDataSourceId(tenantId)
  if (!dsId) return res.json([])

  const cacheKey = `${tenantId}:${dsId}:${dtDe}:${dtAte}`
  const cached = await contasPagarCache.get(cacheKey)
  if (cached) return res.json(cached)

  const query: Record<string, string> = { requireDsId: '1' }
  if (dtDe) query.dt_de = dtDe
  if (dtAte) query.dt_ate = dtAte

  const result = await fetchProxyDataForTool({ tenantId, dsId, query })
  if (!result.ok) return res.json([])

  const rows = result.rows.filter((r): r is Record<string, unknown> => Boolean(r && typeof r === 'object'))
  await contasPagarCache.set(cacheKey, rows)
  res.json(rows)
})

type EstoqueRawRow = Record<string, unknown>

async function getEstoqueDataSourceId(tenantId: string): Promise<string | null> {
  const connector = await getTenantConnector(tenantId)
  return findDsIdForArea(tenantId, 'estoque', connector)
}

function pickRaw(row: EstoqueRawRow, keys: string[]): unknown {
  for (const k of keys) {
    if (k in row && row[k] !== undefined && row[k] !== null) return row[k]
  }
  const lowerMap = new Map(Object.keys(row).map((k) => [k.toLowerCase(), k]))
  for (const k of keys) {
    const rk = lowerMap.get(k.toLowerCase())
    if (rk !== undefined && row[rk] !== undefined && row[rk] !== null) return row[rk]
  }
  return undefined
}

function asText(v: unknown, fallback = ''): string {
  if (typeof v === 'string') return v.trim() || fallback
  if (typeof v === 'number' && Number.isFinite(v)) return String(v)
  return fallback
}

function asNumber(v: unknown, fallback = 0): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v !== 'string') return fallback
  const s = v.trim()
  if (!s) return fallback
  const normalized = s.replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.')
  const n = Number(normalized)
  return Number.isFinite(n) ? n : fallback
}

function estoqueStatus(qtdeAtual: number, qtdeMinima: number): 'Normal' | 'Baixo' | 'Crítico' {
  if (qtdeAtual <= 0 || (qtdeMinima > 0 && qtdeAtual <= qtdeMinima * 0.5)) return 'Crítico'
  if (qtdeMinima > 0 && qtdeAtual <= qtdeMinima) return 'Baixo'
  return 'Normal'
}

function isoDateOrToday(v: unknown): string {
  const s = asText(v)
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  if (/^\d{4}\.\d{2}\.\d{2}/.test(s)) return s.slice(0, 10).replace(/\./g, '-')
  return new Date().toISOString().slice(0, 10)
}

/* Campos SGBR → campos internos (inclui variantes comuns) */
const ID_KEYS = ['id', 'codigo', 'codprod', 'cod', 'controle', 'codproduto']
const MATERIAL_KEYS = ['material', 'materia_prima', 'insumo', 'item', 'produto', 'descricao', 'descprod', 'nomeproduto']
const TIPO_KEYS = ['tipo', 'categoria', 'nivel', 'classe', 'grupo', 'subgrupo', 'referencia']
const QTD_KEYS = ['qtdeatual', 'qtde_atual', 'saldo', 'quantidade', 'qtd', 'qtde', 'estoque']
const QTD_MIN_KEYS = ['qtdeminima', 'qtde_minima', 'estoque_minimo', 'minimo']
const CUSTO_UNIT_KEYS = ['custounitario', 'custo_unitario', 'valorcusto', 'preco_custo', 'precocusto', 'valor_custo']
const CUSTO_TOTAL_KEYS = ['custototal', 'custo_total', 'valor_total_custo']
const PRECO_VENDA_KEYS = ['precovenda', 'preco_venda', 'valorvenda', 'valor_venda']
const DATA_KEYS = ['ultimaentrada', 'ultima_entrada', 'dataentrada', 'dataultimacompra', 'data_ultima_compra', 'data']
const UNIDADE_KEYS = ['unidade', 'und', 'un']
const FORNECEDOR_KEYS = ['fornecedor', 'nomefornecedor', 'nome_fornecedor']

/** Custo total do estoque: qtde positiva × preço custo. Negativo = 0 (sem valor em estoque). */
function calcCustoTotal(row: EstoqueRawRow, qtde: number, custoUnit: number): number {
  const explicit = asNumber(pickRaw(row, CUSTO_TOTAL_KEYS), 0)
  if (explicit > 0) return explicit
  if (qtde <= 0) return 0
  return Math.round(qtde * custoUnit * 100) / 100
}

/** Classificacao delegada 100% ao connector — cada industria define sua taxonomia. */
function classifyEstoqueItem(row: EstoqueRawRow, connector: IndustryConnector) {
  return connector.classifyProduct(row)
}

async function getTenantConnector(tenantId: string): Promise<IndustryConnector> {
  const tenant = await findTenantBySlug(tenantId)
  return ConnectorRegistry.get(tenant?.connectorId)
}

/**
 * Cache compartilhado do estoque — evita 3 chamadas SGBR idênticas (uma por aba).
 * Em modo cluster, Redis garante que servidores diferentes compartilhem o cache.
 */
const estoqueCache = createSharedCache<EstoqueRawRow[]>({
  namespace: 'finance:estoque',
  ttlMs: 15 * 60_000,
})

async function loadEstoqueRows(tenantId: string): Promise<EstoqueRawRow[]> {
  const dsId = await getEstoqueDataSourceId(tenantId)
  if (!dsId) return []

  const cacheKey = `${tenantId}:${dsId}`
  const cached = await estoqueCache.get(cacheKey)
  if (cached) return cached

  const result = await fetchProxyDataForTool({
    tenantId,
    dsId,
    query: { requireDsId: '1' },
  })
  if (!result.ok) return []
  const rows = result.rows.filter((r): r is EstoqueRawRow => Boolean(r && typeof r === 'object'))
  await estoqueCache.set(cacheKey, rows)
  return rows
}

// GET /finance/estoque-materia-prima
financeRouter.get('/estoque-materia-prima', async (req, res) => {
  const tenantId = resolveTenantId(req)
  const connector = await getTenantConnector(tenantId)
  const rows = await loadEstoqueRows(tenantId)
  const mapped = rows
    .map((row) => {
      const cls = classifyEstoqueItem(row, connector)
      if (cls !== 'materia-prima' && cls !== 'outro') return null
      const material = asText(pickRaw(row, MATERIAL_KEYS))
      if (!material) return null
      const qtdeAtual = asNumber(pickRaw(row, QTD_KEYS), 0)
      const qtdeMinima = asNumber(pickRaw(row, QTD_MIN_KEYS), 0)
      const custoUnitario = asNumber(pickRaw(row, CUSTO_UNIT_KEYS), 0)
      const custoTotal = calcCustoTotal(row, qtdeAtual, custoUnitario)
      return {
        id: asText(pickRaw(row, ID_KEYS), `mp_${randomBytes(4).toString('hex')}`),
        material,
        unidade: asText(pickRaw(row, UNIDADE_KEYS), 'UN'),
        qtdeAtual,
        qtdeMinima,
        custoUnitario,
        custoTotal,
        ultimaEntrada: isoDateOrToday(pickRaw(row, DATA_KEYS)),
        fornecedor: asText(pickRaw(row, FORNECEDOR_KEYS), 'Não informado'),
        status: estoqueStatus(qtdeAtual, qtdeMinima),
        detalhes: row,
      }
    })
    .filter(Boolean)
  res.json(mapped)
})

/**
 * Handler de produtos intermediários: itens classificados pelo connector como
 * 'espuma' (intermediario primário) ou 'aglomerado' (subproduto). O label
 * `tipo` na resposta usa a classificação do connector — frontend pode formatar
 * com `tenant.connector.labels.product` se quiser display amigável.
 */
async function listEstoqueIntermediario(req: import('express').Request, res: import('express').Response) {
  const tenantId = resolveTenantId(req)
  const connector = await getTenantConnector(tenantId)
  const rows = await loadEstoqueRows(tenantId)
  const mapped = rows
    .map((row) => {
      const cls = classifyEstoqueItem(row, connector)
      if (cls !== 'espuma' && cls !== 'aglomerado') return null
      const produto = asText(pickRaw(row, MATERIAL_KEYS))
      if (!produto) return null
      /** Mantemos `tipo` em PT-BR para compatibilidade com clientes legados; se o connector é genérico/comércio, sempre será 'Espuma' aqui (vazio no filtro). */
      const tipo: 'Espuma' | 'Aglomerado' = cls === 'aglomerado' ? 'Aglomerado' : 'Espuma'
      const qtdeAtual = asNumber(pickRaw(row, QTD_KEYS), 0)
      const qtdeMinima = asNumber(pickRaw(row, QTD_MIN_KEYS), 0)
      const custoUnitario = asNumber(pickRaw(row, CUSTO_UNIT_KEYS), 0)
      const custoTotal = calcCustoTotal(row, qtdeAtual, custoUnitario)
      return {
        id: asText(pickRaw(row, ID_KEYS), `es_${randomBytes(4).toString('hex')}`),
        produto,
        tipo,
        classification: cls,
        densidade: asText(pickRaw(row, ['densidade', 'dens', 'densid']), '-'),
        unidade: asText(pickRaw(row, UNIDADE_KEYS), 'UN'),
        qtdeAtual,
        qtdeMinima,
        custoUnitario,
        custoTotal,
        ultimaEntrada: isoDateOrToday(pickRaw(row, DATA_KEYS)),
        status: estoqueStatus(qtdeAtual, qtdeMinima),
        detalhes: row,
      }
    })
    .filter(Boolean)
  res.json(mapped)
}

/** Endpoint preferencial — neutro de segmento. */
financeRouter.get('/estoque-intermediario', listEstoqueIntermediario)
/** @deprecated Use /estoque-intermediario. Mantido para compatibilidade com clientes legados. */
financeRouter.get('/estoque-espuma', listEstoqueIntermediario)

// GET /finance/estoque-produto-final
financeRouter.get('/estoque-produto-final', async (req, res) => {
  const tenantId = resolveTenantId(req)
  const connector = await getTenantConnector(tenantId)
  const rows = await loadEstoqueRows(tenantId)
  const mapped = rows
    .map((row) => {
      const cls = classifyEstoqueItem(row, connector)
      if (cls !== 'produto-final') return null
      const produto = asText(pickRaw(row, MATERIAL_KEYS))
      if (!produto) return null
      const tipo: 'Espuma' | 'Aglomerado' = /aglomerado/i.test(produto) ? 'Aglomerado' : 'Espuma'
      const qtdeAtual = asNumber(pickRaw(row, QTD_KEYS), 0)
      const qtdeMinima = asNumber(pickRaw(row, QTD_MIN_KEYS), 0)
      const custoUnitario = asNumber(pickRaw(row, CUSTO_UNIT_KEYS), 0)
      const custoTotal = calcCustoTotal(row, qtdeAtual, custoUnitario)
      const precoVenda = asNumber(pickRaw(row, PRECO_VENDA_KEYS), 0)
      return {
        id: asText(pickRaw(row, ID_KEYS), `pf_${randomBytes(4).toString('hex')}`),
        produto,
        tipo,
        densidade: asText(pickRaw(row, ['densidade', 'dens', 'densid']), '-'),
        dimensoes: asText(pickRaw(row, ['dimensoes', 'dimensao', 'medidas']), '-'),
        unidade: asText(pickRaw(row, UNIDADE_KEYS), 'UN'),
        qtdeAtual,
        qtdeMinima,
        custoUnitario,
        custoTotal,
        precoVenda,
        ultimaEntrada: isoDateOrToday(pickRaw(row, DATA_KEYS)),
        status: estoqueStatus(qtdeAtual, qtdeMinima),
        detalhes: row,
      }
    })
    .filter(Boolean)
  res.json(mapped)
})

