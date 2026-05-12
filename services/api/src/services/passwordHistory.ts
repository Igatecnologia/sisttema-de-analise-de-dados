/**
 * Password history (SEC-2.8) — bloqueia reuso das ultimas N senhas.
 *
 * - Insert apos cada change/reset de senha
 * - Verify recusa se a senha bate com qualquer hash recente
 * - Cleanup periodico de entries > 1 ano (LGPD: minimizacao)
 */
import { getDb } from '../db/sqlite.js'
import { getPostgresPool, hasPostgresConfig } from '../db/postgres.js'
import { verifyUserPasswordAsync } from '../userStorage.js'

const HISTORY_SIZE = 5
const RETENTION_DAYS = 365
const db = getDb()

function usePostgresStorage(): boolean {
  return process.env.IGA_STORAGE_DRIVER === 'postgres' && hasPostgresConfig()
}

export async function recordPasswordHistory(userId: string, passwordHash: string): Promise<void> {
  const now = new Date().toISOString()
  if (usePostgresStorage()) {
    await getPostgresPool().query(
      'INSERT INTO user_password_history (user_id, password_hash, created_at) VALUES ($1, $2, $3)',
      [userId, passwordHash, now],
    )
    return
  }
  db.prepare(
    'INSERT INTO user_password_history (user_id, password_hash, created_at) VALUES (?, ?, ?)',
  ).run(userId, passwordHash, now)
}

async function getRecentHashes(userId: string): Promise<string[]> {
  if (usePostgresStorage()) {
    const result = await getPostgresPool().query<{ password_hash: string }>(
      'SELECT password_hash FROM user_password_history WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2',
      [userId, HISTORY_SIZE],
    )
    return result.rows.map((r) => r.password_hash)
  }
  const rows = db
    .prepare(
      'SELECT password_hash FROM user_password_history WHERE user_id = ? ORDER BY created_at DESC LIMIT ?',
    )
    .all(userId, HISTORY_SIZE) as Array<{ password_hash: string }>
  return rows.map((r) => r.password_hash)
}

/** Retorna true se a senha bate com qualquer das ultimas HISTORY_SIZE armazenadas. */
export async function isPasswordReused(userId: string, plaintextPassword: string): Promise<boolean> {
  const recent = await getRecentHashes(userId)
  for (const hash of recent) {
    if (await verifyUserPasswordAsync(plaintextPassword, hash)) return true
  }
  return false
}

/** Remove entries mais antigas que RETENTION_DAYS — chamar via job periodico. */
export async function cleanupOldPasswordHistory(): Promise<number> {
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString()
  if (usePostgresStorage()) {
    const result = await getPostgresPool().query(
      'DELETE FROM user_password_history WHERE created_at < $1',
      [cutoff],
    )
    return result.rowCount ?? 0
  }
  const result = db.prepare('DELETE FROM user_password_history WHERE created_at < ?').run(cutoff)
  return result.changes ?? 0
}

export const PASSWORD_HISTORY_CONFIG = { HISTORY_SIZE, RETENTION_DAYS }
