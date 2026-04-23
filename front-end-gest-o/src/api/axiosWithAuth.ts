import axios, { type AxiosInstance } from 'axios'
import { setStoredSession } from '../auth/authStorage'
import { emitAuthSignOut } from '../auth/authEvents'
import { getHttpStatusMessage } from './httpError'
import { getCurrentTenantId } from '../tenant/tenantStorage'

/**
 * Lê o CSRF token do cookie `XSRF-TOKEN` (padrão Laravel/Express csurf).
 * Backend deve setar esse cookie em cada resposta.
 */
function readCsrfToken(): string | null {
  const match = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]+)/)
  return match ? decodeURIComponent(match[1]) : null
}

const MUTATING_METHODS = new Set(['post', 'put', 'patch', 'delete'])

export function createAuthorizedAxios(baseURL: string, timeoutMs = 180_000): AxiosInstance {
  const instance = axios.create({
    baseURL,
    timeout: timeoutMs,
    withCredentials: true,
  })

  instance.interceptors.request.use((config) => {
    config.headers = config.headers ?? {}

    // Correlação com logs do backend / gateway (observabilidade)
    config.headers['X-Request-Id'] = crypto.randomUUID()

    // Tenant isolation — backend MUST validate
    const tenantId = getCurrentTenantId()
    if (tenantId) {
      config.headers['X-Tenant-ID'] = tenantId
    }

    // CSRF token para requests que modificam dados
    const method = (config.method ?? 'get').toLowerCase()
    if (MUTATING_METHODS.has(method)) {
      const csrfToken = readCsrfToken()
      if (csrfToken) {
        config.headers['X-XSRF-TOKEN'] = csrfToken
      }
    }

    return config
  })

  /** Evita múltiplos logouts simultâneos */
  let logoutEmitted = false

  instance.interceptors.response.use(
    (res) => res,
    (err) => {
      const status = err?.response?.status
      const url = err?.config?.url ?? ''
      // Não fazer logout automático em chamadas de proxy/login — usam tokens externos
      const isProxyOrLogin = url.includes('/api/proxy') || url.includes('/auth/login')
      if (status === 401 && !isProxyOrLogin && !logoutEmitted) {
        logoutEmitted = true
        setStoredSession(null)
        emitAuthSignOut()
        // Reset após um breve delay para permitir novos logouts após re-login
        setTimeout(() => { logoutEmitted = false }, 2000)
      }
      if (err && typeof err === 'object') {
        ;(err as { contextMessage?: string }).contextMessage = getHttpStatusMessage(status)
      }
      return Promise.reject(err)
    },
  )

  return instance
}
