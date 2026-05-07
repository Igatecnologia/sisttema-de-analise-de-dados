import { Router } from 'express'
import { getDb } from '../db/sqlite.js'
import { getPostgresPool, hasPostgresConfig } from '../db/postgres.js'
import { computeAuditRowHash, type AuditRowForHash } from '../utils/auditChainHash.js'

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

type ChainRow = {
  id: string | number
  user_id: string | null
  tenant_id: string | null
  action: string
  resource: string
  metadata_json: string | null
  created_at: string
  prev_hash: string | null
  row_hash: string | null
}

function toRowForHash(row: ChainRow): AuditRowForHash {
  return {
    id: String(row.id),
    user_id: row.user_id,
    tenant_id: row.tenant_id,
    action: row.action,
    resource: row.resource,
    metadata_json: row.metadata_json,
    created_at: row.created_at,
    prev_hash: row.prev_hash ?? '',
  }
}

/**
 * GET /audit/verify
 * Recalcula a hash chain do audit_log em ordem cronologica.
 * Retorna `valid: false` se qualquer row foi editada/deletada/inserida fora da chain.
 *
 * Linhas legadas (sem row_hash) sao ignoradas — a chain so eh verificada para
 * registros gravados depois da migracao 006.
 */
auditRouter.get('/verify', async (_req, res) => {
  let rows: ChainRow[]

  if (usePostgresStorage()) {
    const result = await getPostgresPool().query<ChainRow>(
      'SELECT id, user_id, tenant_id, action, resource, metadata_json, created_at, prev_hash, row_hash FROM audit_log WHERE row_hash IS NOT NULL ORDER BY id ASC',
    )
    rows = result.rows
  } else {
    rows = db
      .prepare(
        'SELECT id, user_id, tenant_id, action, resource, metadata_json, created_at, prev_hash, row_hash FROM audit_log WHERE row_hash IS NOT NULL ORDER BY id ASC',
      )
      .all() as ChainRow[]
  }

  let prevHash = ''
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const declaredPrev = row.prev_hash ?? ''
    if (declaredPrev !== prevHash) {
      return res.status(409).json({
        valid: false,
        brokenAt: { id: row.id, index: i, reason: 'prev_hash_mismatch' },
        verified: i,
        total: rows.length,
      })
    }
    const expected = computeAuditRowHash(toRowForHash(row))
    if (expected !== row.row_hash) {
      return res.status(409).json({
        valid: false,
        brokenAt: { id: row.id, index: i, reason: 'row_hash_mismatch' },
        verified: i,
        total: rows.length,
      })
    }
    prevHash = row.row_hash ?? ''
  }

  res.json({ valid: true, verified: rows.length, total: rows.length })
})
