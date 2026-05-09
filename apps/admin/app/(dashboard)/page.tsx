'use client'

import { useEffect, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  Building2,
  Calendar,
  DollarSign,
  RefreshCw,
  Sparkles,
  TrendingDown,
  Users,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { PageHeader } from '@/components/PageHeader'
import { StatCard } from '@/components/StatCard'
import {
  api,
  type AiUsageResponse,
  type AuditEvent,
  type Metrics,
  type SystemHealthResponse,
  type TenantsResponse,
} from '@/lib/api'

type DashboardData = {
  metrics: Metrics | null
  tenants: TenantsResponse | null
  audit: AuditEvent[]
  health: SystemHealthResponse | null
  aiUsage: AiUsageResponse | null
}

const PLAN_COLORS: Record<string, string> = {
  trial: '#94a3b8',
  starter: '#60a5fa',
  pro: '#a78bfa',
  enterprise: '#fbbf24',
}

const STATUS_COLORS: Record<string, string> = {
  active: '#10b981',
  inactive: '#94a3b8',
  suspended: '#ef4444',
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData>({
    metrics: null,
    tenants: null,
    audit: [],
    health: null,
    aiUsage: null,
  })
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  async function load(opts: { silent?: boolean } = {}) {
    if (!opts.silent) setLoading(true)
    setRefreshing(true)
    try {
      const [m, t, a, h, ai] = await Promise.allSettled([
        api.get<Metrics>('/v1/super-admin/metrics'),
        api.get<TenantsResponse>('/v1/super-admin/tenants'),
        api.get<{ events: AuditEvent[] }>('/v1/super-admin/audit-recent'),
        api.get<SystemHealthResponse>('/v1/super-admin/system-health'),
        api.get<AiUsageResponse>('/v1/super-admin/ai-usage?months=1'),
      ])
      setData({
        metrics: m.status === 'fulfilled' ? m.value : null,
        tenants: t.status === 'fulfilled' ? t.value : null,
        audit: a.status === 'fulfilled' ? a.value.events : [],
        health: h.status === 'fulfilled' ? h.value : null,
        aiUsage: ai.status === 'fulfilled' ? ai.value : null,
      })
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const metrics = data.metrics
  const tenants = data.tenants
  const planData = tenants
    ? Object.entries(tenants.metrics.byPlan).map(([plan, count]) => ({
        plan,
        count,
        fill: PLAN_COLORS[plan] ?? 'var(--accent)',
      }))
    : []
  const statusData = tenants
    ? Object.entries(tenants.metrics.byStatus).map(([status, count]) => ({
        status,
        count,
        fill: STATUS_COLORS[status] ?? 'var(--accent)',
      }))
    : []

  // Top 5 tenants by MRR
  const topByMrr = tenants
    ? [...tenants.tenants]
        .sort((a, b) => b.mrrBrlCents - a.mrrBrlCents)
        .filter((t) => t.mrrBrlCents > 0)
        .slice(0, 5)
        .map((t) => ({
          name: t.name.length > 20 ? `${t.name.slice(0, 18)}...` : t.name,
          mrr: t.mrrBrlCents / 100,
          plan: t.plan,
        }))
    : []

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle="Visao geral cross-tenant em tempo real"
        actions={
          <button
            onClick={() => void load({ silent: true })}
            disabled={refreshing}
            className="btn btn-secondary"
            aria-label="Atualizar"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            Atualizar
          </button>
        }
      />

      {loading ? (
        <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Carregando metricas...
        </div>
      ) : (
        <div className="space-y-6">
          {/* KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <StatCard
              label="MRR"
              value={metrics?.mrrBrlFormatted ?? '—'}
              icon={<DollarSign size={14} />}
              accent="var(--success)"
              hint={`${metrics?.activeSubscriptions ?? 0} assinaturas ativas`}
            />
            <StatCard
              label="Tenants ativos"
              value={tenants?.metrics.byStatus.active ?? 0}
              icon={<Building2 size={14} />}
              accent="var(--info)"
              hint={`${tenants?.total ?? 0} no total`}
            />
            <StatCard
              label="Em trial"
              value={metrics?.trialingTenants ?? 0}
              icon={<Calendar size={14} />}
              accent="var(--warning)"
              hint="Aguardando conversao"
            />
            <StatCard
              label="Churn"
              value={`${metrics?.churnRatePct ?? 0}%`}
              icon={<TrendingDown size={14} />}
              accent="var(--danger)"
              hint={`${metrics?.canceledSubscriptions ?? 0} cancelamentos`}
            />
          </div>

          {/* Health + AI Usage strip */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div
              className="rounded-xl p-5 col-span-2"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Activity size={14} style={{ color: 'var(--success)' }} />
                  Saude dos servicos
                </h3>
                <span
                  className="text-[11px] font-medium px-2 py-0.5 rounded uppercase tracking-wider"
                  style={{
                    color: data.health?.status === 'healthy' ? 'var(--success)' : 'var(--warning)',
                    background:
                      data.health?.status === 'healthy' ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)',
                  }}
                >
                  {data.health?.status ?? 'unknown'}
                </span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {data.health
                  ? Object.entries(data.health.checks).map(([key, c]) => (
                      <div key={key} className="flex items-center gap-2 text-xs">
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ background: c.ok ? 'var(--success)' : 'var(--danger)' }}
                        />
                        <span className="font-medium">{key}</span>
                        <span style={{ color: 'var(--text-muted)' }}>{c.detail}</span>
                      </div>
                    ))
                  : null}
              </div>
            </div>

            <div
              className="rounded-xl p-5"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
            >
              <div className="flex items-center gap-2 mb-3 text-sm font-semibold">
                <Sparkles size={14} style={{ color: 'var(--purple)' }} />
                Custo IA (mes)
              </div>
              {data.aiUsage?.supported ? (
                <>
                  <div className="text-3xl font-bold tabular-nums">
                    US$ {(data.aiUsage.grandTotalUsd ?? 0).toFixed(2)}
                  </div>
                  <div className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
                    {data.aiUsage.rows?.length ?? 0} tenants ativos
                  </div>
                </>
              ) : (
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  Tracking requer Postgres
                </div>
              )}
            </div>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ChartCard title="Distribuicao por plano" subtitle="Quantos tenants em cada plano">
              {planData.length > 0 ? (
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie
                      data={planData}
                      dataKey="count"
                      nameKey="plan"
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                      label={(entry: { plan: string; count: number }) => `${entry.plan} (${entry.count})`}
                    >
                      {planData.map((d) => (
                        <Cell key={d.plan} fill={d.fill} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: 'var(--surface-2)',
                        border: '1px solid var(--border)',
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <EmptyHint message="Sem dados ainda" />
              )}
            </ChartCard>

            <ChartCard title="Top 5 por MRR" subtitle="Tenants que mais geram receita">
              {topByMrr.length > 0 ? (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={topByMrr} layout="vertical" margin={{ left: 60 }}>
                    <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" stroke="var(--text-muted)" tick={{ fontSize: 11 }} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      stroke="var(--text-muted)"
                      tick={{ fontSize: 11 }}
                      width={130}
                    />
                    <Tooltip
                      contentStyle={{
                        background: 'var(--surface-2)',
                        border: '1px solid var(--border)',
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                      formatter={(v) => [`R$ ${Number(v).toLocaleString('pt-BR')}`, 'MRR']}
                    />
                    <Bar dataKey="mrr" radius={[0, 6, 6, 0]}>
                      {topByMrr.map((d, i) => (
                        <Cell key={i} fill={PLAN_COLORS[d.plan] ?? 'var(--accent)'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyHint message="Nenhum tenant pagante ainda" />
              )}
            </ChartCard>
          </div>

          {/* Status + atividade recente */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ChartCard title="Status dos tenants" subtitle="Distribuicao por status operacional">
              {statusData.length > 0 ? (
                <div className="space-y-3 mt-2">
                  {statusData.map((d) => {
                    const total = statusData.reduce((acc, x) => acc + x.count, 0)
                    const pct = total > 0 ? (d.count / total) * 100 : 0
                    return (
                      <div key={d.status}>
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="flex items-center gap-2">
                            <span
                              className="w-2 h-2 rounded-full"
                              style={{ background: d.fill }}
                            />
                            {d.status}
                          </span>
                          <span className="tabular-nums">
                            {d.count} <span style={{ color: 'var(--text-muted)' }}>({pct.toFixed(0)}%)</span>
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full" style={{ background: 'var(--surface-2)' }}>
                          <div
                            className="h-full rounded-full transition-all"
                            style={{ width: `${pct}%`, background: d.fill }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <EmptyHint message="Sem dados" />
              )}
            </ChartCard>

            <ChartCard title="Atividade super-admin recente" subtitle="Ultimas 10 acoes admin">
              {data.audit.length > 0 ? (
                <div className="space-y-2 mt-2 max-h-[280px] overflow-y-auto pr-2">
                  {data.audit.slice(0, 10).map((e) => (
                    <div
                      key={e.id}
                      className="flex items-start gap-3 text-xs py-2 border-b last:border-0"
                      style={{ borderColor: 'var(--border)' }}
                    >
                      <AlertTriangle
                        size={12}
                        className="mt-0.5 flex-shrink-0"
                        style={{ color: 'var(--accent)' }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm">{e.action}</div>
                        <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                          {e.resource} · {e.tenantId ?? 'sem-tenant'} ·{' '}
                          {new Date(e.createdAt).toLocaleString('pt-BR')}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyHint message="Sem atividade recente" />
              )}
            </ChartCard>
          </div>
        </div>
      )}
    </>
  )
}

function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
}) {
  return (
    <div
      className="rounded-xl p-5"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
    >
      <div className="mb-2">
        <h3 className="text-sm font-semibold">{title}</h3>
        {subtitle && (
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {subtitle}
          </p>
        )}
      </div>
      {children}
    </div>
  )
}

function EmptyHint({ message }: { message: string }) {
  return (
    <div
      className="flex items-center justify-center text-xs h-[200px]"
      style={{ color: 'var(--text-muted)' }}
    >
      {message}
    </div>
  )
}

// Suprime warning unused para users import nao-usado neste page
void Users
