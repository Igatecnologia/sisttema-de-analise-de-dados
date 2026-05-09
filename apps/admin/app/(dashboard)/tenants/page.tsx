'use client'

import { useEffect, useState } from 'react'
import { Download, Plus, RefreshCw } from 'lucide-react'
import { message } from 'antd'
import { PageHeader } from '@/components/PageHeader'
import { TenantsTable } from '@/components/TenantsTable'
import { TenantFormModal } from '@/components/TenantFormModal'
import { ExtendTrialModal } from '@/components/ExtendTrialModal'
import { TenantDetailDrawer } from '@/components/TenantDetailDrawer'
import { api, ApiError, type TenantsResponse, type Tenant } from '@/lib/api'

export default function TenantsPage() {
  const [tenants, setTenants] = useState<TenantsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Tenant | null>(null)
  const [extendingTrial, setExtendingTrial] = useState<Tenant | null>(null)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [reloadingConnectors, setReloadingConnectors] = useState(false)

  async function load() {
    try {
      const data = await api.get<TenantsResponse>('/v1/super-admin/tenants')
      setTenants(data)
    } catch (err) {
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
      [
        t.slug,
        t.name,
        t.plan,
        t.status,
        t.userCount,
        t.datasourceCount,
        (t.mrrBrlCents / 100).toFixed(2),
        t.trialEndsAt ?? '',
        t.createdAt,
      ].join(','),
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

  return (
    <>
      <PageHeader
        title="Tenants"
        subtitle={tenants ? `${tenants.total} tenants no sistema` : 'Carregando...'}
        breadcrumbs={[{ label: 'Dashboard', href: '/' }, { label: 'Tenants' }]}
        actions={
          <>
            <button onClick={exportCsv} className="btn btn-secondary">
              <Download size={14} /> Exportar CSV
            </button>
            <button
              onClick={reloadConnectors}
              disabled={reloadingConnectors}
              className="btn btn-secondary"
            >
              <RefreshCw size={14} className={reloadingConnectors ? 'animate-spin' : ''} />
              Reload connectors
            </button>
            <button
              onClick={() => {
                setEditing(null)
                setFormOpen(true)
              }}
              className="btn btn-primary"
            >
              <Plus size={14} /> Novo tenant
            </button>
          </>
        }
      />

      {loading ? (
        <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Carregando tenants...
        </div>
      ) : tenants ? (
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
      ) : null}

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
    </>
  )
}
