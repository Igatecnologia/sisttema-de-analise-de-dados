/**
 * P1-09 (audit 2026-05-12): comparativos período-a-período nativos.
 *
 * Pergunta #1 de PME: "como foi vs mês passado?". Antes o sistema exigia
 * o admin abrir 2 tabs e comparar manualmente. Esta camada padroniza o
 * cálculo: total, variação absoluta, variação %, top movers.
 *
 * Não busca dados — recebe arrays já materializados (caller usa proxy/erp
 * routes). Mantém a função pura e testável.
 */

export type PeriodRange = {
  /** ISO date YYYY-MM-DD. */
  from: string
  /** ISO date YYYY-MM-DD. */
  to: string
}

export type ComparisonInput<T extends Record<string, unknown>> = {
  current: T[]
  previous: T[]
  /** Função que extrai o valor numérico a comparar de cada row. */
  getValue: (row: T) => number
  /** Função opcional pra agrupar (ex: por SKU, vendedor, cliente). */
  getGroupKey?: (row: T) => string
  /** Label legível pro grupo (ex: nome do produto). Default = key. */
  getGroupLabel?: (row: T) => string
}

export type Delta = {
  /** Valor absoluto: current - previous (positivo = cresceu). */
  abs: number
  /** Variação percentual; null se previous === 0. */
  pct: number | null
  /** 'up' | 'down' | 'flat' | 'na' — útil pra UI escolher ícone/cor. */
  direction: 'up' | 'down' | 'flat' | 'na'
}

export type ComparisonResult = {
  totals: { current: number; previous: number; delta: Delta }
  count: { current: number; previous: number; delta: Delta }
  /** Top 10 grupos que mais cresceram (por variação absoluta). */
  topGains: Array<{ key: string; label: string; current: number; previous: number; delta: Delta }>
  /** Top 10 grupos que mais caíram. */
  topLosses: Array<{ key: string; label: string; current: number; previous: number; delta: Delta }>
}

export function computeDelta(current: number, previous: number): Delta {
  const abs = current - previous
  const pct = previous === 0 ? null : (abs / Math.abs(previous)) * 100
  let direction: Delta['direction']
  if (abs > 0.001) direction = 'up'
  else if (abs < -0.001) direction = 'down'
  else if (previous === 0 && current === 0) direction = 'na'
  else direction = 'flat'
  return { abs: Math.round(abs * 100) / 100, pct: pct === null ? null : Math.round(pct * 10) / 10, direction }
}

export function comparePeriods<T extends Record<string, unknown>>(
  input: ComparisonInput<T>,
): ComparisonResult {
  const currentTotal = input.current.reduce((s, r) => s + (input.getValue(r) || 0), 0)
  const previousTotal = input.previous.reduce((s, r) => s + (input.getValue(r) || 0), 0)

  const result: ComparisonResult = {
    totals: {
      current: Math.round(currentTotal * 100) / 100,
      previous: Math.round(previousTotal * 100) / 100,
      delta: computeDelta(currentTotal, previousTotal),
    },
    count: {
      current: input.current.length,
      previous: input.previous.length,
      delta: computeDelta(input.current.length, input.previous.length),
    },
    topGains: [],
    topLosses: [],
  }

  if (!input.getGroupKey) return result

  /** Agrupa por chave em ambos períodos, calcula delta por grupo, ranking. */
  type GroupAcc = { key: string; label: string; current: number; previous: number }
  const map = new Map<string, GroupAcc>()
  const accumulate = (rows: T[], bucket: 'current' | 'previous') => {
    for (const row of rows) {
      const key = input.getGroupKey!(row)
      if (!key) continue
      const label = input.getGroupLabel ? input.getGroupLabel(row) : key
      const existing = map.get(key) ?? { key, label, current: 0, previous: 0 }
      existing[bucket] += input.getValue(row) || 0
      map.set(key, existing)
    }
  }
  accumulate(input.current, 'current')
  accumulate(input.previous, 'previous')

  const all = Array.from(map.values()).map((g) => ({
    ...g,
    current: Math.round(g.current * 100) / 100,
    previous: Math.round(g.previous * 100) / 100,
    delta: computeDelta(g.current, g.previous),
  }))

  result.topGains = all
    .filter((g) => g.delta.abs > 0)
    .sort((a, b) => b.delta.abs - a.delta.abs)
    .slice(0, 10)

  result.topLosses = all
    .filter((g) => g.delta.abs < 0)
    .sort((a, b) => a.delta.abs - b.delta.abs)
    .slice(0, 10)

  return result
}

/**
 * Helper: dado um range atual, calcula o range "equivalente anterior".
 * Ex: 2026-05-01..2026-05-12 (12 dias) → previous = 2026-04-19..2026-04-30 (12 dias).
 */
export function previousRangeOf(current: PeriodRange): PeriodRange {
  const from = new Date(current.from + 'T00:00:00Z')
  const to = new Date(current.to + 'T00:00:00Z')
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    throw new Error('previousRangeOf: datas inválidas (use YYYY-MM-DD)')
  }
  const days = Math.max(1, Math.floor((to.getTime() - from.getTime()) / (24 * 3600 * 1000)) + 1)
  const prevTo = new Date(from)
  prevTo.setUTCDate(prevTo.getUTCDate() - 1)
  const prevFrom = new Date(prevTo)
  prevFrom.setUTCDate(prevFrom.getUTCDate() - (days - 1))
  return {
    from: prevFrom.toISOString().slice(0, 10),
    to: prevTo.toISOString().slice(0, 10),
  }
}
