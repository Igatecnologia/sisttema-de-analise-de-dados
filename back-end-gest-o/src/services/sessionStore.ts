import { getDb } from '../db/sqlite.js'
import { getRedisClient, hasRedisConfig } from './redis.js'

export type SessionRecord = {
  userId: string
  tenantId: string
  expiresAt: number
}

const TOKEN_TTL_MS = 8 * 60 * 60 * 1000
const TOKEN_TTL_SECONDS = Math.floor(TOKEN_TTL_MS / 1000)
const db = getDb()

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

export async function registerSession(token: string, userId: string, tenantId: string) {
  if (!tenantId || !tenantId.trim()) {
    throw new Error('[sessionStore.registerSession] tenantId obrigatorio')
  }
  const now = Date.now()
  const expiresAt = now + TOKEN_TTL_MS

  if (hasRedisConfig()) {
    const redis = await ensureRedisConnected()
    await redis
      .multi()
      .set(tokenKey(token), JSON.stringify({ userId, tenantId, expiresAt } satisfies SessionRecord), 'EX', TOKEN_TTL_SECONDS)
      .sadd(userSessionsKey(userId), token)
      .expire(userSessionsKey(userId), TOKEN_TTL_SECONDS)
      .exec()
    return
  }

  db.prepare(`
    INSERT OR REPLACE INTO sessions (token, user_id, tenant_id, expires_at, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(token, userId, tenantId, expiresAt, now)
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
    }
  }

  const row = db
    .prepare('SELECT user_id, tenant_id, expires_at FROM sessions WHERE token = ?')
    .get(token) as { user_id: string; tenant_id: string; expires_at: number } | undefined
  if (!row) return null
  return { userId: row.user_id, tenantId: row.tenant_id ?? 'default', expiresAt: row.expires_at }
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
