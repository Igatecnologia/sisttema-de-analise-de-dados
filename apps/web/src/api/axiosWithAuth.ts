import { setStoredSession } from '../auth/authStorage'
import { emitAuthSignOut } from '../auth/authEvents'
import { getHttpStatusMessage } from './httpError'
import { getCurrentTenantId } from '../tenant/tenantStorage'

export type HttpRequestConfig = {
  url?: string
  method?: string
  headers?: Record<string, string>
  params?: Record<string, string | number | boolean | null | undefined>
  responseType?: 'json' | 'blob' | 'text'
  signal?: AbortSignal
  _retried?: boolean
}

export type HttpResponse<T = unknown> = {
  data: T
  status: number
  headers: Record<string, string>
  config: HttpRequestConfig
}

export class HttpClientError<T = unknown> extends Error {
  code?: string
  response?: HttpResponse<T>
  config?: HttpRequestConfig
  contextMessage?: string

  constructor(message: string, options: { code?: string; response?: HttpResponse<T>; config?: HttpRequestConfig } = {}) {
    super(message)
    this.name = 'HttpClientError'
    this.code = options.code
    this.response = options.response
    this.config = options.config
  }
}

type RequestInterceptor = (config: HttpRequestConfig) => HttpRequestConfig | Promise<HttpRequestConfig>

function readCsrfToken(): string | null {
  const match = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]+)/)
  return match ? decodeURIComponent(match[1]) : null
}

const MUTATING_METHODS = new Set(['post', 'put', 'patch', 'delete'])

function toHeadersObject(headers: Headers): Record<string, string> {
  const out: Record<string, string> = {}
  headers.forEach((value, key) => {
    out[key] = value
  })
  return out
}

function buildUrl(baseURL: string, url: string, params?: HttpRequestConfig['params']): string {
  const absolute = /^https?:\/\//i.test(url)
  /**
   * baseURL pode ser vazio (same-origin via Vercel rewrite). Nesse caso new URL()
   * sem base lanca TypeError. Resolvemos contra window.location.origin no browser
   * para manter same-origin semantics.
   */
  const rawTarget = absolute
    ? url
    : `${baseURL.replace(/\/$/, '')}/${url.replace(/^\//, '')}`
  const fallbackOrigin =
    typeof window !== 'undefined' ? window.location.origin : 'http://localhost'
  const parsed = absolute
    ? new URL(rawTarget)
    : new URL(rawTarget.startsWith('/') ? rawTarget : `/${rawTarget}`, fallbackOrigin)
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value === null || value === undefined) continue
      parsed.searchParams.set(key, String(value))
    }
  }
  return parsed.toString()
}

async function parseResponseBody(response: Response, responseType: HttpRequestConfig['responseType']): Promise<unknown> {
  if (responseType === 'blob') return response.blob()
  if (responseType === 'text') return response.text()
  if (response.status === 204) return null
  const text = await response.text()
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

export function isHttpClientError(error: unknown): error is HttpClientError {
  return error instanceof HttpClientError
}

export function createAuthorizedHttpClient(baseURL: string, timeoutMs = 180_000) {
  const requestInterceptors = new Map<number, RequestInterceptor>()
  let interceptorId = 0
  let logoutEmitted = false
  let refreshInflight: Promise<boolean> | null = null

  async function tryRefresh(): Promise<boolean> {
    if (refreshInflight) return refreshInflight
    refreshInflight = (async () => {
      try {
        await request<{ token: string }>({
          url: '/api/v1/auth/refresh',
          method: 'post',
          _retried: true,
        })
        return true
      } catch {
        return false
      } finally {
        setTimeout(() => {
          refreshInflight = null
        }, 50)
      }
    })()
    return refreshInflight
  }

  async function request<T = unknown>(initialConfig: HttpRequestConfig & { data?: unknown }): Promise<HttpResponse<T>> {
    let config: HttpRequestConfig & { data?: unknown } = {
      method: 'get',
      ...initialConfig,
      headers: { ...(initialConfig.headers ?? {}) },
    }
    if (!config.url) throw new HttpClientError('URL ausente', { config })
    const requestUrl = config.url

    config.headers = config.headers ?? {}
    config.headers['X-Request-Id'] = crypto.randomUUID()

    const tenantId = getCurrentTenantId()
    if (tenantId) config.headers['X-Tenant-ID'] = tenantId

    const method = (config.method ?? 'get').toLowerCase()
    if (MUTATING_METHODS.has(method)) {
      const csrfToken = readCsrfToken()
      if (csrfToken) config.headers['X-XSRF-TOKEN'] = csrfToken
    }

    for (const interceptor of requestInterceptors.values()) {
      config = { ...config, ...(await interceptor(config)) }
    }

    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), timeoutMs)
    const externalSignal = config.signal
    const abortFromExternal = () => controller.abort()
    externalSignal?.addEventListener('abort', abortFromExternal, { once: true })

    try {
      const fetchHeaders: Record<string, string> = { ...(config.headers ?? {}) }
      const hasBody = config.data !== undefined
      const body = hasBody ? JSON.stringify(config.data) : undefined
      if (hasBody && !fetchHeaders['Content-Type'] && !fetchHeaders['content-type']) {
        fetchHeaders['Content-Type'] = 'application/json'
      }

      const response = await fetch(buildUrl(baseURL, requestUrl, config.params), {
        method: method.toUpperCase(),
        headers: fetchHeaders,
        body,
        credentials: 'include',
        signal: controller.signal,
      })
      const data = await parseResponseBody(response, config.responseType) as T
      const httpResponse: HttpResponse<T> = {
        data,
        status: response.status,
        headers: toHeadersObject(response.headers),
        config,
      }

      if (!response.ok) {
        throw new HttpClientError(`HTTP ${response.status}`, { response: httpResponse, config })
      }

      return httpResponse
    } catch (error) {
      if (error instanceof HttpClientError) {
        const status = error.response?.status
        const url = config.url ?? ''
        const isAuthFlow =
          url.includes('/api/proxy') ||
          url.includes('/auth/login') ||
          url.includes('/auth/refresh') ||
          url.includes('/auth/logout')

        if (status === 401 && !isAuthFlow && !config._retried) {
          const ok = await tryRefresh()
          if (ok) return request<T>({ ...initialConfig, _retried: true })
          if (!logoutEmitted) {
            logoutEmitted = true
            setStoredSession(null)
            emitAuthSignOut()
            setTimeout(() => {
              logoutEmitted = false
            }, 2000)
          }
        }

        error.contextMessage = getHttpStatusMessage(status)
        if (status === 402 && typeof window !== 'undefined') {
          const data = error.response?.data as Record<string, unknown> | undefined
          if (data?.reason === 'plan_limit_reached') {
            window.dispatchEvent(new CustomEvent('iga:plan-limit-reached', { detail: data }))
          }
        }
        throw error
      }

      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new HttpClientError('Tempo limite da requisicao esgotado.', { code: 'ETIMEDOUT', config })
      }
      throw new HttpClientError('Network Error', { code: 'ERR_NETWORK', config })
    } finally {
      window.clearTimeout(timeout)
      externalSignal?.removeEventListener('abort', abortFromExternal)
    }
  }

  return {
    defaults: {
      baseURL,
    },
    interceptors: {
      request: {
        use(interceptor: RequestInterceptor) {
          const id = ++interceptorId
          requestInterceptors.set(id, interceptor)
          return id
        },
        eject(id: number) {
          requestInterceptors.delete(id)
        },
      },
    },
    request,
    get<T = unknown>(url: string, config?: HttpRequestConfig) {
      return request<T>({ ...config, url, method: 'get' })
    },
    post<T = unknown>(url: string, data?: unknown, config?: HttpRequestConfig) {
      return request<T>({ ...config, url, method: 'post', data })
    },
    put<T = unknown>(url: string, data?: unknown, config?: HttpRequestConfig) {
      return request<T>({ ...config, url, method: 'put', data })
    },
    patch<T = unknown>(url: string, data?: unknown, config?: HttpRequestConfig) {
      return request<T>({ ...config, url, method: 'patch', data })
    },
    delete<T = unknown>(url: string, config?: HttpRequestConfig) {
      return request<T>({ ...config, url, method: 'delete' })
    },
  }
}

export type HttpClient = ReturnType<typeof createAuthorizedHttpClient>
