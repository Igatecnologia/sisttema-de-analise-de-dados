import { Spin } from 'antd'
import { Suspense, lazy, type ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { useAuth } from '../auth/AuthContext'
import { AppLayout } from '../layouts/AppLayout'
import { getAllowedRoutes, getUserUxPreferences } from '../navigation/uxPreferences'
import { RequireAuth } from './RequireAuth'
import { RequirePermission } from './RequirePermission'
import { PageTransition } from '../components/PageTransition'
import { PageErrorBoundary } from '../components/PageErrorBoundary'
import { useTenant } from '../tenant/TenantContext'

const GestaoExecutivaPage = lazy(() =>
  import('../pages/GestaoExecutivaPage').then((m) => ({ default: m.GestaoExecutivaPage })),
)
const DashboardPage = lazy(() =>
  import('../pages/DashboardPage').then((m) => ({ default: m.DashboardPage })),
)
const DashboardInsightsPage = lazy(() =>
  import('../pages/DashboardInsightsPage').then((m) => ({
    default: m.DashboardInsightsPage,
  })),
)
const VendasAnaliticoPage = lazy(() =>
  import('../pages/VendasAnaliticoPage').then((m) => ({ default: m.VendasAnaliticoPage })),
)
const ReportsPage = lazy(() =>
  import('../pages/ReportsPage').then((m) => ({ default: m.ReportsPage })),
)
const FinancePage = lazy(() =>
  import('../pages/FinancePage').then((m) => ({ default: m.FinancePage })),
)
const NotFoundPage = lazy(() =>
  import('../pages/NotFoundPage').then((m) => ({ default: m.NotFoundPage })),
)
const LoginPage = lazy(() =>
  import('../pages/LoginPage').then((m) => ({ default: m.LoginPage })),
)
const RegisterPage = lazy(() =>
  import('../pages/RegisterPage').then((m) => ({ default: m.RegisterPage })),
)
const ForgotPasswordPage = lazy(() =>
  import('../pages/ForgotPasswordPage').then((m) => ({ default: m.ForgotPasswordPage })),
)
const ResetPasswordPage = lazy(() =>
  import('../pages/ResetPasswordPage').then((m) => ({ default: m.ResetPasswordPage })),
)
const AcceptInvitePage = lazy(() =>
  import('../pages/AcceptInvitePage').then((m) => ({ default: m.AcceptInvitePage })),
)
const VerifyEmailPage = lazy(() =>
  import('../pages/VerifyEmailPage').then((m) => ({ default: m.VerifyEmailPage })),
)
const OnboardingPage = lazy(() =>
  import('../pages/OnboardingPage').then((m) => ({ default: m.OnboardingPage })),
)
const ImportingDataPage = lazy(() =>
  import('../pages/ImportingDataPage').then((m) => ({ default: m.ImportingDataPage })),
)
const UsersPage = lazy(() =>
  import('../pages/UsersPage').then((m) => ({ default: m.UsersPage })),
)
const SettingsPage = lazy(() =>
  import('../pages/SettingsPage').then((m) => ({ default: m.SettingsPage })),
)
const AuditPage = lazy(() =>
  import('../pages/AuditPage').then((m) => ({ default: m.AuditPage })),
)
const SecurityPage = lazy(() =>
  import('../pages/SecurityPage').then((m) => ({ default: m.SecurityPage })),
)
const BillingPlansPage = lazy(() =>
  import('../pages/BillingPlansPage').then((m) => ({ default: m.BillingPlansPage })),
)
const BillingPortalPage = lazy(() =>
  import('../pages/BillingPortalPage').then((m) => ({ default: m.BillingPortalPage })),
)
const LgpdPage = lazy(() =>
  import('../pages/LgpdPage').then((m) => ({ default: m.LgpdPage })),
)
const SuperAdminMovedPage = lazy(() =>
  import('../pages/SuperAdminMovedPage').then((m) => ({ default: m.SuperAdminMovedPage })),
)
const ConnectorsMarketplacePage = lazy(() =>
  import('../pages/ConnectorsMarketplacePage').then((m) => ({ default: m.ConnectorsMarketplacePage })),
)
const WebhooksPage = lazy(() =>
  import('../pages/WebhooksPage').then((m) => ({ default: m.WebhooksPage })),
)
const ScheduledReportsPage = lazy(() =>
  import('../pages/ScheduledReportsPage').then((m) => ({ default: m.ScheduledReportsPage })),
)
const PrivacyPolicyPage = lazy(() =>
  import('../pages/LegalPages').then((m) => ({ default: m.PrivacyPolicyPage })),
)
const TermsOfServicePage = lazy(() =>
  import('../pages/LegalPages').then((m) => ({ default: m.TermsOfServicePage })),
)
const CookiesPolicyPage = lazy(() =>
  import('../pages/LegalPages').then((m) => ({ default: m.CookiesPolicyPage })),
)
const AccessibilityPage = lazy(() =>
  import('../pages/LegalPages').then((m) => ({ default: m.AccessibilityPage })),
)
const SubProcessorsPage = lazy(() =>
  import('../pages/LegalPages').then((m) => ({ default: m.SubProcessorsPage })),
)
const ProducaoPage = lazy(() =>
  import('../pages/ProducaoPage').then((m) => ({ default: m.ProducaoPage })),
)
const FichaTecnicaPage = lazy(() =>
  import('../pages/FichaTecnicaPage').then((m) => ({ default: m.FichaTecnicaPage })),
)
const NotasFiscaisPage = lazy(() =>
  import('../pages/NotasFiscaisPage').then((m) => ({ default: m.NotasFiscaisPage })),
)
const EstoquePage = lazy(() =>
  import('../pages/EstoquePage').then((m) => ({ default: m.EstoquePage })),
)
const ClientesPage = lazy(() =>
  import('../pages/ClientesPage').then((m) => ({ default: m.ClientesPage })),
)
const ComprasPage = lazy(() =>
  import('../pages/ComprasPage').then((m) => ({ default: m.ComprasPage })),
)
const AlertasPage = lazy(() =>
  import('../pages/AlertasPage').then((m) => ({ default: m.AlertasPage })),
)
const DataSourceConfigPage = lazy(() =>
  import('../pages/DataSourceConfigPage').then((m) => ({ default: m.DataSourceConfigPage })),
)
const OpsStatusPage = lazy(() =>
  import('../pages/OpsStatusPage').then((m) => ({ default: m.OpsStatusPage })),
)
const SuporteTecnicoPage = lazy(() =>
  import('../pages/SuporteTecnicoPage').then((m) => ({ default: m.SuporteTecnicoPage })),
)
const FaleConoscoSuportePage = lazy(() =>
  import('../pages/FaleConoscoSuportePage').then((m) => ({ default: m.FaleConoscoSuportePage })),
)
const DesignTokensPage = lazy(() =>
  import('../pages/DesignTokensPage').then((m) => ({ default: m.DesignTokensPage })),
)
const ProfilePage = lazy(() =>
  import('../pages/ProfilePage').then((m) => ({ default: m.ProfilePage })),
)
const NotificationsPage = lazy(() =>
  import('../pages/NotificationsPage').then((m) => ({ default: m.NotificationsPage })),
)
const TenantSwitcherPage = lazy(() =>
  import('../pages/TenantSwitcherPage').then((m) => ({ default: m.TenantSwitcherPage })),
)
const APIKeysPage = lazy(() =>
  import('../pages/APIKeysPage').then((m) => ({ default: m.APIKeysPage })),
)
const SavedViewsPage = lazy(() =>
  import('../pages/SavedViewsPage').then((m) => ({ default: m.SavedViewsPage })),
)
const HelpCenterPage = lazy(() =>
  import('../pages/HelpCenterPage').then((m) => ({ default: m.HelpCenterPage })),
)
const ChangelogPage = lazy(() =>
  import('../pages/ChangelogPage').then((m) => ({ default: m.ChangelogPage })),
)
const IntegrationHealthPage = lazy(() =>
  import('../pages/IntegrationHealthPage').then((m) => ({ default: m.IntegrationHealthPage })),
)
const PlanComparisonWizardPage = lazy(() =>
  import('../pages/PlanComparisonWizardPage').then((m) => ({ default: m.PlanComparisonWizardPage })),
)
const ReportsGalleryPage = lazy(() =>
  import('../pages/ReportsGalleryPage').then((m) => ({ default: m.ReportsGalleryPage })),
)
const PublicShareLinkPage = lazy(() =>
  import('../pages/PublicShareLinkPage').then((m) => ({ default: m.PublicShareLinkPage })),
)
const AuditLogPerUserPage = lazy(() =>
  import('../pages/AuditLogPerUserPage').then((m) => ({ default: m.AuditLogPerUserPage })),
)
const WelcomeTourPage = lazy(() =>
  import('../pages/WelcomeTourPage').then((m) => ({ default: m.WelcomeTourPage })),
)

function HomeRedirect() {
  const { session } = useAuth()
  const allowedPaths = new Set(getAllowedRoutes(session).map((item) => item.path))
  const homePath = getUserUxPreferences(session).homePath
  const fallback = allowedPaths.has('/gestao')
    ? '/gestao'
    : [...allowedPaths][0] ?? '/login'
  const nextPath = homePath && allowedPaths.has(homePath) ? homePath : fallback
  return <Navigate to={nextPath} replace />
}

function moduleForPath(path: string): string {
  if (path.startsWith('/financeiro')) return 'financeiro'
  if (path.startsWith('/relatorios')) return 'relatorios'
  if (path.startsWith('/usuarios')) return 'usuarios'
  if (path.startsWith('/configuracoes')) return 'usuarios'
  if (path.startsWith('/auditoria')) return 'auditoria'
  if (path.startsWith('/producao')) return 'producao'
  if (path.startsWith('/ficha-tecnica')) return 'ficha_tecnica'
  if (path.startsWith('/notas-fiscais')) return 'comercial'
  if (path.startsWith('/compras')) return 'compras'
  if (path.startsWith('/estoque')) return 'estoque'
  if (path.startsWith('/alertas')) return 'alertas'
  if (path.startsWith('/notificacoes')) return 'alertas'
  if (path.startsWith('/fontes-de-dados')) return 'datasources'
  if (path.startsWith('/integracoes')) return 'datasources'
  if (path.startsWith('/admin/operacao')) return 'operations'
  if (path.startsWith('/api-keys')) return 'auditoria'
  if (path.startsWith('/visoes-salvas')) return 'relatorios'
  if (path.startsWith('/orgs')) return 'usuarios'
  if (path.startsWith('/ajuda') || path.startsWith('/novidades') || path.startsWith('/suporte') || path.startsWith('/tokens')) return 'suporte'
  return 'dashboard'
}

function RequireTenantModule({ path, children }: { path: string; children: ReactNode }) {
  const tenant = useTenant()
  if (!tenant.enabledModules.includes(moduleForPath(path))) return <Navigate to="/" replace />
  return children
}

export function AppRouter() {
  return (
    <AnimatePresence mode="wait">
      <PageTransition>
        <Suspense
          fallback={
            <div
              style={{
                minHeight: '100vh',
                display: 'grid',
                placeItems: 'center',
                background: 'transparent',
              }}
            >
              <Spin size="large" />
            </div>
          }
        >
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/accept-invite" element={<AcceptInvitePage />} />
            <Route path="/verify-email" element={<VerifyEmailPage />} />
            <Route path="/legal/privacidade" element={<PageErrorBoundary><PrivacyPolicyPage /></PageErrorBoundary>} />
            <Route path="/legal/termos" element={<PageErrorBoundary><TermsOfServicePage /></PageErrorBoundary>} />
            <Route path="/legal/cookies" element={<PageErrorBoundary><CookiesPolicyPage /></PageErrorBoundary>} />
            <Route path="/legal/acessibilidade" element={<PageErrorBoundary><AccessibilityPage /></PageErrorBoundary>} />
            <Route path="/legal/sub-processors" element={<PageErrorBoundary><SubProcessorsPage /></PageErrorBoundary>} />
            <Route path="/p/:token" element={<PageErrorBoundary><PublicShareLinkPage /></PageErrorBoundary>} />
            <Route path="/onboarding" element={<RequireAuth><OnboardingPage /></RequireAuth>} />
            <Route path="/importando-dados" element={<RequireAuth><ImportingDataPage /></RequireAuth>} />
            <Route
              element={
                <RequireAuth>
                  <AppLayout />
                </RequireAuth>
              }
            >
          <Route index element={<HomeRedirect />} />
          <Route
            path="/gestao"
            element={
              <RequirePermission permission="dashboard:view">
                <RequireTenantModule path="/gestao"><PageErrorBoundary><GestaoExecutivaPage /></PageErrorBoundary></RequireTenantModule>
              </RequirePermission>
            }
          />
          <Route
            path="/dashboard"
            element={
              <RequirePermission permission="dashboard:view">
                <RequireTenantModule path="/dashboard"><PageErrorBoundary><DashboardPage /></PageErrorBoundary></RequireTenantModule>
              </RequirePermission>
            }
          />
          <Route
            path="/dashboard/analises"
            element={
              <RequirePermission permission="dashboard:view">
                <RequireTenantModule path="/dashboard/analises"><PageErrorBoundary><DashboardInsightsPage /></PageErrorBoundary></RequireTenantModule>
              </RequirePermission>
            }
          />
          <Route
            path="/dashboard/dados"
            element={<Navigate to="/dashboard/vendas-analitico" replace />}
          />
          <Route
            path="/dashboard/vendas-analitico"
            element={
              <RequirePermission permission="dashboard:view">
                <RequireTenantModule path="/dashboard/vendas-analitico"><PageErrorBoundary><VendasAnaliticoPage /></PageErrorBoundary></RequireTenantModule>
              </RequirePermission>
            }
          />
          <Route
            path="/financeiro"
            element={
              <RequirePermission permission="reports:view">
                <RequireTenantModule path="/financeiro"><PageErrorBoundary><FinancePage /></PageErrorBoundary></RequireTenantModule>
              </RequirePermission>
            }
          />
          <Route
            path="/relatorios"
            element={
              <RequirePermission permission="reports:view">
                <RequireTenantModule path="/relatorios"><PageErrorBoundary><ReportsPage /></PageErrorBoundary></RequireTenantModule>
              </RequirePermission>
            }
          />
          <Route
            path="/relatorios/agendados"
            element={
              <RequirePermission permission="reports:view">
                <PageErrorBoundary><ScheduledReportsPage /></PageErrorBoundary>
              </RequirePermission>
            }
          />
          <Route
            path="/relatorios/galeria"
            element={
              <RequirePermission permission="reports:view">
                <PageErrorBoundary><ReportsGalleryPage /></PageErrorBoundary>
              </RequirePermission>
            }
          />
          <Route
            path="/visoes-salvas"
            element={
              <RequirePermission permission="reports:view">
                <PageErrorBoundary><SavedViewsPage /></PageErrorBoundary>
              </RequirePermission>
            }
          />
          <Route path="/boas-vindas" element={<PageErrorBoundary><WelcomeTourPage /></PageErrorBoundary>} />
          <Route path="/perfil" element={<PageErrorBoundary><ProfilePage /></PageErrorBoundary>} />
          <Route path="/notificacoes" element={<PageErrorBoundary><NotificationsPage /></PageErrorBoundary>} />
          <Route path="/orgs" element={<PageErrorBoundary><TenantSwitcherPage /></PageErrorBoundary>} />
          <Route
            path="/api-keys"
            element={
              <RequirePermission permission="audit:view">
                <PageErrorBoundary><APIKeysPage /></PageErrorBoundary>
              </RequirePermission>
            }
          />
          <Route
            path="/usuarios"
            element={
              <RequirePermission permission="users:view">
                <RequireTenantModule path="/usuarios"><PageErrorBoundary><UsersPage /></PageErrorBoundary></RequireTenantModule>
              </RequirePermission>
            }
          />
          <Route
            path="/usuarios/:id/historico"
            element={
              <RequirePermission permission="audit:view">
                <PageErrorBoundary><AuditLogPerUserPage /></PageErrorBoundary>
              </RequirePermission>
            }
          />
          <Route
            path="/configuracoes"
            element={
              <RequirePermission permission="users:view">
                <RequireTenantModule path="/configuracoes"><PageErrorBoundary><SettingsPage /></PageErrorBoundary></RequireTenantModule>
              </RequirePermission>
            }
          />
          <Route
            path="/auditoria"
            element={
              <RequirePermission permission="audit:view">
                <RequireTenantModule path="/auditoria"><PageErrorBoundary><AuditPage /></PageErrorBoundary></RequireTenantModule>
              </RequirePermission>
            }
          />
          <Route
            path="/seguranca"
            element={<PageErrorBoundary><SecurityPage /></PageErrorBoundary>}
          />
          <Route
            path="/seguranca/lgpd"
            element={<PageErrorBoundary><LgpdPage /></PageErrorBoundary>}
          />
          <Route
            path="/planos"
            element={<PageErrorBoundary><BillingPlansPage /></PageErrorBoundary>}
          />
          <Route
            path="/planos/recomendar"
            element={<PageErrorBoundary><PlanComparisonWizardPage /></PageErrorBoundary>}
          />
          <Route
            path="/billing"
            element={<PageErrorBoundary><BillingPortalPage /></PageErrorBoundary>}
          />
          <Route
            path="/connectors"
            element={<PageErrorBoundary><ConnectorsMarketplacePage /></PageErrorBoundary>}
          />
          <Route
            path="/integracoes/saude"
            element={
              <RequirePermission permission="datasources:view">
                <PageErrorBoundary><IntegrationHealthPage /></PageErrorBoundary>
              </RequirePermission>
            }
          />
          <Route
            path="/webhooks"
            element={
              <RequirePermission permission="audit:view">
                <PageErrorBoundary><WebhooksPage /></PageErrorBoundary>
              </RequirePermission>
            }
          />
          <Route
            path="/super-admin"
            element={<PageErrorBoundary><SuperAdminMovedPage /></PageErrorBoundary>}
          />
          <Route
            path="/producao"
            element={
              <RequirePermission permission="producao:view">
                <RequireTenantModule path="/producao"><PageErrorBoundary><ProducaoPage /></PageErrorBoundary></RequireTenantModule>
              </RequirePermission>
            }
          />
          <Route
            path="/ficha-tecnica"
            element={
              <RequirePermission permission="fichatecnica:view">
                <RequireTenantModule path="/ficha-tecnica"><PageErrorBoundary><FichaTecnicaPage /></PageErrorBoundary></RequireTenantModule>
              </RequirePermission>
            }
          />
          <Route
            path="/notas-fiscais"
            element={
              <RequirePermission permission="comercial:view">
                <RequireTenantModule path="/notas-fiscais"><PageErrorBoundary><NotasFiscaisPage /></PageErrorBoundary></RequireTenantModule>
              </RequirePermission>
            }
          />
          <Route
            path="/compras"
            element={
              <RequirePermission permission="producao:view">
                <RequireTenantModule path="/compras"><PageErrorBoundary><ComprasPage /></PageErrorBoundary></RequireTenantModule>
              </RequirePermission>
            }
          />
          <Route
            path="/estoque"
            element={
              <RequirePermission permission="estoque:view">
                <RequireTenantModule path="/estoque"><PageErrorBoundary><EstoquePage /></PageErrorBoundary></RequireTenantModule>
              </RequirePermission>
            }
          />
          <Route
            path="/clientes"
            element={
              <RequirePermission permission="comercial:view">
                <PageErrorBoundary><ClientesPage /></PageErrorBoundary>
              </RequirePermission>
            }
          />
          <Route path="/operacional" element={<Navigate to="/gestao" replace />} />
          <Route
            path="/alertas"
            element={
              <RequirePermission permission="alertas:view">
                <RequireTenantModule path="/alertas"><PageErrorBoundary><AlertasPage /></PageErrorBoundary></RequireTenantModule>
              </RequirePermission>
            }
          />
          <Route path="/suporte/fale-conosco" element={<FaleConoscoSuportePage />} />
          <Route path="/ajuda" element={<PageErrorBoundary><HelpCenterPage /></PageErrorBoundary>} />
          <Route path="/novidades" element={<PageErrorBoundary><ChangelogPage /></PageErrorBoundary>} />
          <Route
            path="/tokens"
            element={
              <RequirePermission permission="support:view">
                <RequireTenantModule path="/tokens"><PageErrorBoundary><DesignTokensPage /></PageErrorBoundary></RequireTenantModule>
              </RequirePermission>
            }
          />
          <Route
            path="/suporte"
            element={
              <RequirePermission permission="support:view">
                <RequireTenantModule path="/suporte"><PageErrorBoundary><SuporteTecnicoPage /></PageErrorBoundary></RequireTenantModule>
              </RequirePermission>
            }
          />
          <Route
            path="/fontes-de-dados"
            element={
              <RequirePermission permission="datasources:view">
                <RequireTenantModule path="/fontes-de-dados"><PageErrorBoundary><DataSourceConfigPage /></PageErrorBoundary></RequireTenantModule>
              </RequirePermission>
            }
          />
          <Route
            path="/admin/operacao"
            element={
              <RequirePermission permission="operations:view">
                <RequireTenantModule path="/admin/operacao"><PageErrorBoundary><OpsStatusPage /></PageErrorBoundary></RequireTenantModule>
              </RequirePermission>
            }
          />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </Suspense>
      </PageTransition>
    </AnimatePresence>
  )
}
