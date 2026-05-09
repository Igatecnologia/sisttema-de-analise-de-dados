'use client'

import { useEffect, useMemo, useState } from 'react'
import { Search, ShieldCheck, ShieldOff } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { api, type CrossTenantUser, type UsersResponse } from '@/lib/api'

const ROLE_COLOR: Record<string, string> = {
  admin: '#fbbf24',
  manager: '#a78bfa',
  viewer: '#60a5fa',
}

const STATUS_COLOR: Record<string, string> = {
  active: '#10b981',
  inactive: '#94a3b8',
  blocked: '#ef4444',
}

export default function UsersPage() {
  const [data, setData] = useState<UsersResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  useEffect(() => {
    let active = true
    void (async () => {
      try {
        const res = await api.get<UsersResponse>('/v1/super-admin/users')
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
    return data.users.filter((u) => {
      if (roleFilter !== 'all' && u.role !== roleFilter) return false
      if (statusFilter !== 'all' && u.status !== statusFilter) return false
      if (!q) return true
      return (
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.tenantId.toLowerCase().includes(q)
      )
    })
  }, [data, search, roleFilter, statusFilter])

  return (
    <>
      <PageHeader
        title="Usuarios"
        subtitle={data ? `${data.total} usuarios em todos os tenants` : 'Carregando...'}
        breadcrumbs={[{ label: 'Dashboard', href: '/' }, { label: 'Usuarios' }]}
      />

      <div
        className="rounded-xl"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        <div className="p-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[240px] max-w-md">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2"
                style={{ color: 'var(--text-muted)' }}
              />
              <input
                placeholder="Buscar por nome, email ou tenantId..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-lg outline-none text-sm"
                style={{
                  background: 'var(--surface-2)',
                  border: '1px solid var(--border)',
                  color: 'var(--text)',
                }}
              />
            </div>
            <FilterChips
              label="Role"
              value={roleFilter}
              onChange={setRoleFilter}
              options={[
                { value: 'all', label: 'Todos' },
                { value: 'admin', label: 'Admin' },
                { value: 'manager', label: 'Manager' },
                { value: 'viewer', label: 'Viewer' },
              ]}
            />
            <FilterChips
              label="Status"
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { value: 'all', label: 'Todos' },
                { value: 'active', label: 'Ativos' },
                { value: 'inactive', label: 'Inativos' },
                { value: 'blocked', label: 'Bloqueados' },
              ]}
            />
          </div>
          <div className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
            {loading ? 'Carregando...' : `Mostrando ${filtered.length} de ${data?.total ?? 0}`}
          </div>
        </div>

        {loading ? null : filtered.length === 0 ? (
          <div className="p-12 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
            Nenhum usuario encontrado.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: 'var(--surface-2)' }}>
                  <Th>Usuario</Th>
                  <Th>Tenant</Th>
                  <Th>Role</Th>
                  <Th>Status</Th>
                  <Th>MFA</Th>
                  <Th>Criado</Th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => (
                  <UserRow key={u.id} user={u} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}

function UserRow({ user }: { user: CrossTenantUser }) {
  return (
    <tr className="border-t" style={{ borderColor: 'var(--border)' }}>
      <td className="px-4 py-3">
        <div className="font-medium">{user.name}</div>
        <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {user.email}
        </div>
      </td>
      <td className="px-4 py-3 text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
        {user.tenantId}
      </td>
      <td className="px-4 py-3">
        <span
          className="inline-block px-2 py-0.5 rounded text-[11px] font-medium uppercase tracking-wider"
          style={{
            background: `${ROLE_COLOR[user.role] ?? '#94a3b8'}20`,
            color: ROLE_COLOR[user.role] ?? '#94a3b8',
          }}
        >
          {user.role}
        </span>
      </td>
      <td className="px-4 py-3">
        <span
          className="inline-flex items-center gap-1.5 text-xs"
          style={{ color: STATUS_COLOR[user.status] ?? '#94a3b8' }}
        >
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: STATUS_COLOR[user.status] ?? '#94a3b8' }}
          />
          {user.status}
        </span>
      </td>
      <td className="px-4 py-3">
        {user.mfaEnabled ? (
          <span className="inline-flex items-center gap-1 text-xs" style={{ color: 'var(--success)' }}>
            <ShieldCheck size={12} />
            ativo
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-xs" style={{ color: 'var(--text-faint)' }}>
            <ShieldOff size={12} />
            inativo
          </span>
        )}
      </td>
      <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-muted)' }}>
        {user.createdAt ? new Date(user.createdAt).toLocaleDateString('pt-BR') : '—'}
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

function FilterChips({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: Array<{ value: string; label: string }>
}) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-xs mr-1" style={{ color: 'var(--text-muted)' }}>
        {label}:
      </span>
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className="px-2.5 py-1 rounded-md text-xs transition-colors"
          style={{
            background: value === opt.value ? 'var(--accent-muted)' : 'transparent',
            color: value === opt.value ? 'var(--accent)' : 'var(--text-muted)',
            border:
              value === opt.value ? '1px solid var(--accent-strong)' : '1px solid var(--border)',
            fontWeight: value === opt.value ? 600 : 400,
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
