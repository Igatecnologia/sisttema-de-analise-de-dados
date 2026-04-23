import {
  AlertOutlined,
  AppstoreOutlined,
  BarChartOutlined,
  CloudServerOutlined,
  CompassOutlined,
  CustomerServiceOutlined,
  DatabaseOutlined,
  DollarOutlined,
  DotChartOutlined,
  ExperimentOutlined,
  FileSearchOutlined,
  FileTextOutlined,
  HomeOutlined,
  InboxOutlined,
  StarOutlined,
  MenuOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  ProfileOutlined,
  ShoppingCartOutlined,
  TeamOutlined,
  PhoneOutlined,
} from '@ant-design/icons'
import { MoonStar, SunMedium, Search, UserCircle2 } from 'lucide-react'
import {
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
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { ForcePasswordChangeModal } from '../auth/ForcePasswordChangeModal'
import { hasPermission } from '../auth/permissions'
import { useAppTheme } from '../theme/ThemeContext'
import { useTenant } from '../tenant/TenantContext'
import { getAppEnvBadge } from '../api/apiEnv'
import {
  getAllowedRoutes,
  getWorkspaceDefinition,
  getUserUxPreferences,
} from '../navigation/uxPreferences'
import { Logo } from '../assets/logo'
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts'
import { AlertsBell } from '../components/AlertsBell'
import { CommandPalette } from '../components/CommandPalette'
import { CopilotDrawer } from '../components/CopilotDrawer'
import { OpenTabsBar } from '../components/OpenTabsBar'
import { useOpenTabs } from '../hooks/useOpenTabs'
/**
 * Picker de fonte de vendas foi removido — o sistema lê automaticamente TODAS as
 * fontes compatíveis em paralelo. Ver `services/vendasAnaliticoSourceSelection.ts`.
 */

const { Header, Sider, Content } = Layout

const pageTitlesByMenuKey: Record<string, string> = {
  gestao: 'Visão do gestor',
  dashboard: 'Dashboard',
  relatorios: 'Relatórios',
  financeiro: 'Financeiro',
  usuarios: 'Funcionários',
  auditoria: 'Auditoria',
  'dashboard-analises': 'Análises BI',
  'dashboard-vendas-analitico': 'Vendas',
  producao: 'Produção',
  'ficha-tecnica': 'Ficha Técnica',
  'notas-fiscais': 'Notas Fiscais',
  compras: 'Compras',
  estoque: 'Estoque',
  alertas: 'Alertas',
  'fontes-de-dados': 'Fontes de dados',
  'admin-operacao': 'Operação',
  suporte: 'Área técnica',
  'suporte-fale-conosco': 'Fale conosco',
  tokens: 'Design Tokens',
}

function getTitleByMenuKey(menuKey: string) {
  return pageTitlesByMenuKey[menuKey] ?? 'Dashboard'
}

function resolveMenuKeyFromPath(pathname: string): string {
  if (pathname.startsWith('/gestao')) return 'gestao'
  if (pathname.startsWith('/dashboard/analises')) return 'dashboard-analises'
  if (pathname.startsWith('/dashboard/vendas-analitico')) return 'dashboard-vendas-analitico'
  if (pathname.startsWith('/financeiro')) return 'financeiro'
  if (pathname.startsWith('/relatorios')) return 'relatorios'
  if (pathname.startsWith('/usuarios')) return 'usuarios'
  if (pathname.startsWith('/auditoria')) return 'auditoria'
  if (pathname.startsWith('/producao')) return 'producao'
  if (pathname.startsWith('/ficha-tecnica')) return 'ficha-tecnica'
  if (pathname.startsWith('/compras')) return 'compras'
  if (pathname.startsWith('/notas-fiscais')) return 'notas-fiscais'
  if (pathname.startsWith('/estoque')) return 'estoque'
  if (pathname.startsWith('/alertas')) return 'alertas'
  if (pathname.startsWith('/suporte/fale-conosco')) return 'suporte-fale-conosco'
  if (pathname.startsWith('/tokens')) return 'tokens'
  if (pathname.startsWith('/fontes-de-dados')) return 'fontes-de-dados'
  if (pathname.startsWith('/admin/operacao')) return 'admin-operacao'
  if (pathname.startsWith('/suporte')) return 'suporte'
  return 'dashboard'
}

function useSelectedMenuKey(pathname: string) {
  return useMemo(() => resolveMenuKeyFromPath(pathname), [pathname])
}

/** Detecta qual grupo do sidebar deve estar aberto baseado na rota */
function useOpenSubMenuKeys(selectedKey: string) {
  return useMemo(() => {
    if (selectedKey === 'gestao' || selectedKey.startsWith('dashboard') || selectedKey === 'alertas') return ['sub-dashboard']
    if (selectedKey === 'producao' || selectedKey === 'ficha-tecnica' || selectedKey === 'compras' || selectedKey === 'notas-fiscais' || selectedKey === 'estoque') return ['sub-erp']
    if (selectedKey === 'financeiro' || selectedKey === 'relatorios') return ['sub-analytics']
    if (['usuarios', 'auditoria'].includes(selectedKey)) return ['sub-admin']
    if (
      ['suporte', 'suporte-fale-conosco', 'tokens', 'fontes-de-dados', 'admin-operacao'].includes(selectedKey)
    ) {
      return ['sub-suporte']
    }
    return ['sub-dashboard']
  }, [selectedKey])
}

/** Menu lateral: prefetch desabilitado — causava spike de queryFn e download de
 *  chunks em hover, competindo com a página ativa. Chunks são carregados on-demand. */
function SidebarLink({ to, children }: { to: string; children: React.ReactNode }) {
  return <Link to={to}>{children}</Link>
}

export function AppLayout() {
  const location = useLocation()
  const selectedKey = useSelectedMenuKey(location.pathname)
  const defaultOpenKeys = useOpenSubMenuKeys(selectedKey)
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
  const { mode, toggle } = useAppTheme()
  const { session, signOut } = useAuth()
  const { token } = theme.useToken()
  const screens = Grid.useBreakpoint()
  const navigate = useNavigate()
  const tenant = useTenant()
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

    if (hasPermission(session, 'dashboard:view')) {
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
        ],
      })
    }

    {
      const erpChildren: NonNullable<React.ComponentProps<typeof Menu>['items']> = []
      if (hasPermission(session, 'producao:view')) {
        erpChildren.push({ key: 'producao', icon: <ExperimentOutlined />, label: <SidebarLink to="/producao">Produção</SidebarLink> })
      }
      if (hasPermission(session, 'fichatecnica:view')) {
        erpChildren.push({ key: 'ficha-tecnica', icon: <ProfileOutlined />, label: <SidebarLink to="/ficha-tecnica">Ficha Técnica</SidebarLink> })
      }
      if (hasPermission(session, 'producao:view')) {
        erpChildren.push({ key: 'compras', icon: <ShoppingCartOutlined />, label: <SidebarLink to="/compras">Compras</SidebarLink> })
      }
      if (hasPermission(session, 'comercial:view')) {
        erpChildren.push({ key: 'notas-fiscais', icon: <FileTextOutlined />, label: <SidebarLink to="/notas-fiscais">Notas Fiscais</SidebarLink> })
      }
      if (hasPermission(session, 'estoque:view')) {
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

    if (hasPermission(session, 'reports:view')) {
      items.push({
        key: 'sub-analytics',
        icon: <DollarOutlined />,
        label: 'Financeiro',
        children: [
          { key: 'financeiro', icon: <DollarOutlined />, label: <SidebarLink to="/financeiro">Visão Financeira</SidebarLink> },
          { key: 'relatorios', icon: <FileTextOutlined />, label: <SidebarLink to="/relatorios">Relatórios</SidebarLink> },
        ],
      })
    }

    const adminChildren: NonNullable<React.ComponentProps<typeof Menu>['items']> = []
    if (hasPermission(session, 'users:view')) {
      adminChildren.push({ key: 'usuarios', icon: <TeamOutlined />, label: <SidebarLink to="/usuarios">Funcionários</SidebarLink> })
    }
    if (hasPermission(session, 'audit:view')) {
      adminChildren.push({ key: 'auditoria', icon: <FileSearchOutlined />, label: <SidebarLink to="/auditoria">Auditoria</SidebarLink> })
    }
    if (adminChildren.length) {
      items.push({
        key: 'sub-admin',
        icon: <TeamOutlined />,
        label: 'Administração',
        children: adminChildren,
      })
    }

    {
      const suporteChildren: NonNullable<React.ComponentProps<typeof Menu>['items']> = [
        {
          key: 'suporte-fale-conosco',
          icon: <PhoneOutlined />,
          label: <SidebarLink to="/suporte/fale-conosco">Fale conosco</SidebarLink>,
        },
      ]
      if (hasPermission(session, 'support:view')) {
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
      if (hasPermission(session, 'datasources:view')) {
        suporteChildren.push({
          key: 'fontes-de-dados',
          icon: <DatabaseOutlined />,
          label: <SidebarLink to="/fontes-de-dados">Fontes de dados</SidebarLink>,
        })
      }
      if (hasPermission(session, 'operations:view')) {
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
  }, [session])

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
    <Layout className="app-shell" style={{ minHeight: '100vh' }}>
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
        <Sider
          className="app-sider-premium"
          breakpoint="lg"
          width={240}
          collapsedWidth={64}
          collapsed={collapsed}
          onCollapse={setCollapsed}
          trigger={null}
          style={{
            position: 'sticky',
            top: 0,
            height: '100vh',
          }}
        >
          <div className="app-sider-premium__sheen" aria-hidden />
          <div className="app-sider-premium__edge" aria-hidden />
          <div className="app-sider-brand app-sider-brand--premium">
            <Space size={10} align="center" style={{ minWidth: 0, overflow: 'hidden', justifyContent: collapsed ? 'center' : 'flex-start', width: '100%' }}>
              {tenant.logoUrl ? (
                <img
                  src={tenant.logoUrl}
                  alt={tenant.companyName}
                  className="app-sider-logo"
                />
              ) : <Logo size="md" animated variant={mode === 'dark' ? 'inverse' : 'color'} />}
              {!collapsed && (
                <div style={{ lineHeight: 1.1, minWidth: 0 }}>
                  <span className="app-sider-brand-name" style={{ color: token.colorText }}>
                    {tenant.companyName}
                  </span>
                  <br />
                  <Typography.Text
                    style={{
                      color:
                        mode === 'dark'
                          ? 'var(--qc-text-muted)'
                          : token.colorTextSecondary,
                      fontSize: 12,
                    }}
                  >
                    {tenant.subtitle}
                  </Typography.Text>
                </div>
              )}
            </Space>
          </div>

          <div className="app-sider-nav">
            <Menu
              className="app-sider-menu"
              classNames={{ popup: 'app-sider-menu-popup' }}
              theme={mode === 'dark' ? 'dark' : 'light'}
              mode="inline"
              selectedKeys={[selectedKey]}
              defaultOpenKeys={collapsed ? [] : defaultOpenKeys}
              items={navItems}
              style={{ background: 'transparent', borderInlineEnd: 0 }}
            />
          </div>

          {/* Toggle de colapso — rodapé do sidebar */}
          <div className="app-sider-toggle">
            <Tooltip title={collapsed ? 'Expandir menu (Ctrl+B)' : 'Recolher menu (Ctrl+B)'} placement="right">
              <button
                className="app-sider-toggle__btn"
                aria-label={collapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'}
                onClick={() => setCollapsed(!collapsed)}
              >
                {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
                {!collapsed && <span className="app-sider-toggle__label">Recolher</span>}
              </button>
            </Tooltip>
          </div>
        </Sider>
      ) : (
        <Drawer
          open={mobileNavOpen}
          onClose={() => setMobileNavOpen(false)}
          placement="left"
          width={300}
          styles={{ body: { padding: 0 } }}
          title="Menu"
        >
          <div className="app-sider-nav app-sider-nav--drawer">
            <Menu
              className="app-sider-menu"
              classNames={{ popup: 'app-sider-menu-popup' }}
              theme={mode === 'dark' ? 'dark' : 'light'}
              mode="inline"
              selectedKeys={[selectedKey]}
              defaultOpenKeys={defaultOpenKeys}
              items={navItems}
              onClick={() => setMobileNavOpen(false)}
              style={{ borderInlineEnd: 0 }}
            />
          </div>
        </Drawer>
      )}

      <Layout>
        <Header
          style={{
            padding: '0 20px',
            background: token.colorBgContainer,
            borderBottom: `1px solid ${token.colorBorderSecondary}`,
            position: 'sticky',
            top: 0,
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
                <Typography.Text type="secondary" style={{ display: 'block', fontSize: 12 }}>
                  {workspaceDefinition.label} / {tenant.companyName}
                </Typography.Text>
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
              <Outlet />
            </div>
          </div>
        </Content>

      </Layout>
      <ForcePasswordChangeModal />
    </Layout>
  )
}
