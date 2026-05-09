import { randomBytes } from 'node:crypto'
import { Router } from 'express'
import { z } from 'zod'
import { getDb } from '../db/sqlite.js'
import { hasPostgresConfig, queryPostgres } from '../db/postgres.js'
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth.js'

export const savedViewsRouter = Router()
savedViewsRouter.use(requireAuth)

const db = getDb()

const savedViewSchema = z.object({
  pageKey: z.string().min(2).max(80).regex(/^[a-z0-9-]+$/),
  name: z.string().min(1).max(80),
  params: z.string().max(2000).default(''),
})

type SavedViewRow = {
  id: string
  tenant_id: string
  user_id: string
  page_key: string
  name: string
  params: string
  created_at: string
  updated_at: string
}

function usePostgresStorage(): boolean {
  return process.env.IGA_STORAGE_DRIVER === 'postgres' && hasPostgresConfig()
}

function mapView(row: SavedViewRow) {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    userId: row.user_id,
    pageKey: row.page_key,
    name: row.name,
    params: row.params,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }
}

savedViewsRouter.get('/', async (req, res) => {
  const authReq = req as AuthenticatedRequest
  const pageKey = typeof req.query.pageKey === 'string' ? req.query.pageKey : ''
  if (usePostgresStorage()) {
    const result = pageKey
      ? await queryPostgres<SavedViewRow>(`
          SELECT * FROM saved_views
          WHERE tenant_id = $1 AND user_id = $2 AND page_key = $3
          ORDER BY created_at DESC
        `, [authReq.tenantId, authReq.userId, pageKey])
      : await queryPostgres<SavedViewRow>(`
          SELECT * FROM saved_views
          WHERE tenant_id = $1 AND user_id = $2
          ORDER BY created_at DESC
        `, [authReq.tenantId, authReq.userId])
    return res.json(result.rows.map(mapView))
  }
  const rows = pageKey
    ? db.prepare(`
        SELECT * FROM saved_views
        WHERE tenant_id = ? AND user_id = ? AND page_key = ?
        ORDER BY created_at DESC
      `).all(authReq.tenantId, authReq.userId, pageKey)
    : db.prepare(`
        SELECT * FROM saved_views
        WHERE tenant_id = ? AND user_id = ?
        ORDER BY created_at DESC
      `).all(authReq.tenantId, authReq.userId)
  res.json((rows as SavedViewRow[]).map(mapView))
})

savedViewsRouter.post('/', async (req, res) => {
  const authReq = req as AuthenticatedRequest
  const parsed = savedViewSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'Dados invalidos' })
  }
  const now = new Date().toISOString()
  const id = `sv_${randomBytes(8).toString('hex')}`
  if (usePostgresStorage()) {
    await queryPostgres(`
      INSERT INTO saved_views (id, tenant_id, user_id, page_key, name, params, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [id, authReq.tenantId, authReq.userId, parsed.data.pageKey, parsed.data.name.trim(), parsed.data.params, now, now])
  } else {
    db.prepare(`
      INSERT INTO saved_views (id, tenant_id, user_id, page_key, name, params, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, authReq.tenantId, authReq.userId, parsed.data.pageKey, parsed.data.name.trim(), parsed.data.params, now, now)
  }
  res.status(201).json(mapView({
    id,
    tenant_id: authReq.tenantId,
    user_id: authReq.userId,
    page_key: parsed.data.pageKey,
    name: parsed.data.name.trim(),
    params: parsed.data.params,
    created_at: now,
    updated_at: now,
  }))
})

savedViewsRouter.delete('/:id', async (req, res) => {
  const authReq = req as unknown as AuthenticatedRequest
  if (usePostgresStorage()) {
    const result = await queryPostgres(
      'DELETE FROM saved_views WHERE id = $1 AND tenant_id = $2 AND user_id = $3',
      [req.params.id, authReq.tenantId, authReq.userId],
    )
    if (!result.rowCount) return res.status(404).json({ message: 'Visao salva nao encontrada' })
    return res.json({ ok: true })
  }
  const result = db.prepare('DELETE FROM saved_views WHERE id = ? AND tenant_id = ? AND user_id = ?')
    .run(req.params.id, authReq.tenantId, authReq.userId)
  if (result.changes === 0) return res.status(404).json({ message: 'Visao salva nao encontrada' })
  res.json({ ok: true })
})
