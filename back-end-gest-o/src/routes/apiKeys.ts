import { createHash, randomBytes } from 'node:crypto'
import { Router } from 'express'
import { z } from 'zod'
import { getDb } from '../db/sqlite.js'
import { hasPostgresConfig, queryPostgres } from '../db/postgres.js'
import { requireAdmin, type AuthenticatedRequest } from '../middleware/auth.js'
import { logAudit } from '../services/auditLog.js'

export const apiKeysRouter = Router()
apiKeysRouter.use(requireAdmin)

const db = getDb()

const scopeSchema = z.enum(['reports:read', 'dashboards:read', 'datasources:read', 'webhooks:write'])
const createApiKeySchema = z.object({
  name: z.string().min(2).max(80),
  scopes: z.array(scopeSchema).min(1).max(8),
})

type ApiKeyRow = {
  id: string
  tenant_id: string
  user_id: string
  name: string
  prefix: string
  scopes_json: string
  status: string
  last_used_at: string | null
  created_at: string
  revoked_at: string | null
}

function usePostgresStorage(): boolean {
  return process.env.IGA_STORAGE_DRIVER === 'postgres' && hasPostgresConfig()
}

function hashSecret(secret: string): string {
  return createHash('sha256').update(secret).digest('hex')
}

function mapKey(row: ApiKeyRow) {
  const scopes = Array.isArray(row.scopes_json)
    ? row.scopes_json
    : JSON.parse(String(row.scopes_json)) as string[]
  return {
    id: row.id,
    tenantId: row.tenant_id,
    userId: row.user_id,
    name: row.name,
    prefix: row.prefix,
    scopes,
    status: row.status as 'active' | 'revoked',
    lastUsedAt: row.last_used_at ? String(row.last_used_at) : null,
    createdAt: String(row.created_at),
    revokedAt: row.revoked_at ? String(row.revoked_at) : null,
  }
}

apiKeysRouter.get('/', async (req, res) => {
  const authReq = req as AuthenticatedRequest
  if (usePostgresStorage()) {
    const result = await queryPostgres<ApiKeyRow>(`
      SELECT id, tenant_id, user_id, name, prefix, scopes_json, status, last_used_at, created_at, revoked_at
      FROM api_keys
      WHERE tenant_id = $1
      ORDER BY created_at DESC
    `, [authReq.tenantId])
    return res.json(result.rows.map(mapKey))
  }
  const rows = db.prepare(`
    SELECT id, tenant_id, user_id, name, prefix, scopes_json, status, last_used_at, created_at, revoked_at
    FROM api_keys
    WHERE tenant_id = ?
    ORDER BY created_at DESC
  `).all(authReq.tenantId) as ApiKeyRow[]
  res.json(rows.map(mapKey))
})

apiKeysRouter.post('/', async (req, res) => {
  const authReq = req as AuthenticatedRequest
  const parsed = createApiKeySchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'Dados invalidos' })
  }

  const secret = `iga_live_${randomBytes(32).toString('hex')}`
  const now = new Date().toISOString()
  const id = `key_${randomBytes(8).toString('hex')}`
  const prefix = secret.slice(0, 18)
  const scopes = [...new Set(parsed.data.scopes)].sort()
  if (usePostgresStorage()) {
    await queryPostgres(`
      INSERT INTO api_keys (id, tenant_id, user_id, name, prefix, secret_hash, scopes_json, status, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, 'active', $8)
    `, [id, authReq.tenantId, authReq.userId, parsed.data.name.trim(), prefix, hashSecret(secret), JSON.stringify(scopes), now])
  } else {
    db.prepare(`
      INSERT INTO api_keys (id, tenant_id, user_id, name, prefix, secret_hash, scopes_json, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?)
    `).run(id, authReq.tenantId, authReq.userId, parsed.data.name.trim(), prefix, hashSecret(secret), JSON.stringify(scopes), now)
  }

  logAudit({
    userId: authReq.userId,
    tenantId: authReq.tenantId,
    action: 'api_key_created',
    resource: 'api_keys',
    metadata: { keyId: id, scopes },
  })

  res.status(201).json({
    key: mapKey({
      id,
      tenant_id: authReq.tenantId,
      user_id: authReq.userId,
      name: parsed.data.name.trim(),
      prefix,
      scopes_json: JSON.stringify(scopes),
      status: 'active',
      last_used_at: null,
      created_at: now,
      revoked_at: null,
    }),
    secret,
  })
})

apiKeysRouter.post('/:id/revoke', async (req, res) => {
  const authReq = req as unknown as AuthenticatedRequest
  const now = new Date().toISOString()
  if (usePostgresStorage()) {
    const result = await queryPostgres(`
      UPDATE api_keys
      SET status = 'revoked', revoked_at = $1
      WHERE id = $2 AND tenant_id = $3 AND status = 'active'
    `, [now, req.params.id, authReq.tenantId])
    if (!result.rowCount) return res.status(404).json({ message: 'Chave nao encontrada ou ja revogada' })
  } else {
  const result = db.prepare(`
    UPDATE api_keys
    SET status = 'revoked', revoked_at = ?
    WHERE id = ? AND tenant_id = ? AND status = 'active'
  `).run(now, req.params.id, authReq.tenantId)
  if (result.changes === 0) return res.status(404).json({ message: 'Chave nao encontrada ou ja revogada' })
  }
  logAudit({
    userId: authReq.userId,
    tenantId: authReq.tenantId,
    action: 'api_key_revoked',
    resource: 'api_keys',
    metadata: { keyId: req.params.id },
  })
  res.json({ ok: true })
})
