/**
 * Refresh token rotation com reuse detection (SEC-2.6).
 *
 * Modelo:
 *   - Cada login cria uma "familia" com 1 refresh token inicial
 *   - Cada uso (rotacao) marca o token atual como usado e cria um novo
 *   - Se o MESMO token eh apresentado 2x apos ja ter sido rotacionado,
 *     consideramos hijack: revogamos a familia inteira + alerta de seguranca
 *   - Refresh tokens duram REFRESH_TTL_MS (default 7 dias)
 *
 * O token plain eh entregue ao client uma vez; armazenamos apenas o hash.
 */
import { createHash, randomBytes } from 'node:crypto'
import { getDb } from '../db/sqlite.js'
import { getPostgresPool, hasPostgresConfig } from '../db/postgres.js'

const db = getDb()
const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000

function usePostgresStorage(): boolean {
  return process.env.IGA_STORAGE_DRIVER === 'postgres' && hasPostgresConfig()
}

function hashToken(plain: string): string {
  return createHash('sha256').update(plain, 'utf8').digest('hex')
}

function genFamilyId(): string {
  return `fam_${randomBytes(8).toString('hex')}`
}

function genPlainToken(): string {
  return randomBytes(48).toString('base64url')
}

export type RefreshIssue = {
  token: string
  expiresAt: number
  familyId: string
}

type RefreshRow = {
  token_hash: string
  user_id: string
  tenant_id: string
  family_id: string
  parent_hash: string | null
  used_at: string | null
  expires_at: string
  revoked_at: string | null
}

async function readRow(tokenHash: string): Promise<RefreshRow | null> {
  if (usePostgresStorage()) {
    const result = await getPostgresPool().query<RefreshRow>(
      'SELECT token_hash, user_id, tenant_id, family_id, parent_hash, used_at::text AS used_at, expires_at::text AS expires_at, revoked_at::text AS revoked_at FROM refresh_tokens WHERE token_hash = $1',
      [tokenHash],
    )
    return result.rows[0] ?? null
  }
  return (db.prepare('SELECT * FROM refresh_tokens WHERE token_hash = ?').get(tokenHash) as RefreshRow | undefined) ?? null
}

async function insertRow(row: {
  tokenHash: string
  userId: string
  tenantId: string
  familyId: string
  parentHash: string | null
  expiresAt: string
  ipHash: string | null
  uaHash: string | null
}): Promise<void> {
  const now = new Date().toISOString()
  if (usePostgresStorage()) {
    await getPostgresPool().query(
      `INSERT INTO refresh_tokens (token_hash, user_id, tenant_id, family_id, parent_hash, expires_at, created_at, ip_hash, ua_hash)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [row.tokenHash, row.userId, row.tenantId, row.familyId, row.parentHash, row.expiresAt, now, row.ipHash, row.uaHash],
    )
    return
  }
  db.prepare(
    `INSERT INTO refresh_tokens (token_hash, user_id, tenant_id, family_id, parent_hash, expires_at, created_at, ip_hash, ua_hash)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(row.tokenHash, row.userId, row.tenantId, row.familyId, row.parentHash, row.expiresAt, now, row.ipHash, row.uaHash)
}

async function markUsed(tokenHash: string): Promise<void> {
  const now = new Date().toISOString()
  if (usePostgresStorage()) {
    await getPostgresPool().query('UPDATE refresh_tokens SET used_at = $2 WHERE token_hash = $1 AND used_at IS NULL', [tokenHash, now])
  } else {
    db.prepare('UPDATE refresh_tokens SET used_at = ? WHERE token_hash = ? AND used_at IS NULL').run(now, tokenHash)
  }
}

export async function revokeFamily(familyId: string): Promise<void> {
  const now = new Date().toISOString()
  if (usePostgresStorage()) {
    await getPostgresPool().query('UPDATE refresh_tokens SET revoked_at = $2 WHERE family_id = $1 AND revoked_at IS NULL', [familyId, now])
  } else {
    db.prepare('UPDATE refresh_tokens SET revoked_at = ? WHERE family_id = ? AND revoked_at IS NULL').run(now, familyId)
  }
}

export async function issueRefreshTokenForLogin(
  userId: string,
  tenantId: string,
  binding?: { ipHash?: string | null; uaHash?: string | null },
): Promise<RefreshIssue> {
  const familyId = genFamilyId()
  const plain = genPlainToken()
  const tokenHash = hashToken(plain)
  const expiresAtDate = new Date(Date.now() + REFRESH_TTL_MS)
  await insertRow({
    tokenHash,
    userId,
    tenantId,
    familyId,
    parentHash: null,
    expiresAt: expiresAtDate.toISOString(),
    ipHash: binding?.ipHash ?? null,
    uaHash: binding?.uaHash ?? null,
  })
  return { token: plain, expiresAt: expiresAtDate.getTime(), familyId }
}

export type RotateResult =
  | { ok: true; userId: string; tenantId: string; familyId: string; issue: RefreshIssue }
  | { ok: false; reason: 'not_found' | 'expired' | 'revoked' | 'reuse_detected' }

export async function rotateRefreshToken(
  plain: string,
  binding?: { ipHash?: string | null; uaHash?: string | null },
): Promise<RotateResult> {
  const tokenHash = hashToken(plain)
  const row = await readRow(tokenHash)
  if (!row) return { ok: false, reason: 'not_found' }
  if (row.revoked_at) return { ok: false, reason: 'revoked' }
  if (new Date(row.expires_at).getTime() <= Date.now()) return { ok: false, reason: 'expired' }
  /** Reuse detection: token ja foi rotacionado antes -> hijack -> revoga familia. */
  if (row.used_at) {
    await revokeFamily(row.family_id)
    return { ok: false, reason: 'reuse_detected' }
  }
  await markUsed(tokenHash)
  const newPlain = genPlainToken()
  const newHash = hashToken(newPlain)
  const expiresAtDate = new Date(Date.now() + REFRESH_TTL_MS)
  await insertRow({
    tokenHash: newHash,
    userId: row.user_id,
    tenantId: row.tenant_id,
    familyId: row.family_id,
    parentHash: tokenHash,
    expiresAt: expiresAtDate.toISOString(),
    ipHash: binding?.ipHash ?? null,
    uaHash: binding?.uaHash ?? null,
  })
  return {
    ok: true,
    userId: row.user_id,
    tenantId: row.tenant_id,
    familyId: row.family_id,
    issue: { token: newPlain, expiresAt: expiresAtDate.getTime(), familyId: row.family_id },
  }
}

export async function revokeAllRefreshForUser(userId: string): Promise<void> {
  const now = new Date().toISOString()
  if (usePostgresStorage()) {
    await getPostgresPool().query('UPDATE refresh_tokens SET revoked_at = $2 WHERE user_id = $1 AND revoked_at IS NULL', [userId, now])
    return
  }
  db.prepare('UPDATE refresh_tokens SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL').run(now, userId)
}
