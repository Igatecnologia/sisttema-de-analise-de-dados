import { Router } from 'express'
import { getDb } from '../db/sqlite.js'
import { getPostgresPool, hasPostgresConfig } from '../db/postgres.js'

export const auditRouter = Router()

const db = getDb()

function usePostgresStorage(): boolean {
  return process.env.IGA_STORAGE_DRIVER === 'postgres' && hasPostgresConfig()
}

/**
 * GET /audit?limit=50&offset=0&action=login_failed
 * Lista eventos de audit log com paginação e filtro opcional por action.
 */
auditRouter.get('/', async (req, res) => {
  const limit = Math.min(Math.max(parseInt(String(req.query.limit ?? '50'), 10) || 50, 1), 500)
  const offset = Math.max(parseInt(String(req.query.offset ?? '0'), 10) || 0, 0)
  const action = typeof req.query.action === 'string' ? req.query.action.trim() : undefined

  if (usePostgresStorage()) {
    const pool = getPostgresPool()
    const rowsRes = action
      ? await pool.query(
          'SELECT * FROM audit_log WHERE action = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
          [action, limit, offset],
        )
      : await pool.query(
          'SELECT * FROM audit_log ORDER BY created_at DESC LIMIT $1 OFFSET $2',
          [limit, offset],
        )
    const totalRes = action
      ? await pool.query<{ total: string }>('SELECT COUNT(*)::text AS total FROM audit_log WHERE action = $1', [action])
      : await pool.query<{ total: string }>('SELECT COUNT(*)::text AS total FROM audit_log')
    const total = Number(totalRes.rows[0]?.total ?? 0)
    return res.json({ total, limit, offset, rows: rowsRes.rows })
  }

  let rows: unknown[]
  let total: number

  if (action) {
    rows = db.prepare(
      'SELECT * FROM audit_log WHERE action = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
    ).all(action, limit, offset)
    total = (db.prepare('SELECT COUNT(*) AS total FROM audit_log WHERE action = ?').get(action) as { total: number }).total
  } else {
    rows = db.prepare(
      'SELECT * FROM audit_log ORDER BY created_at DESC LIMIT ? OFFSET ?',
    ).all(limit, offset)
    total = (db.prepare('SELECT COUNT(*) AS total FROM audit_log').get() as { total: number }).total
  }

  res.json({ total, limit, offset, rows })
})
