'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Download, Plus, RefreshCw } from 'lucide-react'
import { message } from 'antd'
import { api, ApiError, type Me, type TenantsResponse, type Metrics, type AuditEvent, type Tenant } from '@/lib/api'
import { TenantsTable } from '@/components/TenantsTable'
import { StatsRow } from '@/components/StatsRow'
import { AuditFeed } from '@/components/AuditFeed'
import { TopBar } from '@/components/TopBar'
import { TenantFormModal } from '@/components/TenantFormModal'
import { ExtendTrialModal } from '@/components/ExtendTrialModal'
import { TenantDetailDrawer } from '@/components/TenantDetailDrawer'

export default function HomePage() {
  const router = useRouter()
  const [me, setMe] = useState<Me | null>(null)
  const [tenants, setTenants] = useState<TenantsResponse | null>(null)
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [audit, setAudit] = useState<AuditEvent[] | null>(null)
  const [loading, setLoading] = useState(true)

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Tenant | null>(null)
  const [extendingTrial, setExtendingTrial] = useState<Tenant | null>(null)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [reloadingConnectors, setReloadingConnectors] = useState(false)

  async function load() {
    try {
      const meData = await api.get<Me>('/v1/auth/me')
      if (!meData.isSuperAdmin) {
        router.replace('/login')
        return
      }
      setMe(meData)
      const [t, m, a] = await Promise.all([
        api.get<TenantsResponse>('/v1/super-admin/tenants'),
        api.get<Metrics>('/v1/super-admin/metrics'),
        api.get<{ events: AuditEvent[] }>('/v1/super-admin/audit-recent').catch(() => ({ events: [] })),
      ])
      setTenants(t)
      setMetrics(m)
      setAudit(a.events)
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        router.replace('/login')
        return
      }
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  function exportCsv() {
    if (!tenants) return
    const header = ['slug', 'name', 'plan', 'status', 'users', 'datasources', 'mrr_brl', 'trial_ends_at', 'created_at']
    const rows = tenants.tenants.map((t) =>
      [t.slug, t.name, t.plan, t.status, t.userCount, t.datasourceCount, (t.mrrBrlCents / 100).toFixed(2), t.trialEndsAt ?? '', t.createdAt].join(','),
    )
    const csv = [header.join(','), ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `tenants-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function reloadConnectors() {
    setReloadingConnectors(true)
    try {
      await api.post('/v1/connectors/reload')
      message.success('Connectors recarregados')
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Falha ao recarregar'
      message.error(msg)
    } finally {
      setReloadingConnectors(false)
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Carregando…
        </div>
      </main>
    )
  }

  if (!me) return null

  return (
    <main className="min-h-screen">
      <TopBar me={me} />

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold mb-2">Operações</h1>
            <p style={{ color: 'var(--text-muted)' }}>
              Visão cross-tenant. {tenants ? `${tenants.total} tenants no total.` : ''}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={exportCsv}
              className="px-3 py-2 rounded-lg text-sm flex items-center gap-2 transition-colors hover:bg-white/5"
              style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--text)' }}
            >
              <Download size={14} /> Exportar CSV
            </button>
            <button
              onClick={reloadConnectors}
              disabled={reloadingConnectors}
              className="px-3 py-2 rounded-lg text-sm flex items-center gap-2 transition-colors hover:bg-white/5 disabled:opacity-50"
              style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--text)' }}
            >
              <RefreshCw size={14} className={reloadingConnectors ? 'animate-spin' : ''} /> Recarregar connectors
            </button>
            <button
              onClick={() => {
                setEditing(null)
                setFormOpen(true)
              }}
              className="px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors"
              style={{ background: 'var(--accent)', color: '#0a0e14' }}
            >
              <Plus size={14} /> Novo tenant
            </button>
          </div>
        </header>

        {metrics ? <StatsRow metrics={metrics} /> : null}

        {tenants ? (
          <section>
            <h2 className="text-lg font-semibold mb-4">Tenants</h2>
            <TenantsTable
              tenants={tenants.tenants}
              onRefresh={() => void load()}
              onEdit={(t) => {
                setEditing(t)
                setFormOpen(true)
              }}
              onExtendTrial={(t) => setExtendingTrial(t)}
              onOpenDetail={(t) => setDetailId(t.id)}
            />
          </section>
        ) : null}

        {audit && audit.length > 0 ? (
          <section>
            <h2 className="text-lg font-semibold mb-4">Atividade super-admin recente</h2>
            <AuditFeed events={audit} />
          </section>
        ) : null}
      </div>

      <TenantFormModal
        open={formOpen}
        tenant={editing}
        onClose={() => {
          setFormOpen(false)
          setEditing(null)
        }}
        onSaved={() => void load()}
      />

      <ExtendTrialModal
        tenant={extendingTrial}
        onClose={() => setExtendingTrial(null)}
        onSaved={() => void load()}
      />

      <TenantDetailDrawer tenantId={detailId} onClose={() => setDetailId(null)} />
    </main>
  )
}
