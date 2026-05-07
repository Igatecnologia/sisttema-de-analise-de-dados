export type ProductClassification =
  | 'materia-prima'
  | 'espuma'
  | 'aglomerado'
  | 'produto-final'
  | 'outro'

export type ConnectorLabels = {
  product: string
  productPlural: string
  rawMaterial: string
  finishedProduct: string
  production: string
  stock: string
  sales: string
}

export type ConnectorDemoData = {
  stockRows: Record<string, unknown>[]
  salesRows: Record<string, unknown>[]
}

/**
 * Areas logicas reconhecidas pelo backend. Connectors mapeiam cada uma para
 * substrings de endpoints reais (ex.: SGBR usa "/sgbrbi/estoque", Bling usa
 * "/v3/produtos/estoque"). Adicione novas areas aqui antes de usar nas rotas.
 */
export type ConnectorArea =
  | 'estoque'
  | 'produzido'
  | 'vendas'
  | 'compras'
  | 'contas'
  | 'notasfiscais'

export type WarmTarget = {
  /** Identificador curto, usado em logs. */
  label: string
  /** Area logica — o connector resolve para o endpoint real do datasource. */
  area: ConnectorArea
  /** Query string opcional (ex.: `{ dt_de, dt_ate }`). */
  query?: Record<string, string>
}

export interface IndustryConnector {
  id: string
  name: string
  cspConnectSrc: string[]
  labels: ConnectorLabels
  /** Substrings que matcham endpoints reais por area. Primeiro match vence. */
  areaHints: Record<ConnectorArea, string[]>
  /** Endpoints aquecidos pelo job de warm cache. Vazio = job desligado para o connector. */
  warmTargets: WarmTarget[]
  getProductTypes(): string[]
  classifyProduct(row: Record<string, unknown>): ProductClassification
  normalizeRow(row: Record<string, unknown>, area?: string): Record<string, unknown>
  getDemoData(): ConnectorDemoData
}

export function pickText(row: Record<string, unknown>, keys: string[], fallback = ''): string {
  const lowerMap = new Map(Object.keys(row).map((key) => [key.toLowerCase(), key]))
  for (const key of keys) {
    const actual = key in row ? key : lowerMap.get(key.toLowerCase())
    const value = actual ? row[actual] : undefined
    if (typeof value === 'string' && value.trim()) return value.trim()
    if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  }
  return fallback
}

