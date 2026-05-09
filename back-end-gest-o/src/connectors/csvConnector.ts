import type { BusinessSegment } from '../segments.js'
import { GenericConnector } from './genericConnector.js'
import {
  type ConnectorArea,
  type ProductClassification,
  type WarmTarget,
  pickText,
} from './industryConnector.js'

/**
 * CsvConnector — para tenants que sobem dados via CSV/Excel uploadado.
 * Sem warm cache (datasource eh upload manual, nao API live).
 */
export class CsvConnector extends GenericConnector {
  id = 'csv'
  name = 'CSV / Excel'
  cspConnectSrc: string[] = []
  /** CSV/Excel atende qualquer segmento. */
  segments: BusinessSegment[] = ['industry', 'commerce', 'services', 'distribution']

  /** Hints amplos: o usuario nomeia o dataEndpoint como /csv/{area}. */
  areaHints: Record<ConnectorArea, string[]> = {
    estoque: ['estoque', 'inventory', 'stock', 'csv/estoque'],
    produzido: ['produzido', 'producao', 'production', 'csv/producao'],
    vendas: ['vendas', 'sales', 'orders', 'csv/vendas'],
    compras: ['compras', 'purchases', 'csv/compras'],
    contas: ['contas', 'pagar', 'csv/contas'],
    notasfiscais: ['notas', 'nfe', 'invoices', 'csv/nfe'],
  }

  warmTargets: WarmTarget[] = []

  classifyProduct(row: Record<string, unknown>): ProductClassification {
    const text = pickText(row, ['categoria', 'tipo', 'grupo', 'classe', 'product_type']).toUpperCase()
    if (/MATERIA|INSUMO|RAW/.test(text)) return 'materia-prima'
    if (/FINAL|FINISHED|ACABADO/.test(text)) return 'produto-final'
    return 'outro'
  }
}

/**
 * Bling/Tiny/Omie connectors — stubs de hints + areas. APIs reais exigem
 * credenciais OAuth de cada provider; cada empresa instala via marketplace
 * e configura no datasource. Aqui declaramos o connector para CSP/labels e
 * resolucao de areas; a logica de proxy continua generica via DataSource.
 */
export class BlingConnector extends GenericConnector {
  id = 'bling'
  name = 'Bling ERP'
  cspConnectSrc = ['https://*.bling.com.br', 'https://api.bling.com.br']
  /** Bling cobre comércio, distribuição e indústrias menores. */
  segments: BusinessSegment[] = ['commerce', 'distribution', 'industry']
  labels = {
    product: 'Produto',
    productPlural: 'Produtos',
    rawMaterial: 'Materia-prima',
    finishedProduct: 'Produto final',
    production: 'Producao',
    stock: 'Estoque',
    sales: 'Pedidos',
  }
  areaHints: Record<ConnectorArea, string[]> = {
    estoque: ['/v3/estoques', '/produtos/estoque', 'estoque'],
    produzido: ['/v3/producao', 'producao'],
    vendas: ['/v3/pedidos/vendas', 'pedidos', 'vendas'],
    compras: ['/v3/pedidos/compras', 'compras'],
    contas: ['/v3/contas/pagar', 'contas'],
    notasfiscais: ['/v3/nfe', 'nfe', 'notas'],
  }
  warmTargets: WarmTarget[] = [
    { label: 'estoque', area: 'estoque' },
    { label: 'vendas', area: 'vendas' },
  ]
}

export class TinyConnector extends GenericConnector {
  id = 'tiny'
  name = 'Tiny ERP'
  cspConnectSrc = ['https://api.tiny.com.br', 'https://*.tiny.com.br']
  /** Tiny é forte em comércio e distribuição. */
  segments: BusinessSegment[] = ['commerce', 'distribution']
  areaHints: Record<ConnectorArea, string[]> = {
    estoque: ['estoque.pesquisa', 'produto.estoque', 'estoque'],
    produzido: ['producao', 'ordens'],
    vendas: ['pedidos.pesquisa', 'pedidos', 'vendas'],
    compras: ['compras.pesquisa', 'compras'],
    contas: ['contas.pagar', 'contas'],
    notasfiscais: ['nfe.pesquisa', 'nfe'],
  }
  warmTargets: WarmTarget[] = []
}

export class OmieConnector extends GenericConnector {
  id = 'omie'
  name = 'Omie ERP'
  cspConnectSrc = ['https://app.omie.com.br', 'https://*.omie.com.br']
  /** Omie atende serviços, indústria leve e comércio. */
  segments: BusinessSegment[] = ['services', 'industry', 'commerce']
  areaHints: Record<ConnectorArea, string[]> = {
    estoque: ['ConsultarPosEstoque', 'estoque'],
    produzido: ['producao'],
    vendas: ['ListarPedidos', 'pedidos', 'vendas'],
    compras: ['ListarPedidoCompra', 'compras'],
    contas: ['ListarContasPagar', 'contas'],
    notasfiscais: ['ListarNF', 'nfe'],
  }
  warmTargets: WarmTarget[] = []
}
