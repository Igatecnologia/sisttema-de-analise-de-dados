'use client'

import { useEffect, useState } from 'react'
import { Search } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { api, type AuditEvent, type AuditSearchResponse } from '@/lib/api'

export default function AuditPage() {
  const [events, setEvents] = useState<AuditEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [actionFilter, setActionFilter] = useState('')
  const [tenantFilter, setTenantFilter] = useState('')

  async function load() {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (actionFilter) params.set('action', actionFilter)
      if (tenantFilter) params.set('tenantId', tenantFilter)
      params.set('limit', '500')
      const res = await api.get<AuditSearchResponse>(
        `/v1/super-admin/audit-search?${params.toString()}`,
      )
      setEvents(res.events)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <>
      <PageHeader
        title="Auditoria"
        subtitle="Trilha completa de eventos do sistema"
        breadcrumbs={[{ label: 'Dashboard', href: '/' }, { label: 'Auditoria' }]}
      />

      <div
        className="rounded-xl"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        <div className="p-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              void load()
            }}
            className="flex flex-wrap gap-3 items-center"
          >
            <div className="relative flex-1 min-w-[200px] max-w-xs">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
              <input
                placeholder="Filtrar por action..."
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-lg outline-none text-sm"
                style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)' }}
              />
            </div>
            <input
              placeholder="tenantId exato..."
              value={tenantFilter}
              onChange={(e) => setTenantFilter(e.target.value)}
              className="px-4 py-2 rounded-lg outline-none text-sm min-w-[200px]"
              style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)' }}
            />
            <button type="submit" className="btn btn-primary">
              Buscar
            </button>
            <button
              type="button"
              onClick={() => {
                setActionFilter('')
                setTenantFilter('')
                setTimeout(() => void load(), 0)
              }}
              className="btn btn-ghost"
            >
              Limpar
            </button>
            <span className="text-xs ml-auto" style={{ color: 'var(--text-muted)' }}>
              {loading ? 'Buscando...' : `${events.length} eventos`}
            </span>
          </form>
        </div>

        {loading ? null : events.length === 0 ? (
          <div className="p-12 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
            Nenhum evento encontrado.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: 'var(--surface-2)' }}>
                  <Th>Quando</Th>
                  <Th>Action</Th>
                  <Th>Resource</Th>
                  <Th>Tenant</Th>
                  <Th>User</Th>
                  <Th>Metadata</Th>
                </tr>
              </thead>
              <tbody>
                {events.map((e) => (
                  <tr key={e.id} className="border-t" style={{ borderColor: 'var(--border)' }}>
                    <td className="px-4 py-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                      {new Date(e.createdAt).toLocaleString('pt-BR')}
                    </td>
                    <td className="px-4 py-2 text-xs font-mono">{e.action}</td>
                    <td className="px-4 py-2 text-xs">{e.resource}</td>
                    <td className="px-4 py-2 text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
                      {e.tenantId ?? '—'}
                    </td>
                    <td className="px-4 py-2 text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
                      {e.userId ?? '—'}
                    </td>
                    <td className="px-4 py-2 text-xs max-w-md">
                      <pre
                        className="text-[10px] truncate"
                        style={{
                          color: 'var(--text-muted)',
                          fontFamily: 'ui-monospace, monospace',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                        title={JSON.stringify(e.metadata)}
                      >
                        {e.metadata ? JSON.stringify(e.metadata) : '—'}
                      </pre>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
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
