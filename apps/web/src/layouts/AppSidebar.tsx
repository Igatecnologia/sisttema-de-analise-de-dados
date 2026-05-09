import {
  AlertCircle,
  Bell,
  BookOpen,
  Boxes,
  Building2,
  Calendar,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  CircuitBoard,
  ClipboardList,
  Database,
  FileSearch,
  FileText,
  HelpCircle,
  Home,
  KeyRound,
  LineChart,
  Lock,
  LogOut,
  Megaphone,
  Moon,
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
  Sun,
  Truck,
  UserCircle,
  Users,
  Wallet,
  Wrench,
  Zap,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import { Dropdown } from 'antd'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../auth/AuthContext'
import { hasPermission, type Permission } from '../auth/permissions'
import { useTenant } from '../tenant/TenantContext'
import { useAppTheme } from '../theme/ThemeContext'
import { listAlerts } from '../services/alertsService'

type NavItem = {
  to: string
  label: string
  icon: ReactNode
  permission?: Permission
  module?: string
  badge?: string | number
  badgeColor?: string
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

function buildGroups(): NavGroup[] {
  return [
    {
      id: 'home',
      label: 'Visão',
      items: [
        { to: '/gestao', label: 'Visão do gestor', icon: <PieChart size={17} /> },
        { to: '/dashboard', label: 'Visão geral', icon: <Home size={17} /> },
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
        { to: '/billing', label: 'Plano e cobrança', icon: <Wallet size={17} /> },
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

function userInitials(name: string | undefined | null): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase()
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase()
}

const ROLE_LABEL: Record<string, string> = {
  admin: 'Administrador',
  manager: 'Gestor',
  viewer: 'Visualizador',
}

export function AppSidebar({ collapsed, onCollapseToggle, onNavigate, isMobileDrawer }: Props) {
  const tenant = useTenant()
  const { session, signOut } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const { mode, toggle: toggleTheme } = useAppTheme()
  const [filter, setFilter] = useState('')
  const filterRef = useRef<HTMLInputElement>(null)
  const navContainerRef = useRef<HTMLDivElement>(null)
  const [scrollState, setScrollState] = useState({ atTop: true, atBottom: false })

  // Atalho '/' foca o filtro
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

  // Scroll fades
  useEffect(() => {
    const el = navContainerRef.current
    if (!el) return
    function update() {
      if (!el) return
      setScrollState({
        atTop: el.scrollTop <= 4,
        atBottom: el.scrollHeight - el.scrollTop - el.clientHeight <= 4,
      })
    }
    update()
    el.addEventListener('scroll', update, { passive: true })
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => {
      el.removeEventListener('scroll', update)
      ro.disconnect()
    }
  }, [])

  // Badge de alertas (count nao lidos)
  const alertsQuery = useQuery({
    queryKey: ['alerts', 'unread-count'],
    queryFn: async () => {
      const items = await listAlerts()
      return items.filter((a) => !a.readAt).length
    },
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
    enabled: Boolean(session),
  })
  const unreadAlerts = alertsQuery.data ?? 0

  const groups = useMemo(() => {
    const all = buildGroups()
    const enabledModules = tenant.enabledModules ?? []
    const q = filter.trim().toLowerCase()
    return all
      .map((g) => ({
        ...g,
        items: g.items
          .map((it) => {
            // Inject badge dynamic for /alertas
            if (it.to === '/alertas' && unreadAlerts > 0) {
              return { ...it, badge: unreadAlerts, badgeColor: '#ef4444' }
            }
            return it
          })
          .filter((it) => {
            if (it.permission && !hasPermission(session, it.permission)) return false
            if (it.module && !enabledModules.includes(it.module)) return false
            return true
          })
          .filter((it) => (q ? it.label.toLowerCase().includes(q) : true)),
      }))
      .filter((g) => g.items.length > 0)
  }, [session, tenant.enabledModules, filter, unreadAlerts])

  const isActive = (path: string) => {
    if (path === '/gestao') return location.pathname === '/gestao'
    if (path === '/dashboard') return location.pathname === '/dashboard'
    return location.pathname === path || location.pathname.startsWith(`${path}/`)
  }

  const primaryColor = tenant.primaryColor || '#2563eb'
  const isDark = mode === 'dark'

  const sidebarStyle: React.CSSProperties = {
    width: collapsed ? 76 : 264,
    minWidth: collapsed ? 76 : 264,
    height: isMobileDrawer ? '100%' : '100vh',
    background: isDark
      ? 'linear-gradient(180deg, #0f1822 0%, #0a0e14 100%)'
      : 'linear-gradient(180deg, #ffffff 0%, #fafbfd 100%)',
    borderRight: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.06)'}`,
    display: 'flex',
    flexDirection: 'column',
    position: isMobileDrawer ? 'relative' : 'sticky',
    top: 0,
    transition: 'width 220ms cubic-bezier(0.4, 0, 0.2, 1)',
    zIndex: 10,
  }

  const handleLogout = () => {
    signOut()
    navigate('/login', { replace: true })
  }

  return (
    <aside
      role="navigation"
      aria-label="Navegação principal"
      className="app-sidebar-modern"
      data-collapsed={collapsed ? '1' : '0'}
      style={sidebarStyle}
    >
      {/* === Brand === */}
      <div
        style={{
          padding: collapsed ? '18px 0' : '18px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.05)'}`,
          justifyContent: collapsed ? 'center' : 'flex-start',
          minHeight: 64,
          flexShrink: 0,
        }}
      >
        <Link
          to="/gestao"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            textDecoration: 'none',
            color: 'inherit',
            minWidth: 0,
            flex: 1,
            justifyContent: collapsed ? 'center' : 'flex-start',
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
                background: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}cc)`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                boxShadow: `0 4px 14px ${primaryColor}33`,
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
                  color: isDark ? '#e4e7eb' : '#0f172a',
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
                  color: isDark ? '#94a3b8' : '#64748b',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {tenant.subtitle}
              </div>
            </div>
          )}
        </Link>
      </div>

      {/* === Quick filter === */}
      {!collapsed && !isMobileDrawer && (
        <div style={{ padding: '14px 14px 4px', flexShrink: 0 }}>
          <div
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.04)',
              borderRadius: 10,
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.05)'}`,
              padding: '7px 10px',
            }}
          >
            <Search size={14} style={{ color: isDark ? '#64748b' : '#94a3b8', flexShrink: 0 }} />
            <input
              ref={filterRef}
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Buscar no menu"
              style={{
                flex: 1,
                marginLeft: 8,
                background: 'transparent',
                border: 'none',
                outline: 'none',
                fontSize: 12.5,
                color: isDark ? '#e4e7eb' : '#0f172a',
                width: '100%',
              }}
            />
            <kbd
              style={{
                fontFamily: 'ui-monospace, monospace',
                fontSize: 10,
                padding: '2px 6px',
                borderRadius: 4,
                background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.06)',
                color: isDark ? '#94a3b8' : '#64748b',
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.06)'}`,
              }}
            >
              /
            </kbd>
            {filter && (
              <button
                type="button"
                onClick={() => setFilter('')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: isDark ? '#64748b' : '#94a3b8',
                  fontSize: 11,
                  cursor: 'pointer',
                  padding: 2,
                  marginLeft: 4,
                }}
                aria-label="Limpar filtro"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      )}

      {/* === Nav list with scroll fades === */}
      <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>
        {/* Top fade */}
        <div
          aria-hidden
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 16,
            pointerEvents: 'none',
            background: `linear-gradient(to bottom, ${isDark ? '#0f1822' : '#ffffff'}, transparent)`,
            opacity: scrollState.atTop ? 0 : 1,
            transition: 'opacity 200ms ease',
            zIndex: 1,
          }}
        />
        {/* Bottom fade */}
        <div
          aria-hidden
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: 16,
            pointerEvents: 'none',
            background: `linear-gradient(to top, ${isDark ? '#0a0e14' : '#fafbfd'}, transparent)`,
            opacity: scrollState.atBottom ? 0 : 1,
            transition: 'opacity 200ms ease',
            zIndex: 1,
          }}
        />
        <nav
          ref={navContainerRef}
          style={{
            height: '100%',
            overflowY: 'auto',
            padding: '8px 10px 12px',
            scrollbarWidth: 'thin',
          }}
          className="app-sidebar-modern__nav"
        >
          {groups.length === 0 && filter && (
            <div
              style={{
                textAlign: 'center',
                padding: 28,
                fontSize: 12,
                color: isDark ? '#64748b' : '#94a3b8',
              }}
            >
              Nada encontrado para "<strong>{filter}</strong>"
            </div>
          )}
          {groups.map((group, idx) => (
            <div key={group.id} style={{ marginBottom: 14 }}>
              {!collapsed && (
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    color: isDark ? '#475569' : '#94a3b8',
                    padding: '8px 12px 6px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <span>{group.label}</span>
                  <span
                    aria-hidden
                    style={{
                      flex: 1,
                      height: 1,
                      background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.05)',
                    }}
                  />
                </div>
              )}
              {collapsed && idx > 0 && (
                <div
                  aria-hidden
                  style={{
                    height: 1,
                    margin: '8px 16px',
                    background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.05)',
                  }}
                />
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {group.items.map((item) => (
                  <NavLinkItem
                    key={item.to}
                    item={item}
                    active={isActive(item.to)}
                    collapsed={collapsed}
                    isDark={isDark}
                    primaryColor={primaryColor}
                    onClick={onNavigate}
                  />
                ))}
              </div>
            </div>
          ))}
        </nav>
      </div>

      {/* === User card + actions === */}
      {!isMobileDrawer && session && (
        <div
          style={{
            padding: collapsed ? '10px 10px 12px' : '10px 12px 12px',
            borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.05)'}`,
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            flexShrink: 0,
          }}
        >
          <Dropdown
            placement={collapsed ? 'topRight' : 'top'}
            trigger={['click']}
            menu={{
              items: [
                {
                  key: 'profile',
                  icon: <UserCircle size={14} />,
                  label: 'Meu perfil',
                  onClick: () => navigate('/perfil'),
                },
                {
                  key: 'security',
                  icon: <Lock size={14} />,
                  label: 'Segurança',
                  onClick: () => navigate('/seguranca'),
                },
                {
                  key: 'theme',
                  icon: isDark ? <Sun size={14} /> : <Moon size={14} />,
                  label: isDark ? 'Tema claro' : 'Tema escuro',
                  onClick: toggleTheme,
                },
                { type: 'divider' as const },
                {
                  key: 'logout',
                  icon: <LogOut size={14} />,
                  label: 'Sair',
                  danger: true,
                  onClick: handleLogout,
                },
              ],
            }}
          >
            <button
              type="button"
              aria-label="Menu do usuário"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: collapsed ? 6 : '8px 10px',
                borderRadius: 12,
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.06)'}`,
                background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(15,23,42,0.015)',
                cursor: 'pointer',
                transition: 'background 150ms ease, border-color 150ms ease',
                width: '100%',
                justifyContent: collapsed ? 'center' : 'flex-start',
                color: 'inherit',
                fontFamily: 'inherit',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = isDark
                  ? 'rgba(255,255,255,0.05)'
                  : 'rgba(15,23,42,0.04)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = isDark
                  ? 'rgba(255,255,255,0.02)'
                  : 'rgba(15,23,42,0.015)'
              }}
            >
              {/* Avatar */}
              <div
                style={{
                  width: collapsed ? 32 : 30,
                  height: collapsed ? 32 : 30,
                  borderRadius: 10,
                  background: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}cc)`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  fontSize: 12,
                  fontWeight: 700,
                  flexShrink: 0,
                  letterSpacing: '0.02em',
                }}
              >
                {userInitials(session.user.name)}
              </div>
              {!collapsed && (
                <>
                  <div style={{ minWidth: 0, flex: 1, lineHeight: 1.2, textAlign: 'left' }}>
                    <div
                      style={{
                        fontWeight: 600,
                        fontSize: 12.5,
                        color: isDark ? '#e4e7eb' : '#0f172a',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {session.user.name}
                    </div>
                    <div
                      style={{
                        fontSize: 10.5,
                        color: isDark ? '#64748b' : '#94a3b8',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {ROLE_LABEL[session.user.role] ?? session.user.role}
                    </div>
                  </div>
                  <ChevronsUpDown
                    size={14}
                    style={{ color: isDark ? '#64748b' : '#94a3b8', flexShrink: 0 }}
                  />
                </>
              )}
            </button>
          </Dropdown>

          {/* Collapse toggle */}
          <button
            type="button"
            onClick={onCollapseToggle}
            aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
            title={collapsed ? 'Expandir (Ctrl+B)' : 'Recolher (Ctrl+B)'}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              width: '100%',
              padding: collapsed ? '6px 0' : '6px 10px',
              borderRadius: 8,
              border: 'none',
              background: 'transparent',
              color: isDark ? '#64748b' : '#94a3b8',
              cursor: 'pointer',
              fontSize: 11.5,
              fontWeight: 500,
              justifyContent: 'center',
              transition: 'background 120ms ease',
              fontFamily: 'inherit',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = isDark
                ? 'rgba(255,255,255,0.03)'
                : 'rgba(15,23,42,0.03)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent'
            }}
          >
            {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
            {!collapsed && <span>Recolher</span>}
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
  isDark,
  primaryColor,
  onClick,
}: {
  item: NavItem
  active: boolean
  collapsed: boolean
  isDark: boolean
  primaryColor: string
  onClick?: () => void
}) {
  const baseColor = isDark ? '#cbd5e1' : '#475569'
  const activeColor = isDark ? '#fff' : '#0f172a'
  const hoverBg = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.04)'
  const activeBg = isDark
    ? `linear-gradient(90deg, ${primaryColor}26, ${primaryColor}0a)`
    : `linear-gradient(90deg, ${primaryColor}14, ${primaryColor}04)`

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
        padding: collapsed ? '10px 0' : '8px 12px',
        borderRadius: 10,
        textDecoration: 'none',
        color: active ? activeColor : baseColor,
        background: active ? activeBg : 'transparent',
        fontWeight: active ? 600 : 500,
        fontSize: 13.5,
        transition: 'background 150ms ease, color 150ms ease',
        justifyContent: collapsed ? 'center' : 'flex-start',
      }}
      onMouseEnter={(e) => {
        if (!active) e.currentTarget.style.background = hoverBg
      }}
      onMouseLeave={(e) => {
        if (!active) e.currentTarget.style.background = 'transparent'
      }}
    >
      {/* Active indicator dot */}
      {active && !collapsed && (
        <span
          aria-hidden
          style={{
            position: 'absolute',
            left: 0,
            top: '50%',
            transform: 'translateY(-50%)',
            width: 3,
            height: 18,
            background: primaryColor,
            borderRadius: '0 3px 3px 0',
          }}
        />
      )}
      <span
        style={{
          color: active ? primaryColor : isDark ? '#94a3b8' : '#64748b',
          flexShrink: 0,
          display: 'flex',
        }}
      >
        {item.icon}
      </span>
      {!collapsed && (
        <>
          <span
            style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
          >
            {item.label}
          </span>
          {item.badge !== undefined && item.badge !== '' && (
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.04em',
                padding: '2px 7px',
                minWidth: 20,
                textAlign: 'center',
                borderRadius: 999,
                background: item.badgeColor || `${primaryColor}22`,
                color: item.badgeColor ? '#fff' : primaryColor,
                lineHeight: 1.4,
              }}
            >
              {item.badge}
            </span>
          )}
        </>
      )}
      {/* Collapsed badge dot */}
      {collapsed && item.badge !== undefined && item.badge !== '' && (
        <span
          aria-hidden
          style={{
            position: 'absolute',
            top: 4,
            right: 12,
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: item.badgeColor || primaryColor,
            border: `2px solid ${isDark ? '#0f1822' : '#ffffff'}`,
          }}
        />
      )}
    </Link>
  )
}
