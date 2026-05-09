/**
 * Origem do backend IGA (sem path `/api/...` — os serviços já usam `/api/v1/...`).
 * Se `VITE_API_BASE_URL` vier como `http://host:3000/api/v1`, o Axios montava URL duplicada e tudo retornava 404.
 */
function normalizeApiOrigin(raw: string): string {
  let s = raw.trim().replace(/\/+$/, '')
  if (/\/api(\/v\d+)?$/i.test(s)) {
    s = s.replace(/\/api(\/v\d+)?$/i, '')
  }
  return s
}

/**
 * URL base da API principal.
 * - Valor explícito (ex.: `http://host:3001`) → usa como base absoluta.
 * - String vazia definida explicitamente → same-origin (URLs relativas, para quando o
 *   Express serve `/` + `/api/*` no mesmo host, caso do instalador Windows).
 * - Indefinido → fallback dev para `http://localhost:3000`.
 */
function resolveApiBaseUrl(): string {
  const raw = import.meta.env.VITE_API_BASE_URL
  if (raw === undefined) return normalizeApiOrigin('http://localhost:3000')
  const trimmed = raw.toString().trim()
  if (trimmed === '') return ''
  return normalizeApiOrigin(trimmed)
}

export const API_BASE_URL = resolveApiBaseUrl()

/**
 * Timeout HTTP do Axios (proxy SGBR, teste de fonte, relatórios).
 * Padrão 180s — a API externa pode demorar em intervalos grandes; antes era 20s e estourava.
 */
function parseHttpTimeoutMs(): number {
  const raw = import.meta.env.VITE_HTTP_TIMEOUT_MS?.toString().trim()
  const n = raw ? Number(raw) : NaN
  if (!Number.isFinite(n) || n < 10_000) return 180_000
  return Math.min(n, 600_000)
}

export const HTTP_CLIENT_TIMEOUT_MS = parseHttpTimeoutMs()

/** Stale time para cache de dados analiticos (5 min) */
export const ANALITICO_STALE_MS = 1000 * 60 * 5

const stageRaw = import.meta.env.VITE_APP_STAGE?.toString().trim().toLowerCase() ?? ''

/** Badge no cabecalho para indicar ambiente */
export function getAppEnvBadge():
  | { label: string; color: 'blue' | 'orange' | 'processing' }
  | null {
  if (stageRaw === 'homolog' || stageRaw === 'staging' || stageRaw === 'hml') {
    return { label: 'HOMOLOG', color: 'orange' }
  }
  if (import.meta.env.DEV) {
    return { label: 'DEV', color: 'blue' }
  }
  if (stageRaw === 'development' || stageRaw === 'dev') {
    return { label: 'DEV', color: 'processing' }
  }
  return null
}
