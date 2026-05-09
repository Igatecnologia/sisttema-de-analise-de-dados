/**
 * MFA/TOTP (SEC-2.1) — segredos armazenados criptografados; backup codes hasheados.
 *
 * Fluxo:
 *   1. setup-init: gera secret, salva (enabled_at=null), retorna otpauth_url
 *   2. setup-confirm: recebe TOTP do user; se valido, marca enabled_at=now;
 *      gera 10 backup codes one-time (retornados em texto, gravados como hash)
 *   3. login: se enabled, exige TOTP. backup code consome um slot.
 *   4. disable: exige senha + TOTP atual. Apaga registro.
 */
import { generateSecret, generateURI, verifySync } from 'otplib'
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { getDb } from '../db/sqlite.js'
import { getPostgresPool, hasPostgresConfig } from '../db/postgres.js'
import { decryptSecret, encryptSecret, isEncryptedPayload } from './crypto.js'

const db = getDb()

/** Tolerancia simetrica de 1 step (~30s antes/depois) para clock skew. */
const TOTP_VERIFY_OPTS = { epochTolerance: 1 } as const

function verifyTotp(secret: string, token: string): boolean {
  const result = verifySync({ secret, token, ...TOTP_VERIFY_OPTS })
  return result.valid === true
}

function usePostgresStorage(): boolean {
  return process.env.IGA_STORAGE_DRIVER === 'postgres' && hasPostgresConfig()
}

export type MfaStatus = {
  enabled: boolean
  pendingSetup: boolean
  backupCodesRemaining: number
}

type MfaRow = {
  user_id: string
  secret_encrypted: string
  backup_codes_json: string
  enabled_at: string | null
  last_used_at: string | null
}

function decryptSecretField(raw: string): string {
  try {
    const parsed = JSON.parse(raw) as unknown
    if (isEncryptedPayload(parsed)) return decryptSecret(parsed)
  } catch { /* invalido */ }
  throw new Error('Secret MFA corrompido')
}

function hashBackupCode(code: string): string {
  /** Backup codes sao 8 hex chars — colisao quase impossivel; SHA-256 puro suficiente. */
  return createHash('sha256').update(code, 'utf8').digest('hex')
}

function generateBackupCodes(count = 10): { plain: string[]; hashes: string[] } {
  const plain: string[] = []
  const hashes: string[] = []
  for (let i = 0; i < count; i++) {
    const code = randomBytes(4).toString('hex') // 8 chars hex
    plain.push(code)
    hashes.push(hashBackupCode(code))
  }
  return { plain, hashes }
}

async function readMfaRow(userId: string): Promise<MfaRow | null> {
  if (usePostgresStorage()) {
    const result = await getPostgresPool().query<MfaRow>(
      'SELECT user_id, secret_encrypted, backup_codes_json::text AS backup_codes_json, enabled_at::text AS enabled_at, last_used_at::text AS last_used_at FROM user_mfa WHERE user_id = $1',
      [userId],
    )
    return result.rows[0] ?? null
  }
  const row = db.prepare('SELECT * FROM user_mfa WHERE user_id = ?').get(userId) as MfaRow | undefined
  return row ?? null
}

export async function getMfaStatus(userId: string): Promise<MfaStatus> {
  const row = await readMfaRow(userId)
  if (!row) return { enabled: false, pendingSetup: false, backupCodesRemaining: 0 }
  let backupRemaining = 0
  try {
    const arr = JSON.parse(row.backup_codes_json) as string[]
    backupRemaining = Array.isArray(arr) ? arr.length : 0
  } catch { /* ignora */ }
  return {
    enabled: Boolean(row.enabled_at),
    pendingSetup: !row.enabled_at,
    backupCodesRemaining: backupRemaining,
  }
}

/** Gera um novo secret e persiste (enabled=false). Retorna otpauth_url para QR. */
export async function initMfaSetup(userId: string, userEmail: string, issuer: string): Promise<{ otpauthUrl: string; secret: string }> {
  const secret = generateSecret()
  const encrypted = JSON.stringify(encryptSecret(secret))
  const now = new Date().toISOString()

  if (usePostgresStorage()) {
    await getPostgresPool().query(
      `INSERT INTO user_mfa (user_id, secret_encrypted, backup_codes_json, enabled_at, created_at, updated_at)
       VALUES ($1, $2, '[]'::jsonb, NULL, $3, $3)
       ON CONFLICT (user_id) DO UPDATE SET secret_encrypted = $2, backup_codes_json = '[]'::jsonb, enabled_at = NULL, updated_at = $3`,
      [userId, encrypted, now],
    )
  } else {
    db.prepare(
      `INSERT INTO user_mfa (user_id, secret_encrypted, backup_codes_json, enabled_at, created_at, updated_at)
       VALUES (?, ?, '[]', NULL, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET secret_encrypted = excluded.secret_encrypted, backup_codes_json = '[]', enabled_at = NULL, updated_at = excluded.updated_at`,
    ).run(userId, encrypted, now, now)
  }

  const otpauthUrl = generateURI({ issuer, label: userEmail, secret })
  return { otpauthUrl, secret }
}

/** Confirma setup com TOTP. Retorna lista de backup codes (uma vez so) se OK. */
export async function confirmMfaSetup(userId: string, totp: string): Promise<{ ok: true; backupCodes: string[] } | { ok: false; reason: 'no_pending' | 'invalid_token' }> {
  const row = await readMfaRow(userId)
  if (!row || row.enabled_at) return { ok: false, reason: 'no_pending' }
  const secret = decryptSecretField(row.secret_encrypted)
  if (!verifyTotp(secret, totp)) return { ok: false, reason: 'invalid_token' }

  const { plain, hashes } = generateBackupCodes(10)
  const now = new Date().toISOString()
  const backupJson = JSON.stringify(hashes)

  if (usePostgresStorage()) {
    await getPostgresPool().query(
      'UPDATE user_mfa SET enabled_at = $2, backup_codes_json = $3::jsonb, updated_at = $2 WHERE user_id = $1',
      [userId, now, backupJson],
    )
  } else {
    db.prepare('UPDATE user_mfa SET enabled_at = ?, backup_codes_json = ?, updated_at = ? WHERE user_id = ?').run(now, backupJson, now, userId)
  }
  return { ok: true, backupCodes: plain }
}

/** Verifica TOTP ou backup code. Consome o backup code se usado. */
export async function verifyMfaToken(userId: string, token: string): Promise<{ ok: true; usedBackupCode: boolean } | { ok: false }> {
  const row = await readMfaRow(userId)
  if (!row || !row.enabled_at) return { ok: false }
  const cleaned = token.replace(/\s/g, '').toLowerCase()

  /** TOTP eh sempre 6 digitos numericos. */
  if (/^\d{6}$/.test(cleaned)) {
    const secret = decryptSecretField(row.secret_encrypted)
    if (verifyTotp(secret, cleaned)) {
      const now = new Date().toISOString()
      if (usePostgresStorage()) {
        await getPostgresPool().query('UPDATE user_mfa SET last_used_at = $2 WHERE user_id = $1', [userId, now])
      } else {
        db.prepare('UPDATE user_mfa SET last_used_at = ? WHERE user_id = ?').run(now, userId)
      }
      return { ok: true, usedBackupCode: false }
    }
    return { ok: false }
  }

  /** Backup code = 8 hex chars. */
  if (/^[0-9a-f]{8}$/.test(cleaned)) {
    let codes: string[] = []
    try { codes = JSON.parse(row.backup_codes_json) as string[] } catch { /* ignora */ }
    const tried = hashBackupCode(cleaned)
    const idx = codes.findIndex((stored) => {
      try {
        return timingSafeEqual(Buffer.from(stored, 'hex'), Buffer.from(tried, 'hex'))
      } catch {
        return false
      }
    })
    if (idx < 0) return { ok: false }
    codes.splice(idx, 1)
    const now = new Date().toISOString()
    const newJson = JSON.stringify(codes)
    if (usePostgresStorage()) {
      await getPostgresPool().query(
        'UPDATE user_mfa SET backup_codes_json = $2::jsonb, last_used_at = $3, updated_at = $3 WHERE user_id = $1',
        [userId, newJson, now],
      )
    } else {
      db.prepare('UPDATE user_mfa SET backup_codes_json = ?, last_used_at = ?, updated_at = ? WHERE user_id = ?').run(newJson, now, now, userId)
    }
    return { ok: true, usedBackupCode: true }
  }

  return { ok: false }
}

export async function disableMfa(userId: string): Promise<void> {
  if (usePostgresStorage()) {
    await getPostgresPool().query('DELETE FROM user_mfa WHERE user_id = $1', [userId])
  } else {
    db.prepare('DELETE FROM user_mfa WHERE user_id = ?').run(userId)
  }
}

export async function regenerateBackupCodes(userId: string): Promise<string[] | null> {
  const row = await readMfaRow(userId)
  if (!row || !row.enabled_at) return null
  const { plain, hashes } = generateBackupCodes(10)
  const now = new Date().toISOString()
  const json = JSON.stringify(hashes)
  if (usePostgresStorage()) {
    await getPostgresPool().query('UPDATE user_mfa SET backup_codes_json = $2::jsonb, updated_at = $3 WHERE user_id = $1', [userId, json, now])
  } else {
    db.prepare('UPDATE user_mfa SET backup_codes_json = ?, updated_at = ? WHERE user_id = ?').run(json, now, userId)
  }
  return plain
}
