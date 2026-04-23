/** DEVE ser a primeira importação: configura dayjs globalmente antes de qualquer
 *  componente avaliar um import que use dayjs (ex.: DatePicker do AntD). */
import './i18n/dayjsSetup'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import 'antd/dist/reset.css'
import './index.css'

import App from './App'
import { TenantProvider } from './tenant/TenantProvider'
import { ThemeProvider } from './theme/ThemeProvider'
import { I18nProvider } from './i18n/I18nContext'
import { AuthProvider } from './auth/AuthProvider'
import { AppErrorBoundary } from './components/AppErrorBoundary'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from './query/queryClient'
import { publicAssetUrl } from './utils/publicAssetUrl'
import { setCurrentTenantId } from './tenant/tenantStorage'

/** Resolve tenantId cedo — antes de qualquer read de localStorage */
function resolveEarlyTenantId(): string {
  const envTenant = import.meta.env.VITE_TENANT_ID?.toString().trim()
  if (envTenant) return envTenant
  const host = window.location.hostname
  const parts = host.split('.')
  if (parts.length >= 3 && parts[0] !== 'www') return parts[0]
  return 'default'
}
setCurrentTenantId(resolveEarlyTenantId())

/** Fundo da tela de login (CSS não resolve import.meta.env.BASE_URL sozinho). */
document.documentElement.style.setProperty(
  '--login-bg-image',
  `url("${publicAssetUrl('logo.png.png')}")`,
)

function routerBasename() {
  const raw = import.meta.env.BASE_URL
  if (raw === '/') return undefined
  return raw.replace(/\/$/, '') || undefined
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <TenantProvider>
      <I18nProvider>
        <ThemeProvider>
          <AuthProvider>
            <QueryClientProvider client={queryClient}>
              <AppErrorBoundary>
                <BrowserRouter basename={routerBasename()}>
                  <App />
                </BrowserRouter>
              </AppErrorBoundary>
            </QueryClientProvider>
          </AuthProvider>
        </ThemeProvider>
      </I18nProvider>
    </TenantProvider>
  </StrictMode>,
)
