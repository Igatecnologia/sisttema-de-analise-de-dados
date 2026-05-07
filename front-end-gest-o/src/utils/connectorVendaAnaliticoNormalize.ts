import type { VendaAnaliticaRow } from '../api/schemas'

/** Lê valor com aliases (nome exato ou case-insensitive). */
export function pickRaw(row: Record<string, unknown>, keys: string[]): unknown {
  for (const k of keys) {
    if (k in row && row[k] !== undefined && row[k] !== null) return row[k]
  }
  const lowerMap = new Map(Object.keys(row).map((k) => [k.toLowerCase(), k]))
  for (const k of keys) {
    const rk = lowerMap.get(k.toLowerCase())
    if (rk !== undefined && row[rk] !== undefined && row[rk] !== null) return row[rk]
  }
  return undefined
}

export function toNum(v: unknown, fallback = 0): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string') {
    const t = v.trim()
    if (!t) return fallback
    const normalized = t.replace(/[^\d,.-]/g, '')
    const n = Number(normalized.replace(/\./g, '').replace(',', '.'))
    return Number.isFinite(n) ? n : fallback
  }
  return fallback
}

export function toStr(v: unknown, fallback = ''): string {
  if (v == null) return fallback
  return String(v)
}

function asCod(v: unknown): string | number {
  if (typeof v === 'number' || typeof v === 'string') return v
  if (v != null && v !== '') return String(v)
  return 0
}

/**
 * Unifica linhas de `vendas/analitico` e `vendanfe/analitico` (e variações de nomes de colunas SGBR).
 */
export function normalizeVendaAnaliticaRow(row: Record<string, unknown>): VendaAnaliticaRow {
  const data = toStr(pickRaw(row, ['data', 'dt_emissao', 'data_emissao', 'emissao', 'dta', 'dtemissao']), '')
  const datafec = toStr(pickRaw(row, ['datafec', 'data_fechamento', 'dt_fec', 'dtfechamento']), data)

  const codvendedor = pickRaw(row, ['codvendedor', 'cod_vendedor', 'vendedor_cod'])
  const nomevendedor = toStr(pickRaw(row, ['nomevendedor', 'nome_vendedor', 'vendedor']), '')

  const codprod = asCod(pickRaw(row, ['codprod', 'cod_prod', 'codigo_produto', 'produto', 'sku', 'coditem', 'cod']))
  const decprod = toStr(
    pickRaw(row, ['decprod', 'desc_prod', 'descr_produto', 'produto_nome', 'descricao', 'nome_produto', 'produto']),
    '',
  )

  const qtdevendida = toNum(pickRaw(row, ['qtdevendida', 'qtd', 'quantidade', 'qtde', 'qtdevenda', 'qt']))
  const und = toStr(pickRaw(row, ['und', 'unidade', 'um']), 'UN')
  const qtdeconvertidavd = toNum(pickRaw(row, ['qtdeconvertidavd', 'qtde_convertida', 'qtd_conv']), qtdevendida)

  const precocustoitem = toNum(pickRaw(row, ['precocustoitem', 'preco_custo', 'custounit', 'vl_custo', 'precocusto']))
  const valorunit = toNum(pickRaw(row, ['valorunit', 'valor_unit', 'vl_unit', 'preco_unit', 'vlrunit']))
  const total = toNum(pickRaw(row, ['total', 'valor_total', 'vl_total', 'vltotal', 'valor', 'totalliquido', 'vltot']))

  const codcliente = asCod(pickRaw(row, ['codcliente', 'cod_cliente', 'cliente', 'codcli', 'codigo_cliente']))
  const nomecliente = toStr(pickRaw(row, ['nomecliente', 'nome_cliente', 'cliente_nome', 'razao', 'nm_cliente']), '')

  const cepRaw = pickRaw(row, ['cepcliente', 'cep'])
  const cepcliente =
    cepRaw === undefined || cepRaw === null ? undefined : (toStr(cepRaw) || undefined)

  const totalprodutos = toNum(pickRaw(row, ['totalprodutos', 'total_produtos', 'vl_produtos']), total)
  const statuspedido = toStr(pickRaw(row, ['statuspedido', 'status', 'sit_pedido', 'situacao', 'situacaonf']), 'P')

  const base: VendaAnaliticaRow = {
    data: data || datafec || '1970-01-01',
    codvendedor: codvendedor as number | string | undefined,
    nomevendedor: nomevendedor || undefined,
    codprod,
    decprod,
    qtdevendida,
    und,
    qtdeconvertidavd,
    precocustoitem,
    valorunit,
    total,
    codcliente,
    nomecliente,
    cepcliente,
    totalprodutos,
    statuspedido,
    datafec: datafec || data || '1970-01-01',
  }

  return { ...row, ...base }
}
