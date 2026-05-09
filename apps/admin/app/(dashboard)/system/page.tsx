'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, RefreshCw, XCircle } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { api, type SystemHealthResponse } from '@/lib/api'

export default function SystemPage() {
  const [data, setData] = useState<SystemHealthResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  async function load(opts: { silent?: boolean } = {}) {
    if (!opts.silent) setLoading(true)
    setRefreshing(true)
    try {
      const res = await api.get<SystemHealthResponse>('/v1/super-admin/system-health')
      setData(res)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  return (
    <>
      <PageHeader
        title="Saude do sistema"
        subtitle={
          data
            ? `${data.status === 'healthy' ? 'Tudo OK' : 'Servicos com problemas'} · ${(data.uptime / 3600).toFixed(1)}h uptime`
            : 'Carregando...'
        }
        breadcrumbs={[{ label: 'Dashboard', href: '/' }, { label: 'Saude do sistema' }]}
        actions={
          <button
            onClick={() => void load({ silent: true })}
            disabled={refreshing}
            className="btn btn-secondary"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            Atualizar
          </button>
        }
      />

      {loading ? (
        <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Verificando servicos...
        </div>
      ) : !data ? null : (
        <div className="space-y-6">
          {/* Status banner */}
          <div
            className="rounded-xl p-5 flex items-center gap-4"
            style={{
              background: data.status === 'healthy' ? 'rgba(16,185,129,0.08)' : 'rgba(245,158,11,0.08)',
              border: `1px solid ${data.status === 'healthy' ? 'rgba(16,185,129,0.3)' : 'rgba(245,158,11,0.3)'}`,
            }}
          >
            {data.status === 'healthy' ? (
              <CheckCircle2 size={32} style={{ color: 'var(--success)' }} />
            ) : (
              <XCircle size={32} style={{ color: 'var(--warning)' }} />
            )}
            <div>
              <h2 className="text-lg font-semibold">
                {data.status === 'healthy' ? 'Todos os servicos operacionais' : 'Alguns servicos estao degradados'}
              </h2>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Ultima verificacao: {new Date(data.timestamp).toLocaleString('pt-BR')} · Env: {data.nodeEnv}
              </p>
            </div>
          </div>

          {/* Service grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(data.checks).map(([key, check]) => (
              <div
                key={key}
                className="rounded-xl p-5"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold capitalize">{key}</h3>
                  {check.ok ? (
                    <CheckCircle2 size={20} style={{ color: 'var(--success)' }} />
                  ) : (
                    <XCircle size={20} style={{ color: 'var(--warning)' }} />
                  )}
                </div>
                <div
                  className="text-xs px-2 py-1 rounded inline-block"
                  style={{
                    background: check.ok ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)',
                    color: check.ok ? 'var(--success)' : 'var(--warning)',
                  }}
                >
                  {check.ok ? 'operational' : 'unconfigured'}
                </div>
                {check.detail && (
                  <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
                    {check.detail}
                  </p>
                )}
              </div>
            ))}
          </div>

          {/* Process info */}
          <div
            className="rounded-xl p-5"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
          >
            <h3 className="text-sm font-semibold mb-3">Process info</h3>
            <dl className="grid grid-cols-2 md:grid-cols-3 gap-4 text-xs">
              <div>
                <dt style={{ color: 'var(--text-muted)' }}>Uptime</dt>
                <dd className="font-mono mt-0.5">{(data.uptime / 3600).toFixed(2)}h</dd>
              </div>
              <div>
                <dt style={{ color: 'var(--text-muted)' }}>Environment</dt>
                <dd className="font-mono mt-0.5">{data.nodeEnv}</dd>
              </div>
              <div>
                <dt style={{ color: 'var(--text-muted)' }}>Health check</dt>
                <dd className="font-mono mt-0.5">{data.timestamp}</dd>
              </div>
            </dl>
          </div>
        </div>
      )}
    </>
  )
}
