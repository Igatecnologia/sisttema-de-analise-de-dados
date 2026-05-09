// ─── Tipos de domínio (extraídos dos schemas Zod em api/schemas.ts) ─────────
// Estes tipos representam as entidades retornadas pelas APIs.

/* ── Usuários ── */

export type UserRole = 'admin' | 'manager' | 'viewer'

export type User = {
  id: string
  name: string
  email: string
  role: UserRole
  status: 'active' | 'inactive'
  /** `null` ou ausente = pacote padrão do perfil; array = lista gravada no servidor */
  permissions?: string[] | null
  password?: string
  createdAt: string
  updatedAt?: string
}

/* ── Auditoria ��─ */

export type AuditAction =
  | 'login'
  | 'logout'
  | 'users.create'
  | 'users.update'
  | 'users.delete'
  | 'reports.export'
  | 'pii.reveal'

export type AuditDiff = {
  before: Record<string, unknown>
  after: Record<string, unknown>
}

export type AuditLog = {
  id: string
  at: string
  actor: string
  action: AuditAction
  target?: string
  piiMasked?: boolean
  sensitiveAccessLogged?: boolean
  diff?: AuditDiff
  meta?: Record<string, unknown>
}

/* ── Dashboard ── */

export type Kpi = {
  key: 'vendas' | 'usuarios' | 'faturamento'
  label: string
  value: number
  previousValue: number
  deltaPct: number
  trend: number[]
}

export type SalesPoint = { date: string; value: number }
export type RevenuePoint = { month: string; value: number }
export type HeatmapPoint = { day: string; hour: number; value: number }

export type DashboardLatestRow = {
  id: string
  cliente: string
  total: number
  status: 'pago' | 'pendente' | 'cancelado'
  data: string
  produto: string
  codprod: string | number
  codcliente: string | number
  qtde: number
  valorunit: number
  custounit: number
  margem: number
}

export type DashboardData = {
  kpis: Kpi[]
  sales: SalesPoint[]
  revenue: RevenuePoint[]
  heatmap: HeatmapPoint[]
  latest: DashboardLatestRow[]
}

/* ── Financeiro ── */

export type FinanceEntry = {
  id: string
  date: string
  category: 'Receita' | 'Custo Fixo' | 'Custo Variável' | 'Imposto'
  description: string
  amount: number
  /** Custo da linha (SGBR analítico) — permite alinhar KPIs ao filtro de busca. */
  linhaCusto?: number
}

/** Metadados do GET /api/proxy/data (paginação SGBR). */
export type AnaliticoFetchMeta = {
  truncated: boolean
  pagesFetched: number
  rowCount: number
}

export type FinanceOverview = {
  receita: number
  custos: number
  lucro: number
  margemPct: number
  linhasCount?: number
  /** Presente quando os dados vêm do analítico SGBR via proxy. */
  analiticoFetchMeta?: AnaliticoFetchMeta
  monthlyFlow: Array<{
    month: string
    receita: number
    custos: number
    lucro: number
  }>
  entries: FinanceEntry[]
}

/* ── Relatórios ── */

export type ReportItem = {
  id: string
  nome: string
  categoria: 'Vendas' | 'Usuários' | 'Financeiro'
  tipo: 'Performance' | 'Financeiro' | 'Conversão' | 'Retenção' | 'Tendência' | 'TopN' | 'Sazonalidade' | 'Segmentação'
  valorPrincipal: number
  valorSecundario: number
  segmento: 'SMB' | 'MidMarket' | 'Enterprise'
  atualizadoEm: string
}

/* ── ERP ── */

export type StatusOperacional = 'Pendente' | 'Em Produção' | 'Concluído' | 'Faturado' | 'Cancelado'
export type TipoEspuma = 'Espuma' | 'Aglomerado'
export type FormaPagamento = 'Dinheiro' | 'PIX' | 'Cartão' | 'Boleto' | 'Prazo'
export type ClassificacaoCompra = 'Produção' | 'Despesa Operacional'

export type CompraMateriaPrima = {
  id: string; data: string; fornecedor: string; material: string; unidade: string
  quantidade: number; custoUnitario: number; custoTotal: number
  classificacao: ClassificacaoCompra; notaFiscal: string; status: 'Recebido' | 'Pendente' | 'Cancelado'
}

export type LoteProducao = {
  id: string; data: string; tipo: TipoEspuma; densidade: string
  volumeTotalM3: number; custoMateriaPrima: number; custoEnergia: number
  custoMaoDeObra: number; custoPerdas: number; custoIndiretos: number
  custoTotalLote: number; custoPorM3: number; rendimentoPct: number
  operador: string; status: StatusOperacional; observacoes: string
}

export type FichaTecnica = {
  id: string; produto: string; tipo: TipoEspuma; densidade: string
  alturaM: number; larguraM: number; comprimentoM: number; volumeM3: number
  pesoEstimadoKg: number; consumoMateriaPrimaKg: number
  custoMateriaPrima: number; custoConversao: number; custoEstimado: number
  custoPorM3: number; precoSugerido: number; margemAlvoPct: number; ativo: boolean
}

export type ItemPedido = {
  fichaTecnicaId: string; produto: string; quantidade: number
  volumeM3Unitario: number; volumeM3Total: number; precoUnitario: number; precoTotal: number
}

export type Pedido = {
  id: string; data: string; cliente: string; itens: ItemPedido[]
  totalPecas: number; totalM3: number; totalValor: number
  formaPagamento: FormaPagamento; status: StatusOperacional; observacoes: string
}

export type OrdemProducao = {
  id: string; data: string; pedidoIds: string[]; produtos: string[]
  totalPecas: number; totalM3: number; consumoEstimadoM3: number; loteIds: string[]
  status: StatusOperacional; dataPrevista: string; dataConclusao: string | null; observacoes: string
}

/** Documentos fiscais eletrônicos comuns no Brasil (exibição na aba Notas fiscais). */
export type TipoDocumentoFiscal = 'NF-e' | 'NFS-e' | 'NFC-e' | 'CT-e' | 'Outro'

export type Faturamento = {
  id: string; data: string; pedidoId: string; cliente: string; numeroNF: string
  /** NF-e mercadorias, NFS-e serviço municipal, NFC-e consumidor, CT-e transporte. */
  tipoDocumento: TipoDocumentoFiscal
  valorProdutos: number; valorFrete: number; valorImpostos: number; valorTotal: number
  formaPagamento: FormaPagamento; status: 'Emitida' | 'Cancelada' | 'Pendente'
}

export type MovimentoEstoque = {
  id: string; data: string; nivelEstoque: 'Insumo' | 'Produto Base'; item: string
  tipoMovimento: 'Entrada' | 'Saída'; origem: 'Compra' | 'Produção' | 'Venda' | 'OP' | 'Ajuste' | 'Devolução'
  referenciaId: string; quantidade: number; unidade: string
  custoUnitario: number; custoTotal: number; saldoAnterior: number; saldoAtual: number
}

export type CustoRealProduto = {
  fichaTecnicaId: string; produto: string; densidade: string
  custoMateriaPrima: number; custoEnergia: number; custoMaoDeObra: number
  custoPerdas: number; custoIndiretos: number; custoRealTotal: number
  custoRealPorM3: number; precoVenda: number; margemRealPct: number
  margemAlvoPct: number; alertaMargem: boolean
}

export type AlertaOperacional = {
  id: string; data: string
  tipo: 'margem_baixa' | 'estoque_critico' | 'vazamento_lucro' | 'producao_atrasada' | 'inadimplencia'
  severidade: 'alta' | 'media' | 'baixa'
  titulo: string; descricao: string; referenciaId: string; lido: boolean
}

/* ── Finance Reports ── */

export type ConciliacaoRow = {
  id: string; cliente: string; dataVenda: string; valorVenda: number
  dataPagamento: string | null; valorPago: number; diferenca: number
  status: 'Conciliado' | 'Pendente' | 'Divergente'
}

export type ContaPagar = {
  id: string; fornecedor: string; descricao: string
  categoria: 'Matéria Prima' | 'Energia' | 'Folha' | 'Impostos' | 'Frete' | 'Outros'
  valor: number; dataEmissao: string; dataVencimento: string
  dataPagamento: string | null; status: 'Pago' | 'A vencer' | 'Vencido'
}

export type ContaReceber = {
  id: string; cliente: string; descricao: string; valor: number
  dataEmissao: string; dataVencimento: string; dataRecebimento: string | null
  status: 'Recebido' | 'A vencer' | 'Vencido'
}

export type EstoqueMateriaPrima = {
  id: string; material: string; unidade: string; qtdeAtual: number; qtdeMinima: number
  custoUnitario: number; custoTotal: number; ultimaEntrada: string
  fornecedor: string; status: 'Normal' | 'Baixo' | 'Crítico'
  detalhes?: Record<string, unknown>
}

export type EstoqueEspuma = {
  id: string; produto: string; tipo: TipoEspuma; densidade: string; unidade: string
  qtdeAtual: number; qtdeMinima: number; custoUnitario: number; custoTotal: number
  ultimaEntrada: string; status: 'Normal' | 'Baixo' | 'Crítico'
  detalhes?: Record<string, unknown>
}

export type EstoqueProdutoFinal = {
  id: string; produto: string; tipo: TipoEspuma; densidade: string
  dimensoes: string; unidade: string; qtdeAtual: number; qtdeMinima: number
  custoUnitario: number; custoTotal: number; precoVenda: number
  ultimaEntrada: string; status: 'Normal' | 'Baixo' | 'Crítico'
  detalhes?: Record<string, unknown>
}

export type VendaEspuma = {
  id: string; data: string; cliente: string; produto: string; tipo: TipoEspuma
  densidade: string; qtde: number; unidade: string; precoUnitario: number; total: number
  formaPagamento: FormaPagamento
}
