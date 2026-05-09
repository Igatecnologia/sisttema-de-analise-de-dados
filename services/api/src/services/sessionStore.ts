import { createHash } from 'node:crypto'
import { getDb } from '../db/sqlite.js'
import { getRedisClient, hasRedisConfig } from './redis.js'

export type SessionRecord = {
  userId: string
  tenantId: string
  expiresAt: number
  ipHash?: string | null
  uaHash?: string | null
  uaFamily?: string | null
}

export type SessionBinding = {
  ipHash: string
  uaHash: string
  uaFamily: string
}

const TOKEN_TTL_MS = 8 * 60 * 60 * 1000
const TOKEN_TTL_SECONDS = Math.floor(TOKEN_TTL_MS / 1000)
const db = getDb()

/**
 * Detecta familia do user-agent — coarse o suficiente para alertar mudanca
 * drastica (Chrome -> Safari) sem barrar updates de versao ou minor changes.
 */
export function detectUaFamily(userAgent: string): string {
  const ua = userAgent.toLowerCase()
  if (ua.includes('edg/')) return 'edge'
  if (ua.includes('chrome/')) return 'chrome'
  if (ua.includes('firefox/')) return 'firefox'
  if (ua.includes('safari/') && !ua.includes('chrome/')) return 'safari'
  if (ua.includes('opera/') || ua.includes('opr/')) return 'opera'
  if (ua.includes('curl/') || ua.includes('wget/')) return 'cli'
  if (ua.includes('postman')) return 'postman'
  return 'other'
}

export function buildSessionBinding(ip: string, userAgent: string): SessionBinding {
  return {
    ipHash: createHash('sha256').update(ip || '', 'utf8').digest('hex'),
    uaHash: createHash('sha256').update(userAgent || '', 'utf8').digest('hex'),
    uaFamily: detectUaFamily(userAgent),
  }
}

function tokenKey(token: string) {
  return `session:${token}`
}

function userSessionsKey(userId: string) {
  return `user_sessions:${userId}`
}

async function ensureRedisConnected() {
  const redis = getRedisClient()
  if (redis.status === 'wait') await redis.connect()
  return redis
}

export async function registerSession(
  token: string,
  userId: string,
  tenantId: string,
  binding?: SessionBinding,
) {
  if (!tenantId || !tenantId.trim()) {
    throw new Error('[sessionStore.registerSession] tenantId obrigatorio')
  }
  const now = Date.now()
  const expiresAt = now + TOKEN_TTL_MS

  if (hasRedisConfig()) {
    const redis = await ensureRedisConnected()
    const record: SessionRecord = {
      userId,
      tenantId,
      expiresAt,
      ipHash: binding?.ipHash ?? null,
      uaHash: binding?.uaHash ?? null,
      uaFamily: binding?.uaFamily ?? null,
    }
    await redis
      .multi()
      .set(tokenKey(token), JSON.stringify(record), 'EX', TOKEN_TTL_SECONDS)
      .sadd(userSessionsKey(userId), token)
      .expire(userSessionsKey(userId), TOKEN_TTL_SECONDS)
      .exec()
    return
  }

  db.prepare(`
    INSERT OR REPLACE INTO sessions (token, user_id, tenant_id, expires_at, created_at, ip_hash, ua_hash, ua_family)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    token,
    userId,
    tenantId,
    expiresAt,
    now,
    binding?.ipHash ?? null,
    binding?.uaHash ?? null,
    binding?.uaFamily ?? null,
  )
}

export async function readSession(token: string): Promise<SessionRecord | null> {
  if (hasRedisConfig()) {
    const redis = await ensureRedisConnected()
    const raw = await redis.get(tokenKey(token))
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<SessionRecord>
    if (!parsed.userId || !parsed.expiresAt) return null
    return {
      userId: parsed.userId,
      tenantId: parsed.tenantId ?? 'default',
      expiresAt: parsed.expiresAt,
      ipHash: parsed.ipHash ?? null,
      uaHash: parsed.uaHash ?? null,
      uaFamily: parsed.uaFamily ?? null,
    }
  }

  const row = db
    .prepare('SELECT user_id, tenant_id, expires_at, ip_hash, ua_hash, ua_family FROM sessions WHERE token = ?')
    .get(token) as
      | { user_id: string; tenant_id: string; expires_at: number; ip_hash: string | null; ua_hash: string | null; ua_family: string | null }
      | undefined
  if (!row) return null
  return {
    userId: row.user_id,
    tenantId: row.tenant_id ?? 'default',
    expiresAt: row.expires_at,
    ipHash: row.ip_hash,
    uaHash: row.ua_hash,
    uaFamily: row.ua_family,
  }
}

export async function revokeSession(token: string) {
  if (hasRedisConfig()) {
    const current = await readSession(token)
    const redis = await ensureRedisConnected()
    const tx = redis.multi().del(tokenKey(token))
    if (current) tx.srem(userSessionsKey(current.userId), token)
    await tx.exec()
    return
  }

  db.prepare('DELETE FROM sessions WHERE token = ?').run(token)
}

export async function revokeAllSessionsForUser(userId: string): Promise<number> {
  if (hasRedisConfig()) {
    const redis = await ensureRedisConnected()
    const key = userSessionsKey(userId)
    const tokens = await redis.smembers(key)
    const tx = redis.multi().del(key)
    for (const token of tokens) tx.del(tokenKey(token))
    await tx.exec()
    return tokens.length
  }

  const result = db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId)
  return result.changes
}

export async function cleanupExpiredSqliteSessions() {
  if (hasRedisConfig()) return
  db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(Date.now())
}
