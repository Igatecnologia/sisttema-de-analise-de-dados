import {
  AlertCircle,
  Bell,
  BookOpen,
  Boxes,
  Building2,
  Calendar,
  ChevronLeft,
  ChevronRight,
  CircuitBoard,
  ClipboardList,
  Database,
  FileSearch,
  FileText,
  HelpCircle,
  HomeIcon,
  KeyRound,
  LineChart,
  Lock,
  Megaphone,
  Package,
  Phone,
  PieChart,
  Receipt,
  ScrollText,
  Search,
  Settings,
  ShoppingCart,
  Sparkles,
  Star,
  Truck,
  UserCircle,
  Users,
  Wallet,
  Wrench,
  Zap,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from '../auth/AuthContext'
import { hasPermission, type Permission } from '../auth/permissions'
import { useTenant } from '../tenant/TenantContext'
import { useAppTheme } from '../theme/ThemeContext'

type NavItem = {
  to: string
  label: string
  icon: ReactNode
  permission?: Permission
  module?: string
  badge?: string
  badgeColor?: string
  external?: string
}

type NavGroup = {
  id: string
  label: string
  items: NavItem[]
}

type Props = {
  collapsed: boolean
  onCollapseToggle: () => void
  onNavigate?: () => void
  isMobileDrawer?: boolean
}

function buildGroups(_session: unknown): NavGroup[] {
  return [
    {
      id: 'home',
      label: 'Visão',
      items: [
        { to: '/gestao', label: 'Visão do gestor', icon: <PieChart size={17} /> },
        { to: '/dashboard', label: 'Visão geral', icon: <HomeIcon size={17} /> },
        { to: '/dashboard/analises', label: 'Análises BI', icon: <LineChart size={17} /> },
        { to: '/dashboard/vendas-analitico', label: 'Vendas', icon: <ShoppingCart size={17} /> },
        { to: '/alertas', label: 'Alertas', icon: <AlertCircle size={17} /> },
        { to: '/notificacoes', label: 'Notificações', icon: <Bell size={17} /> },
      ],
    },
    {
      id: 'operacao',
      label: 'Operação',
      items: [
        { to: '/producao', label: 'Produção', icon: <CircuitBoard size={17} />, module: 'producao', permission: 'producao:view' },
        { to: '/ficha-tecnica', label: 'Ficha técnica', icon: <ClipboardList size={17} />, module: 'ficha_tecnica', permission: 'fichatecnica:view' },
        { to: '/compras', label: 'Compras', icon: <Package size={17} />, module: 'compras', permission: 'producao:view' },
        { to: '/notas-fiscais', label: 'Notas fiscais', icon: <Receipt size={17} />, module: 'comercial', permission: 'comercial:view' },
        { to: '/estoque', label: 'Estoque', icon: <Boxes size={17} />, module: 'estoque', permission: 'estoque:view' },
        { to: '/clientes', label: 'Clientes', icon: <Users size={17} />, module: 'comercial', permission: 'comercial:view' },
      ],
    },
    {
      id: 'financeiro',
      label: 'Financeiro & relatórios',
      items: [
        { to: '/financeiro', label: 'Visão financeira', icon: <Wallet size={17} />, permission: 'reports:view' },
        { to: '/relatorios', label: 'Relatórios', icon: <FileText size={17} />, permission: 'reports:view' },
        { to: '/relatorios/galeria', label: 'Galeria', icon: <BookOpen size={17} />, permission: 'reports:view' },
        { to: '/relatorios/agendados', label: 'Agendados', icon: <Calendar size={17} />, permission: 'reports:view' },
        { to: '/visoes-salvas', label: 'Visões salvas', icon: <Star size={17} />, permission: 'reports:view' },
      ],
    },
    {
      id: 'admin',
      label: 'Administração',
      items: [
        { to: '/configuracoes', label: 'Configurações', icon: <Settings size={17} />, permission: 'users:view' },
        { to: '/usuarios', label: 'Funcionários', icon: <UserCircle size={17} />, permission: 'users:view' },
        { to: '/orgs', label: 'Organizações', icon: <Building2 size={17} />, permission: 'users:view' },
        { to: '/auditoria', label: 'Auditoria', icon: <FileSearch size={17} />, permission: 'audit:view' },
        { to: '/api-keys', label: 'API keys', icon: <KeyRound size={17} />, permission: 'audit:view' },
        { to: '/billing', label: 'Plano e cobrança', icon: <Wallet size={17} />, badge: 'admin' },
      ],
    },
    {
      id: 'integracoes',
      label: 'Dados & integrações',
      items: [
        { to: '/fontes-de-dados', label: 'Fontes de dados', icon: <Database size={17} />, permission: 'datasources:view' },
        { to: '/integracoes/saude', label: 'Saúde integrações', icon: <Zap size={17} />, permission: 'datasources:view' },
        { to: '/connectors', label: 'Conectores', icon: <Truck size={17} />, permission: 'datasources:view' },
        { to: '/webhooks', label: 'Webhooks', icon: <Megaphone size={17} />, permission: 'audit:view' },
      ],
    },
    {
      id: 'suporte',
      label: 'Conta & suporte',
      items: [
        { to: '/perfil', label: 'Meu perfil', icon: <UserCircle size={17} /> },
        { to: '/seguranca', label: 'Segurança', icon: <Lock size={17} /> },
        { to: '/seguranca/lgpd', label: 'Privacidade (LGPD)', icon: <ScrollText size={17} /> },
        { to: '/ajuda', label: 'Central de ajuda', icon: <HelpCircle size={17} /> },
        { to: '/novidades', label: 'Novidades', icon: <Sparkles size={17} /> },
        { to: '/suporte/fale-conosco', label: 'Fale conosco', icon: <Phone size={17} /> },
        { to: '/admin/operacao', label: 'Operação', icon: <Wrench size={17} />, permission: 'operations:view', module: 'operations' },
      ],
    },
  ]
}

export function AppSidebar({ collapsed, onCollapseToggle, onNavigate, isMobileDrawer }: Props) {
  const tenant = useTenant()
  const { session } = useAuth()
  const location = useLocation()
  const { mode } = useAppTheme()
  const [filter, setFilter] = useState('')
  const filterRef = useRef<HTMLInputElement>(null)

  // Atalho '/' foca o filtro (estilo GitHub)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null
      const typing = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement
      if (e.key === '/' && !typing && !collapsed) {
        e.preventDefault()
        filterRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [collapsed])

  const groups = useMemo(() => {
    const all = buildGroups(session)
    const enabledModules = tenant.enabledModules ?? []
    const q = filter.trim().toLowerCase()
    return all
      .map((g) => ({
        ...g,
        items: g.items
          .filter((it) => {
            if (it.permission && !hasPermission(session, it.permission)) return false
            if (it.module && !enabledModules.includes(it.module)) return false
            return true
          })
          .filter((it) => (q ? it.label.toLowerCase().includes(q) : true)),
      }))
      .filter((g) => g.items.length > 0)
  }, [session, tenant.enabledModules, filter])

  const isActive = (path: string) => {
    if (path === '/gestao') return location.pathname === '/gestao'
    if (path === '/dashboard') return location.pathname === '/dashboard'
    return location.pathname === path || location.pathname.startsWith(`${path}/`)
  }

  const sidebarStyle: React.CSSProperties = {
    width: collapsed ? 76 : 256,
    minWidth: collapsed ? 76 : 256,
    height: isMobileDrawer ? '100%' : '100vh',
    background:
      mode === 'dark'
        ? 'linear-gradient(180deg, #0f1620 0%, #0a0e14 100%)'
        : 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
    borderRight: `1px solid ${mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.06)'}`,
    display: 'flex',
    flexDirection: 'column',
    position: isMobileDrawer ? 'relative' : 'sticky',
    top: 0,
    transition: 'width 200ms cubic-bezier(0.4, 0, 0.2, 1)',
    zIndex: 10,
  }

  return (
    <aside
      role="navigation"
      aria-label="Navegação principal"
      className="app-sidebar-modern"
      data-collapsed={collapsed ? '1' : '0'}
      style={sidebarStyle}
    >
      {/* Brand */}
      <div
        style={{
          padding: collapsed ? '20px 0' : '20px 18px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          borderBottom: `1px solid ${mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.05)'}`,
          justifyContent: collapsed ? 'center' : 'flex-start',
          minHeight: 64,
        }}
      >
        {tenant.logoUrl ? (
          <img
            src={tenant.logoUrl}
            alt={tenant.companyName}
            style={{ width: 36, height: 36, borderRadius: 10, objectFit: 'contain', flexShrink: 0 }}
          />
        ) : (
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: `linear-gradient(135deg, ${tenant.primaryColor || '#1677ff'}, ${tenant.primaryColor || '#1677ff'}cc)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              boxShadow: `0 4px 14px ${tenant.primaryColor || '#1677ff'}33`,
            }}
          >
            <Sparkles size={18} color="#fff" />
          </div>
        )}
        {!collapsed && (
          <div style={{ minWidth: 0, lineHeight: 1.2 }}>
            <div
              style={{
                fontWeight: 700,
                fontSize: 14,
                color: mode === 'dark' ? '#e4e7eb' : '#0f172a',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
              title={tenant.companyName}
            >
              {tenant.companyName}
            </div>
            <div
              style={{
                fontSize: 11,
                color: mode === 'dark' ? '#94a3b8' : '#64748b',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {tenant.subtitle}
            </div>
          </div>
        )}
      </div>

      {/* Quick filter */}
      {!collapsed && !isMobileDrawer && (
        <div style={{ padding: '14px 14px 8px' }}>
          <div
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              background: mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.04)',
              borderRadius: 10,
              border: `1px solid ${mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.05)'}`,
              padding: '6px 10px',
            }}
          >
            <Search size={14} style={{ color: mode === 'dark' ? '#64748b' : '#94a3b8', flexShrink: 0 }} />
            <input
              ref={filterRef}
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filtrar menu (/)"
              style={{
                flex: 1,
                marginLeft: 8,
                background: 'transparent',
                border: 'none',
                outline: 'none',
                fontSize: 12,
                color: mode === 'dark' ? '#e4e7eb' : '#0f172a',
                width: '100%',
              }}
            />
            {filter && (
              <button
                type="button"
                onClick={() => setFilter('')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: mode === 'dark' ? '#64748b' : '#94a3b8',
                  fontSize: 11,
                  cursor: 'pointer',
                  padding: 2,
                }}
                aria-label="Limpar filtro"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      )}

      {/* Nav list */}
      <nav
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '8px 10px 16px',
          scrollbarWidth: 'thin',
        }}
        className="app-sidebar-modern__nav"
      >
        {groups.length === 0 && filter && (
          <div
            style={{
              textAlign: 'center',
              padding: 24,
              fontSize: 12,
              color: mode === 'dark' ? '#64748b' : '#94a3b8',
            }}
          >
            Nenhum item encontrado para "{filter}"
          </div>
        )}
        {groups.map((group) => (
          <div key={group.id} style={{ marginBottom: 14 }}>
            {!collapsed && (
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: mode === 'dark' ? '#475569' : '#94a3b8',
                  padding: '8px 12px 6px',
                }}
              >
                {group.label}
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {group.items.map((item) => (
                <NavLinkItem
                  key={item.to}
                  item={item}
                  active={isActive(item.to)}
                  collapsed={collapsed}
                  mode={mode}
                  primaryColor={tenant.primaryColor || '#1677ff'}
                  onClick={onNavigate}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom — collapse toggle */}
      {!isMobileDrawer && (
        <div
          style={{
            padding: '12px',
            borderTop: `1px solid ${mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.05)'}`,
          }}
        >
          <button
            type="button"
            onClick={onCollapseToggle}
            aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              width: '100%',
              padding: collapsed ? '10px 0' : '10px 12px',
              borderRadius: 10,
              border: 'none',
              background: 'transparent',
              color: mode === 'dark' ? '#94a3b8' : '#64748b',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 500,
              justifyContent: collapsed ? 'center' : 'flex-start',
              transition: 'all 150ms ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background =
                mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.04)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent'
            }}
          >
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
            {!collapsed && <span>Recolher menu</span>}
          </button>
        </div>
      )}
    </aside>
  )
}

function NavLinkItem({
  item,
  active,
  collapsed,
  mode,
  primaryColor,
  onClick,
}: {
  item: NavItem
  active: boolean
  collapsed: boolean
  mode: 'dark' | 'light'
  primaryColor: string
  onClick?: () => void
}) {
  const baseColor = mode === 'dark' ? '#cbd5e1' : '#475569'
  const activeColor = mode === 'dark' ? '#fff' : '#0f172a'
  const hoverBg = mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.04)'

  return (
    <Link
      to={item.to}
      onClick={onClick}
      title={collapsed ? item.label : undefined}
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: collapsed ? '10px 0' : '9px 12px',
        borderRadius: 10,
        textDecoration: 'none',
        color: active ? activeColor : baseColor,
        background: active
          ? mode === 'dark'
            ? `linear-gradient(90deg, ${primaryColor}1f, ${primaryColor}08)`
            : `linear-gradient(90deg, ${primaryColor}12, ${primaryColor}03)`
          : 'transparent',
        fontWeight: active ? 600 : 500,
        fontSize: 13.5,
        transition: 'all 150ms ease',
        justifyContent: collapsed ? 'center' : 'flex-start',
      }}
      onMouseEnter={(e) => {
        if (!active) e.currentTarget.style.background = hoverBg
      }}
      onMouseLeave={(e) => {
        if (!active) e.currentTarget.style.background = 'transparent'
      }}
    >
      {/* Active accent bar */}
      {active && !collapsed && (
        <span
          aria-hidden
          style={{
            position: 'absolute',
            left: 0,
            top: 8,
            bottom: 8,
            width: 3,
            background: primaryColor,
            borderRadius: '0 3px 3px 0',
          }}
        />
      )}
      <span
        style={{
          color: active ? primaryColor : mode === 'dark' ? '#94a3b8' : '#64748b',
          flexShrink: 0,
          display: 'flex',
        }}
      >
        {item.icon}
      </span>
      {!collapsed && (
        <>
          <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {item.label}
          </span>
          {item.badge && (
            <span
              style={{
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                padding: '2px 7px',
                borderRadius: 999,
                background: item.badgeColor || `${primaryColor}22`,
                color: item.badgeColor ? '#fff' : primaryColor,
              }}
            >
              {item.badge}
            </span>
          )}
        </>
      )}
    </Link>
  )
}
