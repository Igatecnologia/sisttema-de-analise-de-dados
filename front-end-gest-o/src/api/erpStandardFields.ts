/**
 * Campos padrão esperados por cada endpoint ERP.
 * Usado na UI de mapeamento de campos para popular o dropdown "Campo Padrão".
 * Mantido em sincronia manual com os Zod schemas em schemas.ts.
 */
export const ERP_STANDARD_FIELDS: Record<string, { label: string; fields: string[] }> = {
  'compras-materia-prima': {
    label: 'Compras de Matéria-Prima',
    fields: ['id', 'data', 'fornecedor', 'material', 'unidade', 'quantidade', 'custoUnitario', 'custoTotal', 'classificacao', 'notaFiscal', 'status'],
  },
  'lotes-producao': {
    label: 'Lotes de Produção',
    fields: ['id', 'data', 'tipo', 'densidade', 'volumeTotalM3', 'custoMateriaPrima', 'custoEnergia', 'custoMaoDeObra', 'custoPerdas', 'custoIndiretos', 'custoTotalLote', 'custoPorM3', 'rendimentoPct', 'operador', 'status', 'observacoes'],
  },
  'fichas-tecnicas': {
    label: 'Fichas Técnicas',
    fields: ['id', 'produto', 'tipo', 'densidade', 'alturaM', 'larguraM', 'comprimentoM', 'volumeM3', 'pesoEstimadoKg', 'consumoMateriaPrimaKg', 'custoMateriaPrima', 'custoConversao', 'custoEstimado', 'custoPorM3', 'precoSugerido', 'margemAlvoPct', 'ativo'],
  },
  'pedidos': {
    label: 'Pedidos',
    fields: ['id', 'data', 'cliente', 'itens', 'totalPecas', 'totalM3', 'totalValor', 'formaPagamento', 'status', 'observacoes'],
  },
  'ordens-producao': {
    label: 'Ordens de Produção',
    fields: ['id', 'data', 'pedidoIds', 'produtos', 'totalPecas', 'totalM3', 'consumoEstimadoM3', 'loteIds', 'status', 'dataPrevista', 'dataConclusao', 'observacoes'],
  },
  'faturamentos': {
    label: 'Faturamentos',
    fields: [
      'id',
      'data',
      'pedidoId',
      'cliente',
      'numeroNF',
      'tipoDocumento',
      'valorProdutos',
      'valorFrete',
      'valorImpostos',
      'valorTotal',
      'formaPagamento',
      'status',
    ],
  },
  'movimentos-estoque': {
    label: 'Movimentos de Estoque',
    fields: ['id', 'data', 'nivelEstoque', 'item', 'tipoMovimento', 'origem', 'referenciaId', 'quantidade', 'unidade', 'custoUnitario', 'custoTotal', 'saldoAnterior', 'saldoAtual'],
  },
  'custo-real': {
    label: 'Custo Real de Produtos',
    fields: ['fichaTecnicaId', 'produto', 'densidade', 'custoMateriaPrima', 'custoEnergia', 'custoMaoDeObra', 'custoPerdas', 'custoIndiretos', 'custoRealTotal', 'custoRealPorM3', 'precoVenda', 'margemRealPct', 'margemAlvoPct', 'alertaMargem'],
  },
  'alertas': {
    label: 'Alertas Operacionais',
    fields: ['id', 'data', 'tipo', 'severidade', 'titulo', 'descricao', 'referenciaId', 'lido'],
  },
  'contas-a-pagar': {
    label: 'Contas a Pagar',
    fields: ['id', 'fornecedor', 'documento', 'duplicata', 'dtEmissao', 'dtVencimento', 'dtPagamento', 'valorTitulo', 'valorPago', 'valorJuros', 'valorDesconto', 'portador', 'status', 'centroCusto'],
  },
  'contas-a-receber': {
    label: 'Contas a Receber',
    fields: ['id', 'cliente', 'documento', 'dtEmissao', 'dtVencimento', 'dtRecebimento', 'valorTitulo', 'valorRecebido', 'valorJuros', 'valorDesconto', 'portador', 'status', 'centroCusto'],
  },
  'vendas-analitico': {
    label: 'Vendas Analítico',
    fields: ['id', 'data', 'cliente', 'produto', 'quantidade', 'valorUnit', 'valorTotal', 'custoUnitario', 'status', 'vendedor'],
  },
  'notas-fiscais': {
    label: 'Notas Fiscais',
    fields: ['id', 'data', 'cliente', 'numeroNF', 'tipoDocumento', 'valorProdutos', 'valorFrete', 'valorImpostos', 'valorTotal', 'status'],
  },
  /** Relatório BI `GET /sgbrbi/produzido?dt_de=&dt_ate=` — colunas variam por cliente/versão. */
  'produzido-sgbr': {
    label: 'Produzido (SGBR BI)',
    fields: ['id', 'data', 'produto', 'quantidade', 'unidade', 'codigo', 'observacao'],
  },
}

export const ALL_ERP_ENDPOINTS = Object.keys(ERP_STANDARD_FIELDS)

export const ERP_ENDPOINT_OPTIONS = Object.entries(ERP_STANDARD_FIELDS).map(([key, val]) => ({
  value: key,
  label: val.label,
}))
