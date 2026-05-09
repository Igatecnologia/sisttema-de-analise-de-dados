import type {
  CompraMateriaPrima,
  LoteProducao,
  FichaTecnica,
  Pedido,
  OrdemProducao,
  Faturamento,
  MovimentoEstoque,
  CustoRealProduto,
  AlertaOperacional,
} from '../types/models'
import { hasAnySources, getNotasFiscaisDataSource } from './dataSourceService'
import { getFaturamentosFromSgbrBiProxy } from './notasFiscaisProxyService'
import { getValidated } from '../api/validatedHttp'
import {
  comprasMateriaPrimaResponseSchema,
  lotesProducaoResponseSchema,
  fichasTecnicasResponseSchema,
  pedidosResponseSchema,
  ordensProducaoResponseSchema,
  faturamentosResponseSchema,
  movimentosEstoqueResponseSchema,
  custoRealProdutosResponseSchema,
  alertasOperacionaisResponseSchema,
  vendasSgbrResponseSchema,
} from '../api/schemas'
import type { VendaSgbr } from '../api/schemas'
import { http } from './http'
import { listAlerts } from './alertsService'

export async function getComprasMateriaPrima(): Promise<CompraMateriaPrima[]> {
  return getValidated(http, '/erp/compras-materia-prima', comprasMateriaPrimaResponseSchema) as Promise<CompraMateriaPrima[]>
}

export async function getLotesProducao(): Promise<LoteProducao[]> {
  return getValidated(http, '/erp/lotes-producao', lotesProducaoResponseSchema) as Promise<LoteProducao[]>
}

export async function getFichasTecnicas(): Promise<FichaTecnica[]> {
  return getValidated(http, '/erp/fichas-tecnicas', fichasTecnicasResponseSchema) as Promise<FichaTecnica[]>
}

export async function getPedidos(): Promise<Pedido[]> {
  return getValidated(http, '/erp/pedidos', pedidosResponseSchema) as Promise<Pedido[]>
}

export async function getOrdensProducao(): Promise<OrdemProducao[]> {
  return getValidated(http, '/erp/ordens-producao', ordensProducaoResponseSchema) as Promise<OrdemProducao[]>
}

export async function getVendasSgbr(params?: { dtDe: string; dtAte: string }): Promise<VendaSgbr[]> {
  const qs = params ? `?dt_de=${params.dtDe.replace(/-/g, '.')}&dt_ate=${params.dtAte.replace(/-/g, '.')}` : ''
  return getValidated(http, `/erp/vendas-sgbr${qs}`, vendasSgbrResponseSchema) as Promise<VendaSgbr[]>
}

/** Período padrão alinhado à aba Comercial → Notas fiscais (últimos 12 meses). */
export function getDefaultFaturamentoDateRange(): { dtDe: string; dtAte: string } {
  const end = new Date()
  const start = new Date(end)
  start.setFullYear(start.getFullYear() - 1)
  const iso = (d: Date) => d.toISOString().slice(0, 10)
  return { dtDe: iso(start), dtAte: iso(end) }
}

/**
 * Com fonte SGBR `notasfiscais/*` cadastrada, busca via proxy; senão mantém stub `/erp/faturamentos`.
 */
export async function getFaturamentos(opts?: { dtDe?: string; dtAte?: string }): Promise<Faturamento[]> {
  const nf = getNotasFiscaisDataSource()
  if (hasAnySources() && nf) {
    const { dtDe, dtAte } = getDefaultFaturamentoDateRange()
    return getFaturamentosFromSgbrBiProxy({
      dtDe: opts?.dtDe ?? dtDe,
      dtAte: opts?.dtAte ?? dtAte,
      dsId: nf.id,
      dataEndpoint: nf.dataEndpoint,
    })
  }
  return getValidated(http, '/erp/faturamentos', faturamentosResponseSchema) as Promise<Faturamento[]>
}

export async function getMovimentosEstoque(): Promise<MovimentoEstoque[]> {
  return getValidated(http, '/erp/movimentos-estoque', movimentosEstoqueResponseSchema) as Promise<MovimentoEstoque[]>
}

export async function getCustoRealProdutos(): Promise<CustoRealProduto[]> {
  return getValidated(http, '/erp/custo-real', custoRealProdutosResponseSchema) as Promise<CustoRealProduto[]>
}

export async function getAlertasOperacionais(): Promise<AlertaOperacional[]> {
  const erpAlerts = await getValidated(http, '/erp/alertas', alertasOperacionaisResponseSchema) as AlertaOperacional[]
  if (erpAlerts.length > 0) return erpAlerts

  const appAlerts = await listAlerts()
  return appAlerts.map((item) => ({
    id: item.id,
    data: item.createdAt.slice(0, 10),
    tipo: mapAlertTypeToOperacional(item.type),
    severidade: mapAlertSeverityToOperacional(item.severity),
    titulo: item.title,
    descricao: item.message,
    referenciaId: item.id,
    lido: Boolean(item.readAt),
  }))
}

function mapAlertTypeToOperacional(type: string): AlertaOperacional['tipo'] {
  if (type === 'proxy_error') return 'producao_atrasada'
  if (type === 'alert_volume') return 'estoque_critico'
  if (type === 'system_status') return 'producao_atrasada'
  return 'vazamento_lucro'
}

function mapAlertSeverityToOperacional(severity: 'info' | 'warning' | 'error'): AlertaOperacional['severidade'] {
  if (severity === 'error') return 'alta'
  if (severity === 'warning') return 'media'
  return 'baixa'
}
