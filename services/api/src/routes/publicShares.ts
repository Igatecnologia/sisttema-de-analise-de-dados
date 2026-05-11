import { createHash, randomBytes } from 'node:crypto'
import { Router } from 'express'
import { z } from 'zod'
import { getDb } from '../db/sqlite.js'
import { hasPostgresConfig, queryPostgres } from '../db/postgres.js'
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth.js'
import { logAudit } from '../services/auditLog.js'

export const publicSharesRouter = Router()
const db = getDb()

const DEFAULT_SHARE_TTL_DAYS = 30
const MAX_SHARE_TTL_DAYS = 90
const MAX_PAYLOAD_BYTES = 64 * 1024
const PUBLIC_TOKEN_SCHEMA = z.string().regex(/^[A-Za-z0-9_-]{24,128}$/)

const createShareSchema = z.object({
  title: z.string().min(2).max(120),
  description: z.string().max(500).nullable().optional(),
  payload: z.record(z.string(), z.unknown()).default({}).refine(
    (value) => Buffer.byteLength(JSON.stringify(value), 'utf8') <= MAX_PAYLOAD_BYTES,
    'Payload do link publico excede 64KB.',
  ),
  expiresAt: z.string().datetime().nullable().optional(),
})

type PublicShareRow = {
  token: string
  tenant_id: string
  user_id: string
  title: string
  description: string | null
  payload_json: unknown
  expires_at: string | null
  revoked_at: string | null
  created_at: string
}

function usePostgresStorage(): boolean {
  return process.env.IGA_STORAGE_DRIVER === 'postgres' && hasPostgresConfig()
}

function tokenAuditMetadata(token: string) {
  return {
    tokenPrefix: token.slice(0, 8),
    tokenHash: createHash('sha256').update(token).digest('hex'),
  }
}

function resolveExpiresAt(input: string | null | undefined): string {
  const now = Date.now()
  if (!input) return new Date(now + DEFAULT_SHARE_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString()
  const parsed = Date.parse(input)
  if (!Number.isFinite(parsed) || parsed <= now) {
    throw new Error('expiresAt deve ser uma data futura.')
  }
  const max = now + MAX_SHARE_TTL_DAYS * 24 * 60 * 60 * 1000
  if (parsed > max) {
    throw new Error(`expiresAt nao pode passar de ${MAX_SHARE_TTL_DAYS} dias.`)
  }
  return new Date(parsed).toISOString()
}

function mapShare(row: PublicShareRow, includePayload = false) {
  const payload = typeof row.payload_json === 'string'
    ? JSON.parse(row.payload_json) as Record<string, unknown>
    : row.payload_json as Record<string, unknown>
  return {
    token: row.token,
    tenantId: row.tenant_id,
    title: row.title,
    description: row.description,
    payload: includePayload ? payload : undefined,
    expiresAt: row.expires_at ? String(row.expires_at) : null,
    revokedAt: row.revoked_at ? String(row.revoked_at) : null,
    createdAt: String(row.created_at),
  }
}

publicSharesRouter.get('/public/:token', async (req, res) => {
  const token = PUBLIC_TOKEN_SCHEMA.safeParse(req.params.token)
  if (!token.success) return res.status(404).json({ message: 'Link nao encontrado' })
  const row = usePostgresStorage()
    ? (await queryPostgres<PublicShareRow>('SELECT * FROM public_shares WHERE token = $1 LIMIT 1', [token.data])).rows[0]
    : db.prepare('SELECT * FROM public_shares WHERE token = ? LIMIT 1').get(token.data) as PublicShareRow | undefined
  if (!row || row.revoked_at) return res.status(404).json({ message: 'Link nao encontrado' })
  if (row.expires_at && Date.parse(row.expires_at) < Date.now()) {
    return res.status(410).json({ message: 'Link expirado' })
  }
  res.json(mapShare(row, true))
})

publicSharesRouter.use(requireAuth)

publicSharesRouter.get('/', async (req, res) => {
  const authReq = req as AuthenticatedRequest
  if (usePostgresStorage()) {
    const result = await queryPostgres<PublicShareRow>(
      'SELECT * FROM public_shares WHERE tenant_id = $1 ORDER BY created_at DESC',
      [authReq.tenantId],
    )
    return res.json(result.rows.map((row) => mapShare(row)))
  }
  const rows = db.prepare('SELECT * FROM public_shares WHERE tenant_id = ? ORDER BY created_at DESC')
    .all(authReq.tenantId) as PublicShareRow[]
  res.json(rows.map((row) => mapShare(row)))
})

publicSharesRouter.post('/', async (req, res) => {
  const authReq = req as AuthenticatedRequest
  const parsed = createShareSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'Dados invalidos' })
  }
  let expiresAt: string
  try {
    expiresAt = resolveExpiresAt(parsed.data.expiresAt)
  } catch (err) {
    return res.status(400).json({ message: err instanceof Error ? err.message : 'expiresAt invalido' })
  }
  const token = randomBytes(18).toString('base64url')
  const now = new Date().toISOString()
  if (usePostgresStorage()) {
    await queryPostgres(`
      INSERT INTO public_shares (token, tenant_id, user_id, title, description, payload_json, expires_at, created_at)
      VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8)
    `, [
      token,
      authReq.tenantId,
      authReq.userId,
      parsed.data.title.trim(),
      parsed.data.description ?? null,
      JSON.stringify(parsed.data.payload),
      expiresAt,
      now,
    ])
  } else {
    db.prepare(`
      INSERT INTO public_shares (token, tenant_id, user_id, title, description, payload_json, expires_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      token,
      authReq.tenantId,
      authReq.userId,
      parsed.data.title.trim(),
      parsed.data.description ?? null,
      JSON.stringify(parsed.data.payload),
      expiresAt,
      now,
    )
  }
  logAudit({
    userId: authReq.userId,
    tenantId: authReq.tenantId,
    action: 'public_share_created',
    resource: 'public_shares',
    metadata: tokenAuditMetadata(token),
  })
  res.status(201).json(mapShare({
    token,
    tenant_id: authReq.tenantId,
    user_id: authReq.userId,
    title: parsed.data.title.trim(),
    description: parsed.data.description ?? null,
    payload_json: JSON.stringify(parsed.data.payload),
    expires_at: expiresAt,
    revoked_at: null,
    created_at: now,
  }, true))
})

publicSharesRouter.post('/:token/revoke', async (req, res) => {
  const authReq = req as unknown as AuthenticatedRequest
  const token = PUBLIC_TOKEN_SCHEMA.safeParse(req.params.token)
  if (!token.success) return res.status(404).json({ message: 'Link nao encontrado ou ja revogado' })
  const now = new Date().toISOString()
  if (usePostgresStorage()) {
    const result = await queryPostgres(
      'UPDATE public_shares SET revoked_at = $1 WHERE token = $2 AND tenant_id = $3 AND revoked_at IS NULL',
      [now, token.data, authReq.tenantId],
    )
    if (!result.rowCount) return res.status(404).json({ message: 'Link nao encontrado ou ja revogado' })
    return res.json({ ok: true })
  }
  const result = db.prepare('UPDATE public_shares SET revoked_at = ? WHERE token = ? AND tenant_id = ? AND revoked_at IS NULL')
    .run(now, token.data, authReq.tenantId)
  if (result.changes === 0) return res.status(404).json({ message: 'Link nao encontrado ou ja revogado' })
  res.json({ ok: true })
})
