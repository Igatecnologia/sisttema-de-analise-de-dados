'use client'

import { useEffect, useState } from 'react'
import { Boxes, RefreshCw, Wrench } from 'lucide-react'
import { message } from 'antd'
import { PageHeader } from '@/components/PageHeader'
import { api, ApiError } from '@/lib/api'

type ConnectorMeta = {
  id: string
  name: string
  description?: string
  segments?: string[]
  status?: string
  areas?: string[]
}

type ConnectorsResponse = {
  connectors: ConnectorMeta[]
}

const SEGMENT_LABEL: Record<string, string> = {
  industry: 'Industria',
  commerce: 'Comercio',
  services: 'Servicos',
  distribution: 'Distribuicao',
}

export default function ConnectorsPage() {
  const [data, setData] = useState<ConnectorMeta[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [reloading, setReloading] = useState(false)

  async function load() {
    try {
      const res = await api.get<ConnectorsResponse>('/v1/connectors')
      setData(res.connectors ?? [])
    } catch {
      setData([])
    } finally {
      setLoading(false)
    }
  }

  async function reload() {
    setReloading(true)
    try {
      await api.post('/v1/connectors/reload')
      message.success('Connectors recarregados')
      await load()
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Falha ao recarregar'
      message.error(msg)
    } finally {
      setReloading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  return (
    <>
      <PageHeader
        title="Connectors"
        subtitle={data ? `${data.length} connectors registrados` : 'Carregando...'}
        breadcrumbs={[{ label: 'Dashboard', href: '/' }, { label: 'Connectors' }]}
        actions={
          <button onClick={reload} disabled={reloading} className="btn btn-secondary">
            <RefreshCw size={14} className={reloading ? 'animate-spin' : ''} />
            Hot reload
          </button>
        }
      />

      {loading ? (
        <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Carregando connectors...
        </div>
      ) : data && data.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.map((c) => (
            <div
              key={c.id}
              className="rounded-xl p-5"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Boxes size={18} style={{ color: 'var(--accent)' }} />
                  <h3 className="font-semibold text-sm">{c.name}</h3>
                </div>
                {c.status && (
                  <span
                    className="text-[10px] px-2 py-0.5 rounded uppercase tracking-wider font-medium"
                    style={{
                      background:
                        c.status === 'available' || c.status === 'active'
                          ? 'rgba(16,185,129,0.1)'
                          : 'rgba(148,163,184,0.1)',
                      color:
                        c.status === 'available' || c.status === 'active'
                          ? 'var(--success)'
                          : 'var(--text-muted)',
                    }}
                  >
                    {c.status}
                  </span>
                )}
              </div>
              <div className="text-xs font-mono mb-2" style={{ color: 'var(--text-muted)' }}>
                {c.id}
              </div>
              {c.description && (
                <p className="text-sm mb-3" style={{ color: 'var(--text-muted)' }}>
                  {c.description}
                </p>
              )}
              {c.segments && c.segments.length > 0 && (
                <div className="mt-3">
                  <div
                    className="text-[10px] uppercase tracking-wider mb-1.5"
                    style={{ color: 'var(--text-faint)' }}
                  >
                    Segmentos
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {c.segments.map((s) => (
                      <span
                        key={s}
                        className="text-[11px] px-2 py-0.5 rounded"
                        style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}
                      >
                        {SEGMENT_LABEL[s] ?? s}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {c.areas && c.areas.length > 0 && (
                <div className="mt-2">
                  <div
                    className="text-[10px] uppercase tracking-wider mb-1.5"
                    style={{ color: 'var(--text-faint)' }}
                  >
                    Areas suportadas
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {c.areas.map((a) => (
                      <span
                        key={a}
                        className="text-[11px] px-2 py-0.5 rounded"
                        style={{ background: 'var(--accent-muted)', color: 'var(--accent)' }}
                      >
                        {a}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div
          className="rounded-xl p-12 text-center"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        >
          <Wrench size={32} className="mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Nenhum connector encontrado.
          </p>
        </div>
      )}
    </>
  )
}
