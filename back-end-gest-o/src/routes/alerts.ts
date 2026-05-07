import { Router } from 'express'
import { randomBytes } from 'node:crypto'
import type { AuthenticatedRequest } from '../middleware/auth.js'
import { requireAuth } from '../middleware/auth.js'
import { getDb } from '../db/sqlite.js'
import { getPostgresPool, hasPostgresConfig } from '../db/postgres.js'
import { readAll } from '../storage.js'
import { resolveTenantId } from '../utils/tenant.js'

export const alertsRouter = Router()
alertsRouter.use(requireAuth)

type AlertLevel = 'info' | 'warning' | 'error'
type LiveClient = {
  tenantId: string
  send: (payload: unknown) => void
}

const clients = new Set<LiveClient>()
const db = getDb()

function usePostgresStorage(): boolean {
  return process.env.IGA_STORAGE_DRIVER === 'postgres' && hasPostgresConfig()
}

function pushAlert(tenantId: string, type: string, severity: AlertLevel, title: string, message: string) {
  const id = `alrt_${randomBytes(5).toString('hex')}`
  const createdAt = new Date().toISOString()
  if (usePostgresStorage()) {
    void getPostgresPool()
      .query(
        `INSERT INTO alerts (id, tenant_id, type, severity, title, message, created_at, read_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NULL)`,
        [id, tenantId, type, severity, title, message, createdAt],
      )
      .catch(() => { /* best-effort */ })
  } else {
    db.prepare(`
      INSERT INTO alerts (id, tenant_id, type, severity, title, message, created_at, read_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, NULL)
    `).run(id, tenantId, type, severity, title, message, createdAt)
  }
  const payload = { id, tenantId, type, severity, title, message, createdAt, readAt: null }
  for (const client of clients) {
    if (client.tenantId === tenantId) client.send(payload)
  }
}

async function listAlertsForTenant(tenantId: string): Promise<Record<string, unknown>[]> {
  if (usePostgresStorage()) {
    const result = await getPostgresPool().query(
      'SELECT * FROM alerts WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 100',
      [tenantId],
    )
    return result.rows as Record<string, unknown>[]
  }
  return db
    .prepare('SELECT * FROM alerts WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 100')
    .all(tenantId) as Record<string, unknown>[]
}

async function markAlertRead(id: string, tenantId: string) {
  const now = new Date().toISOString()
  if (usePostgresStorage()) {
    await getPostgresPool().query(
      'UPDATE alerts SET read_at = $1 WHERE id = $2 AND tenant_id = $3',
      [now, id, tenantId],
    )
    return
  }
  db.prepare('UPDATE alerts SET read_at = ? WHERE id = ? AND tenant_id = ?').run(now, id, tenantId)
}

async function countUnreadForTenant(tenantId: string): Promise<number> {
  if (usePostgresStorage()) {
    const result = await getPostgresPool().query<{ total: string }>(
      'SELECT COUNT(*)::text AS total FROM alerts WHERE tenant_id = $1 AND read_at IS NULL',
      [tenantId],
    )
    return Number(result.rows[0]?.total ?? 0)
  }
  return Number(
    (
      db.prepare('SELECT COUNT(*) AS total FROM alerts WHERE tenant_id = ? AND read_at IS NULL').get(tenantId) as {
        total: number
      }
    ).total ?? 0,
  )
}

function mapRow(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    type: String(row.type),
    severity: String(row.severity),
    title: String(row.title),
    message: String(row.message),
    createdAt: String(row.created_at),
    readAt: row.read_at ? String(row.read_at) : null,
  }
}

alertsRouter.get('/', async (req, res) => {
  const tenantId = resolveTenantId(req)
  let rows = await listAlertsForTenant(tenantId)
  if (rows.length === 0) {
    pushAlert(
      tenantId,
      'system_status',
      'info',
      'Monitoramento ativo',
      'Sem alertas criticos no momento. O acompanhamento do sistema esta ativo.',
    )
    rows = await listAlertsForTenant(tenantId)
  }
  res.json(rows.map(mapRow))
})

alertsRouter.post('/:id/read', async (req, res) => {
  const tenantId = resolveTenantId(req)
  await markAlertRead(req.params.id, tenantId)
  res.json({ ok: true })
})

alertsRouter.get('/stream', (req, res) => {
  const tenantId = resolveTenantId(req)
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  const send = (payload: unknown) => {
    res.write('event: alert\n')
    res.write(`data: ${JSON.stringify(payload)}\n\n`)
  }
  const heartbeat = setInterval(() => {
    res.write('event: ping\ndata: {}\n\n')
  }, 25_000)

  const client: LiveClient = { tenantId, send }
  clients.add(client)
  req.on('close', () => {
    clearInterval(heartbeat)
    clients.delete(client)
  })
})

let alertsEngineTimer: NodeJS.Timeout | null = null

export async function runAlertsEngineOnce() {
  const all = readAll()
  const checkedTenants = new Set<string>()
  for (const ds of all) {
    checkedTenants.add(ds.tenantId)
    if (ds.status === 'error' || ds.lastError) {
      pushAlert(
        ds.tenantId,
        'proxy_error',
        'error',
        'Falha em fonte de dados',
        `${ds.name}: ${ds.lastError ?? 'erro de conexao'}`,
      )
    }
  }
  for (const tenantId of checkedTenants) {
    const unread = await countUnreadForTenant(tenantId)
    if (unread > 12) {
      pushAlert(
        tenantId,
        'alert_volume',
        'warning',
        'Muitos alertas nao lidos',
        `Existem ${unread} alertas pendentes de leitura.`,
      )
    }
  }
}

export function startAlertsEngine() {
  if (alertsEngineTimer) return
  alertsEngineTimer = setInterval(() => {
    void runAlertsEngineOnce()
  }, 5 * 60_000)
}

export function createSystemAlert(
  tenantId: string,
  type: string,
  severity: AlertLevel,
  title: string,
  message: string,
) {
  pushAlert(tenantId, type, severity, title, message)
}
