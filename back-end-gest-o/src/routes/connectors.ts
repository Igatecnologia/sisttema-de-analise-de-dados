import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { ConnectorRegistry } from '../connectors/connectorRegistry.js'
import type { ConnectorArea } from '../connectors/industryConnector.js'

type ConnectorSchemaEndpoint = {
  area: ConnectorArea
  method: 'GET'
  path: string
  description: string
  requiredFields: string[]
  optionalFields: string[]
}

const AREA_SCHEMAS: Record<ConnectorArea, Omit<ConnectorSchemaEndpoint, 'area' | 'path'>> = {
  estoque: {
    method: 'GET',
    description: 'Saldo de estoque por produto ou materia-prima.',
    requiredFields: ['produto', 'qtdeatual'],
    optionalFields: ['id', 'codigo', 'grupo', 'categoria', 'qtdeminima', 'unidade', 'customedio'],
  },
  produzido: {
    method: 'GET',
    description: 'Apontamentos de producao ou ordens produzidas.',
    requiredFields: ['produto', 'quantidade', 'data'],
    optionalFields: ['id', 'ordem', 'grupo', 'turno', 'operador', 'custo'],
  },
  vendas: {
    method: 'GET',
    description: 'Pedidos, vendas ou venda analitica.',
    requiredFields: ['data', 'produto', 'total'],
    optionalFields: ['id', 'pedido', 'cliente', 'vendedor', 'qtde', 'quantidade', 'status'],
  },
  compras: {
    method: 'GET',
    description: 'Compras de insumos, materia-prima ou produtos.',
    requiredFields: ['data', 'produto', 'total'],
    optionalFields: ['id', 'fornecedor', 'quantidade', 'qtde', 'unidade', 'status'],
  },
  contas: {
    method: 'GET',
    description: 'Contas a pagar para fluxo financeiro.',
    requiredFields: ['vencimento', 'valor', 'fornecedor'],
    optionalFields: ['id', 'documento', 'emissao', 'pagamento', 'status', 'categoria'],
  },
  notasfiscais: {
    method: 'GET',
    description: 'Notas fiscais emitidas ou recebidas.',
    requiredFields: ['numero', 'data', 'valor'],
    optionalFields: ['id', 'serie', 'cliente', 'fornecedor', 'chave', 'status', 'tipo'],
  },
}

const CUSTOM_API_PATHS: Record<ConnectorArea, string> = {
  estoque: '/iga/v1/estoque',
  produzido: '/iga/v1/produzido',
  vendas: '/iga/v1/vendas',
  compras: '/iga/v1/compras',
  contas: '/iga/v1/contas-pagar',
  notasfiscais: '/iga/v1/notas-fiscais',
}

const COMING_SOON_CONNECTORS = new Set(['bling', 'tiny', 'omie'])

function connectorStatus(id: string): 'ready' | 'coming-soon' {
  return COMING_SOON_CONNECTORS.has(id) ? 'coming-soon' : 'ready'
}

function buildSchema(id: string) {
  const connector = ConnectorRegistry.get(id)
  const areas = Object.entries(connector.areaHints)
    .filter(([, hints]) => hints.length > 0)
    .map(([area]) => area as ConnectorArea)

  const endpoints = areas.map((area) => {
    const base = AREA_SCHEMAS[area]
    return {
      area,
      path: connector.id === 'iga-custom-api'
        ? CUSTOM_API_PATHS[area]
        : connector.areaHints[area][0] ?? `/${area}`,
      ...base,
    }
  })

  return {
    id: connector.id,
    name: connector.name,
    status: connectorStatus(connector.id),
    description: connector.id === 'iga-custom-api'
      ? 'Contrato REST padronizado para adapters criados pela IGA quando o ERP nao possui API oficial.'
      : 'Contrato de configuracao usado pelo marketplace para criar datasources REST.',
    authMethods: ['none', 'bearer_token', 'api_key', 'basic_auth'],
    responseShape: {
      preferred: 'Array JSON na raiz',
      accepted: ['Array JSON', '{ data: [...] }', '{ items: [...] }', '{ results: [...] }'],
      pagination: ['page/per_page', 'offset/limit', 'cursor'],
    },
    endpoints,
    exampleResponse: {
      estoque: [
        { produto: 'Produto exemplo', grupo: 'PRODUTO FINAL', qtdeatual: 42, qtdeminima: 10 },
      ],
      vendas: [
        { data: '2026-05-08', produto: 'Produto exemplo', cliente: 'Cliente exemplo', qtde: 2, total: 199.9 },
      ],
    },
  }
}

/**
 * GET /api/v1/connectors — lista connectors disponiveis (S8).
 * Frontend usa para popular marketplace de integracoes.
 */
export const connectorsRouter = Router()
connectorsRouter.use(requireAuth)

connectorsRouter.get('/', (_req, res) => {
  const list = ConnectorRegistry.list().map((c) => ({
    id: c.id,
    name: c.name,
    labels: c.labels,
    cspConnectSrc: c.cspConnectSrc,
    /** Areas que o connector suporta (chaves nao vazias em areaHints). */
    areas: Object.entries(c.areaHints)
      .filter(([, hints]) => hints.length > 0)
      .map(([area]) => area),
    warmTargets: c.warmTargets.map((t) => ({ label: t.label, area: t.area })),
    status: connectorStatus(c.id),
    schemaUrl: `/api/v1/connectors/${c.id}/schema`,
  }))
  res.json({ connectors: list })
})

connectorsRouter.get('/:id/schema', (req, res) => {
  const connector = ConnectorRegistry.get(req.params.id)
  if (connector.id !== req.params.id && req.params.id !== 'generic') {
    return res.status(404).json({ message: 'Connector nao encontrado' })
  }
  res.json(buildSchema(req.params.id))
})

connectorsRouter.post('/reload', (_req, res) => {
  res.json({ ok: true, ...ConnectorRegistry.reload() })
})
