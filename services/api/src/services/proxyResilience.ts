/**
 * Resilience layer pro proxy ERP — retry exponencial com jitter + circuit breaker por chave.
 *
 * Padrao de uso:
 *   const cb = getCircuitBreaker(`erp:${dsId}`)
 *   const res = await cb.exec(() => retryableFetch(url, init))
 *
 * Filosofia:
 *   - Retry SO em falhas transientes (5xx, network reset, timeout). 4xx e
 *     resposta valida do upstream — nao adianta tentar de novo.
 *   - Circuit breaker fecha o canal quando um upstream esta morrendo para
 *     parar de gastar tempo/CPU em chamadas que vao falhar e dar resposta
 *     rapida pro frontend (fail-fast).
 *   - Armazenamento em memoria — single-process. Multi-instance pode usar
 *     o Redis (proximo passo).
 *
 * Observabilidade: cada falha emite metricas via `recordResilienceEvent`
 * que sao expostas em `/api/v1/admin/proxy-health`.
 */
import { fetch as uFetch } from 'undici'

type UFetchInit = Parameters<typeof uFetch>[1]
type UFetchResponse = Awaited<ReturnType<typeof uFetch>>

const TRANSIENT_NETWORK_CODES = new Set([
  'ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'EPIPE', 'ENOTFOUND',
  'EAI_AGAIN', 'EHOSTUNREACH', 'ENETUNREACH', 'ENETDOWN',
])

export type RetryOptions = {
  /** Tentativas (inclui a primeira). Default 3. */
  attempts?: number
  /** Delay base em ms. Crescimento expo: base * 2^(attempt-1). Default 250. */
  baseDelayMs?: number
  /** Delay maximo permitido entre tentativas. Default 4000. */
  maxDelayMs?: number
  /** Considera status como transiente. Default: 502, 503, 504, 408, 429. */
  transientStatuses?: number[]
  /** Identificador pra observabilidade. */
  label?: string
}

const DEFAULT_TRANSIENT_STATUSES = [408, 429, 502, 503, 504]

function isTransientError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const e = err as { code?: string; cause?: { code?: string }; name?: string }
  if (e.code && TRANSIENT_NETWORK_CODES.has(e.code)) return true
  if (e.cause?.code && TRANSIENT_NETWORK_CODES.has(e.cause.code)) return true
  if (e.name === 'AbortError') return true
  return false
}

function jitter(ms: number): number {
  // Full jitter — distribui aleatoriamente em [0, ms] pra evitar thundering herd.
  return Math.floor(Math.random() * ms)
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Wrapper sobre undici.fetch que tenta de novo em erros transientes.
 * NAO chama `assertSafeExternalUrl` — o caller (proxy.ts) deve usar a
 * versao safeUFetch original que valida a URL antes.
 */
export async function retryableFetch(
  url: string,
  init: UFetchInit,
  fetcher: typeof uFetch,
  opts: RetryOptions = {},
): Promise<UFetchResponse> {
  const attempts = Math.max(1, opts.attempts ?? 3)
  const baseDelay = opts.baseDelayMs ?? 250
  const maxDelay = opts.maxDelayMs ?? 4000
  const transientStatuses = new Set(opts.transientStatuses ?? DEFAULT_TRANSIENT_STATUSES)
  const label = opts.label ?? 'fetch'

  let lastErr: unknown
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const res = await fetcher(url, init)
      if (res.ok || !transientStatuses.has(res.status)) {
        if (attempt > 1) recordResilienceEvent({ kind: 'retry-success', label, attempt, status: res.status })
        return res
      }
      // Status transiente — tenta de novo
      lastErr = new Error(`Upstream HTTP ${res.status}`)
      recordResilienceEvent({ kind: 'retry-attempt', label, attempt, status: res.status })
      if (attempt === attempts) {
        // Esgotou — devolve a ultima resposta pra preservar headers/body
        return res
      }
    } catch (err) {
      lastErr = err
      if (!isTransientError(err) || attempt === attempts) {
        recordResilienceEvent({ kind: 'retry-failed', label, attempt, error: errMsg(err) })
        throw err
      }
      recordResilienceEvent({ kind: 'retry-attempt', label, attempt, error: errMsg(err) })
    }

    const delay = Math.min(maxDelay, baseDelay * 2 ** (attempt - 1)) + jitter(baseDelay)
    await sleep(delay)
  }

  // Nao deveria chegar aqui — defensive.
  throw lastErr ?? new Error(`retryableFetch exhausted (${label})`)
}

// ─── Circuit Breaker ───────────────────────────────────────────────────────

type CircuitState = 'closed' | 'open' | 'half-open'

type Circuit = {
  state: CircuitState
  failures: number
  openedAt: number
  /** Hora em que pode tentar novamente quando estiver `open`. */
  retryAt: number
  totalCalls: number
  totalFailures: number
  totalShortCircuited: number
  lastError?: string
}

export type CircuitOptions = {
  /** Falhas consecutivas pra abrir o circuito. Default 5. */
  failureThreshold?: number
  /** Quanto tempo o circuito fica aberto antes de testar (ms). Default 60_000. */
  cooldownMs?: number
}

const circuits = new Map<string, Circuit>()
const circuitOpts = new Map<string, Required<CircuitOptions>>()

function ensureCircuit(key: string, opts?: CircuitOptions): Circuit {
  let c = circuits.get(key)
  if (!c) {
    c = {
      state: 'closed',
      failures: 0,
      openedAt: 0,
      retryAt: 0,
      totalCalls: 0,
      totalFailures: 0,
      totalShortCircuited: 0,
    }
    circuits.set(key, c)
  }
  if (opts || !circuitOpts.has(key)) {
    circuitOpts.set(key, {
      failureThreshold: opts?.failureThreshold ?? 5,
      cooldownMs: opts?.cooldownMs ?? 60_000,
    })
  }
  return c
}

export class CircuitOpenError extends Error {
  constructor(public readonly key: string, public readonly retryAt: number) {
    super(`Circuit '${key}' is OPEN until ${new Date(retryAt).toISOString()}`)
    this.name = 'CircuitOpenError'
  }
}

/**
 * Executa `fn` sob protecao do circuit breaker `key`. Lanca `CircuitOpenError`
 * imediatamente se o circuito esta aberto (sem chamar `fn`).
 */
export async function withCircuit<T>(
  key: string,
  fn: () => Promise<T>,
  opts?: CircuitOptions,
): Promise<T> {
  const c = ensureCircuit(key, opts)
  const cfg = circuitOpts.get(key)!
  const now = Date.now()

  if (c.state === 'open') {
    if (now < c.retryAt) {
      c.totalShortCircuited++
      recordResilienceEvent({ kind: 'circuit-short', label: key })
      throw new CircuitOpenError(key, c.retryAt)
    }
    // Cooldown expirou — entra em half-open pra testar
    c.state = 'half-open'
    recordResilienceEvent({ kind: 'circuit-half-open', label: key })
  }

  c.totalCalls++
  try {
    const result = await fn()
    // Sucesso — fecha de volta
    if (c.state !== 'closed') {
      recordResilienceEvent({ kind: 'circuit-close', label: key })
    }
    c.state = 'closed'
    c.failures = 0
    return result
  } catch (err) {
    c.totalFailures++
    c.lastError = errMsg(err)

    if (c.state === 'half-open') {
      // Probe falhou — re-abre
      c.state = 'open'
      c.openedAt = now
      c.retryAt = now + cfg.cooldownMs
      recordResilienceEvent({ kind: 'circuit-reopen', label: key })
      throw err
    }

    c.failures++
    if (c.failures >= cfg.failureThreshold) {
      c.state = 'open'
      c.openedAt = now
      c.retryAt = now + cfg.cooldownMs
      recordResilienceEvent({ kind: 'circuit-open', label: key, failures: c.failures })
    }
    throw err
  }
}

export function getCircuitStats(): Record<string, Omit<Circuit, 'lastError'> & { lastError?: string; retryAtIso?: string; openedAtIso?: string }> {
  const out: Record<string, ReturnType<typeof getCircuitStats>[string]> = {}
  for (const [key, c] of circuits) {
    out[key] = {
      ...c,
      retryAtIso: c.retryAt ? new Date(c.retryAt).toISOString() : undefined,
      openedAtIso: c.openedAt ? new Date(c.openedAt).toISOString() : undefined,
    }
  }
  return out
}

/** Reseta um circuit (uso operacional — destravar manualmente). */
export function resetCircuit(key: string): boolean {
  const c = circuits.get(key)
  if (!c) return false
  c.state = 'closed'
  c.failures = 0
  c.openedAt = 0
  c.retryAt = 0
  recordResilienceEvent({ kind: 'circuit-reset', label: key })
  return true
}

// ─── Observabilidade ───────────────────────────────────────────────────────

type ResilienceEvent =
  | { kind: 'retry-attempt'; label: string; attempt: number; status?: number; error?: string }
  | { kind: 'retry-success'; label: string; attempt: number; status: number }
  | { kind: 'retry-failed'; label: string; attempt: number; error: string }
  | { kind: 'circuit-open'; label: string; failures: number }
  | { kind: 'circuit-reopen'; label: string }
  | { kind: 'circuit-close'; label: string }
  | { kind: 'circuit-half-open'; label: string }
  | { kind: 'circuit-short'; label: string }
  | { kind: 'circuit-reset'; label: string }

type EventCounters = Record<ResilienceEvent['kind'], number>

const counters: EventCounters = {
  'retry-attempt': 0, 'retry-success': 0, 'retry-failed': 0,
  'circuit-open': 0, 'circuit-reopen': 0, 'circuit-close': 0,
  'circuit-half-open': 0, 'circuit-short': 0, 'circuit-reset': 0,
}

const recent: ResilienceEvent[] = []
const MAX_RECENT = 200

function recordResilienceEvent(ev: ResilienceEvent) {
  counters[ev.kind] = (counters[ev.kind] ?? 0) + 1
  recent.push(ev)
  if (recent.length > MAX_RECENT) recent.shift()
}

export function getResilienceMetrics() {
  return {
    counters: { ...counters },
    recent: recent.slice(-50),
    circuits: getCircuitStats(),
  }
}

function errMsg(err: unknown): string {
  if (err instanceof Error) return err.message
  return String(err)
}
