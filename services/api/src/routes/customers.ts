import { Router, type Response } from 'express'
import { z } from 'zod'
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth.js'
import { logAudit } from '../services/auditLog.js'
import {
  createCustomer,
  deleteCustomer,
  findCustomerById,
  listCustomers,
  updateCustomer,
  type CustomerRecord,
} from '../customerStorage.js'
import { readAll as readAllDataSources } from '../storage.js'
import { fetchProxyDataForTool } from './proxy.js'

/** Heurística mínima para identificar endpoint de vendas (espelha tools.ts). */
function isSalesEndpoint(ep: string | undefined): boolean {
  if (!ep) return false
  const p = ep.toLowerCase()
  return p.includes('/vendas/analitico') || p.includes('/vendanfe') || p.includes('vendas')
}

function pickStringField(row: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = row[k] ?? row[k.toLowerCase()] ?? row[k.toUpperCase()]
    if (typeof v === 'string' && v.trim()) return v.trim()
    if (typeof v === 'number' && Number.isFinite(v)) return String(v)
  }
  return ''
}

function pickNumberField(row: Record<string, unknown>, keys: string[]): number {
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

function fmtSgbrDate(d: Date): string {
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

export const customersRouter = Router()
customersRouter.use(requireAuth)

const addressSchema = z.object({
  cep: z.string().max(20).optional(),
  street: z.string().max(160).optional(),
  number: z.string().max(20).optional(),
  neighborhood: z.string().max(120).optional(),
  city: z.string().max(120).optional(),
  state: z.string().max(40).optional(),
  complement: z.string().max(160).optional(),
}).strict().nullable()

const createSchema = z.object({
  name: z.string().min(1).max(160),
  document: z.string().max(40).optional().nullable(),
  email: z.string().email().max(254).optional().nullable(),
  phone: z.string().max(40).optional().nullable(),
  contactName: z.string().max(160).optional().nullable(),
  address: addressSchema.optional(),
  creditLimitCents: z.number().int().nonnegative().max(10_000_000_000).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  status: z.enum(['active', 'inactive']).optional(),
})

const updateSchema = createSchema.partial()

const listQuerySchema = z.object({
  search: z.string().max(160).optional(),
  status: z.enum(['active', 'inactive']).optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
  offset: z.coerce.number().int().min(0).optional(),
})

function sanitize(c: CustomerRecord) {
  return {
    id: c.id,
    name: c.name,
    document: c.document,
    email: c.email,
    phone: c.phone,
    contactName: c.contactName,
    address: c.address,
    creditLimitCents: c.creditLimitCents,
    notes: c.notes,
    status: c.status,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  }
}

customersRouter.get('/', async (req, res: Response) => {
  const authReq = req as unknown as AuthenticatedRequest
  const parsed = listQuerySchema.safeParse(req.query)
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'Filtros inválidos' })
  }
  const result = await listCustomers(authReq.tenantId, parsed.data)
  res.json({ items: result.items.map(sanitize), total: result.total })
})

customersRouter.get('/:id', async (req, res: Response) => {
  const authReq = req as unknown as AuthenticatedRequest
  const customer = await findCustomerById(authReq.tenantId, req.params.id)
  if (!customer) return res.status(404).json({ message: 'Cliente não encontrado' })
  res.json(sanitize(customer))
})

customersRouter.post('/', async (req, res: Response) => {
  const authReq = req as unknown as AuthenticatedRequest
  const parsed = createSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'Dados inválidos' })
  }
  try {
    const created = await createCustomer(authReq.tenantId, {
      ...parsed.data,
      address: parsed.data.address ?? null,
      tenantId: authReq.tenantId,
    } as Parameters<typeof createCustomer>[1])
    logAudit({
      userId: authReq.userId,
      tenantId: authReq.tenantId,
      action: 'customer_created',
      resource: 'customers',
      metadata: { customerId: created.id },
    })
    res.status(201).json(sanitize(created))
  } catch (err) {
    /** SQLite/Postgres unique constraint dispara aqui — converter pra 409 amigável. */
    const msg = (err as Error).message ?? ''
    if (msg.toLowerCase().includes('unique') || msg.toLowerCase().includes('duplic')) {
      return res.status(409).json({ message: 'Já existe cliente com este documento ou email neste tenant.' })
    }
    throw err
  }
})

customersRouter.put('/:id', async (req, res: Response) => {
  const authReq = req as unknown as AuthenticatedRequest
  const parsed = updateSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'Dados inválidos' })
  }
  try {
    const updated = await updateCustomer(authReq.tenantId, req.params.id, {
      ...parsed.data,
      address: parsed.data.address === undefined ? undefined : parsed.data.address,
    })
    if (!updated) return res.status(404).json({ message: 'Cliente não encontrado' })
    logAudit({
      userId: authReq.userId,
      tenantId: authReq.tenantId,
      action: 'customer_updated',
      resource: 'customers',
      metadata: { customerId: updated.id },
    })
    res.json(sanitize(updated))
  } catch (err) {
    const msg = (err as Error).message ?? ''
    if (msg.toLowerCase().includes('unique') || msg.toLowerCase().includes('duplic')) {
      return res.status(409).json({ message: 'Já existe cliente com este documento ou email neste tenant.' })
    }
    throw err
  }
})

customersRouter.delete('/:id', async (req, res: Response) => {
  const authReq = req as unknown as AuthenticatedRequest
  const customer = await findCustomerById(authReq.tenantId, req.params.id)
  if (!customer) return res.status(404).json({ message: 'Cliente não encontrado' })
  await deleteCustomer(authReq.tenantId, req.params.id)
  logAudit({
    userId: authReq.userId,
    tenantId: authReq.tenantId,
    action: 'customer_deleted',
    resource: 'customers',
    metadata: { customerId: req.params.id },
  })
  res.json({ ok: true })
})

/**
 * Segmentação A/B/C calculada em tempo real a partir de vendas dos últimos 12
 * meses. NÃO armazenamos em DB (muda toda hora). Critério clássico:
 *   A = top 20% de receita acumulada
 *   B = próximos 30%
 *   C = bottom 50%
 *
 * Junta com cadastro de clientes para enriquecer (clientes sem vendas
 * recentes ficam como "sem-classificacao", clientes com vendas mas sem
 * cadastro vão como "uncadastered" para o frontend sugerir importação).
 */
customersRouter.get('/segmentation/abc', async (req, res: Response) => {
  const authReq = req as unknown as AuthenticatedRequest
  const months = Math.min(Math.max(Number(req.query.months) || 12, 1), 36)
  const dtAteDate = new Date()
  const dtDeDate = new Date(dtAteDate)
  dtDeDate.setMonth(dtDeDate.getMonth() - months)
  const dtDe = fmtSgbrDate(dtDeDate)
  const dtAte = fmtSgbrDate(dtAteDate)

  /** Carrega vendas em paralelo de todas as fontes compatíveis do tenant. */
  const allSources = readAllDataSources().filter(
    (d) => d.tenantId === authReq.tenantId && isSalesEndpoint(d.dataEndpoint),
  )
  const byCustomer = new Map<string, number>()
  await Promise.all(
    allSources.map(async (s) => {
      try {
        const r = await fetchProxyDataForTool({
          tenantId: authReq.tenantId,
          dsId: s.id,
          query: { dt_de: dtDe, dt_ate: dtAte, requireDsId: '1' },
        })
        if (!r.ok) return
        for (const raw of r.rows) {
          if (!raw || typeof raw !== 'object') continue
          const row = raw as Record<string, unknown>
          const cliente = pickStringField(row, ['cliente', 'nomecliente', 'nome_cliente', 'razaosocial', 'fantasia'])
          if (!cliente) continue
          const total = pickNumberField(row, ['total', 'valor_total', 'vl_total', 'totalliquido', 'valor'])
          const key = cliente.toLowerCase()
          byCustomer.set(key, (byCustomer.get(key) ?? 0) + total)
        }
      } catch {
        /** Falha em uma fonte não derruba a segmentação — agregamos as que vierem. */
      }
    }),
  )

  const sorted = [...byCustomer.entries()].sort((a, b) => b[1] - a[1])
  const totalRevenue = sorted.reduce((sum, [, v]) => sum + v, 0)
  let cumulative = 0
  const segments: Array<{ customerKey: string; revenue: number; cumulativePct: number; segment: 'A' | 'B' | 'C' }> = []
  for (const [key, revenue] of sorted) {
    cumulative += revenue
    const pct = totalRevenue > 0 ? cumulative / totalRevenue : 0
    let segment: 'A' | 'B' | 'C'
    if (pct <= 0.2) segment = 'A'
    else if (pct <= 0.5) segment = 'B'
    else segment = 'C'
    segments.push({ customerKey: key, revenue, cumulativePct: pct, segment })
  }

  /** Cruza com cadastro: marca quais clientes têm cadastro completo. */
  const registered = await listCustomers(authReq.tenantId, { limit: 500 })
  const registeredByName = new Map(registered.items.map((c) => [c.name.trim().toLowerCase(), c]))
  const enriched = segments.map((s) => ({
    ...s,
    customerName: s.customerKey,
    registeredCustomer: registeredByName.get(s.customerKey)
      ? { id: registeredByName.get(s.customerKey)!.id, name: registeredByName.get(s.customerKey)!.name }
      : null,
  }))

  res.json({
    months,
    totalRevenue: Math.round(totalRevenue * 100) / 100,
    counts: {
      A: enriched.filter((s) => s.segment === 'A').length,
      B: enriched.filter((s) => s.segment === 'B').length,
      C: enriched.filter((s) => s.segment === 'C').length,
      unregistered: enriched.filter((s) => !s.registeredCustomer).length,
    },
    items: enriched,
  })
})
