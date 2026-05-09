import axios, { type AxiosInstance, type InternalAxiosRequestConfig } from 'axios'
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

  /** Promessa única de refresh em curso — todas as 401s aguardam a mesma. */
  let refreshInflight: Promise<boolean> | null = null

  async function tryRefresh(): Promise<boolean> {
    if (refreshInflight) return refreshInflight
    refreshInflight = (async () => {
      try {
        await axios.post<{ token: string }>(
          `${baseURL}/api/v1/auth/refresh`,
          {},
          { withCredentials: true, timeout: 15_000 },
        )
        return true
      } catch {
        return false
      } finally {
        setTimeout(() => { refreshInflight = null }, 50)
      }
    })()
    return refreshInflight
  }

  instance.interceptors.response.use(
    (res) => res,
    async (err) => {
      const status = err?.response?.status
      const config = err?.config as (InternalAxiosRequestConfig & { _retried?: boolean }) | undefined
      const url = config?.url ?? ''
      const isAuthFlow =
        url.includes('/api/proxy') ||
        url.includes('/auth/login') ||
        url.includes('/auth/refresh') ||
        url.includes('/auth/logout')

      if (status === 401 && !isAuthFlow && config && !config._retried) {
        config._retried = true
        const ok = await tryRefresh()
        if (ok) {
          return instance.request(config)
        }
        if (!logoutEmitted) {
          logoutEmitted = true
          setStoredSession(null)
          emitAuthSignOut()
          setTimeout(() => { logoutEmitted = false }, 2000)
        }
      }
      if (err && typeof err === 'object') {
        ;(err as { contextMessage?: string }).contextMessage = getHttpStatusMessage(status)
      }
      if (status === 402 && typeof window !== 'undefined') {
        const data = err?.response?.data as Record<string, unknown> | undefined
        if (data?.reason === 'plan_limit_reached') {
          window.dispatchEvent(new CustomEvent('iga:plan-limit-reached', { detail: data }))
        }
      }
      return Promise.reject(err)
    },
  )

  return instance
}
