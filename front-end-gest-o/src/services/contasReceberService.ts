import dayjs from 'dayjs'
import { http } from './http'

/**
 * Conta a receber — shape canônico que o frontend consome. O backend
 * retorna a row crua do connector; aqui normalizamos os campos comuns.
 */
export type ContaReceber = {
  id: string
  vencimento: string | null
  emissao: string | null
  recebimento: string | null
  cliente: string
  documento: string
  valor: number
  /** 'aberto' (não recebido), 'recebido', 'atrasado' (vencido + em aberto). */
  status: 'aberto' | 'recebido' | 'atrasado'
  raw: Record<string, unknown>
}

function pickString(row: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = row[k] ?? row[k.toLowerCase()] ?? row[k.toUpperCase()]
    if (typeof v === 'string' && v.trim()) return v.trim()
    if (typeof v === 'number' && Number.isFinite(v)) return String(v)
  }
  return ''
}

function pickNumber(row: Record<string, unknown>, keys: string[]): number {
  for (const k of keys) {
    const v = row[k] ?? row[k.toLowerCase()] ?? row[k.toUpperCase()]
    if (typeof v === 'number' && Number.isFinite(v)) return v
    if (typeof v === 'string') {
      const n = Number(v.replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.'))
      if (Number.isFinite(n)) return n
    }
  }
  return 0
}

function pickDate(row: Record<string, unknown>, keys: string[]): string | null {
  const raw = pickString(row, keys)
  if (!raw) return null
  /** Aceita YYYY-MM-DD, YYYY.MM.DD, DD/MM/YYYY. Normaliza para ISO date. */
  const d1 = /^(\d{4})[.-](\d{2})[.-](\d{2})/.exec(raw)
  if (d1) return `${d1[1]}-${d1[2]}-${d1[3]}`
  const d2 = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(raw)
  if (d2) return `${d2[3]}-${d2[2]}-${d2[1]}`
  return null
}

function normalizeReceber(row: Record<string, unknown>, idx: number): ContaReceber {
  const vencimento = pickDate(row, ['vencimento', 'datavenc', 'data_vencimento', 'dt_vencimento'])
  const recebimento = pickDate(row, ['recebimento', 'datareceb', 'data_recebimento', 'dt_recebimento', 'pagamento'])
  const valor = pickNumber(row, ['valor', 'valor_total', 'vl_total', 'total', 'valortotal'])
  const cliente = pickString(row, ['cliente', 'nomecliente', 'razaosocial', 'fantasia', 'sacado'])
  const documento = pickString(row, ['documento', 'numdoc', 'nfe', 'titulo', 'numero'])

  let status: ContaReceber['status'] = 'aberto'
  if (recebimento) status = 'recebido'
  else if (vencimento && dayjs(vencimento).isBefore(dayjs().startOf('day'))) status = 'atrasado'

  return {
    id: pickString(row, ['id', 'codigo', 'controle', 'titulo']) || `cr_${idx}`,
    vencimento,
    emissao: pickDate(row, ['emissao', 'dataemissao', 'data_emissao', 'dt_emissao']),
    recebimento,
    cliente,
    documento,
    valor,
    status,
    raw: row,
  }
}

export type ContasReceberRange = { dtDe: string; dtAte: string }

export function contasReceberRangeDefault(): ContasReceberRange {
  /** Default: próximos 90 dias de vencimentos + retroativos do mês corrente. */
  const start = dayjs().startOf('month')
  const end = dayjs().add(90, 'day')
  return { dtDe: start.format('YYYY-MM-DD'), dtAte: end.format('YYYY-MM-DD') }
}

export async function getContasReceber(params?: ContasReceberRange): Promise<ContaReceber[]> {
  const range = params ?? contasReceberRangeDefault()
  const search = new URLSearchParams({ dt_de: range.dtDe, dt_ate: range.dtAte })
  const { data } = await http.get<unknown[]>(`/finance/contas-receber?${search.toString()}`)
  if (!Array.isArray(data)) return []
  return data
    .filter((r): r is Record<string, unknown> => Boolean(r && typeof r === 'object'))
    .map(normalizeReceber)
}

/** KPIs derivados — calculados no front para evitar round-trip. */
export function computeContasReceberKpis(rows: ContaReceber[]) {
  const total = rows.reduce((sum, r) => sum + r.valor, 0)
  const aReceber = rows.filter((r) => r.status === 'aberto').reduce((sum, r) => sum + r.valor, 0)
  const recebido = rows.filter((r) => r.status === 'recebido').reduce((sum, r) => sum + r.valor, 0)
  const atrasado = rows.filter((r) => r.status === 'atrasado').reduce((sum, r) => sum + r.valor, 0)
  /** Inadimplência = atrasado / (atrasado + a receber + recebido). */
  const denominador = atrasado + aReceber + recebido
  const inadimplenciaPct = denominador > 0 ? (atrasado / denominador) * 100 : 0
  /** Próximos 30 dias. */
  const limite30 = dayjs().add(30, 'day')
  const proximos30 = rows
    .filter((r) => r.status === 'aberto' && r.vencimento && dayjs(r.vencimento).isBefore(limite30))
    .reduce((sum, r) => sum + r.valor, 0)
  return { total, aReceber, recebido, atrasado, inadimplenciaPct, proximos30 }
}
