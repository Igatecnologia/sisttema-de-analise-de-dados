import { Spin } from 'antd'
import { Suspense, lazy } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { useAuth } from '../auth/AuthContext'
import { AppLayout } from '../layouts/AppLayout'
import { getAllowedRoutes, getUserUxPreferences } from '../navigation/uxPreferences'
import { RequireAuth } from './RequireAuth'
import { RequirePermission } from './RequirePermission'
import { PageTransition } from '../components/PageTransition'
import { PageErrorBoundary } from '../components/PageErrorBoundary'

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
const UsersPage = lazy(() =>
  import('../pages/UsersPage').then((m) => ({ default: m.UsersPage })),
)
const AuditPage = lazy(() =>
  import('../pages/AuditPage').then((m) => ({ default: m.AuditPage })),
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
                <PageErrorBoundary><GestaoExecutivaPage /></PageErrorBoundary>
              </RequirePermission>
            }
          />
          <Route
            path="/dashboard"
            element={
              <RequirePermission permission="dashboard:view">
                <PageErrorBoundary><DashboardPage /></PageErrorBoundary>
              </RequirePermission>
            }
          />
          <Route
            path="/dashboard/analises"
            element={
              <RequirePermission permission="dashboard:view">
                <PageErrorBoundary><DashboardInsightsPage /></PageErrorBoundary>
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
                <PageErrorBoundary><VendasAnaliticoPage /></PageErrorBoundary>
              </RequirePermission>
            }
          />
          <Route
            path="/financeiro"
            element={
              <RequirePermission permission="reports:view">
                <PageErrorBoundary><FinancePage /></PageErrorBoundary>
              </RequirePermission>
            }
          />
          <Route
            path="/relatorios"
            element={
              <RequirePermission permission="reports:view">
                <PageErrorBoundary><ReportsPage /></PageErrorBoundary>
              </RequirePermission>
            }
          />
          <Route
            path="/usuarios"
            element={
              <RequirePermission permission="users:view">
                <PageErrorBoundary><UsersPage /></PageErrorBoundary>
              </RequirePermission>
            }
          />
          <Route
            path="/auditoria"
            element={
              <RequirePermission permission="audit:view">
                <PageErrorBoundary><AuditPage /></PageErrorBoundary>
              </RequirePermission>
            }
          />
          <Route
            path="/producao"
            element={
              <RequirePermission permission="producao:view">
                <PageErrorBoundary><ProducaoPage /></PageErrorBoundary>
              </RequirePermission>
            }
          />
          <Route
            path="/ficha-tecnica"
            element={
              <RequirePermission permission="fichatecnica:view">
                <PageErrorBoundary><FichaTecnicaPage /></PageErrorBoundary>
              </RequirePermission>
            }
          />
          <Route
            path="/notas-fiscais"
            element={
              <RequirePermission permission="comercial:view">
                <PageErrorBoundary><NotasFiscaisPage /></PageErrorBoundary>
              </RequirePermission>
            }
          />
          <Route
            path="/compras"
            element={
              <RequirePermission permission="producao:view">
                <PageErrorBoundary><ComprasPage /></PageErrorBoundary>
              </RequirePermission>
            }
          />
          <Route
            path="/estoque"
            element={
              <RequirePermission permission="estoque:view">
                <PageErrorBoundary><EstoquePage /></PageErrorBoundary>
              </RequirePermission>
            }
          />
          <Route path="/operacional" element={<Navigate to="/gestao" replace />} />
          <Route
            path="/alertas"
            element={
              <RequirePermission permission="alertas:view">
                <PageErrorBoundary><AlertasPage /></PageErrorBoundary>
              </RequirePermission>
            }
          />
          <Route path="/suporte/fale-conosco" element={<FaleConoscoSuportePage />} />
          <Route
            path="/tokens"
            element={
              <RequirePermission permission="support:view">
                <PageErrorBoundary><DesignTokensPage /></PageErrorBoundary>
              </RequirePermission>
            }
          />
          <Route
            path="/suporte"
            element={
              <RequirePermission permission="support:view">
                <PageErrorBoundary><SuporteTecnicoPage /></PageErrorBoundary>
              </RequirePermission>
            }
          />
          <Route
            path="/fontes-de-dados"
            element={
              <RequirePermission permission="datasources:view">
                <PageErrorBoundary><DataSourceConfigPage /></PageErrorBoundary>
              </RequirePermission>
            }
          />
          <Route
            path="/admin/operacao"
            element={
              <RequirePermission permission="operations:view">
                <PageErrorBoundary><OpsStatusPage /></PageErrorBoundary>
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
