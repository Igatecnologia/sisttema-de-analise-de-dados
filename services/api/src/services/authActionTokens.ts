import { createHash, randomBytes } from 'node:crypto'
import { getDb } from '../db/sqlite.js'
import { hasPostgresConfig, queryPostgres } from '../db/postgres.js'

export type AuthActionTokenType = 'invite' | 'password_reset' | 'email_verify'

export type AuthActionTokenRecord = {
  id: string
  tenantId: string
  userId: string | null
  email: string
  type: AuthActionTokenType
  tokenHash: string
  expiresAt: string
  usedAt: string | null
  metadata: Record<string, unknown>
  createdAt: string
}

const db = getDb()

function usePostgresStorage(): boolean {
  return process.env.IGA_STORAGE_DRIVER === 'postgres' && hasPostgresConfig()
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

function mapRow(row: Record<string, unknown>): AuthActionTokenRecord {
  const metadataRaw = row.metadata_json
  let metadata: Record<string, unknown> = {}
  if (metadataRaw) {
    try {
      metadata = typeof metadataRaw === 'string'
        ? JSON.parse(metadataRaw) as Record<string, unknown>
        : metadataRaw as Record<string, unknown>
    } catch {
      metadata = {}
    }
  }
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    userId: row.user_id ? String(row.user_id) : null,
    email: String(row.email),
    type: row.type as AuthActionTokenType,
    tokenHash: String(row.token_hash),
    expiresAt: String(row.expires_at),
    usedAt: row.used_at ? String(row.used_at) : null,
    metadata,
    createdAt: String(row.created_at),
  }
}

export async function createAuthActionToken(input: {
  tenantId: string
  userId?: string | null
  email: string
  type: AuthActionTokenType
  ttlMs: number
  metadata?: Record<string, unknown>
}): Promise<{ token: string; record: AuthActionTokenRecord }> {
  const now = new Date()
  const token = randomBytes(32).toString('hex')
  const record = {
    id: `aat_${randomBytes(6).toString('hex')}_${Date.now().toString(36)}`,
    tenantId: input.tenantId,
    userId: input.userId ?? null,
    email: input.email.trim().toLowerCase(),
    type: input.type,
    tokenHash: sha256(token),
    expiresAt: new Date(now.getTime() + input.ttlMs).toISOString(),
    usedAt: null,
    metadata: input.metadata ?? {},
    createdAt: now.toISOString(),
  } satisfies AuthActionTokenRecord

  if (usePostgresStorage()) {
    await queryPostgres(
      `
      INSERT INTO auth_action_tokens (
        id, tenant_id, user_id, email, type, token_hash, expires_at, used_at, metadata_json, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NULL, $8::jsonb, $9)
      `,
      [
        record.id,
        record.tenantId,
        record.userId,
        record.email,
        record.type,
        record.tokenHash,
        record.expiresAt,
        JSON.stringify(record.metadata),
        record.createdAt,
      ],
    )
  } else {
    db.prepare(`
      INSERT INTO auth_action_tokens (
        id, tenant_id, user_id, email, type, token_hash, expires_at, used_at, metadata_json, created_at
      ) VALUES (
        @id, @tenant_id, @user_id, @email, @type, @token_hash, @expires_at, NULL, @metadata_json, @created_at
      )
    `).run({
      id: record.id,
      tenant_id: record.tenantId,
      user_id: record.userId,
      email: record.email,
      type: record.type,
      token_hash: record.tokenHash,
      expires_at: record.expiresAt,
      metadata_json: JSON.stringify(record.metadata),
      created_at: record.createdAt,
    })
  }

  return { token, record }
}

export async function consumeAuthActionToken(type: AuthActionTokenType, token: string): Promise<AuthActionTokenRecord | null> {
  const tokenHash = sha256(token)
  const now = new Date().toISOString()
  if (usePostgresStorage()) {
    const result = await queryPostgres(
      `
      UPDATE auth_action_tokens
      SET used_at = $1
      WHERE id = (
        SELECT id FROM auth_action_tokens
        WHERE type = $2 AND token_hash = $3 AND used_at IS NULL AND expires_at > $1
        LIMIT 1
      )
      RETURNING *
      `,
      [now, type, tokenHash],
    )
    return result.rows[0] ? mapRow(result.rows[0] as Record<string, unknown>) : null
  }
  const row = db.prepare(`
    SELECT * FROM auth_action_tokens
    WHERE type = ? AND token_hash = ? AND used_at IS NULL AND expires_at > ?
    LIMIT 1
  `).get(type, tokenHash, now) as Record<string, unknown> | undefined
  if (!row) return null
  db.prepare('UPDATE auth_action_tokens SET used_at = ? WHERE id = ?').run(now, row.id)
  return mapRow(row)
}

