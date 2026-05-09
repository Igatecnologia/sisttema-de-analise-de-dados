'use client'

import { useMemo, useState } from 'react'
import { Calendar, Eye, LogIn, Pause, Pencil, Play, Search, Trash2 } from 'lucide-react'
import { Segmented } from 'antd'
import { api, ApiError, type Tenant } from '@/lib/api'

const PLAN_COLOR: Record<string, string> = {
  enterprise: '#fbbf24',
  pro: '#a78bfa',
  starter: '#60a5fa',
  trial: '#94a3b8',
}

const STATUS_COLOR: Record<string, string> = {
  active: '#10b981',
  inactive: '#94a3b8',
  suspended: '#ef4444',
}

type Props = {
  tenants: Tenant[]
  onRefresh: () => void
  onEdit: (tenant: Tenant) => void
  onExtendTrial: (tenant: Tenant) => void
  onOpenDetail: (tenant: Tenant) => void
}

export function TenantsTable({ tenants, onRefresh, onEdit, onExtendTrial, onOpenDetail }: Props) {
  const [search, setSearch] = useState('')
  const [planFilter, setPlanFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [busy, setBusy] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return tenants.filter((t) => {
      if (planFilter !== 'all' && t.plan !== planFilter) return false
      if (statusFilter !== 'all' && t.status !== statusFilter) return false
      if (!q) return true
      return t.slug.toLowerCase().includes(q) || t.name.toLowerCase().includes(q) || t.id.toLowerCase().includes(q)
    })
  }, [tenants, search, planFilter, statusFilter])

  async function action(label: string, fn: () => Promise<unknown>, requireConfirm = true) {
    if (requireConfirm && !window.confirm(`Confirmar: ${label}?`)) return
    try {
      await fn()
      onRefresh()
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Falha'
      alert(msg)
    } finally {
      setBusy(null)
    }
  }

  async function suspend(t: Tenant) {
    setBusy(t.id)
    await action(`Suspender ${t.name}`, () => api.post(`/v1/super-admin/tenants/${t.id}/suspend`))
  }

  async function activate(t: Tenant) {
    setBusy(t.id)
    await action(`Ativar ${t.name}`, () => api.post(`/v1/super-admin/tenants/${t.id}/activate`))
  }

  async function remove(t: Tenant) {
    if (t.id === 'default') {
      alert('Tenant default não pode ser excluído.')
      return
    }
    setBusy(t.id)
    await action(`Excluir ${t.name}`, () => api.delete(`/v1/super-admin/tenants/${t.id}`))
  }

  async function impersonate(t: Tenant) {
    if (t.status !== 'active') return
    setBusy(t.id)
    try {
      await api.post(`/v1/super-admin/tenants/${t.id}/impersonate`)
      window.location.href = `http://localhost:5173/?tenant=${t.slug}`
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Falha'
      alert(msg)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <div className="p-4 border-b space-y-3" style={{ borderColor: 'var(--border)' }}>
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[240px] max-w-md">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
            <input
              placeholder="Buscar por slug, nome ou id…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg outline-none text-sm"
              style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)' }}
            />
          </div>
          <Segmented
            value={planFilter}
            onChange={(v) => setPlanFilter(String(v))}
            options={[
              { label: 'Todos planos', value: 'all' },
              { label: 'Trial', value: 'trial' },
              { label: 'Starter', value: 'starter' },
              { label: 'Pro', value: 'pro' },
              { label: 'Enterprise', value: 'enterprise' },
            ]}
          />
          <Segmented
            value={statusFilter}
            onChange={(v) => setStatusFilter(String(v))}
            options={[
              { label: 'Todos', value: 'all' },
              { label: 'Ativos', value: 'active' },
              { label: 'Suspensos', value: 'suspended' },
              { label: 'Inativos', value: 'inactive' },
            ]}
          />
        </div>
        <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
          Mostrando {filtered.length} de {tenants.length}
        </div>
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr style={{ background: 'var(--surface-2)' }}>
            <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--text-muted)' }}>Tenant</th>
            <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--text-muted)' }}>Plano</th>
            <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--text-muted)' }}>Status</th>
            <th className="text-right px-4 py-3 font-medium" style={{ color: 'var(--text-muted)' }}>Usuários</th>
            <th className="text-right px-4 py-3 font-medium" style={{ color: 'var(--text-muted)' }}>MRR</th>
            <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--text-muted)' }}>Trial até</th>
            <th className="text-right px-4 py-3 font-medium" style={{ color: 'var(--text-muted)' }}>Ações</th>
          </tr>
        </thead>
        <tbody>
          {filtered.length === 0 ? (
            <tr>
              <td colSpan={7} className="text-center py-12" style={{ color: 'var(--text-muted)' }}>
                Nenhum tenant encontrado.
              </td>
            </tr>
          ) : (
            filtered.map((t) => (
              <tr key={t.id} className="border-t" style={{ borderColor: 'var(--border)' }}>
                <td className="px-4 py-3">
                  <button
                    onClick={() => onOpenDetail(t)}
                    className="text-left"
                    style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--text)' }}
                  >
                    <div className="font-medium hover:underline">{t.name}</div>
                    <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {t.slug} · {t.id}
                    </div>
                  </button>
                </td>
                <td className="px-4 py-3">
                  <span
                    className="inline-block px-2 py-0.5 rounded text-xs font-medium uppercase tracking-wider"
                    style={{ background: `${PLAN_COLOR[t.plan]}20`, color: PLAN_COLOR[t.plan] }}
                  >
                    {t.plan}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-1.5 text-xs" style={{ color: STATUS_COLOR[t.status] }}>
                    <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: STATUS_COLOR[t.status] }} />
                    {t.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-right tabular-nums">{t.userCount}</td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {t.mrrBrlCents > 0 ? `R$ ${(t.mrrBrlCents / 100).toLocaleString('pt-BR')}` : '—'}
                </td>
                <td className="px-4 py-3" style={{ color: 'var(--text-muted)' }}>
                  {t.trialEndsAt ? new Date(t.trialEndsAt).toLocaleDateString('pt-BR') : '—'}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <IconBtn label="Ver detalhes" color="var(--text-muted)" onClick={() => onOpenDetail(t)}><Eye size={14} /></IconBtn>
                    <IconBtn label="Editar" color="var(--text-muted)" onClick={() => onEdit(t)}><Pencil size={14} /></IconBtn>
                    {t.status === 'active' ? (
                      <IconBtn label="Entrar como tenant" color="var(--text-muted)" disabled={busy === t.id} onClick={() => impersonate(t)}>
                        <LogIn size={14} />
                      </IconBtn>
                    ) : null}
                    {t.plan === 'trial' ? (
                      <IconBtn label="Estender trial" color="#f59e0b" disabled={busy === t.id} onClick={() => onExtendTrial(t)}>
                        <Calendar size={14} />
                      </IconBtn>
                    ) : null}
                    {t.status === 'suspended' ? (
                      <IconBtn label="Reativar" color="#10b981" disabled={busy === t.id} onClick={() => activate(t)}>
                        <Play size={14} />
                      </IconBtn>
                    ) : (
                      <IconBtn label="Suspender" color="#f59e0b" disabled={busy === t.id} onClick={() => suspend(t)}>
                        <Pause size={14} />
                      </IconBtn>
                    )}
                    {t.id !== 'default' ? (
                      <IconBtn label="Excluir" color="#ef4444" disabled={busy === t.id} onClick={() => remove(t)}>
                        <Trash2 size={14} />
                      </IconBtn>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}

function IconBtn({
  children,
  label,
  color,
  disabled,
  onClick,
}: {
  children: React.ReactNode
  label: string
  color: string
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className="p-1.5 rounded hover:bg-white/5 transition-colors disabled:opacity-50"
      style={{ color }}
    >
      {children}
    </button>
  )
}
