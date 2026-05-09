import type { BusinessSegment } from '../segments.js'
import { GenericConnector } from './genericConnector.js'
import type { ConnectorArea, WarmTarget } from './industryConnector.js'

/**
 * Connector para APIs criadas pela IGA quando o ERP do cliente nao possui API
 * oficial. A integracao fica no formato REST padronizado e o painel consome
 * cada area como qualquer outro datasource.
 */
export class IgaCustomApiConnector extends GenericConnector {
  id = 'iga-custom-api'
  name = 'API propria IGA'
  cspConnectSrc: string[] = []
  /** Custom API atende qualquer segmento — a normalização vem do mapeamento. */
  segments: BusinessSegment[] = ['industry', 'commerce', 'services', 'distribution']

  areaHints: Record<ConnectorArea, string[]> = {
    estoque: ['/iga/v1/estoque', '/api/iga/estoque', 'iga/estoque', 'estoque'],
    produzido: ['/iga/v1/produzido', '/iga/v1/producao', 'iga/produzido', 'producao'],
    vendas: ['/iga/v1/vendas', '/iga/v1/pedidos', 'iga/vendas', 'pedidos'],
    compras: ['/iga/v1/compras', 'iga/compras'],
    contas: ['/iga/v1/contas-pagar', '/iga/v1/financeiro/contas-pagar', 'contas-pagar'],
    recebiveis: ['/iga/v1/contas-receber', '/iga/v1/financeiro/contas-receber', '/iga/v1/recebiveis', 'contas-receber'],
    notasfiscais: ['/iga/v1/notas-fiscais', '/iga/v1/nfe', 'notas-fiscais', 'nfe'],
  }

  warmTargets: WarmTarget[] = [
    { label: 'estoque', area: 'estoque' },
    { label: 'vendas', area: 'vendas' },
    { label: 'contas', area: 'contas' },
  ]
}
