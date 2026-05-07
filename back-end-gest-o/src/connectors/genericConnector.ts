import {
  type ConnectorArea,
  type ConnectorDemoData,
  type IndustryConnector,
  type ProductClassification,
  type WarmTarget,
  pickText,
} from './industryConnector.js'

export class GenericConnector implements IndustryConnector {
  id = 'generic'
  name = 'Generic'
  cspConnectSrc: string[] = []
  labels = {
    product: 'Produto',
    productPlural: 'Produtos',
    rawMaterial: 'Materia-prima',
    finishedProduct: 'Produto final',
    production: 'Producao',
    stock: 'Estoque',
    sales: 'Vendas',
  }

  /** Hints amplos para datasources genericos. Override no connector especifico. */
  areaHints: Record<ConnectorArea, string[]> = {
    estoque: ['estoque', 'inventory', 'stock'],
    produzido: ['produzido', 'produced', 'producao', 'production'],
    vendas: ['vendas', 'sales', 'orders'],
    compras: ['compras', 'purchases', 'purchase'],
    contas: ['contas', 'accounts', 'pagar', 'pay'],
    notasfiscais: ['notasfiscais', 'notafiscal', 'invoices', 'vendanfe'],
  }

  /** Sem warm cache por default — connector especifico opta-in se quiser. */
  warmTargets: WarmTarget[] = []

  getProductTypes(): string[] {
    return ['materia-prima', 'produto-final', 'outro']
  }

  classifyProduct(row: Record<string, unknown>): ProductClassification {
    const text = pickText(row, ['grupo', 'tipo', 'categoria', 'produto', 'descricao']).toUpperCase()
    if (/MATERIA|INSUMO|RAW/.test(text)) return 'materia-prima'
    if (/FINAL|FINISHED/.test(text)) return 'produto-final'
    return 'outro'
  }

  normalizeRow(row: Record<string, unknown>): Record<string, unknown> {
    return row
  }

  getDemoData(): ConnectorDemoData {
    return {
      stockRows: [
        { id: 'demo-mp-1', produto: 'Materia-prima demo', grupo: 'MATERIA PRIMA', qtdeatual: 120, qtdeminima: 40 },
        { id: 'demo-pf-1', produto: 'Produto final demo', grupo: 'PRODUTO FINAL', qtdeatual: 48, qtdeminima: 12 },
      ],
      salesRows: [
        { data: new Date().toISOString().slice(0, 10), produto: 'Produto final demo', total: 1250, qtde: 10 },
      ],
    }
  }
}
