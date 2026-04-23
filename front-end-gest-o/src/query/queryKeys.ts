export const queryKeys = {
  dashboard: (params: { period: string; pollMs?: string; start?: string; end?: string; sourceId?: string }) => ['dashboard', params] as const,
  finance: (range?: { dtDe: string; dtAte: string; sourceId?: string }) =>
    range ? (['finance', 'sgbr', range.dtDe, range.dtAte, range.sourceId ?? 'default'] as const) : (['finance'] as const),
  reports: (params: {
    q?: string
    cat?: string
    type?: string
    logic?: string
    startDate?: string
    endDate?: string
    page?: number
    pageSize?: number
    sortBy?: string
    sortOrder?: string
  }) => ['reports', params] as const,
  reportSchedules: () => ['reportSchedules'] as const,
  audit: (params: { q?: string; action?: string }) => ['audit', params] as const,
  users: (params: { q?: string; role?: string; status?: string }) =>
    ['users', params] as const,
  vendasAnalitico: (params: { dtDe: string; dtAte: string; sourceId?: string }) =>
    ['vendasAnalitico', params] as const,

  conciliacao: () => ['conciliacao'] as const,
  contasPagar: (params?: { dtDe: string; dtAte: string; sourceId?: string }) =>
    params
      ? (['contasPagar', 'sgbr', params.dtDe, params.dtAte, params.sourceId ?? 'default'] as const)
      : (['contasPagar'] as const),
  contasReceber: () => ['contasReceber'] as const,
  estoqueMateriaPrima: () => ['estoqueMateriaPrima'] as const,
  estoqueEspuma: () => ['estoqueEspuma'] as const,
  vendasEspuma: () => ['vendasEspuma'] as const,
  estoqueProdutoFinal: () => ['estoqueProdutoFinal'] as const,

  /* ── ERP Sprint 8 ── */
  comprasMateriaPrima: () => ['comprasMateriaPrima'] as const,
  lotesProducao: () => ['lotesProducao'] as const,
  produzidoSgbr: (params: { dtDe: string; dtAte: string; sourceId?: string }) =>
    ['produzidoSgbr', 'sgbr', params.dtDe, params.dtAte, params.sourceId ?? 'default'] as const,
  fichasTecnicas: () => ['fichasTecnicas'] as const,
  pedidos: () => ['pedidos'] as const,
  ordensProducao: () => ['ordensProducao'] as const,
  /** Sem params: cache genérico (ex.: dashboard operacional). Com params: período + fonte na aba Notas fiscais. */
  faturamentos: (params?: { dtDe: string; dtAte: string; sourceId?: string }) =>
    params
      ? (['faturamentos', 'sgbr', params.dtDe, params.dtAte, params.sourceId ?? 'default'] as const)
      : (['faturamentos'] as const),
  movimentosEstoque: () => ['movimentosEstoque'] as const,
  custoRealProdutos: () => ['custoRealProdutos'] as const,
  alertasOperacionais: () => ['alertasOperacionais'] as const,
  alerts: () => ['alerts'] as const,
  userPreferences: () => ['userPreferences'] as const,

  /* ── Fontes de Dados ── */
  dataSources: () => ['dataSources'] as const,
  dataSource: (id: string) => ['dataSources', id] as const,

  opsStatus: () => ['opsStatus'] as const,
} as const

