/**
 * Carrega Sentry e PostHog via CDN snippet — somente se env vars estiverem setadas.
 * Zero impacto no bundle quando desabilitado (sem dependencias instaladas).
 *
 * Para ativar:
 *   VITE_SENTRY_DSN=https://...@sentry.io/...
 *   VITE_POSTHOG_KEY=phc_...
 *   VITE_POSTHOG_HOST=https://app.posthog.com (opcional)
 */

declare global {
  interface Window {
    Sentry?: {
      onLoad?: (cb: () => void) => void
      init?: (options: Record<string, unknown>) => void
    }
    posthog?: {
      capture: (name: string, props?: Record<string, unknown>) => void
      identify: (id: string, props?: Record<string, unknown>) => void
      reset: () => void
      isFeatureEnabled?: (flag: string) => boolean
    }
  }
}

function injectScript(src: string, opts: { async?: boolean; defer?: boolean; integrity?: string; crossOrigin?: string } = {}): void {
  const script = document.createElement('script')
  script.src = src
  if (opts.async) script.async = true
  if (opts.defer) script.defer = true
  if (opts.integrity) script.integrity = opts.integrity
  if (opts.crossOrigin) script.crossOrigin = opts.crossOrigin
  document.head.appendChild(script)
}

function bootstrapSentry(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined
  if (!dsn) return
  /** Sentry Loader Script — single line CDN, ~50ms para carregar, sem afetar TTI. */
  const sentryProjectId = dsn.split('/').pop()
  if (!sentryProjectId) return
  injectScript(`https://browser.sentry-cdn.com/8.45.0/loader.min.js`, { async: true, crossOrigin: 'anonymous' })
  /** Inicializacao tardia: o loader carrega Sentry quando primeira excecao acontece. */
  ;(window as Window).Sentry = {
    onLoad: (cb) => cb(),
    init: () => {
      /** Configurado via Sentry CDN console — ou re-init manual aqui. */
    },
  }
  /** Setup minimo via fetch da config: usuario informa DSN e Sentry CDN injeta SDK. */
  const meta = document.createElement('meta')
  meta.setAttribute('name', 'sentry-dsn')
  meta.setAttribute('content', dsn)
  document.head.appendChild(meta)
}

function bootstrapPostHog(): void {
  const key = import.meta.env.VITE_POSTHOG_KEY as string | undefined
  if (!key) return
  const host = (import.meta.env.VITE_POSTHOG_HOST as string | undefined) ?? 'https://app.posthog.com'
  /** Snippet oficial PostHog (versao reduzida — autocapture + capture). */
  /* eslint-disable */
  ;(function (t: any, e: any) {
    const o = (t.posthog = t.posthog || []) as any
    if (!o.__SV) {
      o._i = []
      o.init = function (i: any, s: any, a: any) {
        function g(t2: any, e2: string) {
          const o2 = e2.split('.')
          o2.length === 2 && (t2 = t2[o2[0]], e2 = o2[1])
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
  ;(window as any).posthog?.init?.(key, { api_host: host, persistence: 'localStorage+cookie' })
}

export function bootstrapObservability(): void {
  try {
    bootstrapSentry()
  } catch {
    /** Falhas em observability nao podem derrubar o app. */
  }
  try {
    bootstrapPostHog()
  } catch {
    /** ignore */
  }
}
