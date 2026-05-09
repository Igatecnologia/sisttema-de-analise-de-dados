/**
 * Configuracoes padrao para graficos Recharts.
 * Importar e usar em todos os graficos para consistencia visual.
 */
import { formatBRL, formatCompact } from '../../utils/formatters'
import { useReducedMotion } from '../../hooks/useReducedMotion'

export { CHART_COLORS } from '../../theme/colors'

/** Tooltip escuro profissional — usar em todos os graficos */
export function ChartTooltip({
  active,
  payload,
  label,
  format = 'currency',
}: {
  active?: boolean
  payload?: Array<{ name: string; value: number; color: string }>
  label?: string
  format?: 'currency' | 'integer' | 'compact'
}) {
  if (!active || !payload?.length) return null

  const fmt = (v: number) => {
    if (format === 'currency') return formatBRL(v)
    if (format === 'compact') return formatCompact(v)
    return v.toLocaleString('pt-BR')
  }

  return (
    <div
      style={{
        background: '#0F172A',
        border: 'none',
        borderRadius: 8,
        padding: '10px 14px',
        boxShadow: '0 4px 16px rgb(0 0 0 / 0.25)',
        maxWidth: 280,
      }}
    >
      {label && (
        <p className="typ-tooltip-label" style={{ margin: '0 0 6px' }}>
          {label}
        </p>
      )}
      {payload.map((entry, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: entry.color, flexShrink: 0 }} />
          <span className="typ-tooltip-name">{entry.name}</span>
          <span className="typ-tooltip-value" style={{ marginLeft: 'auto' }}>
            {fmt(entry.value)}
          </span>
        </div>
      ))}
    </div>
  )
}

/** CartesianGrid — so linhas horizontais, sem ruido */
/* eslint-disable react-refresh/only-export-components -- props estaticas Recharts */
export const gridProps = {
  strokeDasharray: '3 3',
  stroke: '#E2E8F0',
  vertical: false,
} as const

/** XAxis limpo — tipografia controlada pelo CSS (.recharts-cartesian-axis-tick-value) */
export const xAxisProps = {
  tick: { fontSize: 11, fill: '#94A3B8', fontWeight: 500 },
  axisLine: false,
  tickLine: false,
} as const

/** YAxis limpo */
export const yAxisProps = {
  tick: { fontSize: 11, fill: '#94A3B8' },
  axisLine: false,
  tickLine: false,
  width: 72,
} as const

export function useChartAnimationProps() {
  const reduced = useReducedMotion()
  return reduced
    ? { isAnimationActive: false as const }
    : {
        isAnimationActive: true as const,
        animationDuration: 600,
        animationEasing: 'ease-out' as const,
      }
}
/* eslint-enable react-refresh/only-export-components */
