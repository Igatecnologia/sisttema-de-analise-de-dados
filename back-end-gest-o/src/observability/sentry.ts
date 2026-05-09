import * as Sentry from '@sentry/node'

/**
 * Sentry init — chamado uma vez no bootstrap (server.ts), antes de createApp().
 *
 * Em produção:
 *  - tracesSampleRate 0.1 (10% das requests) — equilibra observability vs custo
 *  - profilesSampleRate 0 — profiling desligado por default (custa extra)
 *  - beforeSend filtra PII (emails, senhas, tokens) e payloads de proxy SGBR
 *
 * Em dev/test:
 *  - SENTRY_DSN normalmente não setado → init é no-op (Sentry.init aceita DSN vazia)
 *  - tracesSampleRate 1.0 quando setar SENTRY_DSN local pra testar
 */

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
  'set-cookie',
  'cpf',
  'cnpj',
  'card_number',
  'cardnumber',
  'cvv',
])

function redactObject(value: unknown, depth = 0): unknown {
  if (depth > 6 || value == null) return value
  if (Array.isArray(value)) return value.map((v) => redactObject(v, depth + 1))
  if (typeof value !== 'object') return value
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (SENSITIVE_KEYS.has(k.toLowerCase())) {
      out[k] = '[redacted]'
    } else {
      out[k] = redactObject(v, depth + 1)
    }
  }
  return out
}

let initialized = false

export function initSentry(): void {
  if (initialized) return
  const dsn = process.env.SENTRY_DSN?.trim()
  if (!dsn) return
  const isProduction = process.env.NODE_ENV === 'production'

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? 'development',
    release: process.env.RENDER_GIT_COMMIT?.slice(0, 7) ?? process.env.IGA_VERSION ?? 'unknown',
    tracesSampleRate: isProduction ? 0.1 : 1.0,
    profilesSampleRate: 0,
    /**
     * `sendDefaultPii: false` evita que Sentry capture IPs e cookies
     * automaticamente. PII é filtrada explicitamente em beforeSend abaixo.
     */
    sendDefaultPii: false,
    beforeSend(event) {
      /** Filtra dados sensíveis em request body, headers e tags. */
      if (event.request) {
        if (event.request.headers) {
          event.request.headers = redactObject(event.request.headers) as Record<string, string>
        }
        if (event.request.cookies) {
          event.request.cookies = '[redacted]' as unknown as Record<string, string>
        }
        if (event.request.data) {
          event.request.data = redactObject(event.request.data)
        }
        if (event.request.query_string && typeof event.request.query_string === 'string') {
          /** Não vazar query strings com tokens (?token=..., ?api_key=...). */
          const cleaned = event.request.query_string.replace(/(token|api_?key|secret|password)=[^&]+/gi, '$1=[redacted]')
          event.request.query_string = cleaned
        }
      }
      if (event.extra) {
        event.extra = redactObject(event.extra) as Record<string, unknown>
      }
      return event
    },
    ignoreErrors: [
      /** Erros esperados de auth — não são bug. */
      'Unauthorized',
      'Forbidden',
      'CSRF token mismatch',
      /** Erros de rede do client browser que não são acionáveis no servidor. */
      'NetworkError',
      'AbortError',
      'aborted',
    ],
  })
  initialized = true
}

export { Sentry }
