import { Router } from 'express'
import { randomBytes } from 'node:crypto'
import { z } from 'zod'
import type { AuthenticatedRequest } from '../middleware/auth.js'
import { requireAuth } from '../middleware/auth.js'
import { getDb } from '../db/sqlite.js'
import { logAudit } from '../services/auditLog.js'

const db = getDb()

export const csvDatasetsRouter = Router()
csvDatasetsRouter.use(requireAuth)

/**
 * CSV datasets — upload de arquivos CSV pré-parsados pelo cliente.
 * O cliente envia { name, filename, columns, rows } como JSON.
 * Backend persiste e devolve sob demanda. Limite 10MB por dataset.
 */

const MAX_BYTES = 10 * 1024 * 1024 // 10MB
const MAX_ROWS = 100_000
const MAX_COLUMNS = 200

const createSchema = z.object({
  name: z.string().min(1).max(160),
  filename: z.string().min(1).max(255),
  columns: z.array(z.string().min(1).max(120)).min(1).max(MAX_COLUMNS),
  rows: z.array(z.array(z.union([z.string(), z.number(), z.boolean(), z.null()]))).max(MAX_ROWS),
})

type CsvRow = {
  id: string
  tenant_id: string
  user_id: string
  name: string
  filename: string
  columns_json: string
  rows_json: string
  row_count: number
  size_bytes: number
  created_at: string
  updated_at: string
}

function mapSummary(row: CsvRow) {
  return {
    id: row.id,
    name: row.name,
    filename: row.filename,
    columns: parseColumns(row.columns_json),
    rowCount: row.row_count,
    sizeBytes: row.size_bytes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function parseColumns(value: string): string[] {
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : []
  } catch {
    return []
  }
}

function parseRows(value: string): unknown[][] {
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

csvDatasetsRouter.get('/', async (req, res) => {
  const authReq = req as unknown as AuthenticatedRequest
  const rows = db
    .prepare(
      `SELECT id, tenant_id, user_id, name, filename, columns_json, '[]' as rows_json, row_count, size_bytes, created_at, updated_at
       FROM csv_datasets WHERE tenant_id = ? ORDER BY created_at DESC`,
    )
    .all(authReq.tenantId) as CsvRow[]
  res.json({ datasets: rows.map(mapSummary) })
})

csvDatasetsRouter.get('/:id', async (req, res) => {
  const authReq = req as unknown as AuthenticatedRequest
  const row = db
    .prepare(`SELECT * FROM csv_datasets WHERE id = ? AND tenant_id = ?`)
    .get(req.params.id, authReq.tenantId) as CsvRow | undefined
  if (!row) return res.status(404).json({ message: 'CSV não encontrado' })
  const limit = Math.min(Number(req.query.limit ?? 1000), MAX_ROWS)
  const offset = Math.max(Number(req.query.offset ?? 0), 0)
  const allRows = parseRows(row.rows_json)
  res.json({
    ...mapSummary(row),
    rows: allRows.slice(offset, offset + limit),
    hasMore: offset + limit < allRows.length,
  })
})

csvDatasetsRouter.post('/', async (req, res) => {
  const authReq = req as unknown as AuthenticatedRequest
  const parsed = createSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'Payload inválido' })
  }
  const columnsJson = JSON.stringify(parsed.data.columns)
  const rowsJson = JSON.stringify(parsed.data.rows)
  const sizeBytes = Buffer.byteLength(rowsJson, 'utf8')
  if (sizeBytes > MAX_BYTES) {
    return res.status(413).json({ message: `Arquivo excede o limite de ${Math.round(MAX_BYTES / 1024 / 1024)}MB` })
  }

  const id = `csv_${randomBytes(6).toString('hex')}`
  const now = new Date().toISOString()
  db.prepare(
    `INSERT INTO csv_datasets (id, tenant_id, user_id, name, filename, columns_json, rows_json, row_count, size_bytes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    authReq.tenantId,
    authReq.userId,
    parsed.data.name.trim(),
    parsed.data.filename.trim(),
    columnsJson,
    rowsJson,
    parsed.data.rows.length,
    sizeBytes,
    now,
    now,
  )
  logAudit({
    userId: authReq.userId,
    tenantId: authReq.tenantId,
    action: 'csv_dataset_uploaded',
    resource: 'csv_datasets',
    metadata: { id, rowCount: parsed.data.rows.length, sizeBytes, filename: parsed.data.filename },
  })

  res.status(201).json({
    id,
    name: parsed.data.name.trim(),
    filename: parsed.data.filename.trim(),
    columns: parsed.data.columns,
    rowCount: parsed.data.rows.length,
    sizeBytes,
    createdAt: now,
    updatedAt: now,
  })
})

csvDatasetsRouter.delete('/:id', async (req, res) => {
  const authReq = req as unknown as AuthenticatedRequest
  const result = db
    .prepare(`DELETE FROM csv_datasets WHERE id = ? AND tenant_id = ?`)
    .run(req.params.id, authReq.tenantId)
  if (result.changes === 0) return res.status(404).json({ message: 'CSV não encontrado' })
  logAudit({
    userId: authReq.userId,
    tenantId: authReq.tenantId,
    action: 'csv_dataset_deleted',
    resource: 'csv_datasets',
    metadata: { id: req.params.id },
  })
  res.json({ ok: true })
})
