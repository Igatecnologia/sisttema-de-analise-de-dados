'use client'

import { useEffect, useMemo, useState } from 'react'
import { Brain, DollarSign, Sparkles, Zap } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { PageHeader } from '@/components/PageHeader'
import { StatCard } from '@/components/StatCard'
import { api, type AiUsageResponse } from '@/lib/api'

export default function AiUsagePage() {
  const [data, setData] = useState<AiUsageResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [months, setMonths] = useState(3)

  useEffect(() => {
    let active = true
    setLoading(true)
    void (async () => {
      try {
        const res = await api.get<AiUsageResponse>(`/v1/super-admin/ai-usage?months=${months}`)
        if (active) setData(res)
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [months])

  const aggregations = useMemo(() => {
    if (!data?.supported || !data.rows) return null
    const tenantTotals = new Map<string, { tenantId: string; cost: number; conversations: number }>()
    let totalConversations = 0
    let totalErrors = 0
    let avgLatency = 0
    let count = 0
    const modelCounts = new Map<string, number>()

    for (const row of data.rows) {
      const existing = tenantTotals.get(row.tenantId) ?? {
        tenantId: row.tenantId,
        cost: 0,
        conversations: 0,
      }
      existing.cost += row.totalCostUsd
      existing.conversations += row.conversations
      tenantTotals.set(row.tenantId, existing)
      totalConversations += row.conversations
      totalErrors += row.errorRate * row.conversations
      avgLatency += row.avgLatencyMs
      count += 1
      if (row.primaryModel) {
        modelCounts.set(row.primaryModel, (modelCounts.get(row.primaryModel) ?? 0) + 1)
      }
    }
    return {
      topByTenant: [...tenantTotals.values()].sort((a, b) => b.cost - a.cost).slice(0, 10),
      totalConversations,
      avgLatencyMs: count > 0 ? avgLatency / count : 0,
      errorRate: totalConversations > 0 ? (totalErrors / totalConversations) * 100 : 0,
      modelCounts: [...modelCounts.entries()].sort((a, b) => b[1] - a[1]),
    }
  }, [data])

  return (
    <>
      <PageHeader
        title="IA Usage"
        subtitle="Custo + uso do Copilot por tenant"
        breadcrumbs={[{ label: 'Dashboard', href: '/' }, { label: 'IA Usage' }]}
        actions={
          <div className="flex gap-1">
            {[1, 3, 6, 12].map((m) => (
              <button
                key={m}
                onClick={() => setMonths(m)}
                className="px-3 py-1.5 rounded-md text-xs transition-colors"
                style={{
                  background: months === m ? 'var(--accent-muted)' : 'transparent',
                  color: months === m ? 'var(--accent)' : 'var(--text-muted)',
                  border: '1px solid ' + (months === m ? 'var(--accent-strong)' : 'var(--border)'),
                  fontWeight: months === m ? 600 : 400,
                }}
              >
                {m === 1 ? '1 mes' : `${m} meses`}
              </button>
            ))}
          </div>
        }
      />

      {loading ? (
        <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Carregando...
        </div>
      ) : !data?.supported ? (
        <div
          className="rounded-xl p-8 text-center"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        >
          <Brain size={48} className="mx-auto mb-4" style={{ color: 'var(--text-muted)' }} />
          <h3 className="text-lg font-semibold mb-2">Tracking de IA nao disponivel</h3>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            {data?.message ?? 'Configure IGA_STORAGE_DRIVER=postgres para ativar tracking de custo IA por tenant.'}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <StatCard
              label="Custo total"
              value={`US$ ${(data.grandTotalUsd ?? 0).toFixed(2)}`}
              icon={<DollarSign size={14} />}
              accent="var(--success)"
              hint={`Em ${months} ${months === 1 ? 'mes' : 'meses'}`}
            />
            <StatCard
              label="Conversas"
              value={(aggregations?.totalConversations ?? 0).toLocaleString('pt-BR')}
              icon={<Sparkles size={14} />}
              accent="var(--purple)"
            />
            <StatCard
              label="Latencia media"
              value={`${(aggregations?.avgLatencyMs ?? 0).toFixed(0)}ms`}
              icon={<Zap size={14} />}
              accent="var(--info)"
            />
            <StatCard
              label="Taxa de erro"
              value={`${(aggregations?.errorRate ?? 0).toFixed(2)}%`}
              icon={<Brain size={14} />}
              accent={
                (aggregations?.errorRate ?? 0) < 1
                  ? 'var(--success)'
                  : (aggregations?.errorRate ?? 0) < 5
                    ? 'var(--warning)'
                    : 'var(--danger)'
              }
            />
          </div>

          {/* Top tenants */}
          <div
            className="rounded-xl p-5"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
          >
            <h3 className="text-sm font-semibold mb-4">Top 10 tenants por custo IA</h3>
            {aggregations && aggregations.topByTenant.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={aggregations.topByTenant} layout="vertical" margin={{ left: 80 }}>
                  <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" horizontal={false} />
                  <XAxis
                    type="number"
                    stroke="var(--text-muted)"
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v) => `$${v.toFixed(2)}`}
                  />
                  <YAxis
                    type="category"
                    dataKey="tenantId"
                    stroke="var(--text-muted)"
                    tick={{ fontSize: 11 }}
                    width={150}
                  />
                  <Tooltip
                    contentStyle={{
                      background: 'var(--surface-2)',
                      border: '1px solid var(--border)',
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    formatter={(v, name) => {
                      if (name === 'cost') return [`US$ ${Number(v).toFixed(4)}`, 'Custo']
                      return [String(v), String(name)]
                    }}
                  />
                  <Bar dataKey="cost" fill="var(--accent)" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-xs text-center py-8" style={{ color: 'var(--text-muted)' }}>
                Nenhum uso registrado nesse periodo
              </div>
            )}
          </div>

          {/* Tabela detalhada por tenant/mes */}
          <div
            className="rounded-xl"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
          >
            <div className="p-4 border-b" style={{ borderColor: 'var(--border)' }}>
              <h3 className="text-sm font-semibold">Detalhamento por tenant/mes</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: 'var(--surface-2)' }}>
                    <Th>Tenant</Th>
                    <Th>Mes</Th>
                    <Th>Custo (USD)</Th>
                    <Th>Conversas</Th>
                    <Th>Tokens IN</Th>
                    <Th>Tokens OUT</Th>
                    <Th>Latencia</Th>
                    <Th>Erro %</Th>
                    <Th>Modelo</Th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows?.map((row, i) => (
                    <tr key={i} className="border-t" style={{ borderColor: 'var(--border)' }}>
                      <td className="px-4 py-2 text-xs font-mono">{row.tenantId}</td>
                      <td className="px-4 py-2 text-xs">{row.month}</td>
                      <td className="px-4 py-2 text-xs tabular-nums font-medium">
                        US$ {row.totalCostUsd.toFixed(4)}
                      </td>
                      <td className="px-4 py-2 text-xs tabular-nums">{row.conversations}</td>
                      <td className="px-4 py-2 text-xs tabular-nums" style={{ color: 'var(--text-muted)' }}>
                        {row.totalTokensIn.toLocaleString('pt-BR')}
                      </td>
                      <td className="px-4 py-2 text-xs tabular-nums" style={{ color: 'var(--text-muted)' }}>
                        {row.totalTokensOut.toLocaleString('pt-BR')}
                      </td>
                      <td className="px-4 py-2 text-xs tabular-nums" style={{ color: 'var(--text-muted)' }}>
                        {row.avgLatencyMs.toFixed(0)}ms
                      </td>
                      <td
                        className="px-4 py-2 text-xs tabular-nums"
                        style={{
                          color:
                            row.errorRate < 0.01
                              ? 'var(--success)'
                              : row.errorRate < 0.05
                                ? 'var(--warning)'
                                : 'var(--danger)',
                        }}
                      >
                        {(row.errorRate * 100).toFixed(2)}%
                      </td>
                      <td className="px-4 py-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                        {row.primaryModel ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th
      className="text-left px-4 py-2 font-medium text-[11px] uppercase tracking-wider"
      style={{ color: 'var(--text-muted)' }}
    >
      {children}
    </th>
  )
}
