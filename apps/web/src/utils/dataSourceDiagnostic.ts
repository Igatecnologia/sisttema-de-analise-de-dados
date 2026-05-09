import { ERP_STANDARD_FIELDS } from '../api/erpStandardFields'

// ─── Palavras-chave para reconhecer areas por nome de campo ─────────────────

const AREA_KEYWORDS: Record<string, string[]> = {
  'compras-materia-prima': ['fornecedor', 'supplier', 'material', 'notafiscal', 'nf_', 'compra', 'purchase', 'materia_prima', 'raw_material'],
  'lotes-producao': ['lote', 'batch', 'densidade', 'density', 'rendimento', 'yield', 'operador', 'operator', 'volumem3', 'volume_m3', 'mao_de_obra'],
  'fichas-tecnicas': ['ficha', 'spec', 'produto', 'product', 'margem', 'margin', 'preco_sugerido', 'suggested_price', 'peso_kg', 'consumo_kg'],
  'pedidos': ['cliente', 'client', 'customer', 'pedido', 'order', 'peca', 'piece', 'pagamento', 'payment', 'forma_pagamento'],
  'ordens-producao': ['ordem', 'work_order', 'op_', 'producao', 'production', 'data_prevista', 'planned_date', 'data_conclusao'],
  'faturamentos': [
    'fatura', 'invoice', 'nf', 'nfe', 'nfse', 'nfce', 'cte',
    'tipo_documento', 'tipoDocumento', 'nota_fiscal',
    'frete', 'freight', 'imposto', 'tax', 'numero_nf',
  ],
  'movimentos-estoque': ['estoque', 'stock', 'inventory', 'movimento', 'movement', 'entrada', 'saida', 'saldo', 'balance', 'nivel_estoque'],
  'custo-real': ['custo_real', 'real_cost', 'margem_real', 'actual_margin', 'preco_venda', 'sale_price', 'alerta_margem'],
  'alertas': ['alerta', 'alert', 'severidade', 'severity', 'titulo', 'title', 'descricao', 'description', 'lido', 'read'],
  /** Campos típicos SGBR / ERP BR de títulos a pagar (duplicatas/boletos). */
  'contas-a-pagar': [
    'dtvencimento', 'dt_vencimento', 'vencimento',
    'dtemissao', 'dt_emissao',
    'dtpagamento', 'dt_pagamento', 'dtpgto', 'dtpago',
    'valortitulo', 'valor_titulo',
    'valorpago', 'valor_pago',
    'valorjuros', 'valor_juros',
    'valordesconto', 'valor_desconto',
    'codfornecedor', 'fornecedor', 'nomefornecedor',
    'duplicata', 'boleto', 'portador',
    'centrocusto', 'centro_custo',
    'pagas', 'pagar', 'apagar',
  ],
  /** Títulos a receber (contraparte de contas a pagar). */
  'contas-a-receber': [
    'dtvencimento', 'dt_vencimento',
    'dtrecebimento', 'dt_recebimento',
    'valorrecebido', 'valor_recebido',
    'codcliente', 'nomecliente',
    'areceber', 'receber',
  ],
  /** Vendas analítico: caracteriza pela combinação de cliente+produto+quantidade. */
  'vendas-analitico': [
    'qtdevendida', 'qtde_vendida', 'quantidade_vendida',
    'valorunit', 'valor_unit', 'valor_unitario',
    'decprod', 'nomeprod', 'codprod',
    'codvendedor', 'vendedor',
    'statuspedido', 'status_pedido',
    'datafec', 'dt_fec', 'data_faturamento',
  ],
  /** Notas fiscais SGBR — distinto de 'faturamentos' genérico. */
  'notas-fiscais': [
    'vendanfe', 'notasfiscais', 'nota_fiscal', 'numero_nfe',
    'chavenfe', 'chave_nfe', 'serie_nfe',
  ],
  /** Produzido BI — quantidades / produto / período (nomes variam). */
  'produzido-sgbr': [
    'produzido', 'qtdeproduz', 'quantidade_produzida', 'qtdproduz', 'qtd_produz',
    'producao', 'codprod', 'decprod', 'nomeprod', 'unidade', 'dt_', 'data',
  ],
}

// ─── Palavras-chave para detectar campos de vendas (SGBR BI style) ──────────

const VENDAS_KEYWORDS = ['venda', 'vendida', 'codprod', 'decprod', 'codcliente', 'nomecliente', 'valorunit', 'totalprodutos', 'statuspedido', 'datafec', 'qtde', 'sale', 'sold']

export type AreaMatch = {
  area: string
  label: string
  confidence: 'alta' | 'media' | 'baixa'
  matchedFields: string[]
  missingFields: string[]
}

export type FieldAnalysis = {
  name: string
  type: string
  sampleValue: unknown
  suggestedRole: string | null
}

export type DiagnosticResult = {
  /** Areas reconhecidas nos dados */
  recognized: AreaMatch[]
  /** Campos que nao pertencem a nenhuma area conhecida */
  unknownFields: string[]
  /** Se parece ser dados de vendas analitico (tipo SGBR BI) */
  isVendasAnalitico: boolean
  /** Mapeamentos sugeridos automaticamente */
  suggestedMappings: Array<{ standardField: string; sourceField: string; transform: 'none' | 'trim' | 'number' | 'date_iso' }>
  /** Endpoints sugeridos */
  suggestedEndpoints: string[]
  /** Análise campo a campo com tipos e valores */
  fieldAnalysis: FieldAnalysis[]
  /** Resumo legível da API */
  apiSummary: string
}

/**
 * Detecta o "papel" provável de um campo baseado em nome e tipo.
 */
function detectFieldRole(fieldName: string, fieldType: string | undefined): string | null {
  const f = fieldName.toLowerCase()
  const t = fieldType ?? 'string'

  // Endereço/localização
  if (f.includes('cep') || f.includes('zipcode') || f.includes('postal') || f.includes('endereco') || f.includes('address') || f.includes('bairro') || f.includes('cidade') || f.includes('uf') || f.includes('estado')) {
    return 'Localização/Endereço'
  }

  // IDs
  if (f === 'id' || f === 'codigo' || f === 'code' || f.startsWith('cod')) return 'Identificador'

  // Datas
  if (f.includes('data') || f.includes('date') || f.includes('dt_') || f === 'created_at' || f === 'updated_at' || t === 'date') return 'Data'

  // Valores monetários
  if (f.includes('valor') || f.includes('total') || f.includes('preco') || f.includes('custo') || f.includes('price') || f.includes('cost') || f.includes('amount')) return 'Valor monetário'

  // Quantidades
  if (f.includes('qtd') || f.includes('quantidade') || f.includes('qty') || f.includes('quantity')) return 'Quantidade'

  // Nomes/descrições
  if (f.includes('nome') || f.includes('name') || f.includes('desc') || f.includes('produto') || f.includes('cliente') || f.includes('fornecedor')) return 'Nome/Descrição'

  // Status
  if (f.includes('status') || f.includes('estado') || f.includes('situacao')) return 'Status'

  // Percentuais
  if (f.includes('pct') || f.includes('percent') || f.includes('margem') || f.includes('rendimento')) return 'Percentual'

  return null
}

/**
 * Analisa os campos retornados pela API e identifica:
 * - Quais areas do painel esses dados alimentam
 * - Quais campos estao faltando
 * - Quais campos sao desconhecidos
 * - Sugestoes de mapeamento automatico
 * - Analise de tipos e valores
 */
export function diagnoseFields(
  sampleFields: string[],
  fieldTypes?: Record<string, string>,
  sampleRows?: Record<string, unknown>[],
): DiagnosticResult {
  const normalized = sampleFields.map((f) => f.toLowerCase().trim())
  const recognized: AreaMatch[] = []
  const matchedFieldsAll = new Set<string>()

  // Checa vendas analitico (SGBR BI pattern)
  const vendasScore = normalized.filter((f) =>
    VENDAS_KEYWORDS.some((kw) => f.includes(kw)),
  ).length
  const isVendasAnalitico = vendasScore >= 3

  // Para cada area, calcula match
  for (const [areaKey, config] of Object.entries(ERP_STANDARD_FIELDS)) {
    const keywords = AREA_KEYWORDS[areaKey] ?? []
    const areaFields = config.fields

    const matchedByKeyword = normalized.filter((f) =>
      keywords.some((kw) => f.includes(kw)),
    )
    const matchedByName = normalized.filter((f) =>
      areaFields.some((sf) => f === sf.toLowerCase() || f.includes(sf.toLowerCase()) || sf.toLowerCase().includes(f)),
    )
    const allMatched = [...new Set([...matchedByKeyword, ...matchedByName])]

    if (allMatched.length === 0) continue

    const ratio = allMatched.length / areaFields.length
    const confidence: 'alta' | 'media' | 'baixa' =
      ratio >= 0.5 ? 'alta' : ratio >= 0.25 ? 'media' : 'baixa'

    const missingFields = areaFields.filter(
      (sf) => !normalized.some((f) => f === sf.toLowerCase() || f.includes(sf.toLowerCase())),
    )

    allMatched.forEach((f) => matchedFieldsAll.add(f))

    recognized.push({ area: areaKey, label: config.label, confidence, matchedFields: allMatched, missingFields })
  }

  // Campos desconhecidos
  const unknownFields = sampleFields.filter(
    (f) => !matchedFieldsAll.has(f.toLowerCase().trim()),
  )

  // Mapeamentos sugeridos
  const suggestedMappings = buildSuggestedMappings(sampleFields, recognized)

  // Endpoints sugeridos
  const suggestedEndpoints = recognized
    .filter((r) => r.confidence === 'alta' || r.confidence === 'media')
    .map((r) => r.area)

  // Ordena por confianca
  recognized.sort((a, b) => {
    const order = { alta: 0, media: 1, baixa: 2 }
    return order[a.confidence] - order[b.confidence]
  })

  // Análise de campos com tipos e valores
  const firstRow = sampleRows?.[0]
  const fieldAnalysis: FieldAnalysis[] = sampleFields.map((name) => {
    const type = fieldTypes?.[name] ?? inferTypeFromName(name)
    const sampleValue = firstRow?.[name] ?? null
    const suggestedRole = detectFieldRole(name, type)
    return { name, type, sampleValue, suggestedRole }
  })

  // Resumo da API
  const apiSummary = buildApiSummary(sampleFields, fieldAnalysis, isVendasAnalitico, recognized)

  return { recognized, unknownFields, isVendasAnalitico, suggestedMappings, suggestedEndpoints, fieldAnalysis, apiSummary }
}

/**
 * Gera um resumo legível sobre o que a API está enviando.
 */
function buildApiSummary(
  fields: string[],
  analysis: FieldAnalysis[],
  isVendas: boolean,
  recognized: AreaMatch[],
): string {
  const parts: string[] = []

  if (isVendas) {
    parts.push('API reconhecida como dados de vendas analítico (padrão SGBR BI)')
  } else if (recognized.length > 0) {
    const areas = recognized.filter(r => r.confidence !== 'baixa').map(r => r.label)
    if (areas.length > 0) {
      parts.push(`Dados compatíveis com: ${areas.join(', ')}`)
    }
  }

  const dateFields = analysis.filter(f => f.suggestedRole === 'Data')
  const moneyFields = analysis.filter(f => f.suggestedRole === 'Valor monetário')
  const nameFields = analysis.filter(f => f.suggestedRole === 'Nome/Descrição')
  const qtyFields = analysis.filter(f => f.suggestedRole === 'Quantidade')

  parts.push(`${fields.length} campos detectados`)

  if (dateFields.length > 0) parts.push(`${dateFields.length} campo(s) de data: ${dateFields.map(f => f.name).join(', ')}`)
  if (moneyFields.length > 0) parts.push(`${moneyFields.length} campo(s) de valor: ${moneyFields.map(f => f.name).join(', ')}`)
  if (nameFields.length > 0) parts.push(`${nameFields.length} campo(s) de nome: ${nameFields.map(f => f.name).join(', ')}`)
  if (qtyFields.length > 0) parts.push(`${qtyFields.length} campo(s) de quantidade: ${qtyFields.map(f => f.name).join(', ')}`)

  return parts.join('. ') + '.'
}

/** Infere tipo pelo nome do campo (quando não temos fieldTypes do backend) */
function inferTypeFromName(fieldName: string): string {
  const f = fieldName.toLowerCase()
  if (f.includes('data') || f.includes('date') || f.includes('dt_')) return 'date'
  if (f.includes('valor') || f.includes('total') || f.includes('preco') || f.includes('custo') || f.includes('qtd')) return 'number'
  return 'string'
}

/** Gera mapeamentos automaticos baseados em similaridade de nomes */
function buildSuggestedMappings(
  sampleFields: string[],
  recognized: AreaMatch[],
): DiagnosticResult['suggestedMappings'] {
  const mappings: DiagnosticResult['suggestedMappings'] = []
  const usedSource = new Set<string>()

  const standardFields = recognized.flatMap((r) =>
    (ERP_STANDARD_FIELDS[r.area]?.fields ?? []),
  )
  const uniqueStandard = [...new Set(standardFields)]

  for (const std of uniqueStandard) {
    const stdLower = std.toLowerCase()

    const exact = sampleFields.find((f) => f.toLowerCase() === stdLower && !usedSource.has(f))
    if (exact) {
      usedSource.add(exact)
      continue
    }

    const partial = sampleFields.find(
      (f) => !usedSource.has(f) && (
        f.toLowerCase().includes(stdLower) ||
        stdLower.includes(f.toLowerCase())
      ),
    )
    if (partial) {
      usedSource.add(partial)
      const transform = inferTransform(std, partial)
      mappings.push({ standardField: std, sourceField: partial, transform })
    }
  }

  // Mapeamentos conhecidos para SGBR BI
  const sgbrMap: Record<string, { std: string; transform: 'none' | 'trim' | 'number' | 'date_iso' }> = {
    decprod: { std: 'produto', transform: 'trim' },
    nomecliente: { std: 'cliente', transform: 'trim' },
    qtdevendida: { std: 'quantidade', transform: 'number' },
    valorunit: { std: 'valorunit', transform: 'number' },
    precocustoitem: { std: 'custoUnitario', transform: 'number' },
    total: { std: 'valorTotal', transform: 'number' },
    datafec: { std: 'data', transform: 'date_iso' },
    statuspedido: { std: 'status', transform: 'none' },
    codprod: { std: 'id', transform: 'number' },
    codcliente: { std: 'codcliente', transform: 'number' },
  }

  for (const sourceField of sampleFields) {
    const mapping = sgbrMap[sourceField.toLowerCase()]
    if (mapping && !usedSource.has(sourceField)) {
      usedSource.add(sourceField)
      if (!mappings.some((m) => m.standardField === mapping.std)) {
        mappings.push({ standardField: mapping.std, sourceField, transform: mapping.transform })
      }
    }
  }

  return mappings
}

/** Infere o tipo de transformacao baseado no nome do campo */
function inferTransform(standard: string, source: string): 'none' | 'trim' | 'number' | 'date_iso' {
  const s = (standard + source).toLowerCase()
  if (s.includes('data') || s.includes('date') || s.includes('dt_')) return 'date_iso'
  if (s.includes('valor') || s.includes('custo') || s.includes('preco') || s.includes('total') || s.includes('qtde') || s.includes('amount') || s.includes('price') || s.includes('cost')) return 'number'
  if (s.includes('nome') || s.includes('name') || s.includes('desc') || s.includes('produto')) return 'trim'
  return 'none'
}

// ─── Diagnostico de conexao ─────────────────────────────────────────────────

export type ConnectionDiagnostic = {
  status: 'ok' | 'auth_required' | 'auth_failed' | 'no_data' | 'error'
  message: string
  details: string[]
}

/**
 * Analisa o resultado do teste e retorna diagnostico amigavel
 */
export function diagnoseConnection(
  testSuccess: boolean,
  testMessage: string,
  sampleFields: string[] | undefined,
  httpStatus?: number,
): ConnectionDiagnostic {
  if (!testSuccess && (testMessage.includes('ECONNREFUSED') || testMessage.includes('Failed to fetch') || testMessage.includes('timeout'))) {
    return {
      status: 'error',
      message: 'Nao foi possivel conectar ao servidor',
      details: [
        'Verifique se o endereco esta correto',
        'Verifique se o servidor esta ligado',
        'Verifique se ha firewall bloqueando a conexao',
      ],
    }
  }

  if (!testSuccess && (httpStatus === 401 || httpStatus === 403 || testMessage.includes('401') || testMessage.includes('403') || testMessage.includes('Unauthorized'))) {
    return {
      status: 'auth_required',
      message: 'O servidor exige autenticacao',
      details: [
        'Configure o metodo de autenticacao (Token, Chave de acesso ou Usuario/Senha)',
        'Verifique se as credenciais estao corretas',
        'Se usa token, verifique se nao esta expirado',
      ],
    }
  }

  if (testSuccess && (!sampleFields || sampleFields.length === 0)) {
    return {
      status: 'no_data',
      message: 'Conectado, mas nenhum dado retornado',
      details: [
        'O servidor respondeu, porem sem dados',
        'Verifique se o caminho de dados esta correto',
        'Verifique se ha dados no periodo selecionado',
        'Pode ser necessario enviar parametros (ex: datas)',
      ],
    }
  }

  if (!testSuccess) {
    return {
      status: 'error',
      message: 'Falha na conexao',
      details: [testMessage],
    }
  }

  return {
    status: 'ok',
    message: 'Conexao estabelecida com sucesso',
    details: [`${sampleFields?.length ?? 0} campos encontrados nos dados`],
  }
}
