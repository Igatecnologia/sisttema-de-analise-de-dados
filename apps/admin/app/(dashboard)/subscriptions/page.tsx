'use client'

import { useEffect, useMemo, useState } from 'react'
import { CreditCard, ExternalLink, Search } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { StatCard } from '@/components/StatCard'
import { api, type Subscription, type SubscriptionsResponse } from '@/lib/api'

const STATUS_COLOR: Record<string, string> = {
  active: '#10b981',
  trialing: '#f59e0b',
  past_due: '#ef4444',
  canceled: '#94a3b8',
  unpaid: '#ef4444',
  incomplete: '#94a3b8',
  incomplete_expired: '#94a3b8',
  paused: '#94a3b8',
}

const PLAN_COLOR: Record<string, string> = {
  enterprise: '#fbbf24',
  pro: '#a78bfa',
  starter: '#60a5fa',
  trial: '#94a3b8',
}

export default function SubscriptionsPage() {
  const [data, setData] = useState<SubscriptionsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  useEffect(() => {
    let active = true
    void (async () => {
      try {
        const res = await api.get<SubscriptionsResponse>('/v1/super-admin/subscriptions')
        if (active) setData(res)
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [])

  const filtered = useMemo(() => {
    if (!data) return []
    const q = search.trim().toLowerCase()
    return data.subscriptions.filter((s) => {
      if (statusFilter !== 'all' && s.status !== statusFilter) return false
      if (!q) return true
      return s.tenantId.toLowerCase().includes(q) || (s.stripeCustomerId ?? '').toLowerCase().includes(q)
    })
  }, [data, search, statusFilter])

  const summary = useMemo(() => {
    if (!data) return null
    const byStatus: Record<string, number> = {}
    let active = 0
    let trialing = 0
    let canceled = 0
    for (const s of data.subscriptions) {
      byStatus[s.status] = (byStatus[s.status] ?? 0) + 1
      if (s.status === 'active') active++
      if (s.status === 'trialing') trialing++
      if (s.status === 'canceled') canceled++
    }
    return { byStatus, active, trialing, canceled }
  }, [data])

  return (
    <>
      <PageHeader
        title="Assinaturas"
        subtitle={data ? `${data.total} subscriptions Stripe` : 'Carregando...'}
        breadcrumbs={[{ label: 'Dashboard', href: '/' }, { label: 'Assinaturas' }]}
      />

      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <StatCard
            label="Ativos"
            value={summary.active}
            icon={<CreditCard size={14} />}
            accent="var(--success)"
          />
          <StatCard
            label="Em trial"
            value={summary.trialing}
            icon={<CreditCard size={14} />}
            accent="var(--warning)"
          />
          <StatCard
            label="Cancelados"
            value={summary.canceled}
            icon={<CreditCard size={14} />}
            accent="var(--text-muted)"
          />
          <StatCard
            label="Total"
            value={data?.total ?? 0}
            icon={<CreditCard size={14} />}
            accent="var(--info)"
          />
        </div>
      )}

      <div
        className="rounded-xl"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        <div className="p-4 border-b flex flex-wrap gap-3 items-center" style={{ borderColor: 'var(--border)' }}>
          <div className="relative flex-1 min-w-[240px] max-w-md">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
            <input
              placeholder="Buscar tenantId ou customerId..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg outline-none text-sm"
              style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)' }}
            />
          </div>
          <div className="flex items-center gap-1">
            {['all', 'active', 'trialing', 'past_due', 'canceled'].map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className="px-2.5 py-1 rounded-md text-xs transition-colors"
                style={{
                  background: statusFilter === s ? 'var(--accent-muted)' : 'transparent',
                  color: statusFilter === s ? 'var(--accent)' : 'var(--text-muted)',
                  border: '1px solid ' + (statusFilter === s ? 'var(--accent-strong)' : 'var(--border)'),
                  fontWeight: statusFilter === s ? 600 : 400,
                }}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
            Carregando...
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
            Nenhuma subscription encontrada.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: 'var(--surface-2)' }}>
                  <Th>Tenant</Th>
                  <Th>Plano</Th>
                  <Th>Status</Th>
                  <Th>Stripe customer</Th>
                  <Th>Proximo ciclo</Th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <SubRow key={s.tenantId + (s.stripeSubscriptionId ?? '')} sub={s} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}

function SubRow({ sub }: { sub: Subscription }) {
  return (
    <tr className="border-t" style={{ borderColor: 'var(--border)' }}>
      <td className="px-4 py-3 font-medium">{sub.tenantId}</td>
      <td className="px-4 py-3">
        <span
          className="inline-block px-2 py-0.5 rounded text-[11px] font-medium uppercase tracking-wider"
          style={{
            background: `${PLAN_COLOR[sub.plan] ?? '#94a3b8'}20`,
            color: PLAN_COLOR[sub.plan] ?? '#94a3b8',
          }}
        >
          {sub.plan}
        </span>
      </td>
      <td className="px-4 py-3">
        <span className="inline-flex items-center gap-1.5 text-xs" style={{ color: STATUS_COLOR[sub.status] ?? '#94a3b8' }}>
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: STATUS_COLOR[sub.status] ?? '#94a3b8' }}
          />
          {sub.status}
        </span>
      </td>
      <td className="px-4 py-3 text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
        {sub.stripeCustomerId ? (
          <a
            href={`https://dashboard.stripe.com/customers/${sub.stripeCustomerId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 hover:text-[var(--accent)]"
          >
            {sub.stripeCustomerId.slice(0, 16)}...
            <ExternalLink size={11} />
          </a>
        ) : (
          '—'
        )}
      </td>
      <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-muted)' }}>
        {sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd).toLocaleDateString('pt-BR') : '—'}
      </td>
    </tr>
  )
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th
      className="text-left px-4 py-3 font-medium text-[11px] uppercase tracking-wider"
      style={{ color: 'var(--text-muted)' }}
    >
      {children}
    </th>
  )
}
