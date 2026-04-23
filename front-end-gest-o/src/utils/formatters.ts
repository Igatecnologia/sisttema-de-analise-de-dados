/** Formata valor em Reais (BRL) */
export function formatBRL(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

/** Formata porcentagem */
export function formatPct(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`
}

/** Formata número com separador de milhar */
export function formatNumber(value: number): string {
  return value.toLocaleString('pt-BR')
}

/** Formato completo para valores monetarios (sem abreviacao K/M) */
export function formatCompact(value: number): string {
  return formatBRL(value)
}

/** Formato de metrica para MetricCards */
export function formatMetricValue(
  value: number,
  format: 'currency' | 'percentage' | 'integer' | 'compact' | 'decimal',
  currency = 'BRL',
): string {
  switch (format) {
    case 'currency': return currency === 'BRL' ? formatBRL(value) : value.toLocaleString('pt-BR', { style: 'currency', currency })
    case 'percentage': return formatPct(value)
    case 'integer': return formatNumber(Math.round(value))
    case 'compact': return formatCompact(value)
    case 'decimal': return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    default: return String(value)
  }
}

/** Delta com sinal explicito */
export function formatDelta(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`
}

/** Cores de status operacional (reutilizável) */
export const STATUS_COLORS: Record<string, string> = {
  Pendente: 'default',
  'Em Produção': 'processing',
  Concluído: 'success',
  Faturado: 'blue',
  Cancelado: 'error',
  Recebido: 'success',
  Emitida: 'success',
  Pago: 'success',
  'A vencer': 'warning',
  Vencido: 'error',
  Normal: 'success',
  Baixo: 'warning',
  Crítico: 'error',
  Conciliado: 'success',
  Divergente: 'error',
}
