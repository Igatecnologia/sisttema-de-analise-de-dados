import { randomBytes } from 'node:crypto'
import { Router } from 'express'
import { z } from 'zod'
import { getDb } from '../db/sqlite.js'
import { hasPostgresConfig, queryPostgres } from '../db/postgres.js'
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth.js'
import { logAudit } from '../services/auditLog.js'

export const publicSharesRouter = Router()
const db = getDb()

const createShareSchema = z.object({
  title: z.string().min(2).max(120),
  description: z.string().max(500).nullable().optional(),
  payload: z.record(z.string(), z.unknown()).default({}),
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
  const row = usePostgresStorage()
    ? (await queryPostgres<PublicShareRow>('SELECT * FROM public_shares WHERE token = $1 LIMIT 1', [req.params.token])).rows[0]
    : db.prepare('SELECT * FROM public_shares WHERE token = ? LIMIT 1').get(req.params.token) as PublicShareRow | undefined
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
      parsed.data.expiresAt ?? null,
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
      parsed.data.expiresAt ?? null,
      now,
    )
  }
  logAudit({
    userId: authReq.userId,
    tenantId: authReq.tenantId,
    action: 'public_share_created',
    resource: 'public_shares',
    metadata: { token },
  })
  res.status(201).json(mapShare({
    token,
    tenant_id: authReq.tenantId,
    user_id: authReq.userId,
    title: parsed.data.title.trim(),
    description: parsed.data.description ?? null,
    payload_json: JSON.stringify(parsed.data.payload),
    expires_at: parsed.data.expiresAt ?? null,
    revoked_at: null,
    created_at: now,
  }, true))
})

publicSharesRouter.post('/:token/revoke', async (req, res) => {
  const authReq = req as unknown as AuthenticatedRequest
  const now = new Date().toISOString()
  if (usePostgresStorage()) {
    const result = await queryPostgres(
      'UPDATE public_shares SET revoked_at = $1 WHERE token = $2 AND tenant_id = $3 AND revoked_at IS NULL',
      [now, req.params.token, authReq.tenantId],
    )
    if (!result.rowCount) return res.status(404).json({ message: 'Link nao encontrado ou ja revogado' })
    return res.json({ ok: true })
  }
  const result = db.prepare('UPDATE public_shares SET revoked_at = ? WHERE token = ? AND tenant_id = ? AND revoked_at IS NULL')
    .run(now, req.params.token, authReq.tenantId)
  if (result.changes === 0) return res.status(404).json({ message: 'Link nao encontrado ou ja revogado' })
  res.json({ ok: true })
})
