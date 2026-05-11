/**
 * Account lockout adaptativo (SEC-2.4).
 *
 * Politica:
 *   - 5 falhas em 10 min na MESMA conta -> trava por 30 min
 *   - 3 lockouts em 24h -> exige reset de senha por email (HTTP 423 forever)
 *   - Login bem-sucedido limpa o contador de falhas (mas nao o de lockouts)
 *
 * Storage:
 *   - Redis quando disponivel (compartilhado entre app servers, sobrevive a reload)
 *   - Map em memoria como fallback (single-process dev)
 *
 * Chave por (tenantId, email-lowercase) — proteger por conta, nao por IP, evita
 * bypass via botnet (que e o gap do rate limiter atual em /auth/login).
 */
import { getRedisClient, hasRedisConfig } from './redis.js'

const FAIL_WINDOW_SEC = 10 * 60
const LOCK_DURATION_SEC = 30 * 60
const LOCKOUT_TRACK_SEC = 24 * 60 * 60
const MAX_FAILURES = 5
const MAX_LOCKOUTS_24H = 3

type LockState = {
  locked: boolean
  lockedUntil: number | null
  lockoutCount24h: number
  failuresInWindow: number
  /** True quando bateu no limite de 24h — so reset por email destrava. */
  requireReset: boolean
}

type Entry = { value: number; expiresAt: number }
const memStore = new Map<string, Entry>()

function memGet(key: string): number {
  const entry = memStore.get(key)
  if (!entry) return 0
  if (Date.now() > entry.expiresAt) {
    memStore.delete(key)
    return 0
  }
  return entry.value
}

function memSet(key: string, value: number, ttlSec: number) {
  memStore.set(key, { value, expiresAt: Date.now() + ttlSec * 1000 })
}

function memIncr(key: string, ttlSec: number): number {
  const current = memGet(key)
  const next = current + 1
  memSet(key, next, ttlSec)
  return next
}

function memDel(key: string) {
  memStore.delete(key)
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

function failKey(tenantId: string, email: string): string {
  return `auth:fail:${tenantId}:${normalizeEmail(email)}`
}

function lockKey(tenantId: string, email: string): string {
  return `auth:lock:${tenantId}:${normalizeEmail(email)}`
}

function lockoutCountKey(tenantId: string, email: string): string {
  return `auth:lockcount:${tenantId}:${normalizeEmail(email)}`
}

async function redisGetNumber(key: string): Promise<number> {
  const client = getRedisClient()
  if (client.status === 'wait') await client.connect()
  const raw = await client.get(key)
  if (!raw) return 0
  const n = Number(raw)
  return Number.isFinite(n) ? n : 0
}

async function redisIncr(key: string, ttlSec: number): Promise<number> {
  const client = getRedisClient()
  if (client.status === 'wait') await client.connect()
  const next = await client.incr(key)
  if (next === 1) await client.expire(key, ttlSec)
  return next
}

async function redisGetTtl(key: string): Promise<number> {
  const client = getRedisClient()
  if (client.status === 'wait') await client.connect()
  return client.ttl(key)
}

async function redisDel(key: string) {
  const client = getRedisClient()
  if (client.status === 'wait') await client.connect()
  await client.del(key)
}

/** Chamado ANTES de verificar a senha. Se retornar `locked`, bloqueie o login. */
export async function getLockState(tenantId: string, email: string): Promise<LockState> {
  const lk = lockKey(tenantId, email)
  const fk = failKey(tenantId, email)
  const lck = lockoutCountKey(tenantId, email)

  if (hasRedisConfig()) {
    try {
      const lockTtl = await redisGetTtl(lk)
      const failures = await redisGetNumber(fk)
      const lockoutCount = await redisGetNumber(lck)
      const locked = lockTtl > 0
      const requireReset = lockoutCount >= MAX_LOCKOUTS_24H
      return {
        locked: locked || requireReset,
        lockedUntil: locked ? Date.now() + lockTtl * 1000 : null,
        lockoutCount24h: lockoutCount,
        failuresInWindow: failures,
        requireReset,
      }
    } catch {
      /** Redis indisponivel: fail-open de leitura, mas memStore continua valendo. */
    }
  }
  const memLockUntil = memGet(lk)
  const memFails = memGet(fk)
  const memLockouts = memGet(lck)
  const locked = memLockUntil > Date.now()
  const requireReset = memLockouts >= MAX_LOCKOUTS_24H
  return {
    locked: locked || requireReset,
    lockedUntil: locked ? memLockUntil : null,
    lockoutCount24h: memLockouts,
    failuresInWindow: memFails,
    requireReset,
  }
}

/**
 * Registra UMA falha de login. Se atingir o limite, marca o lock.
 * Retorna o estado pos-incremento para o caller decidir a resposta HTTP.
 */
export async function recordLoginFailure(tenantId: string, email: string): Promise<LockState> {
  const lk = lockKey(tenantId, email)
  const fk = failKey(tenantId, email)
  const lck = lockoutCountKey(tenantId, email)

  if (hasRedisConfig()) {
    try {
      const failures = await redisIncr(fk, FAIL_WINDOW_SEC)
      let lockoutCount = await redisGetNumber(lck)
      if (failures >= MAX_FAILURES) {
        const client = getRedisClient()
        if (client.status === 'wait') await client.connect()
        await client.set(lk, '1', 'EX', LOCK_DURATION_SEC)
        lockoutCount = await redisIncr(lck, LOCKOUT_TRACK_SEC)
        await client.del(fk)
      }
      const lockTtl = await redisGetTtl(lk)
      const requireReset = lockoutCount >= MAX_LOCKOUTS_24H
      return {
        locked: lockTtl > 0 || requireReset,
        lockedUntil: lockTtl > 0 ? Date.now() + lockTtl * 1000 : null,
        lockoutCount24h: lockoutCount,
        failuresInWindow: failures < MAX_FAILURES ? failures : 0,
        requireReset,
      }
    } catch {
      /** fall through para memStore */
    }
  }

  const failures = memIncr(fk, FAIL_WINDOW_SEC)
  let lockouts = memGet(lck)
  let lockedUntil = memGet(lk)
  if (failures >= MAX_FAILURES) {
    lockedUntil = Date.now() + LOCK_DURATION_SEC * 1000
    memSet(lk, lockedUntil, LOCK_DURATION_SEC)
    lockouts = memIncr(lck, LOCKOUT_TRACK_SEC)
    memDel(fk)
  }
  const requireReset = lockouts >= MAX_LOCKOUTS_24H
  return {
    locked: lockedUntil > Date.now() || requireReset,
    lockedUntil: lockedUntil > Date.now() ? lockedUntil : null,
    lockoutCount24h: lockouts,
    failuresInWindow: failures < MAX_FAILURES ? failures : 0,
    requireReset,
  }
}

/**
 * Limpa o contador de falhas apos login bem-sucedido.
 *
 * Tambem zera o contador 24h de lockouts: a politica original mantinha esse contador
 * "estavel" pra punir abuso repetido, mas isso permitia que um usuario legitimo
 * ficasse permanentemente preso depois de 3 lockouts no dia, mesmo apos provar
 * identidade. Login OK eh prova de identidade — devolve o usuario ao estado limpo.
 */
export async function clearLoginFailures(tenantId: string, email: string): Promise<void> {
  const fk = failKey(tenantId, email)
  const lk = lockKey(tenantId, email)
  const lck = lockoutCountKey(tenantId, email)
  if (hasRedisConfig()) {
    try {
      await redisDel(fk)
      await redisDel(lk)
      await redisDel(lck)
      return
    } catch { /* fallback */ }
  }
  memDel(fk)
  memDel(lk)
  memDel(lck)
}

/** Constantes exportadas para testes/mensagens. */
export const LOCKOUT_CONFIG = {
  MAX_FAILURES,
  FAIL_WINDOW_SEC,
  LOCK_DURATION_SEC,
  LOCKOUT_TRACK_SEC,
  MAX_LOCKOUTS_24H,
}
