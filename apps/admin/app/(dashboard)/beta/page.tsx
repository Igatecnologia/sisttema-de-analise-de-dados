'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Building2,
  CalendarClock,
  CheckCircle2,
  Clock4,
  Mail,
  Phone,
  Plus,
  Rocket,
  Search,
  ShieldCheck,
  Sparkles,
  XCircle,
} from 'lucide-react'
import { Empty, Input, message, Tag, Tooltip } from 'antd'
import { PageHeader } from '@/components/PageHeader'
import { TenantFormModal } from '@/components/TenantFormModal'
import { TenantDetailDrawer } from '@/components/TenantDetailDrawer'
import { ExtendTrialModal } from '@/components/ExtendTrialModal'
import { api, ApiError, type Tenant, type TenantsResponse } from '@/lib/api'
import { formatCnpj } from '@/lib/cnpjLookup'

function diffDays(iso: string | null): number | null {
  if (!iso) return null
  const target = new Date(iso).getTime()
  if (Number.isNaN(target)) return null
  return Math.ceil((target - Date.now()) / 86_400_000)
}

function StatCard({
  label,
  value,
  icon,
  accent,
  hint,
}: {
  label: string
  value: string | number
  icon: React.ReactNode
  accent: string
  hint?: string
}) {
  return (
    <div
      className="rounded-xl p-5"
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(120% 120% at 100% 0%, ${accent}14 0%, transparent 55%)`,
          pointerEvents: 'none',
        }}
      />
      <div className="relative">
        <div className="flex items-center justify-between mb-3">
          <span
            className="flex items-center gap-2 text-[11px] uppercase tracking-wider font-semibold"
            style={{ color: accent }}
          >
            {icon}
            {label}
          </span>
        </div>
        <div className="text-3xl font-bold tabular-nums">{value}</div>
        {hint && (
          <div className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
            {hint}
          </div>
        )}
      </div>
    </div>
  )
}

function BetaCard({
  tenant,
  onEdit,
  onDetail,
  onExtend,
}: {
  tenant: Tenant
  onEdit: () => void
  onDetail: () => void
  onExtend: () => void
}) {
  const days = diffDays(tenant.trialEndsAt)
  const trialState =
    days == null
      ? { color: 'default' as const, label: 'Sem trial', icon: <Clock4 size={12} /> }
      : days < 0
        ? { color: 'red' as const, label: `Expirou há ${Math.abs(days)}d`, icon: <XCircle size={12} /> }
        : days <= 3
          ? { color: 'orange' as const, label: `${days}d restantes`, icon: <CalendarClock size={12} /> }
          : days <= 7
            ? { color: 'gold' as const, label: `${days}d restantes`, icon: <CalendarClock size={12} /> }
            : { color: 'green' as const, label: `${days}d restantes`, icon: <CheckCircle2 size={12} /> }

  const statusColor =
    tenant.status === 'active' ? 'green' : tenant.status === 'suspended' ? 'red' : 'default'

  const initials = tenant.name
    .split(' ')
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <div
      className="rounded-xl p-5 transition-all"
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        cursor: 'pointer',
      }}
      onClick={onDetail}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onDetail()
      }}
      role="button"
      tabIndex={0}
    >
      <div className="flex items-start gap-3">
        <div
          className="flex-shrink-0 rounded-lg flex items-center justify-center text-sm font-bold"
          style={{
            width: 44,
            height: 44,
            background: tenant.primaryColor
              ? `linear-gradient(135deg, ${tenant.primaryColor}, ${tenant.primaryColor}99)`
              : 'linear-gradient(135deg, var(--accent), var(--accent-strong, var(--accent)))',
            color: '#fff',
          }}
        >
          {initials || <Building2 size={18} />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm truncate">{tenant.name}</span>
            <Tag color={statusColor} style={{ marginRight: 0, fontSize: 10 }}>
              {tenant.status}
            </Tag>
            <Tag color={trialState.color} style={{ marginRight: 0, fontSize: 10, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              {trialState.icon} {trialState.label}
            </Tag>
          </div>
          <div className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>
            {tenant.subtitle ?? 'Gestao e Analise de Dados'} · /{tenant.slug}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 mt-4 text-xs">
        {tenant.cnpj && (
          <Tooltip title="CNPJ cadastrado">
            <div
              className="flex items-center gap-1.5 px-2 py-1.5 rounded"
              style={{ background: 'var(--accent-muted)', color: 'var(--text-muted)' }}
            >
              <ShieldCheck size={12} />
              <span className="truncate" style={{ fontFamily: 'monospace' }}>
                {formatCnpj(tenant.cnpj)}
              </span>
            </div>
          </Tooltip>
        )}
        {tenant.contactEmail && (
          <div
            className="flex items-center gap-1.5 px-2 py-1.5 rounded"
            style={{ background: 'var(--accent-muted)', color: 'var(--text-muted)' }}
          >
            <Mail size={12} />
            <span className="truncate">{tenant.contactEmail}</span>
          </div>
        )}
        {tenant.contactPhone && (
          <div
            className="flex items-center gap-1.5 px-2 py-1.5 rounded"
            style={{ background: 'var(--accent-muted)', color: 'var(--text-muted)' }}
          >
            <Phone size={12} />
            <span className="truncate">{tenant.contactPhone}</span>
          </div>
        )}
        <div
          className="flex items-center gap-1.5 px-2 py-1.5 rounded"
          style={{ background: 'var(--accent-muted)', color: 'var(--text-muted)' }}
        >
          <Building2 size={12} />
          <span>
            {tenant.userCount} usuário{tenant.userCount === 1 ? '' : 's'} · {tenant.datasourceCount} fonte
            {tenant.datasourceCount === 1 ? '' : 's'}
          </span>
        </div>
      </div>

      {tenant.betaNotes && (
        <div
          className="mt-3 p-2.5 rounded text-xs leading-relaxed"
          style={{ background: 'var(--bg-secondary, var(--accent-muted))', color: 'var(--text-muted)' }}
        >
          {tenant.betaNotes}
        </div>
      )}

      <div className="flex items-center gap-2 mt-3 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
        <button
          onClick={(e) => {
            e.stopPropagation()
            onEdit()
          }}
          className="btn btn-secondary"
          style={{ fontSize: 12, padding: '4px 10px' }}
        >
          Editar
        </button>
        {days != null && days <= 7 && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onExtend()
            }}
            className="btn btn-secondary"
            style={{ fontSize: 12, padding: '4px 10px' }}
          >
            <CalendarClock size={12} /> Estender trial
          </button>
        )}
      </div>
    </div>
  )
}

export default function BetaPage() {
  const [data, setData] = useState<TenantsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Tenant | null>(null)
  const [extending, setExtending] = useState<Tenant | null>(null)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  async function load() {
    setLoading(true)
    try {
      const resp = await api.get<TenantsResponse>('/v1/super-admin/tenants')
      setData(resp)
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Falha ao carregar tenants'
      message.error(msg)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const betaTenants = useMemo(() => {
    if (!data) return []
    // "Beta" = tenants em plan=trial OU com betaNotes preenchido OU criados pelo super-admin.
    const list = data.tenants.filter((t) => t.plan === 'trial' || Boolean(t.betaNotes) || Boolean(t.cnpj))
    if (!search.trim()) return list
    const q = search.trim().toLowerCase()
    return list.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.slug.toLowerCase().includes(q) ||
        (t.cnpj ?? '').includes(q.replace(/\D/g, '')) ||
        (t.contactEmail ?? '').toLowerCase().includes(q),
    )
  }, [data, search])

  const stats = useMemo(() => {
    const list = data?.tenants.filter((t) => t.plan === 'trial' || Boolean(t.betaNotes)) ?? []
    const active = list.filter((t) => t.status === 'active').length
    const expiringSoon = list.filter((t) => {
      const d = diffDays(t.trialEndsAt)
      return d != null && d >= 0 && d <= 7
    }).length
    const expired = list.filter((t) => {
      const d = diffDays(t.trialEndsAt)
      return d != null && d < 0
    }).length
    return { total: list.length, active, expiringSoon, expired }
  }, [data])

  return (
    <>
      <PageHeader
        title="Beta Fechada"
        subtitle="Adicione clientes manualmente nesta fase pré-lançamento. CNPJ → empresa preenchida automaticamente."
        breadcrumbs={[{ label: 'Dashboard', href: '/' }, { label: 'Beta Fechada' }]}
        actions={
          <button
            onClick={() => {
              setEditing(null)
              setFormOpen(true)
            }}
            className="btn btn-primary"
          >
            <Plus size={14} /> Adicionar cliente Beta
          </button>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Total no Beta"
          value={stats.total}
          icon={<Sparkles size={14} />}
          accent="#3b82f6"
          hint="Clientes cadastrados pelo super-admin"
        />
        <StatCard
          label="Ativos"
          value={stats.active}
          icon={<CheckCircle2 size={14} />}
          accent="#10b981"
          hint="Status ativo no sistema"
        />
        <StatCard
          label="Vencendo em 7d"
          value={stats.expiringSoon}
          icon={<CalendarClock size={14} />}
          accent="#f59e0b"
          hint="Trial expira em até 7 dias"
        />
        <StatCard
          label="Expirados"
          value={stats.expired}
          icon={<XCircle size={14} />}
          accent="#ef4444"
          hint="Precisam estender ou converter"
        />
      </div>

      <div className="mb-4">
        <Input
          placeholder="Buscar por nome, slug, CNPJ ou email..."
          prefix={<Search size={14} style={{ opacity: 0.5 }} />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          allowClear
          size="large"
          style={{ maxWidth: 480 }}
        />
      </div>

      {loading ? (
        <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Carregando clientes Beta...
        </div>
      ) : betaTenants.length === 0 ? (
        <div
          className="rounded-xl p-12 text-center"
          style={{ background: 'var(--surface)', border: '1px dashed var(--border)' }}
        >
          <Empty
            image={
              <div
                style={{
                  width: 64,
                  height: 64,
                  margin: '0 auto',
                  borderRadius: 16,
                  background: 'linear-gradient(135deg, var(--accent), var(--accent-strong, var(--accent)))',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                }}
              >
                <Rocket size={28} strokeWidth={2} />
              </div>
            }
            description={
              <div>
                <div className="text-base font-medium mb-1">Nenhum cliente Beta ainda</div>
                <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  Comece adicionando clientes manualmente — eles entram em trial de 14 dias.
                </div>
              </div>
            }
          >
            <button
              onClick={() => {
                setEditing(null)
                setFormOpen(true)
              }}
              className="btn btn-primary mt-4"
            >
              <Plus size={14} /> Adicionar primeiro cliente
            </button>
          </Empty>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {betaTenants.map((t) => (
            <BetaCard
              key={t.id}
              tenant={t}
              onEdit={() => {
                setEditing(t)
                setFormOpen(true)
              }}
              onDetail={() => setDetailId(t.id)}
              onExtend={() => setExtending(t)}
            />
          ))}
        </div>
      )}

      <TenantFormModal
        open={formOpen}
        tenant={editing}
        onClose={() => {
          setFormOpen(false)
          setEditing(null)
        }}
        onSaved={() => void load()}
      />
      <ExtendTrialModal tenant={extending} onClose={() => setExtending(null)} onSaved={() => void load()} />
      <TenantDetailDrawer tenantId={detailId} onClose={() => setDetailId(null)} />
    </>
  )
}
