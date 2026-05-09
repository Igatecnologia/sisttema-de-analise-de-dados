import type { BusinessSegment } from '../segments.js'
import { GenericConnector } from './genericConnector.js'
import {
  type ConnectorArea,
  type ConnectorDemoData,
  type ProductClassification,
  type WarmTarget,
  pickText,
} from './industryConnector.js'

function formatSgbrDate(d: Date): string {
  return d.toISOString().slice(0, 10).replace(/-/g, '.')
}
function sevenDaysAgo(): string {
  const d = new Date()
  d.setDate(d.getDate() - 7)
  return formatSgbrDate(d)
}
function todayStr(): string {
  return formatSgbrDate(new Date())
}

export class SgbrEspumaConnector extends GenericConnector {
  id = 'sgbr-espuma'
  name = 'SGBR Espuma'
  cspConnectSrc = ['https://*.sgbrbi.com.br']
  /** SGBR Espuma é específico de indústria de espuma — não atende outros segmentos. */
  segments: BusinessSegment[] = ['industry']
  labels = {
    product: 'Espuma',
    productPlural: 'Espumas',
    rawMaterial: 'Materia-prima',
    finishedProduct: 'Produto final',
    production: 'Producao de espuma',
    stock: 'Estoque de espuma',
    sales: 'Vendas SGBR',
  }

  /** Hints especificos do SGBR — paths reais da API /sgbrbi/* tem prioridade. */
  areaHints: Record<ConnectorArea, string[]> = {
    estoque: ['/sgbrbi/estoque', 'estoque'],
    produzido: ['/sgbrbi/produzido', 'produzido'],
    vendas: ['/sgbrbi/vendas', 'vendas'],
    compras: ['/sgbrbi/compras', 'compras'],
    contas: ['/sgbrbi/contas', 'contas', 'pagar'],
    notasfiscais: ['/sgbrbi/vendanfe', '/sgbrbi/notasfiscais', '/sgbrbi/notafiscal', 'vendanfe', 'notafiscal'],
  }

  /**
   * Cache aquecido com endpoints SGBR mais lentos. `estoque` vem primeiro pois
   * nao usa filtro de data e leva ~22-25s; demais usam janela de 7 dias.
   */
  warmTargets: WarmTarget[] = [
    { label: 'estoque', area: 'estoque' },
    { label: 'vendas', area: 'vendas', query: { dt_de: sevenDaysAgo(), dt_ate: todayStr() } },
    { label: 'produzido', area: 'produzido', query: { dt_de: sevenDaysAgo(), dt_ate: todayStr() } },
    { label: 'compras', area: 'compras', query: { dt_de: sevenDaysAgo(), dt_ate: todayStr() } },
    { label: 'contas', area: 'contas', query: { dt_de: sevenDaysAgo(), dt_ate: todayStr() } },
  ]

  getProductTypes(): string[] {
    return ['materia-prima', 'espuma', 'aglomerado', 'produto-final', 'outro']
  }

  classifyProduct(row: Record<string, unknown>): ProductClassification {
    const group = pickText(row, ['grupo']).toUpperCase()
    const product = pickText(row, ['produto', 'descricao', 'decprod', 'nomeproduto']).toUpperCase()
    if (group === 'MATERIA PRIMA' || group === 'INSUMO') return 'materia-prima'
    if (group === 'PRODUTO BASE') return /AGLOMERADO/.test(product) ? 'aglomerado' : 'espuma'
    if (group === 'PRODUTO FINAL') return 'produto-final'
    if (/AGLOMERADO/.test(product)) return 'aglomerado'
    if (/ESPUMA|EUROPA|BLOCO/.test(product)) return 'espuma'
    return 'outro'
  }

  getDemoData(): ConnectorDemoData {
    return {
      stockRows: [
        { controle: 1001, produto: 'Espuma D28 Demo', grupo: 'PRODUTO BASE', qtdeatual: 32, qtdeminima: 8, precocusto: 145 },
        { controle: 1002, produto: 'Aglomerado Demo', grupo: 'PRODUTO BASE', qtdeatual: 14, qtdeminima: 6, precocusto: 98 },
        { controle: 2001, produto: 'Colchao Demo', grupo: 'PRODUTO FINAL', qtdeatual: 21, qtdeminima: 5, precocusto: 280, precovenda: 520 },
      ],
      salesRows: [
        { datafec: new Date().toISOString().slice(0, 10), decprod: 'Colchao Demo', qtdevendida: 3, total: 1560 },
      ],
    }
  }
}
