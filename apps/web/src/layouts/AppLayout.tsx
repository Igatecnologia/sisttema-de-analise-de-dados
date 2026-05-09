import {
  AlertOutlined,
  AppstoreOutlined,
  ApiOutlined,
  BarChartOutlined,
  ClockCircleOutlined,
  CloudServerOutlined,
  CompassOutlined,
  CustomerServiceOutlined,
  DatabaseOutlined,
  DollarOutlined,
  DotChartOutlined,
  BellOutlined,
  BookOutlined,
  BranchesOutlined,
  ExperimentOutlined,
  FileSearchOutlined,
  FileTextOutlined,
  HomeOutlined,
  InboxOutlined,
  KeyOutlined,
  LockOutlined,
  StarOutlined,
  MenuOutlined,
  ProfileOutlined,
  ShoppingCartOutlined,
  SettingOutlined,
  TeamOutlined,
  PhoneOutlined,
} from '@ant-design/icons'
import { MoonStar, SunMedium, Search, UserCircle2 } from 'lucide-react'
import {
  Breadcrumb,
  Button,
  Drawer,
  Dropdown,
  Layout,
  Menu,
  Modal,
  Space,
  Tag,
  Tooltip,
  Typography,
  theme,
} from 'antd'
import { Grid } from 'antd'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { ForcePasswordChangeModal } from '../auth/ForcePasswordChangeModal'
import { TermsAcceptanceModal } from '../components/TermsAcceptanceModal'
import { BetaWelcomeModal } from '../components/BetaWelcomeModal'
import { hasPermission } from '../auth/permissions'
import { useAppTheme } from '../theme/ThemeContext'
import { useTenant } from '../tenant/TenantContext'
import { getAppEnvBadge } from '../api/apiEnv'
import { http } from '../services/http'
import { setStoredSession, type AuthSession } from '../auth/authStorage'
import {
  getAllowedRoutes,
  getWorkspaceDefinition,
  getUserUxPreferences,
} from '../navigation/uxPreferences'
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts'
import { AlertsBell } from '../components/AlertsBell'
import { CommandPalette } from '../components/CommandPalette'
import { CopilotDrawer } from '../components/CopilotDrawer'
import { OpenTabsBar } from '../components/OpenTabsBar'
import { useOpenTabs } from '../hooks/useOpenTabs'
import { GuidedTour } from '../components/GuidedTour'
import { shouldAutoOpenTour } from '../components/guidedTourStorage'
import { TrialBanner } from '../components/TrialBanner'
import { OrgSwitcher } from '../components/OrgSwitcher'
import { OfflineBanner } from '../components/OfflineBanner'
import { PlanLimitModal } from '../components/PlanLimitModal'
import { AppSidebar } from './AppSidebar'
/**
 * Picker de fonte de vendas foi removido — o sistema lê automaticamente TODAS as
 * fontes compatíveis em paralelo. Ver `services/vendasAnaliticoSourceSelection.ts`.
 */

const { Header, Content } = Layout

const pageTitlesByMenuKey: Record<string, string> = {
  gestao: 'Visão do gestor',
  dashboard: 'Dashboard',
  relatorios: 'Relatórios',
  'relatorios-agendados': 'Relatórios agendados',
  'relatorios-galeria': 'Galeria de relatórios',
  'visoes-salvas': 'Visões salvas',
  financeiro: 'Financeiro',
  usuarios: 'Funcionários',
  'usuario-historico': 'Histórico do usuário',
  orgs: 'Organizações',
  configuracoes: 'Configurações',
  auditoria: 'Auditoria',
  'dashboard-analises': 'Análises BI',
  'dashboard-vendas-analitico': 'Vendas',
  producao: 'Produção',
  'ficha-tecnica': 'Ficha Técnica',
  'notas-fiscais': 'Notas Fiscais',
  compras: 'Compras',
  estoque: 'Estoque',
  alertas: 'Alertas',
  notificacoes: 'Notificações',
  'fontes-de-dados': 'Fontes de dados',
  'integracoes-saude': 'Saúde das integrações',
  'admin-operacao': 'Operação',
  suporte: 'Área técnica',
  'suporte-fale-conosco': 'Fale conosco',
  ajuda: 'Central de ajuda',
  novidades: 'Novidades',
  tokens: 'Design Tokens',
  webhooks: 'Webhooks',
  'super-admin': 'Super Admin (movido)',
  seguranca: 'Segurança',
  'seguranca-lgpd': 'Privacidade e LGPD',
  'api-keys': 'API Keys',
  'billing-plans': 'Planos',
  'billing-recommend': 'Recomendador de plano',
  'billing-portal': 'Assinatura',
  conectores: 'Conectores',
  perfil: 'Meu perfil',
  'boas-vindas': 'Primeiros passos',
  onboarding: 'Bem-vindo',
}

function getTitleByMenuKey(menuKey: string) {
  return pageTitlesByMenuKey[menuKey] ?? 'Dashboard'
}

const groupLabelByMenuKey: Record<string, string> = {
  gestao: 'Dashboards',
  dashboard: 'Dashboards',
  'dashboard-analises': 'Dashboards',
  'dashboard-vendas-analitico': 'Dashboards',
  alertas: 'Dashboards',
  notificacoes: 'Dashboards',
  producao: 'ERP / Produção',
  'ficha-tecnica': 'ERP / Produção',
  compras: 'ERP / Produção',
  'notas-fiscais': 'ERP / Produção',
  estoque: 'ERP / Produção',
  financeiro: 'Financeiro',
  relatorios: 'Financeiro',
  'relatorios-agendados': 'Financeiro',
  'relatorios-galeria': 'Financeiro',
  'visoes-salvas': 'Financeiro',
  usuarios: 'Administração',
  'usuario-historico': 'Administração',
  orgs: 'Administração',
  configuracoes: 'Administração',
  auditoria: 'Administração',
  'api-keys': 'Administração',
  'super-admin': 'Administração',
  seguranca: 'Administração',
  'seguranca-lgpd': 'Administração',
  'billing-plans': 'Administração',
  'billing-recommend': 'Administração',
  'billing-portal': 'Administração',
  perfil: 'Conta',
  'boas-vindas': 'Conta',
  suporte: 'Suporte',
  'suporte-fale-conosco': 'Suporte',
  ajuda: 'Suporte',
  novidades: 'Suporte',
  tokens: 'Suporte',
  webhooks: 'Suporte',
  'fontes-de-dados': 'Suporte',
  'integracoes-saude': 'Suporte',
  'admin-operacao': 'Suporte',
  conectores: 'Suporte',
}

function resolveMenuKeyFromPath(pathname: string): string {
  if (pathname.startsWith('/gestao')) return 'gestao'
  if (pathname.startsWith('/dashboard/analises')) return 'dashboard-analises'
  if (pathname.startsWith('/dashboard/vendas-analitico')) return 'dashboard-vendas-analitico'
  if (pathname.startsWith('/financeiro')) return 'financeiro'
  if (pathname.startsWith('/relatorios/agendados')) return 'relatorios-agendados'
  if (pathname.startsWith('/relatorios/galeria')) return 'relatorios-galeria'
  if (pathname.startsWith('/relatorios')) return 'relatorios'
  if (pathname.startsWith('/visoes-salvas')) return 'visoes-salvas'
  if (pathname.startsWith('/usuarios/') && pathname.endsWith('/historico')) return 'usuario-historico'
  if (pathname.startsWith('/usuarios')) return 'usuarios'
  if (pathname.startsWith('/orgs')) return 'orgs'
  if (pathname.startsWith('/configuracoes')) return 'configuracoes'
  if (pathname.startsWith('/auditoria')) return 'auditoria'
  if (pathname.startsWith('/producao')) return 'producao'
  if (pathname.startsWith('/ficha-tecnica')) return 'ficha-tecnica'
  if (pathname.startsWith('/compras')) return 'compras'
  if (pathname.startsWith('/notas-fiscais')) return 'notas-fiscais'
  if (pathname.startsWith('/estoque')) return 'estoque'
  if (pathname.startsWith('/notificacoes')) return 'notificacoes'
  if (pathname.startsWith('/alertas')) return 'alertas'
  if (pathname.startsWith('/suporte/fale-conosco')) return 'suporte-fale-conosco'
  if (pathname.startsWith('/ajuda')) return 'ajuda'
  if (pathname.startsWith('/novidades')) return 'novidades'
  if (pathname.startsWith('/tokens')) return 'tokens'
  if (pathname.startsWith('/webhooks')) return 'webhooks'
  if (pathname.startsWith('/fontes-de-dados')) return 'fontes-de-dados'
  if (pathname.startsWith('/integracoes/saude')) return 'integracoes-saude'
  if (pathname.startsWith('/admin/operacao')) return 'admin-operacao'
  if (pathname.startsWith('/super-admin')) return 'super-admin'
  if (pathname.startsWith('/seguranca/lgpd')) return 'seguranca-lgpd'
  if (pathname.startsWith('/seguranca')) return 'seguranca'
  if (pathname.startsWith('/api-keys')) return 'api-keys'
  if (pathname.startsWith('/planos/recomendar')) return 'billing-recommend'
  if (pathname.startsWith('/planos') || pathname.startsWith('/billing/plans')) return 'billing-plans'
  if (pathname.startsWith('/billing/portal') || pathname.startsWith('/billing')) return 'billing-portal'
  if (pathname.startsWith('/connectors') || pathname.startsWith('/conectores')) return 'conectores'
  if (pathname.startsWith('/perfil')) return 'perfil'
  if (pathname.startsWith('/boas-vindas')) return 'boas-vindas'
  if (pathname.startsWith('/onboarding')) return 'onboarding'
  if (pathname.startsWith('/suporte')) return 'suporte'
  return 'dashboard'
}

function useSelectedMenuKey(pathname: string) {
  return useMemo(() => resolveMenuKeyFromPath(pathname), [pathname])
}

function hasTenantModule(enabledModules: string[], moduleId: string): boolean {
  return enabledModules.includes(moduleId)
}

/**
 * Menu lateral: prefetch leve no hover — carrega apenas o chunk JS da página
 * (não dispara queryFn/dados). Delay de 300ms evita spike ao passar o mouse rápido.
 */
const chunkPrefetchMap: Record<string, () => Promise<unknown>> = {
  '/gestao': () => import('../pages/DashboardPage'),
  '/gestao/vendas': () => import('../pages/VendasAnaliticoPage'),
  '/gestao/producao': () => import('../pages/ProducaoPage'),
  '/gestao/financeiro': () => import('../pages/FinancePage'),
  '/gestao/notas-fiscais': () => import('../pages/NotasFiscaisPage'),
  '/gestao/compras': () => import('../pages/ComprasPage'),
  '/gestao/estoque': () => import('../pages/EstoquePage'),
  '/gestao/relatorios': () => import('../pages/ReportsPage'),
  '/relatorios/galeria': () => import('../pages/ReportsGalleryPage'),
  '/gestao/usuarios': () => import('../pages/UsersPage'),
  '/perfil': () => import('../pages/ProfilePage'),
  '/configuracoes': () => import('../pages/SettingsPage'),
  '/gestao/auditoria': () => import('../pages/AuditPage'),
}

function SidebarLink({ to, children }: { to: string; children: React.ReactNode }) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const handleMouseEnter = () => {
    const loader = chunkPrefetchMap[to]
    if (!loader) return
    timerRef.current = setTimeout(() => { loader().catch(() => {}) }, 300)
  }
  const handleMouseLeave = () => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null }
  }
  return (
    <Link to={to} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
      {children}
    </Link>
  )
}

function LockedModuleLabel({ children }: { children: React.ReactNode }) {
  return (
    <Tooltip title="Modulo bloqueado no plano atual">
      <Space size={6}>
        <LockOutlined />
        <span>{children}</span>
      </Space>
    </Tooltip>
  )
}

export function AppLayout() {
  const location = useLocation()
  const selectedKey = useSelectedMenuKey(location.pathname)
  const pageTitle = getTitleByMenuKey(selectedKey)
  const [collapsed, setCollapsedRaw] = useState(() => {
    try { return localStorage.getItem('iga.sidebar.collapsed') === '1' } catch { return false }
  })
  const setCollapsed = useCallback((v: boolean) => {
    setCollapsedRaw(v)
    try { localStorage.setItem('iga.sidebar.collapsed', v ? '1' : '0') } catch { /* noop */ }
  }, [])
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)
  const [copilotOpen, setCopilotOpen] = useState(false)
  const [tourOpen, setTourOpen] = useState(() => typeof window !== 'undefined' && shouldAutoOpenTour())
  const { mode, toggle } = useAppTheme()
  const { session, signOut } = useAuth()
  const { token } = theme.useToken()
  const screens = Grid.useBreakpoint()
  const navigate = useNavigate()
  const tenant = useTenant()

  useEffect(() => {
    const company = tenant.companyName?.trim()
    document.title = company ? `${pageTitle} · ${company}` : pageTitle
  }, [pageTitle, tenant.companyName])

  useEffect(() => {
    function handler() {
      setCopilotOpen(true)
    }
    window.addEventListener('iga:open-copilot', handler)
    return () => window.removeEventListener('iga:open-copilot', handler)
  }, [])

  const envBadge = useMemo(() => getAppEnvBadge(), [])
  const allowedRoutes = useMemo(() => getAllowedRoutes(session), [session])
  const navRouteMap = useMemo(
    () => new Map(allowedRoutes.map((route) => [route.path, route])),
    [allowedRoutes],
  )
  const uxPreferences = useMemo(() => getUserUxPreferences(session), [session])
  const workspaceDefinition = useMemo(
    () => getWorkspaceDefinition(uxPreferences.workspaceId),
    [uxPreferences.workspaceId],
  )

  /* ── Sub-menus colapsáveis ── */
  const navItems = useMemo(() => {
    const items: NonNullable<React.ComponentProps<typeof Menu>['items']> = []

    if (hasPermission(session, 'dashboard:view') && hasTenantModule(tenant.enabledModules, 'dashboard')) {
      items.push({
        key: 'sub-dashboard',
        icon: <BarChartOutlined />,
        label: 'Dashboard',
        children: [
          { key: 'gestao', icon: <CompassOutlined />, label: <SidebarLink to="/gestao">Visão do gestor</SidebarLink> },
          { key: 'dashboard', icon: <HomeOutlined />, label: <SidebarLink to="/dashboard">Visão geral</SidebarLink> },
          { key: 'dashboard-analises', icon: <DotChartOutlined />, label: <SidebarLink to="/dashboard/analises">Análises BI</SidebarLink> },
          { key: 'dashboard-vendas-analitico', icon: <ShoppingCartOutlined />, label: <SidebarLink to="/dashboard/vendas-analitico">Vendas</SidebarLink> },
          { key: 'alertas', icon: <AlertOutlined />, label: <SidebarLink to="/alertas">Alertas</SidebarLink> },
          { key: 'notificacoes', icon: <BellOutlined />, label: <SidebarLink to="/notificacoes">Notificações</SidebarLink> },
        ],
      })
    }

    {
      const erpChildren: NonNullable<React.ComponentProps<typeof Menu>['items']> = []
      if (hasPermission(session, 'producao:view') && hasTenantModule(tenant.enabledModules, 'producao')) {
        erpChildren.push({ key: 'producao', icon: <ExperimentOutlined />, label: <SidebarLink to="/producao">Produção</SidebarLink> })
      }
      if (hasPermission(session, 'producao:view') && !hasTenantModule(tenant.enabledModules, 'producao')) {
        erpChildren.push({ key: 'producao-locked', disabled: true, icon: <LockOutlined />, label: <LockedModuleLabel>Produção</LockedModuleLabel> })
      }
      if (hasPermission(session, 'fichatecnica:view') && hasTenantModule(tenant.enabledModules, 'ficha_tecnica')) {
        erpChildren.push({ key: 'ficha-tecnica', icon: <ProfileOutlined />, label: <SidebarLink to="/ficha-tecnica">Ficha Técnica</SidebarLink> })
      }
      if (hasPermission(session, 'fichatecnica:view') && !hasTenantModule(tenant.enabledModules, 'ficha_tecnica')) {
        erpChildren.push({ key: 'ficha-tecnica-locked', disabled: true, icon: <LockOutlined />, label: <LockedModuleLabel>Ficha Técnica</LockedModuleLabel> })
      }
      if (hasPermission(session, 'producao:view') && hasTenantModule(tenant.enabledModules, 'compras')) {
        erpChildren.push({ key: 'compras', icon: <ShoppingCartOutlined />, label: <SidebarLink to="/compras">Compras</SidebarLink> })
      }
      if (hasPermission(session, 'comercial:view') && hasTenantModule(tenant.enabledModules, 'comercial')) {
        erpChildren.push({ key: 'notas-fiscais', icon: <FileTextOutlined />, label: <SidebarLink to="/notas-fiscais">Notas Fiscais</SidebarLink> })
      }
      if (hasPermission(session, 'estoque:view') && hasTenantModule(tenant.enabledModules, 'estoque')) {
        erpChildren.push({ key: 'estoque', icon: <InboxOutlined />, label: <SidebarLink to="/estoque">Estoque</SidebarLink> })
      }
      if (erpChildren.length) {
        items.push({
          key: 'sub-erp',
          icon: <AppstoreOutlined />,
          label: 'ERP / Produção',
          children: erpChildren,
        })
      }
    }

    if (hasPermission(session, 'reports:view') && (hasTenantModule(tenant.enabledModules, 'financeiro') || hasTenantModule(tenant.enabledModules, 'relatorios'))) {
      items.push({
        key: 'sub-analytics',
        icon: <DollarOutlined />,
        label: 'Financeiro',
        children: [
          { key: 'financeiro', icon: <DollarOutlined />, label: <SidebarLink to="/financeiro">Visão Financeira</SidebarLink> },
          { key: 'relatorios', icon: <FileTextOutlined />, label: <SidebarLink to="/relatorios">Relatórios</SidebarLink> },
          { key: 'relatorios-galeria', icon: <FileTextOutlined />, label: <SidebarLink to="/relatorios/galeria">Galeria</SidebarLink> },
          { key: 'relatorios-agendados', icon: <ClockCircleOutlined />, label: <SidebarLink to="/relatorios/agendados">Relatórios agendados</SidebarLink> },
          { key: 'visoes-salvas', icon: <StarOutlined />, label: <SidebarLink to="/visoes-salvas">Visões salvas</SidebarLink> },
        ],
      })
    }

    const adminChildren: NonNullable<React.ComponentProps<typeof Menu>['items']> = []
    if (hasPermission(session, 'users:view') && hasTenantModule(tenant.enabledModules, 'usuarios')) {
      adminChildren.push({ key: 'configuracoes', icon: <SettingOutlined />, label: <SidebarLink to="/configuracoes">Configurações</SidebarLink> })
      adminChildren.push({ key: 'usuarios', icon: <TeamOutlined />, label: <SidebarLink to="/usuarios">Funcionários</SidebarLink> })
      adminChildren.push({ key: 'orgs', icon: <BranchesOutlined />, label: <SidebarLink to="/orgs">Organizações</SidebarLink> })
    }
    if (hasPermission(session, 'audit:view') && hasTenantModule(tenant.enabledModules, 'auditoria')) {
      adminChildren.push({ key: 'auditoria', icon: <FileSearchOutlined />, label: <SidebarLink to="/auditoria">Auditoria</SidebarLink> })
      adminChildren.push({ key: 'api-keys', icon: <KeyOutlined />, label: <SidebarLink to="/api-keys">API Keys</SidebarLink> })
    }
    if (session?.user.role === 'admin') {
      adminChildren.push({ key: 'billing-portal', icon: <DollarOutlined />, label: <SidebarLink to="/billing">Plano e cobrança</SidebarLink> })
      adminChildren.push({ key: 'billing-recommend', icon: <CompassOutlined />, label: <SidebarLink to="/planos/recomendar">Recomendar plano</SidebarLink> })
    }
    if (adminChildren.length) {
      if (session?.isSuperAdmin) {
        const adminUrl = (typeof window !== 'undefined' && window.location.hostname === 'localhost')
          ? 'http://localhost:3003'
          : 'https://admin.iga.com'
        adminChildren.push({
          key: 'super-admin-external',
          icon: <StarOutlined />,
          label: (
            <a href={adminUrl} target="_blank" rel="noopener noreferrer">
              Super Admin ↗
            </a>
          ),
        })
      }
      items.push({
        key: 'sub-admin',
        icon: <TeamOutlined />,
        label: 'Administração',
        children: adminChildren,
      })
    }

    items.push({
      key: 'sub-account',
      icon: <UserCircle2 size={16} />,
      label: 'Conta',
      children: [
        { key: 'perfil', icon: <UserCircle2 size={16} />, label: <SidebarLink to="/perfil">Meu perfil</SidebarLink> },
        { key: 'boas-vindas', icon: <CompassOutlined />, label: <SidebarLink to="/boas-vindas">Primeiros passos</SidebarLink> },
      ],
    })

    {
      const suporteChildren: NonNullable<React.ComponentProps<typeof Menu>['items']> = [
        {
          key: 'suporte-fale-conosco',
          icon: <PhoneOutlined />,
          label: <SidebarLink to="/suporte/fale-conosco">Fale conosco</SidebarLink>,
        },
        {
          key: 'ajuda',
          icon: <BookOutlined />,
          label: <SidebarLink to="/ajuda">Central de ajuda</SidebarLink>,
        },
        {
          key: 'novidades',
          icon: <StarOutlined />,
          label: <SidebarLink to="/novidades">Novidades</SidebarLink>,
        },
      ]
      if (hasPermission(session, 'support:view') && hasTenantModule(tenant.enabledModules, 'suporte')) {
        suporteChildren.push({
          key: 'suporte',
          icon: <CustomerServiceOutlined />,
          label: <SidebarLink to="/suporte">Área técnica</SidebarLink>,
        })
        suporteChildren.push({
          key: 'tokens',
          icon: <StarOutlined />,
          label: <SidebarLink to="/tokens">Design Tokens</SidebarLink>,
        })
      }
      if (hasPermission(session, 'datasources:view') && hasTenantModule(tenant.enabledModules, 'datasources')) {
        suporteChildren.push({
          key: 'fontes-de-dados',
          icon: <DatabaseOutlined />,
          label: <SidebarLink to="/fontes-de-dados">Fontes de dados</SidebarLink>,
        })
        suporteChildren.push({
          key: 'integracoes-saude',
          icon: <DatabaseOutlined />,
          label: <SidebarLink to="/integracoes/saude">Saúde das integrações</SidebarLink>,
        })
      }
      if (hasPermission(session, 'audit:view')) {
        suporteChildren.push({
          key: 'webhooks',
          icon: <ApiOutlined />,
          label: <SidebarLink to="/webhooks">Webhooks</SidebarLink>,
        })
      }
      if (hasPermission(session, 'operations:view') && hasTenantModule(tenant.enabledModules, 'operations')) {
        suporteChildren.push({
          key: 'admin-operacao',
          icon: <CloudServerOutlined />,
          label: <SidebarLink to="/admin/operacao">Operação</SidebarLink>,
        })
      }
      items.push({
        key: 'sub-suporte',
        icon: <CustomerServiceOutlined />,
        label: 'Suporte técnico',
        children: suporteChildren,
      })
    }

    return items
  }, [session, tenant.enabledModules])

  // navItems é definido para manter compat com o AppSidebar futuro mas
  // o sidebar atual (AppSidebar) tem nav propria com Lucide.
  void navItems

  const currentPageTitle = useMemo(
    () => getTitleByMenuKey(selectedKey),
    [selectedKey],
  )

  const getTabTitle = useMemo(
    () => (path: string) => getTitleByMenuKey(resolveMenuKeyFromPath(path)),
    [],
  )
  const { tabs, activePath, closeTab, closeOthers, closeAll } = useOpenTabs(getTabTitle)

  function navigateToSafeHome() {
    const preferred = uxPreferences.homePath
    if (preferred && navRouteMap.has(preferred)) {
      navigate(preferred)
      return
    }
    const workspaceHome = workspaceDefinition.defaultHomePath
    if (navRouteMap.has(workspaceHome)) {
      navigate(workspaceHome)
      return
    }
    navigate('/gestao')
  }

  async function stopImpersonation() {
    try {
      await http.post('/api/v1/super-admin/impersonation/stop')
      const me = await http.get<{
        user: AuthSession['user']
        permissions: AuthSession['permissions']
        impersonation?: AuthSession['impersonation']
      }>('/api/v1/auth/me')
      setStoredSession({
        user: me.data.user,
        permissions: me.data.permissions,
        impersonation: me.data.impersonation ?? null,
      })
      window.location.assign('/super-admin')
    } catch {
      signOut()
      navigate('/login', { replace: true })
    }
  }

  const { shortcutsOpen, closeShortcuts } = useKeyboardShortcuts({
    onOpenSearch: () => setCommandPaletteOpen(true),
    onOpenCopilot: () => setCopilotOpen(true),
    onCloseOverlays: () => {
      setMobileNavOpen(false)
      setCommandPaletteOpen(false)
      setCopilotOpen(false)
    },
  })

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null
      const isTypingTarget =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target?.isContentEditable

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setCommandPaletteOpen(true)
        return
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'b') {
        event.preventDefault()
        setCollapsed(!collapsed)
        return
      }
      if (isTypingTarget) return
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'h') {
        event.preventDefault()
        navigateToSafeHome()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [navigate])

  return (
    <Layout className="app-shell" hasSider style={{ minHeight: '100vh' }}>
      <a
        href="#main-content"
        style={{
          position: 'absolute',
          left: -9999,
          top: 8,
          zIndex: 9999,
          padding: '6px 10px',
          background: token.colorBgElevated,
          border: `1px solid ${token.colorBorder}`,
          borderRadius: 8,
        }}
        onFocus={(e) => {
          e.currentTarget.style.left = '12px'
        }}
        onBlur={(e) => {
          e.currentTarget.style.left = '-9999px'
        }}
      >
        Pular para o conteúdo
      </a>
      {!screens.xs ? (
        <AppSidebar collapsed={collapsed} onCollapseToggle={() => setCollapsed(!collapsed)} />
      ) : (
        <Drawer
          open={mobileNavOpen}
          onClose={() => setMobileNavOpen(false)}
          placement="left"
          width={300}
          styles={{ body: { padding: 0 } }}
          title="Menu"
        >
          <AppSidebar
            collapsed={false}
            onCollapseToggle={() => {}}
            isMobileDrawer
            onNavigate={() => setMobileNavOpen(false)}
          />
        </Drawer>
      )}

      <Layout>
        {session?.impersonation?.active ? (
          <div
            role="status"
            style={{
              position: 'sticky',
              top: 0,
              zIndex: 200,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 12,
              padding: '8px 16px',
              background: '#b42318',
              color: '#fff',
              fontWeight: 700,
            }}
          >
            <span>Impersonation ativa: tenant {session.impersonation.tenantId}</span>
            <Button size="small" danger ghost onClick={stopImpersonation}>
              Sair
            </Button>
          </div>
        ) : null}
        <OfflineBanner />
        <TrialBanner />
        <Header
          role="banner"
          aria-label="Cabeçalho da aplicação"
          style={{
            padding: '0 20px',
            background: token.colorBgContainer,
            borderBottom: `1px solid ${token.colorBorderSecondary}`,
            position: 'sticky',
            top: session?.impersonation?.active ? 40 : 0,
            zIndex: 100,
          }}
        >
          <div
            style={{
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              maxWidth: 1400,
              margin: '0 auto',
              width: '100%',
            }}
          >
            <Space align="center" size={10}>
              <Typography.Title level={5} style={{ margin: 0 }}>
                <span style={{ display: 'block', fontSize: 12, opacity: 0.7 }}>
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>{workspaceDefinition.label} /</Typography.Text>{' '}
                  <OrgSwitcher />
                </span>
                {currentPageTitle}
              </Typography.Title>
              {envBadge ? (
                <Tag color={envBadge.color} style={{ margin: 0 }}>
                  {envBadge.label}
                </Tag>
              ) : null}
            </Space>
            <Space>
              <Tooltip title="Busca rápida (Ctrl+K)">
                <Button
                  type="text"
                  aria-label="Abrir busca rápida"
                  icon={<Search size={18} />}
                  onClick={() => setCommandPaletteOpen(true)}
                />
              </Tooltip>
              <Button type="text" aria-label="Abrir copiloto" onClick={() => setCopilotOpen(true)}>
                IA
              </Button>
              <Button type="text" aria-label="Abrir tour guiado" onClick={() => setTourOpen(true)}>
                Tour
              </Button>
              <AlertsBell />
              {screens.xs ? (
                <Button
                  type="text"
                  aria-label="Abrir menu"
                  icon={<MenuOutlined />}
                  onClick={() => setMobileNavOpen(true)}
                />
              ) : null}
              <Tooltip title={mode === 'dark' ? 'Tema claro' : 'Tema escuro'}>
                <Button
                  type="text"
                  aria-label="Alternar tema"
                  icon={mode === 'dark' ? <SunMedium size={18} /> : <MoonStar size={18} />}
                  onClick={toggle}
                />
              </Tooltip>

              <Dropdown
                placement="bottomRight"
                menu={{
                  items: [
                    {
                      key: 'user',
                      disabled: true,
                      label: (
                        <div style={{ lineHeight: 1.2 }}>
                          <strong>{session?.user.name ?? 'Usuário'}</strong>
                          <br />
                          <span style={{ opacity: 0.7 }}>
                            {session?.user.email ?? ''}
                          </span>
                        </div>
                      ),
                    },
                    { type: 'divider' },
                    {
                      key: 'profile',
                      label: 'Meu perfil',
                      onClick: () => navigate('/perfil'),
                    },
                    {
                      key: 'notifications',
                      label: 'Notificações',
                      onClick: () => navigate('/notificacoes'),
                    },
                    {
                      key: 'organizations',
                      label: 'Organizações',
                      onClick: () => navigate('/orgs'),
                    },
                    { type: 'divider' },
                    {
                      key: 'billing',
                      label: 'Plano e cobrança',
                      onClick: () => navigate('/billing'),
                    },
                    {
                      key: 'plans',
                      label: 'Mudar de plano',
                      onClick: () => navigate('/planos'),
                    },
                    {
                      key: 'security',
                      label: 'Segurança da conta',
                      onClick: () => navigate('/seguranca'),
                    },
                    { type: 'divider' },
                    {
                      key: 'logout',
                      label: 'Sair',
                      onClick: () => {
                        signOut()
                        navigate('/login', { replace: true })
                      },
                    },
                  ],
                }}
              >
                <Button type="text" aria-label="Menu do usuário" icon={<UserCircle2 size={18} />} />
              </Dropdown>
            </Space>
          </div>
        </Header>
        <OpenTabsBar
          tabs={tabs}
          activePath={activePath}
          onClose={closeTab}
          onCloseOthers={closeOthers}
          onCloseAll={closeAll}
        />
        <CommandPalette open={commandPaletteOpen} onClose={() => setCommandPaletteOpen(false)} />
        <CopilotDrawer open={copilotOpen} onClose={() => setCopilotOpen(false)} />
        <PlanLimitModal />
        <GuidedTour open={tourOpen} onClose={() => setTourOpen(false)} />
        <Modal open={shortcutsOpen} onCancel={closeShortcuts} footer={null} title="Atalhos de teclado">
          <Space direction="vertical" style={{ width: '100%' }}>
            <Typography.Text><kbd>Ctrl/Cmd</kbd> + <kbd>K</kbd> abrir busca</Typography.Text>
            <Typography.Text><kbd>Ctrl/Cmd</kbd> + <kbd>B</kbd> recolher/expandir menu</Typography.Text>
            <Typography.Text><kbd>Ctrl/Cmd</kbd> + <kbd>/</kbd> abrir atalhos</Typography.Text>
            <Typography.Text><kbd>g</kbd> + <kbd>d</kbd> ir para dashboard</Typography.Text>
            <Typography.Text><kbd>g</kbd> + <kbd>v</kbd> ir para vendas</Typography.Text>
            <Typography.Text><kbd>g</kbd> + <kbd>f</kbd> ir para financeiro</Typography.Text>
            <Typography.Text><kbd>Esc</kbd> fechar modal/drawer</Typography.Text>
          </Space>
        </Modal>
        <Content
          id="main-content"
          role="main"
          style={{
            background: token.colorBgLayout,
            padding: 0,
          }}
        >
          <div className="app-content">
            <div className="app-container">
              {selectedKey !== 'dashboard' && selectedKey !== 'gestao' ? (
                <Breadcrumb
                  style={{ marginBottom: 12, fontSize: 13 }}
                  items={[
                    { title: <Link to="/gestao">Início</Link> },
                    ...(groupLabelByMenuKey[selectedKey]
                      ? [{ title: groupLabelByMenuKey[selectedKey] }]
                      : []),
                    { title: pageTitle },
                  ]}
                />
              ) : null}
              <Outlet />
            </div>
          </div>
          {screens.xs ? (
            <nav
              aria-label="Navegacao inferior"
              style={{
                position: 'fixed',
                left: 12,
                right: 12,
                bottom: 12,
                zIndex: 120,
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: 6,
                padding: 8,
                borderRadius: 16,
                background: token.colorBgElevated,
                border: `1px solid ${token.colorBorderSecondary}`,
                boxShadow: token.boxShadowSecondary,
              }}
            >
              <Button type="text" icon={<CompassOutlined />} onClick={() => navigate('/gestao')} aria-label="Gestao" />
              <Button type="text" icon={<DollarOutlined />} onClick={() => navigate('/financeiro')} aria-label="Financeiro" />
              <Button type="text" icon={<DatabaseOutlined />} onClick={() => navigate('/fontes-de-dados')} aria-label="Fontes" />
              <Button type="text" icon={<MenuOutlined />} onClick={() => setMobileNavOpen(true)} aria-label="Menu" />
            </nav>
          ) : null}
        </Content>

      </Layout>
      <ForcePasswordChangeModal />
      <TermsAcceptanceModal />
      <BetaWelcomeModal />
    </Layout>
  )
}
