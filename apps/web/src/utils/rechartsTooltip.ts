/** Recharts Tooltip `formatter` recebe `ValueType` (número, string ou array); normaliza para número. */
export function coerceTooltipNumber(value: unknown): number | undefined {
  if (value === undefined || value === null) return undefined
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined
  if (typeof value === 'string') {
    const n = Number(value)
    return Number.isFinite(n) ? n : undefined
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const n = coerceTooltipNumber(item)
      if (n !== undefined) return n
    }
    return undefined
  }
  return undefined
}

export function coerceTooltipNumberOr(value: unknown, fallback: number): number {
  return coerceTooltipNumber(value) ?? fallback
}
