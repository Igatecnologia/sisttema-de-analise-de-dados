import { Command } from 'cmdk'
import { Modal } from 'antd'
import { Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { http } from '../services/http'
import { setStoredSession, type AuthSession } from '../auth/authStorage'

type SearchResult = {
  id: string
  category: string
  title: string
  subtitle: string
  route: string
  action?: 'impersonate'
  tenantId?: string
}

type SuperTenant = {
  id: string
  name: string
  slug: string
  status: string
  plan: string
}

type Props = {
  open: boolean
  onClose: () => void
}

const SaaS_COMMANDS: SearchResult[] = [
  { id: 'cmd-planos', category: 'Comandos SaaS', title: 'Ver planos', subtitle: 'Planos, preços e upgrade', route: '/planos' },
  { id: 'cmd-billing', category: 'Comandos SaaS', title: 'Abrir billing', subtitle: 'Status da assinatura, uso e faturas', route: '/billing' },
  { id: 'cmd-config', category: 'Comandos SaaS', title: 'Configurações do tenant', subtitle: 'Empresa, equipe, integrações e uso', route: '/configuracoes' },
  { id: 'cmd-lgpd', category: 'Comandos SaaS', title: 'LGPD e exportação', subtitle: 'Dados pessoais, portabilidade e exclusão', route: '/seguranca/lgpd' },
  { id: 'cmd-datasources', category: 'Comandos SaaS', title: 'Fontes de dados', subtitle: 'Configurar integrações e ERPs', route: '/fontes-de-dados' },
]

export function CommandPalette({ open, onClose }: Props) {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [superTenants, setSuperTenants] = useState<SuperTenant[]>([])
  const grouped = useMemo(() => {
    const map = new Map<string, SearchResult[]>()
    const q = query.trim().toLowerCase()
    const commands = q
      ? SaaS_COMMANDS.filter((item) => `${item.title} ${item.subtitle}`.toLowerCase().includes(q))
      : SaaS_COMMANDS
    const tenantCommands: SearchResult[] = superTenants
      .filter((tenant) => tenant.status === 'active')
      .filter((tenant) => {
        if (!q) return false
        return `${tenant.name} ${tenant.slug} ${tenant.plan}`.toLowerCase().includes(q)
      })
      .slice(0, 8)
      .map((tenant) => ({
        id: `tenant-switch-${tenant.id}`,
        category: 'Tenant switcher',
        title: `Entrar como ${tenant.name}`,
        subtitle: `${tenant.slug} · ${tenant.plan}`,
        route: '/',
        action: 'impersonate' as const,
        tenantId: tenant.id,
      }))
    for (const item of [...commands, ...tenantCommands, ...results]) {
      const list = map.get(item.category) ?? []
      list.push(item)
      map.set(item.category, list)
    }
    return map
  }, [query, results, superTenants])

  useEffect(() => {
    if (!open) return
    const t = setTimeout(async () => {
      try {
        const { data } = await http.get<SearchResult[]>('/api/v1/search', {
          params: { q: query },
        })
        setResults(data)
      } catch {
        setResults([])
      }
    }, 160)
    return () => clearTimeout(t)
  }, [open, query])

  useEffect(() => {
    if (!open) return
    http
      .get<{ tenants: SuperTenant[] }>('/api/v1/super-admin/tenants')
      .then((res) => setSuperTenants(res.data.tenants))
      .catch(() => setSuperTenants([]))
  }, [open])

  async function runItem(item: SearchResult) {
    if (item.action === 'impersonate' && item.tenantId) {
      const { data } = await http.post<AuthSession>(`/api/v1/super-admin/tenants/${item.tenantId}/impersonate`)
      setStoredSession(data)
      window.location.assign('/')
      return
    }
    navigate(item.route)
  }

  return (
    <Modal open={open} onCancel={onClose} footer={null} title={null} width={680}>
      <Command label="Busca global">
        <div className="cmdk-search-row">
          <Search size={16} />
          <Command.Input value={query} onValueChange={setQuery} placeholder="Buscar clientes, produtos, telas..." />
        </div>
        <Command.List className="cmdk-list">
          <Command.Empty>Nenhum resultado.</Command.Empty>
          {[...grouped.entries()].map(([group, items]) => (
            <Command.Group key={group} heading={group}>
              {items.map((item) => (
                <Command.Item
                  key={item.id}
                  value={`${item.title} ${item.subtitle}`}
                  onSelect={() => {
                    void runItem(item)
                    onClose()
                    setQuery('')
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span>{item.title}</span>
                    <small style={{ opacity: 0.65 }}>{item.subtitle}</small>
                  </div>
                </Command.Item>
              ))}
            </Command.Group>
          ))}
        </Command.List>
      </Command>
    </Modal>
  )
}
