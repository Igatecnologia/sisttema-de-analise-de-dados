import type { ContaPagar } from '../types/models'
import { nowBr, parseVendaDate } from './dayjsBr'

type Raw = Record<string, unknown>

function lowerKeyMap(row: Raw): Map<string, unknown> {
  const m = new Map<string, unknown>()
  for (const [k, v] of Object.entries(row)) {
    m.set(k.toLowerCase(), v)
  }
  return m
}

function pick(row: Raw, keys: string[]): unknown {
  const low = lowerKeyMap(row)
  for (const k of keys) {
    const v = row[k] ?? low.get(k.toLowerCase())
    if (v !== undefined && v !== null && v !== '') return v
  }
  return undefined
}

function pickStr(row: Raw, keys: string[], fallback = ''): string {
  const v = pick(row, keys)
  if (v === undefined || v === null) return fallback
  return String(v).trim() || fallback
}

function parseMoney(v: unknown): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v !== 'string') return 0
  const t = v.replace(/[R$\s]/g, '')
  const normalized = t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t
  const n = Number(normalized)
  return Number.isFinite(n) ? n : 0
}

function parseDateIso(raw: unknown): string | null {
  if (raw === undefined || raw === null || raw === '') return null
  const s = String(raw).trim()
  if (!s) return null
  const slash = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (slash) {
    const [, d, mo, y] = slash
    return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`
  }
  const dot = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/)
  if (dot) {
    const [, d, mo, y] = dot
    return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`
  }
  try {
    const isoLike = /^\d{4}-\d{2}-\d{2}$/.test(s) ? `${s}T12:00:00` : s
    const d = parseVendaDate(isoLike)
    if (!d.isValid()) return null
    return d.format('YYYY-MM-DD')
  } catch {
    return null
  }
}

function mapCategoria(raw: string): ContaPagar['categoria'] {
  const c = raw.toLowerCase()
  if (/imposto|taxa|tribut/.test(c)) return 'Impostos'
  if (/energia|luz|el[eé]tric/.test(c)) return 'Energia'
  if (/folha|sal[aá]rio|rh\b|funcion/.test(c)) return 'Folha'
  if (/frete|transporte/.test(c)) return 'Frete'
  if (/mat[eé]ria|insumo|mat\.?\s*prima/.test(c)) return 'Matéria Prima'
  return 'Outros'
}

/**
 * Ordem importa: "A VENCER"/"ABERTO" precisa ser testado ANTES de qualquer match em "VENC",
 * senão um título aberto é classificado como Vencido. Da mesma forma, "PENDENTE" precisa
 * vencer "PAG" (que está contido em "PAGAMENTO PENDENTE").
 */
function inferStatus(
  row: Raw,
  dataVencimento: string,
  dataPagamento: string | null,
): ContaPagar['status'] {
  const st = pickStr(row, ['status', 'situacao', 'situação', 'situacao_titulo', 'descstatus'])
  const u = st.toUpperCase().trim()

  /** 1. Aberto / pendente — texto explícito tem prioridade */
  if (/\b(ABERT|A\s*VENCER|PEND|EM\s*ABERT|AGUARDAND)/.test(u)) return 'A vencer'

  /** 2. Pago / quitado / baixado — usa word boundary p/ não bater com "PAGAMENTO PENDENTE" */
  if (/\b(PAGO|PAGA|QUIT|BAIX|LIQUID)\b/.test(u)) return 'Pago'

  /** 3. Vencido / atrasado — só depois de eliminar "A VENCER" */
  if (/\b(VENCID|ATRASAD|ATRASO)\b/.test(u)) return 'Vencido'

  /** 4. Códigos curtos comuns no SGBR (1 letra/2 letras) */
  if (u === 'P' || u === 'PG' || u === 'Q' || u === 'B') return 'Pago'
  if (u === 'V' || u === 'VC') return 'Vencido'
  if (u === 'A' || u === 'AB' || u === 'AV') return 'A vencer'

  /** 5. Fallback por datas */
  if (dataPagamento) return 'Pago'
  const hoje = nowBr().startOf('day')
  const v = parseVendaDate(`${dataVencimento}T12:00:00`)
  if (v.isValid() && v.startOf('day').valueOf() < hoje.valueOf()) return 'Vencido'
  return 'A vencer'
}

/**
 * Converte uma linha do SGBR BI em `ContaPagar` (nomes de colunas tolerantes).
 */
export function mapSgbrContasPagasRow(row: Raw, index: number): ContaPagar {
  const id =
    pickStr(row, ['id', 'codigo', 'codtitulo', 'cod_titulo', 'numero', 'nrdoc', 'numdoc', 'titulo']) ||
    `sgbr-${index}`

  const fornecedor = pickStr(row, [
    'fornecedor',
    'nomefornecedor',
    'nome_fornecedor',
    'razao',
    'razao_social',
    'nome',
    'credor',
  ])

  const descricao = pickStr(row, ['descricao', 'historico', 'observacao', 'complemento', 'obs', 'memo'])

  const catRaw = pickStr(row, ['categoria', 'tipo', 'tipo_despesa', 'classificacao'])
  const categoria = catRaw ? mapCategoria(catRaw) : 'Outros'

  let valor = parseMoney(pick(row, ['valor', 'valortitulo', 'vlr', 'vlrtitulo', 'total', 'valorpago', 'vlpago', 'vl_pago', 'valorparcela']))
  if (!Number.isFinite(valor)) valor = 0

  const dataEmissao =
    parseDateIso(pick(row, ['dataemissao', 'data_emissao', 'emissao', 'dtemissao', 'dt_emissao'])) ??
    parseDateIso(pick(row, ['data', 'datafec'])) ??
    nowBr().format('YYYY-MM-DD')

  const dataVencimento =
    parseDateIso(pick(row, ['datavencimento', 'data_vencimento', 'vencimento', 'dtvencto', 'dt_vencimento', 'vencto'])) ??
    dataEmissao

  const dataPagamento = parseDateIso(
    pick(row, ['datapagamento', 'data_pagamento', 'pagamento', 'dtpagto', 'dt_pagamento', 'baixa']),
  )

  const status = inferStatus(row, dataVencimento, dataPagamento)

  return {
    id,
    fornecedor: fornecedor || '—',
    descricao: descricao || '—',
    categoria,
    valor,
    dataEmissao,
    dataVencimento,
    dataPagamento,
    status,
  }
}

export function mapSgbrContasPagasRows(rows: Raw[]): ContaPagar[] {
  return rows.map((r, i) => mapSgbrContasPagasRow(r, i))
}
