import { Activity, Building2, Calendar, TrendingDown } from 'lucide-react'
import type { Metrics } from '@/lib/api'

export function StatsRow({ metrics }: { metrics: Metrics }) {
  const items = [
    { label: 'MRR', value: metrics.mrrBrlFormatted, icon: <Building2 size={16} />, accent: '#10b981' },
    { label: 'Ativos', value: metrics.activeSubscriptions, icon: <Activity size={16} />, accent: '#3b82f6' },
    { label: 'Em trial', value: metrics.trialingTenants, icon: <Calendar size={16} />, accent: '#f59e0b' },
    { label: 'Churn', value: `${metrics.churnRatePct}%`, icon: <TrendingDown size={16} />, accent: '#ef4444' },
  ]
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-xl p-5"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        >
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider mb-2" style={{ color: item.accent }}>
            {item.icon}
            {item.label}
          </div>
          <div className="text-3xl font-bold tabular-nums">{item.value}</div>
        </div>
      ))}
    </div>
  )
}
