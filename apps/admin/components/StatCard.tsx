import type { ReactNode } from 'react'
import { TrendingDown, TrendingUp } from 'lucide-react'

type Props = {
  label: string
  value: ReactNode
  icon?: ReactNode
  accent?: string
  hint?: string
  delta?: { value: string; positive: boolean }
}

export function StatCard({ label, value, icon, accent = 'var(--accent)', hint, delta }: Props) {
  return (
    <div
      className="rounded-xl p-5 transition-all hover:scale-[1.01]"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
    >
      <div className="flex items-center justify-between mb-3">
        <span
          className="flex items-center gap-2 text-[11px] uppercase tracking-wider font-semibold"
          style={{ color: accent }}
        >
          {icon}
          {label}
        </span>
        {delta && (
          <span
            className="flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded"
            style={{
              color: delta.positive ? 'var(--success)' : 'var(--danger)',
              background: delta.positive ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
            }}
          >
            {delta.positive ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
            {delta.value}
          </span>
        )}
      </div>
      <div className="text-3xl font-bold tabular-nums">{value}</div>
      {hint && (
        <div className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
          {hint}
        </div>
      )}
    </div>
  )
}
