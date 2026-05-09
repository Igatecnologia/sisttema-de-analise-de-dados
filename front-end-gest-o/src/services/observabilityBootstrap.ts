/**
 * Bootstrap de Sentry (errors) + PostHog (analytics).
 *
 * Sentry usa SDK npm direto (`@sentry/react`) — instalado no package.json e
 * tree-shaken pelo Vite. Anti-PII filtros idênticos ao backend.
 *
 * PostHog continua via snippet CDN (zero impacto no bundle).
 *
 * Para ativar em produção:
 *   VITE_SENTRY_DSN=https://...@sentry.io/...
 *   VITE_POSTHOG_KEY=phc_...
 *   VITE_POSTHOG_HOST=https://app.posthog.com (opcional)
 */
import * as Sentry from '@sentry/react'

declare global {
  interface Window {
    posthog?: {
      capture: (name: string, props?: Record<string, unknown>) => void
      identify: (id: string, props?: Record<string, unknown>) => void
      reset: () => void
      isFeatureEnabled?: (flag: string) => boolean
    }
  }
}

const SENSITIVE_KEYS = new Set([
  'password',
  'senha',
  'pwd',
  'secret',
  'token',
  'api_key',
  'apikey',
  'access_token',
  'refresh_token',
  'authorization',
  'cookie',
  'cpf',
  'cnpj',
  'card_number',
  'cardnumber',
  'cvv',
])

function redactValue(value: unknown, depth = 0): unknown {
  if (depth > 6 || value == null) return value
  if (Array.isArray(value)) return value.map((v) => redactValue(v, depth + 1))
  if (typeof value !== 'object') return value
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = SENSITIVE_KEYS.has(k.toLowerCase()) ? '[redacted]' : redactValue(v, depth + 1)
  }
  return out
}

function bootstrapSentry(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined
  if (!dsn) return
  const env = (import.meta.env.MODE ?? 'development') as string
  const isProduction = env === 'production'

  Sentry.init({
    dsn,
    environment: env,
    release: import.meta.env.VITE_RELEASE_VERSION as string | undefined,
    tracesSampleRate: isProduction ? 0.1 : 1.0,
    /** Replay desligado por default (custo + privacy). Usuário pode habilitar via env. */
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: isProduction ? 0.1 : 0,
    sendDefaultPii: false,
    integrations: [
      Sentry.browserTracingIntegration(),
    ],
    beforeSend(event) {
      if (event.request) {
        if (event.request.headers) {
          event.request.headers = redactValue(event.request.headers) as Record<string, string>
        }
        if (event.request.cookies) {
          event.request.cookies = '[redacted]' as unknown as Record<string, string>
        }
        if (event.request.data) {
          event.request.data = redactValue(event.request.data)
        }
        if (typeof event.request.query_string === 'string') {
          event.request.query_string = event.request.query_string.replace(
            /(token|api_?key|secret|password)=[^&]+/gi,
            '$1=[redacted]',
          )
        }
      }
      if (event.extra) event.extra = redactValue(event.extra) as Record<string, unknown>
      return event
    },
    ignoreErrors: [
      /** Erros esperados de auth — não bug. */
      'Unauthorized',
      'Forbidden',
      'CSRF token mismatch',
      /** Aborts de rede (cancelamento de request, navegação). */
      'NetworkError',
      'AbortError',
      'aborted',
      /** ResizeObserver loop limit — ruído conhecido do navegador. */
      'ResizeObserver loop limit exceeded',
      'ResizeObserver loop completed with undelivered notifications',
    ],
  })
}

function bootstrapPostHog(): void {
  const key = import.meta.env.VITE_POSTHOG_KEY as string | undefined
  if (!key) return
  const host = (import.meta.env.VITE_POSTHOG_HOST as string | undefined) ?? 'https://app.posthog.com'
  /** Snippet oficial PostHog reduzido. */
  /* eslint-disable */
  ;(function (t: any, e: any) {
    const o = (t.posthog = t.posthog || []) as any
    if (!o.__SV) {
      o._i = []
      o.init = function (i: any, s: any, a: any) {
        function g(t2: any, e2: string) {
          const o2 = e2.split('.')
          o2.length === 2 && ((t2 = t2[o2[0]]), (e2 = o2[1]))
          t2[e2] = function () {
            t2.push([e2].concat(Array.prototype.slice.call(arguments, 0)))
          }
        }
        let p = e.createElement('script')
        p.type = 'text/javascript'
        p.async = !0
        p.src = `${(a && a.api_host) || host}/static/array.js`
        const r = e.getElementsByTagName('script')[0]
        r.parentNode!.insertBefore(p, r)
        let u = t.posthog
        u.people = u.people || []
        u.toString = function (t3?: any) {
          let e3 = 'posthog'
          return t3 !== 'posthog' && (e3 += '.' + t3), e3
        }
        u.people.toString = function () {
          return u.toString(1) + '.people (stub)'
        }
        const c = 'capture identify alias people.set people.set_once set_config register register_once unregister opt_out_capturing has_opted_out_capturing opt_in_capturing reset isFeatureEnabled onFeatureFlags'.split(' ')
        for (let n = 0; n < c.length; n++) g(u, c[n])
        o._i.push([i, s, a])
      }
      o.__SV = 1
    }
  })(window, document)
  /* eslint-enable */
  ;(window as { posthog?: { init: (k: string, opts: Record<string, unknown>) => void } }).posthog?.init?.(key, {
    api_host: host,
    persistence: 'localStorage+cookie',
  })
}

export function bootstrapObservability(): void {
  try {
    bootstrapSentry()
  } catch {
    /** Falhas em observability não podem derrubar o app. */
  }
  try {
    bootstrapPostHog()
  } catch {
    /** ignore */
  }
}

export { Sentry }
