import { Router } from 'express'
import { randomBytes } from 'node:crypto'
import { z } from 'zod'
import type { AuthenticatedRequest } from '../middleware/auth.js'
import { requireAuth } from '../middleware/auth.js'
import { getDb } from '../db/sqlite.js'
import { getPostgresPool, hasPostgresConfig } from '../db/postgres.js'

const db = getDb()
export const scheduledReportsRouter = Router()
scheduledReportsRouter.use(requireAuth)

function usePostgresStorage(): boolean {
  return process.env.IGA_STORAGE_DRIVER === 'postgres' && hasPostgresConfig()
}

const schema = z.object({
  name: z.string().min(1).max(120),
  reportType: z.string().min(1).max(80),
  frequency: z.enum(['daily', 'weekly', 'monthly']),
  cronExpr: z.string().min(5).max(120),
  recipients: z.array(z.string().email()).min(1).max(30),
  format: z.enum(['pdf', 'excel']),
  active: z.boolean().optional(),
})

function mapRow(r: Record<string, unknown>) {
  return {
    id: String(r.id),
    name: String(r.name),
    reportType: String(r.report_type),
    frequency: String(r.frequency),
    cronExpr: String(r.cron_expr),
    recipients: typeof r.recipients_json === 'string'
      ? (JSON.parse(r.recipients_json) as string[])
      : Array.isArray(r.recipients_json)
        ? (r.recipients_json as string[])
        : [],
    format: String(r.format),
    active: r.active === true || Number(r.active ?? 0) === 1,
    lastSentAt: r.last_sent_at ? String(r.last_sent_at) : null,
  }
}

scheduledReportsRouter.get('/', async (req, res) => {
  const authReq = req as unknown as AuthenticatedRequest
  let rows: Record<string, unknown>[]
  if (usePostgresStorage()) {
    const result = await getPostgresPool().query(
      'SELECT * FROM scheduled_reports WHERE user_id = $1 ORDER BY updated_at DESC',
      [authReq.userId],
    )
    rows = result.rows as Record<string, unknown>[]
  } else {
    rows = db
      .prepare('SELECT * FROM scheduled_reports WHERE user_id = ? ORDER BY updated_at DESC')
      .all(authReq.userId) as Record<string, unknown>[]
  }
  res.json(rows.map(mapRow))
})

scheduledReportsRouter.post('/', async (req, res) => {
  const authReq = req as unknown as AuthenticatedRequest
  const parsed = schema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'Payload inválido' })
  }
  const now = new Date().toISOString()
  const id = `sch_${randomBytes(5).toString('hex')}`
  const active = parsed.data.active !== false

  if (usePostgresStorage()) {
    await getPostgresPool().query(
      `INSERT INTO scheduled_reports (
         id, user_id, name, report_type, frequency, cron_expr, recipients_json, format, active, last_sent_at, created_at, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NULL, $10, $11)`,
      [
        id,
        authReq.userId,
        parsed.data.name,
        parsed.data.reportType,
        parsed.data.frequency,
        parsed.data.cronExpr,
        JSON.stringify(parsed.data.recipients),
        parsed.data.format,
        active,
        now,
        now,
      ],
    )
  } else {
    db.prepare(`
      INSERT INTO scheduled_reports (
        id, user_id, name, report_type, frequency, cron_expr, recipients_json, format, active, last_sent_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)
    `).run(
      id,
      authReq.userId,
      parsed.data.name,
      parsed.data.reportType,
      parsed.data.frequency,
      parsed.data.cronExpr,
      JSON.stringify(parsed.data.recipients),
      parsed.data.format,
      active ? 1 : 0,
      now,
      now,
    )
  }

  res.status(201).json({ id, ...parsed.data, active })
})

scheduledReportsRouter.delete('/:id', async (req, res) => {
  const authReq = req as unknown as AuthenticatedRequest
  if (usePostgresStorage()) {
    await getPostgresPool().query(
      'DELETE FROM scheduled_reports WHERE id = $1 AND user_id = $2',
      [req.params.id, authReq.userId],
    )
  } else {
    db.prepare('DELETE FROM scheduled_reports WHERE id = ? AND user_id = ?').run(req.params.id, authReq.userId)
  }
  res.json({ ok: true })
})
