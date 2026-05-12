/**
 * P2-01 (audit 2026-05-12): Quick Insights pré-prontos por segmento.
 *
 * Diferencial competitivo: ao conectar a 1ª fonte, o tenant ganha 1 pacote
 * pronto com dashboards + alertas + relatórios típicos do segmento dele.
 * Time-to-value cai de 2 semanas → 30 minutos.
 *
 * Estrutura por segmento (industry, commerce, services, distribution):
 *  - widgets: layout do dashboard inicial (KPIs cards + 2-3 charts)
 *  - alertRules: 3-5 alertas base (estoque crítico, margem baixa, etc.)
 *  - reportTemplates: 2-3 relatórios pré-configurados pra schedule
 *
 * Aplica via POST /api/v1/segments/:segment/apply-template — idempotente.
 */
import type { BusinessSegment } from '../segments.js'

export type WidgetDef = {
  id: string
  type: 'metric' | 'line-chart' | 'bar-chart' | 'pie-chart' | 'table'
  title: string
  description: string
  /** Tool ou área que alimenta o widget (referência ao tools/proxy). */
  dataSource: string
  size?: 'sm' | 'md' | 'lg'
}

export type AlertRuleDef = {
  id: string
  title: string
  message: string
  severity: 'info' | 'warning' | 'error' | 'critical'
  /** Tipo de gatilho — string livre, processado pelo alertsEngine. */
  trigger: string
  /** Threshold genérico (ex: 0.8 = 80%, 5 = 5 unidades). */
  threshold?: number
}

export type ReportTemplateDef = {
  id: string
  name: string
  description: string
  /** Tipo do report no sistema de relatórios. */
  reportType: string
  /** Cron sugerido pra agendar (admin pode ajustar depois). */
  suggestedSchedule?: string
}

export type SegmentTemplate = {
  segment: BusinessSegment
  label: string
  description: string
  widgets: WidgetDef[]
  alertRules: AlertRuleDef[]
  reportTemplates: ReportTemplateDef[]
}

const INDUSTRY: SegmentTemplate = {
  segment: 'industry',
  label: 'Indústria',
  description: 'Foco em produção, consumo de matéria-prima, custos por lote e estoque crítico.',
  widgets: [
    { id: 'kpi-faturamento-mes', type: 'metric', title: 'Faturamento do mês', description: 'Comparado com meta e mês anterior', dataSource: 'get_faturamento_mes', size: 'sm' },
    { id: 'kpi-producao-dia', type: 'metric', title: 'Produção do dia', description: 'Total produzido nas últimas 24h', dataSource: 'get_producao_periodo', size: 'sm' },
    { id: 'kpi-estoque-critico', type: 'metric', title: 'Itens em estoque crítico', description: 'Abaixo do mínimo cadastrado', dataSource: 'estoque', size: 'sm' },
    { id: 'kpi-custo-medio', type: 'metric', title: 'Custo médio por m³', description: 'Média ponderada dos últimos lotes', dataSource: 'producao', size: 'sm' },
    { id: 'chart-producao-30d', type: 'line-chart', title: 'Produção diária — 30 dias', description: 'Volume produzido por dia', dataSource: 'producao', size: 'lg' },
    { id: 'chart-consumo-mp', type: 'bar-chart', title: 'Top 10 matérias-primas consumidas', description: 'Ranking por volume no mês', dataSource: 'compras', size: 'md' },
    { id: 'table-estoque-baixo', type: 'table', title: 'Estoque crítico', description: 'Itens abaixo do mínimo', dataSource: 'estoque', size: 'md' },
  ],
  alertRules: [
    { id: 'estoque-mp-critico', title: 'Matéria-prima abaixo do mínimo', message: 'Programar compra urgente', severity: 'error', trigger: 'stock_below_min', threshold: 1 },
    { id: 'margem-baixa', title: 'Margem do lote abaixo do alvo', message: 'Revisar precificação ou custos', severity: 'warning', trigger: 'margin_below_target', threshold: 0.2 },
    { id: 'producao-atrasada', title: 'Ordem de produção atrasada > 1 dia', message: 'Risco de quebra de estoque', severity: 'warning', trigger: 'production_late', threshold: 1 },
    { id: 'custo-mp-pico', title: 'Custo de MP subiu > 8% no último lote', message: 'Negociar com fornecedor', severity: 'warning', trigger: 'cost_spike', threshold: 0.08 },
  ],
  reportTemplates: [
    { id: 'producao-mensal', name: 'Produção mensal consolidada', description: 'Total por SKU + custo médio + rendimento', reportType: 'producao', suggestedSchedule: '0 8 1 * *' },
    { id: 'estoque-semanal', name: 'Estoque crítico semanal', description: 'Itens abaixo do mínimo com previsão de quebra', reportType: 'estoque', suggestedSchedule: '0 8 * * 1' },
    { id: 'compras-mensal', name: 'Compras consolidadas', description: 'Por fornecedor + variação de preço', reportType: 'compras', suggestedSchedule: '0 8 1 * *' },
  ],
}

const COMMERCE: SegmentTemplate = {
  segment: 'commerce',
  label: 'Comércio',
  description: 'Foco em vendas, ticket médio, top produtos e desempenho da equipe comercial.',
  widgets: [
    { id: 'kpi-faturamento-mes', type: 'metric', title: 'Faturamento do mês', description: 'vs meta', dataSource: 'get_faturamento_mes', size: 'sm' },
    { id: 'kpi-ticket-medio', type: 'metric', title: 'Ticket médio', description: 'Últimos 30 dias', dataSource: 'vendas', size: 'sm' },
    { id: 'kpi-pedidos-dia', type: 'metric', title: 'Pedidos hoje', description: 'Faturados + pendentes', dataSource: 'vendas', size: 'sm' },
    { id: 'kpi-margem-bruta', type: 'metric', title: 'Margem bruta %', description: 'Preço venda - custo', dataSource: 'vendas', size: 'sm' },
    { id: 'chart-vendas-30d', type: 'line-chart', title: 'Vendas diárias — 30 dias', description: 'Por dia da semana', dataSource: 'vendas', size: 'lg' },
    { id: 'chart-top-produtos', type: 'bar-chart', title: 'Top 10 produtos', description: 'Mais vendidos no mês', dataSource: 'vendas', size: 'md' },
    { id: 'chart-top-vendedores', type: 'bar-chart', title: 'Top vendedores', description: 'Ranking por faturamento', dataSource: 'vendas', size: 'md' },
  ],
  alertRules: [
    { id: 'estoque-vazio', title: 'Produto em ruptura', message: 'Estoque zerado de produto com venda recente', severity: 'critical', trigger: 'stock_out', threshold: 0 },
    { id: 'venda-cancelada-alta', title: 'Taxa de cancelamento > 10%', message: 'Revisar processo comercial', severity: 'warning', trigger: 'cancellation_rate', threshold: 0.1 },
    { id: 'inadimplencia', title: 'Inadimplência > 5%', message: 'Cliente com pendência financeira', severity: 'warning', trigger: 'overdue_receivables', threshold: 0.05 },
    { id: 'queda-vendas', title: 'Vendas caíram > 20% vs semana anterior', message: 'Investigar causa', severity: 'warning', trigger: 'sales_drop', threshold: 0.2 },
  ],
  reportTemplates: [
    { id: 'vendas-diario', name: 'Resumo diário de vendas', description: 'Faturamento + ticket médio + top produtos', reportType: 'vendas', suggestedSchedule: '0 8 * * *' },
    { id: 'comissao-mensal', name: 'Comissão mensal por vendedor', description: 'Para fechar folha', reportType: 'vendas', suggestedSchedule: '0 8 1 * *' },
    { id: 'inadimplencia', name: 'Inadimplência semanal', description: 'Clientes com títulos vencidos', reportType: 'contas-receber', suggestedSchedule: '0 8 * * 1' },
  ],
}

const SERVICES: SegmentTemplate = {
  segment: 'services',
  label: 'Serviços',
  description: 'Foco em contratos ativos, MRR, churn e cobrança recorrente.',
  widgets: [
    { id: 'kpi-mrr', type: 'metric', title: 'MRR ativo', description: 'Receita mensal recorrente', dataSource: 'vendas', size: 'sm' },
    { id: 'kpi-churn', type: 'metric', title: 'Churn do mês', description: 'Cancelamentos / base ativa', dataSource: 'vendas', size: 'sm' },
    { id: 'kpi-contratos-ativos', type: 'metric', title: 'Contratos ativos', description: 'Renovação automática', dataSource: 'vendas', size: 'sm' },
    { id: 'kpi-cobranca-aberta', type: 'metric', title: 'Cobrança em aberto', description: 'Valor não recebido', dataSource: 'contas-receber', size: 'sm' },
    { id: 'chart-mrr-12m', type: 'line-chart', title: 'Evolução MRR — 12 meses', description: 'Crescimento + churn', dataSource: 'vendas', size: 'lg' },
    { id: 'chart-contratos-vencendo', type: 'table', title: 'Contratos a renovar nos próximos 30 dias', description: 'Priorizar contato comercial', dataSource: 'vendas', size: 'md' },
  ],
  alertRules: [
    { id: 'pagamento-falhou', title: 'Pagamento recorrente falhou', message: 'Contato comercial em 24h', severity: 'critical', trigger: 'payment_failed', threshold: 1 },
    { id: 'churn-alto', title: 'Churn > 5% no mês', message: 'Investigar causa e ativar retenção', severity: 'warning', trigger: 'churn_rate', threshold: 0.05 },
    { id: 'contrato-vencendo', title: 'Contrato vence em 30 dias sem renovação automática', message: 'Acionar comercial', severity: 'warning', trigger: 'contract_expiring', threshold: 30 },
  ],
  reportTemplates: [
    { id: 'mrr-mensal', name: 'MRR e churn mensal', description: 'Highlights da receita recorrente', reportType: 'vendas', suggestedSchedule: '0 8 1 * *' },
    { id: 'cobranca-semanal', name: 'Cobrança em aberto semanal', description: 'Por cliente com tempo de atraso', reportType: 'contas-receber', suggestedSchedule: '0 8 * * 1' },
  ],
}

const DISTRIBUTION: SegmentTemplate = {
  segment: 'distribution',
  label: 'Distribuição',
  description: 'Foco em pedidos por filial, prazos de entrega, estoque distribuído.',
  widgets: [
    { id: 'kpi-pedidos-sla', type: 'metric', title: 'Pedidos no SLA', description: '% no prazo prometido', dataSource: 'vendas', size: 'sm' },
    { id: 'kpi-estoque-cd', type: 'metric', title: 'Cobertura de estoque (dias)', description: 'Por centro de distribuição', dataSource: 'estoque', size: 'sm' },
    { id: 'kpi-entregas-atraso', type: 'metric', title: 'Entregas atrasadas', description: 'Últimos 7 dias', dataSource: 'vendas', size: 'sm' },
    { id: 'kpi-faturamento-filial', type: 'metric', title: 'Faturamento por filial', description: 'Top 5 unidades', dataSource: 'vendas', size: 'sm' },
    { id: 'chart-pedidos-filial', type: 'bar-chart', title: 'Pedidos por filial — 30 dias', description: 'Distribuição geográfica', dataSource: 'vendas', size: 'lg' },
    { id: 'chart-rotas-top', type: 'bar-chart', title: 'Top 10 rotas mais movimentadas', description: 'Volume + valor', dataSource: 'vendas', size: 'md' },
  ],
  alertRules: [
    { id: 'estoque-cd-baixo', title: 'CD com cobertura < 7 dias', message: 'Transferir ou repor', severity: 'error', trigger: 'cd_low_coverage', threshold: 7 },
    { id: 'entrega-atrasada', title: 'Entrega atrasada > 24h vs prometido', message: 'Acionar transportadora', severity: 'warning', trigger: 'delivery_late', threshold: 1 },
    { id: 'rota-quebrada', title: 'Rota sem entregas há 3 dias', message: 'Investigar com operações', severity: 'warning', trigger: 'route_silent', threshold: 3 },
  ],
  reportTemplates: [
    { id: 'sla-semanal', name: 'SLA de entregas semanal', description: 'Por filial e transportadora', reportType: 'vendas', suggestedSchedule: '0 8 * * 1' },
    { id: 'estoque-distribuido', name: 'Estoque distribuído', description: 'Cobertura por CD em dias', reportType: 'estoque', suggestedSchedule: '0 8 * * *' },
  ],
}

const TEMPLATES: Record<BusinessSegment, SegmentTemplate> = {
  industry: INDUSTRY,
  commerce: COMMERCE,
  services: SERVICES,
  distribution: DISTRIBUTION,
}

export function getSegmentTemplate(segment: BusinessSegment): SegmentTemplate {
  return TEMPLATES[segment] ?? INDUSTRY
}

export function listSegmentTemplates(): SegmentTemplate[] {
  return Object.values(TEMPLATES)
}
