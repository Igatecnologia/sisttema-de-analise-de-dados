import { Router } from 'express'
import { randomBytes } from 'node:crypto'
import { z } from 'zod'
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth.js'
import { logAudit } from '../services/auditLog.js'
import { getDb } from '../db/sqlite.js'
import { hasPostgresConfig, queryPostgres } from '../db/postgres.js'
import { fetchProxyDataForTool } from './proxy.js'
import { findTenantBySlug } from '../tenantStorage.js'
import { ConnectorRegistry } from '../connectors/connectorRegistry.js'
import { findDsIdForAreaAsync } from '../connectors/findDsIdForArea.js'

export const productionRouter = Router()
productionRouter.use(requireAuth)

const db = getDb()

function usePostgresStorage(): boolean {
  return process.env.IGA_STORAGE_DRIVER === 'postgres' && hasPostgresConfig()
}

type ProductionTarget = {
  id: string
  tenantId: string
  sku: string | null
  targetType: 'daily' | 'weekly' | 'monthly'
  targetValue: number
  unit: string
  validFrom: string
  validTo: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
}

function mapTarget(row: Record<string, unknown>): ProductionTarget {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    sku: row.sku ? String(row.sku) : null,
    targetType: (row.target_type === 'daily' || row.target_type === 'weekly') ? row.target_type : 'monthly',
    targetValue: Number(row.target_value),
    unit: String(row.unit),
    validFrom: String(row.valid_from).slice(0, 10),
    validTo: row.valid_to ? String(row.valid_to).slice(0, 10) : null,
    notes: row.notes ? String(row.notes) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }
}

const targetSchema = z.object({
  sku: z.string().min(1).max(120).nullable().optional(),
  targetType: z.enum(['daily', 'weekly', 'monthly']).default('monthly'),
  targetValue: z.number().positive(),
  unit: z.string().max(20).default('un'),
  validFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'validFrom deve ser YYYY-MM-DD'),
  validTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
})

productionRouter.get('/targets', async (req, res) => {
  const authReq = req as unknown as AuthenticatedRequest
  if (usePostgresStorage()) {
    const result = await queryPostgres(
      'SELECT * FROM production_targets WHERE tenant_id = $1 ORDER BY valid_from DESC LIMIT 200',
      [authReq.tenantId],
    )
    return res.json(result.rows.map((r) => mapTarget(r as Record<string, unknown>)))
  }
  const rows = db
    .prepare('SELECT * FROM production_targets WHERE tenant_id = ? ORDER BY valid_from DESC LIMIT 200')
    .all(authReq.tenantId) as Record<string, unknown>[]
  res.json(rows.map(mapTarget))
})

productionRouter.post('/targets', async (req, res) => {
  const authReq = req as unknown as AuthenticatedRequest
  const parsed = targetSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'Dados inválidos' })
  }
  const id = `pt_${randomBytes(8).toString('hex')}`
  const now = new Date().toISOString()
  const target: ProductionTarget = {
    id,
    tenantId: authReq.tenantId,
    sku: parsed.data.sku ?? null,
    targetType: parsed.data.targetType,
    targetValue: parsed.data.targetValue,
    unit: parsed.data.unit,
    validFrom: parsed.data.validFrom,
    validTo: parsed.data.validTo ?? null,
    notes: parsed.data.notes ?? null,
    createdAt: now,
    updatedAt: now,
  }
  if (usePostgresStorage()) {
    await queryPostgres(
      `INSERT INTO production_targets (id, tenant_id, sku, target_type, target_value, unit, valid_from, valid_to, notes, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [target.id, target.tenantId, target.sku, target.targetType, target.targetValue, target.unit, target.validFrom, target.validTo, target.notes, target.createdAt, target.updatedAt],
    )
  } else {
    db.prepare(
      `INSERT INTO production_targets (id, tenant_id, sku, target_type, target_value, unit, valid_from, valid_to, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(target.id, target.tenantId, target.sku, target.targetType, target.targetValue, target.unit, target.validFrom, target.validTo, target.notes, target.createdAt, target.updatedAt)
  }
  logAudit({ userId: authReq.userId, tenantId: authReq.tenantId, action: 'production_target_created', resource: 'production', metadata: { targetId: id } })
  res.status(201).json(target)
})

productionRouter.delete('/targets/:id', async (req, res) => {
  const authReq = req as unknown as AuthenticatedRequest
  if (usePostgresStorage()) {
    await queryPostgres('DELETE FROM production_targets WHERE tenant_id = $1 AND id = $2', [authReq.tenantId, req.params.id])
  } else {
    db.prepare('DELETE FROM production_targets WHERE tenant_id = ? AND id = ?').run(authReq.tenantId, req.params.id)
  }
  logAudit({ userId: authReq.userId, tenantId: authReq.tenantId, action: 'production_target_deleted', resource: 'production', metadata: { targetId: req.params.id } })
  res.json({ ok: true })
})

function pickNumber(row: Record<string, unknown>, keys: string[]): number {
  for (const k of keys) {
    const v = row[k] ?? row[k.toLowerCase()] ?? row[k.toUpperCase()]
    if (typeof v === 'number' && Number.isFinite(v)) return v
    if (typeof v === 'string') {
      const n = Number(v.replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.'))
      if (Number.isFinite(n)) return n
    }
  }
  return 0
}

function pickString(row: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = row[k] ?? row[k.toLowerCase()] ?? row[k.toUpperCase()]
    if (typeof v === 'string' && v.trim()) return v.trim()
    if (typeof v === 'number' && Number.isFinite(v)) return String(v)
  }
  return ''
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

function fmtSgbrDate(d: Date): string {
  return `${d.getFullYear()}.${pad2(d.getMonth() + 1)}.${pad2(d.getDate())}`
}

/**
 * GET /production/oee?period=daily|weekly|monthly
 *
 * IMPORTANTE: ERPs SMB raramente fornecem dados de Disponibilidade (paradas)
 * e Qualidade (defeitos). Por isso entregamos APENAS o componente de
 * Performance (= produzido / meta). Quando o tenant configurar fontes
 * com paradas/defeitos no futuro (INT-2 ou módulo IoT F8), expandimos
 * para OEE completo. Por hora documentamos como "Performance score".
 *
 * Para o tenant ter targets cadastrados, basta um único row sem sku
 * (NULL) — vira meta agregada do plant. Targets por sku sobrepõem.
 */
productionRouter.get('/oee', async (req, res) => {
  const authReq = req as unknown as AuthenticatedRequest
  const period = (typeof req.query.period === 'string' && ['daily', 'weekly', 'monthly'].includes(req.query.period))
    ? (req.query.period as 'daily' | 'weekly' | 'monthly')
    : 'monthly'

  const tenant = await findTenantBySlug(authReq.tenantId)
  const connector = ConnectorRegistry.get(tenant?.connectorId)
  const dsId = await findDsIdForAreaAsync(authReq.tenantId, 'produzido', connector)
  if (!dsId) {
    return res.json({ ok: false, reason: 'no_production_source', period, message: 'Nenhuma fonte de produção configurada.' })
  }

  /** Janela do período. */
  const today = new Date()
  let start: Date
  if (period === 'daily') {
    start = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  } else if (period === 'weekly') {
    const monday = new Date(today)
    const day = monday.getDay()
    const diffToMonday = day === 0 ? -6 : 1 - day
    monday.setDate(monday.getDate() + diffToMonday)
    monday.setHours(0, 0, 0, 0)
    start = monday
  } else {
    start = new Date(today.getFullYear(), today.getMonth(), 1)
  }

  const result = await fetchProxyDataForTool({
    tenantId: authReq.tenantId,
    dsId,
    query: { dt_de: fmtSgbrDate(start), dt_ate: fmtSgbrDate(today), requireDsId: '1' },
  })
  if (!result.ok) {
    return res.json({ ok: false, reason: 'production_fetch_failed', period })
  }

  /** Agrega por SKU. */
  const producedBySku = new Map<string, { produced: number; name: string }>()
  let totalProduced = 0
  for (const raw of result.rows) {
    if (!raw || typeof raw !== 'object') continue
    const row = raw as Record<string, unknown>
    const sku = pickString(row, ['codprod', 'codigo', 'cod', 'sku', 'controle']) || '_total'
    const name = pickString(row, ['produto', 'descricao', 'descprod', 'nomeproduto']) || sku
    const qtd = pickNumber(row, ['quantidade', 'qtd', 'qtde', 'qtdeproduzida', 'qtde_produzida', 'producao'])
    if (qtd <= 0) continue
    const cur = producedBySku.get(sku) ?? { produced: 0, name }
    cur.produced += qtd
    producedBySku.set(sku, cur)
    totalProduced += qtd
  }

  /** Carrega targets. */
  const targets: ProductionTarget[] = usePostgresStorage()
    ? await (async () => {
    const r = await queryPostgres(
      `SELECT * FROM production_targets
       WHERE tenant_id = $1 AND target_type = $2
         AND valid_from <= CURRENT_DATE AND (valid_to IS NULL OR valid_to >= CURRENT_DATE)`,
      [authReq.tenantId, period],
    )
    return r.rows.map((row) => mapTarget(row as Record<string, unknown>))
  })()
    : (() => {
    const todayIso = new Date().toISOString().slice(0, 10)
    const rows = db
      .prepare(
        `SELECT * FROM production_targets
         WHERE tenant_id = ? AND target_type = ?
           AND valid_from <= ? AND (valid_to IS NULL OR valid_to >= ?)`,
      )
      .all(authReq.tenantId, period, todayIso, todayIso) as Record<string, unknown>[]
    return rows.map(mapTarget)
  })()

  const aggregateTarget = targets.find((t) => t.sku == null)
  const targetsBySku = new Map(targets.filter((t) => t.sku != null).map((t) => [t.sku!, t]))

  const items = [...producedBySku.entries()].map(([sku, info]) => {
    const target = targetsBySku.get(sku)
    const performance = target ? Math.min((info.produced / target.targetValue) * 100, 200) : null
    let status: 'sem-meta' | 'critico' | 'atencao' | 'ok' | 'acima'
    if (performance == null) status = 'sem-meta'
    else if (performance < 70) status = 'critico'
    else if (performance < 90) status = 'atencao'
    else if (performance > 110) status = 'acima'
    else status = 'ok'
    return {
      sku,
      name: info.name,
      produced: Math.round(info.produced * 100) / 100,
      target: target?.targetValue ?? null,
      unit: target?.unit ?? 'un',
      performancePct: performance == null ? null : Math.round(performance * 10) / 10,
      status,
    }
  }).sort((a, b) => {
    /** Críticos primeiro, depois por % desc, depois por produzido desc. */
    const order = { critico: 0, atencao: 1, ok: 2, acima: 3, 'sem-meta': 4 } as const
    if (a.status !== b.status) return order[a.status] - order[b.status]
    return b.produced - a.produced
  })

  const aggregatePerformance = aggregateTarget
    ? Math.min((totalProduced / aggregateTarget.targetValue) * 100, 200)
    : null

  res.json({
    ok: true,
    period,
    periodLabel: period === 'daily' ? 'Hoje' : period === 'weekly' ? 'Semana corrente' : 'Mês corrente',
    totalProduced: Math.round(totalProduced * 100) / 100,
    aggregateTarget: aggregateTarget
      ? {
          value: aggregateTarget.targetValue,
          unit: aggregateTarget.unit,
          performancePct: aggregatePerformance == null ? null : Math.round(aggregatePerformance * 10) / 10,
        }
      : null,
    items,
    counts: {
      withTarget: items.filter((i) => i.status !== 'sem-meta').length,
      withoutTarget: items.filter((i) => i.status === 'sem-meta').length,
      critical: items.filter((i) => i.status === 'critico').length,
    },
    note: 'OEE simplificado = apenas componente de Performance (produzido/meta). Disponibilidade e Qualidade exigem fontes adicionais — IGA-IA F8 IoT cobrirá futuro.',
  })
})
