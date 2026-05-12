import { createHash, randomBytes } from 'node:crypto'
import { Router } from 'express'
import { z } from 'zod'
import { getDb } from '../db/sqlite.js'
import { hasPostgresConfig, queryPostgres } from '../db/postgres.js'
import { requireAdmin, type AuthenticatedRequest } from '../middleware/auth.js'
import { logAudit } from '../services/auditLog.js'
import { sanitizeAllowlist, validateAllowlistEntry } from '../utils/ipAllowlist.js'

export const apiKeysRouter = Router()
apiKeysRouter.use(requireAdmin)

const db = getDb()

const scopeSchema = z.enum(['reports:read', 'dashboards:read', 'datasources:read', 'webhooks:write'])
const createApiKeySchema = z.object({
  name: z.string().min(2).max(80),
  scopes: z.array(scopeSchema).min(1).max(8),
  /** P2-04: opcional. Vazio = aceita qualquer IP. */
  allowedIps: z.array(z.string().max(64)).max(50).optional(),
})
/** PATCH: permite atualizar a allowlist sem regenerar a key. */
const updateApiKeySchema = z.object({
  allowedIps: z.array(z.string().max(64)).max(50),
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

function mapKey(row: ApiKeyRow & { allowed_ips_json?: string | string[] | null }) {
  const scopes = Array.isArray(row.scopes_json)
    ? row.scopes_json
    : JSON.parse(String(row.scopes_json)) as string[]
  let allowedIps: string[] = []
  if (row.allowed_ips_json) {
    allowedIps = Array.isArray(row.allowed_ips_json)
      ? row.allowed_ips_json.filter((s): s is string => typeof s === 'string')
      : (() => { try { return (JSON.parse(String(row.allowed_ips_json)) as string[]) ?? [] } catch { return [] } })()
  }
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
    /** P2-04: lista vazia significa "sem restrição de IP". */
    allowedIps,
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
    SELECT id, tenant_id, user_id, name, prefix, scopes_json, status, last_used_at, created_at, revoked_at, allowed_ips_json
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
  /** P2-04: valida cada entrada antes de aceitar (UI mostra erro por linha). */
  const allowedIpsRaw = parsed.data.allowedIps ?? []
  for (const entry of allowedIpsRaw) {
    const err = validateAllowlistEntry(entry)
    if (err) return res.status(400).json({ message: `allowedIps: "${entry}" — ${err}` })
  }
  const allowedIps = sanitizeAllowlist(allowedIpsRaw)
  const allowedIpsJson = JSON.stringify(allowedIps)
  if (usePostgresStorage()) {
    await queryPostgres(`
      INSERT INTO api_keys (id, tenant_id, user_id, name, prefix, secret_hash, scopes_json, status, created_at, allowed_ips_json)
      VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, 'active', $8, $9::jsonb)
    `, [id, authReq.tenantId, authReq.userId, parsed.data.name.trim(), prefix, hashSecret(secret), JSON.stringify(scopes), now, allowedIpsJson])
  } else {
    db.prepare(`
      INSERT INTO api_keys (id, tenant_id, user_id, name, prefix, secret_hash, scopes_json, status, created_at, allowed_ips_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)
    `).run(id, authReq.tenantId, authReq.userId, parsed.data.name.trim(), prefix, hashSecret(secret), JSON.stringify(scopes), now, allowedIpsJson)
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
      allowed_ips_json: allowedIpsJson,
    }),
    secret,
  })
})

/**
 * P2-04: PATCH /api/v1/api-keys/:id — atualiza apenas a IP allowlist.
 * Sem regenerar o secret (mantém compatibilidade pra apps que já usam a key).
 */
apiKeysRouter.patch('/:id', async (req, res) => {
  const authReq = req as unknown as AuthenticatedRequest
  const parsed = updateApiKeySchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'Dados invalidos' })
  for (const entry of parsed.data.allowedIps) {
    const err = validateAllowlistEntry(entry)
    if (err) return res.status(400).json({ message: `allowedIps: "${entry}" — ${err}` })
  }
  const allowedIps = sanitizeAllowlist(parsed.data.allowedIps)
  const allowedIpsJson = JSON.stringify(allowedIps)
  if (usePostgresStorage()) {
    const result = await queryPostgres(
      `UPDATE api_keys SET allowed_ips_json = $1::jsonb WHERE id = $2 AND tenant_id = $3 AND status = 'active'`,
      [allowedIpsJson, req.params.id, authReq.tenantId],
    )
    if (!result.rowCount) return res.status(404).json({ message: 'Chave nao encontrada ou revogada' })
  } else {
    const result = db.prepare(
      `UPDATE api_keys SET allowed_ips_json = ? WHERE id = ? AND tenant_id = ? AND status = 'active'`,
    ).run(allowedIpsJson, req.params.id, authReq.tenantId)
    if (result.changes === 0) return res.status(404).json({ message: 'Chave nao encontrada ou revogada' })
  }
  logAudit({
    userId: authReq.userId,
    tenantId: authReq.tenantId,
    action: 'api_key_allowlist_updated',
    resource: 'api_keys',
    metadata: { keyId: req.params.id, count: allowedIps.length },
  })
  res.json({ ok: true, allowedIps })
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
