import { randomBytes } from 'node:crypto'
import { getDb } from './db/sqlite.js'
import { hasPostgresConfig, queryPostgres } from './db/postgres.js'

export type CustomerAddress = {
  cep?: string
  street?: string
  number?: string
  neighborhood?: string
  city?: string
  state?: string
  complement?: string
}

export type CustomerRecord = {
  id: string
  tenantId: string
  name: string
  document: string | null
  email: string | null
  phone: string | null
  contactName: string | null
  address: CustomerAddress | null
  creditLimitCents: number | null
  notes: string | null
  status: 'active' | 'inactive'
  createdAt: string
  updatedAt: string
}

export type CustomerInput = Omit<CustomerRecord, 'id' | 'createdAt' | 'updatedAt'> & {
  id?: string
}

const db = getDb()

function usePostgresStorage(): boolean {
  return process.env.IGA_STORAGE_DRIVER === 'postgres' && hasPostgresConfig()
}

function genCustomerId(): string {
  return `cus_${randomBytes(8).toString('hex')}`
}

function parseAddress(value: unknown): CustomerAddress | null {
  if (!value) return null
  if (typeof value === 'object' && !Array.isArray(value)) return value as CustomerAddress
  if (typeof value !== 'string') return null
  try {
    const parsed = JSON.parse(value) as unknown
    return parsed && typeof parsed === 'object' ? (parsed as CustomerAddress) : null
  } catch {
    return null
  }
}

function mapCustomer(row: Record<string, unknown>): CustomerRecord {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    name: String(row.name),
    document: row.document ? String(row.document) : null,
    email: row.email ? String(row.email) : null,
    phone: row.phone ? String(row.phone) : null,
    contactName: row.contact_name ? String(row.contact_name) : null,
    address: parseAddress(row.address_json),
    creditLimitCents:
      row.credit_limit_cents == null ? null : Number(row.credit_limit_cents),
    notes: row.notes ? String(row.notes) : null,
    status: row.status === 'inactive' ? 'inactive' : 'active',
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }
}

export type ListCustomersOpts = {
  search?: string
  status?: 'active' | 'inactive'
  limit?: number
  offset?: number
}

export async function listCustomers(tenantId: string, opts: ListCustomersOpts = {}): Promise<{ items: CustomerRecord[]; total: number }> {
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 500)
  const offset = Math.max(opts.offset ?? 0, 0)
  const search = opts.search?.trim()
  const status = opts.status

  if (usePostgresStorage()) {
    const clauses = ['tenant_id = $1']
    const params: unknown[] = [tenantId]
    if (search) {
      params.push(`%${search.toLowerCase()}%`)
      clauses.push(`(lower(name) LIKE $${params.length} OR lower(coalesce(document, '')) LIKE $${params.length} OR lower(coalesce(email, '')) LIKE $${params.length})`)
    }
    if (status) {
      params.push(status)
      clauses.push(`status = $${params.length}`)
    }
    const where = `WHERE ${clauses.join(' AND ')}`
    const totalResult = await queryPostgres(`SELECT COUNT(*)::text AS t FROM customers ${where}`, params)
    const total = Number((totalResult.rows[0] as { t: string })?.t ?? 0)
    params.push(limit, offset)
    const result = await queryPostgres(
      `SELECT * FROM customers ${where} ORDER BY name ASC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    )
    return { items: result.rows.map((row) => mapCustomer(row as Record<string, unknown>)), total }
  }

  const clauses = ['tenant_id = ?']
  const params: unknown[] = [tenantId]
  if (search) {
    const term = `%${search.toLowerCase()}%`
    clauses.push("(lower(name) LIKE ? OR lower(coalesce(document, '')) LIKE ? OR lower(coalesce(email, '')) LIKE ?)")
    params.push(term, term, term)
  }
  if (status) {
    clauses.push('status = ?')
    params.push(status)
  }
  const where = `WHERE ${clauses.join(' AND ')}`
  const totalRow = db.prepare(`SELECT COUNT(*) AS t FROM customers ${where}`).get(...params) as { t: number } | undefined
  const total = Number(totalRow?.t ?? 0)
  const rows = db
    .prepare(`SELECT * FROM customers ${where} ORDER BY name COLLATE NOCASE LIMIT ? OFFSET ?`)
    .all(...params, limit, offset) as Record<string, unknown>[]
  return { items: rows.map(mapCustomer), total }
}

export async function findCustomerById(tenantId: string, id: string): Promise<CustomerRecord | null> {
  if (usePostgresStorage()) {
    const result = await queryPostgres('SELECT * FROM customers WHERE tenant_id = $1 AND id = $2', [tenantId, id])
    const row = result.rows[0] as Record<string, unknown> | undefined
    return row ? mapCustomer(row) : null
  }
  const row = db
    .prepare('SELECT * FROM customers WHERE tenant_id = ? AND id = ?')
    .get(tenantId, id) as Record<string, unknown> | undefined
  return row ? mapCustomer(row) : null
}

export async function createCustomer(tenantId: string, input: CustomerInput): Promise<CustomerRecord> {
  const now = new Date().toISOString()
  const record: CustomerRecord = {
    id: input.id ?? genCustomerId(),
    tenantId,
    name: input.name.trim(),
    document: input.document?.trim() || null,
    email: input.email?.trim().toLowerCase() || null,
    phone: input.phone?.trim() || null,
    contactName: input.contactName?.trim() || null,
    address: input.address ?? null,
    creditLimitCents: input.creditLimitCents ?? null,
    notes: input.notes?.trim() || null,
    status: input.status ?? 'active',
    createdAt: now,
    updatedAt: now,
  }
  if (usePostgresStorage()) {
    await queryPostgres(
      `INSERT INTO customers (id, tenant_id, name, document, email, phone, contact_name, address_json, credit_limit_cents, notes, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11, $12, $13)`,
      [
        record.id,
        record.tenantId,
        record.name,
        record.document,
        record.email,
        record.phone,
        record.contactName,
        record.address ? JSON.stringify(record.address) : null,
        record.creditLimitCents,
        record.notes,
        record.status,
        record.createdAt,
        record.updatedAt,
      ],
    )
    return record
  }
  db.prepare(
    `INSERT INTO customers (id, tenant_id, name, document, email, phone, contact_name, address_json, credit_limit_cents, notes, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    record.id,
    record.tenantId,
    record.name,
    record.document,
    record.email,
    record.phone,
    record.contactName,
    record.address ? JSON.stringify(record.address) : null,
    record.creditLimitCents,
    record.notes,
    record.status,
    record.createdAt,
    record.updatedAt,
  )
  return record
}

export async function updateCustomer(
  tenantId: string,
  id: string,
  patch: Partial<Omit<CustomerInput, 'id'>>,
): Promise<CustomerRecord | null> {
  const existing = await findCustomerById(tenantId, id)
  if (!existing) return null
  const updated: CustomerRecord = {
    ...existing,
    ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
    ...(patch.document !== undefined ? { document: patch.document?.trim() || null } : {}),
    ...(patch.email !== undefined ? { email: patch.email?.trim().toLowerCase() || null } : {}),
    ...(patch.phone !== undefined ? { phone: patch.phone?.trim() || null } : {}),
    ...(patch.contactName !== undefined ? { contactName: patch.contactName?.trim() || null } : {}),
    ...(patch.address !== undefined ? { address: patch.address } : {}),
    ...(patch.creditLimitCents !== undefined ? { creditLimitCents: patch.creditLimitCents } : {}),
    ...(patch.notes !== undefined ? { notes: patch.notes?.trim() || null } : {}),
    ...(patch.status !== undefined ? { status: patch.status } : {}),
    updatedAt: new Date().toISOString(),
  }
  if (usePostgresStorage()) {
    await queryPostgres(
      `UPDATE customers
       SET name = $1, document = $2, email = $3, phone = $4, contact_name = $5,
           address_json = $6::jsonb, credit_limit_cents = $7, notes = $8, status = $9,
           updated_at = $10
       WHERE tenant_id = $11 AND id = $12`,
      [
        updated.name,
        updated.document,
        updated.email,
        updated.phone,
        updated.contactName,
        updated.address ? JSON.stringify(updated.address) : null,
        updated.creditLimitCents,
        updated.notes,
        updated.status,
        updated.updatedAt,
        tenantId,
        id,
      ],
    )
    return updated
  }
  db.prepare(
    `UPDATE customers
     SET name = ?, document = ?, email = ?, phone = ?, contact_name = ?,
         address_json = ?, credit_limit_cents = ?, notes = ?, status = ?,
         updated_at = ?
     WHERE tenant_id = ? AND id = ?`,
  ).run(
    updated.name,
    updated.document,
    updated.email,
    updated.phone,
    updated.contactName,
    updated.address ? JSON.stringify(updated.address) : null,
    updated.creditLimitCents,
    updated.notes,
    updated.status,
    updated.updatedAt,
    tenantId,
    id,
  )
  return updated
}

export async function deleteCustomer(tenantId: string, id: string): Promise<boolean> {
  if (usePostgresStorage()) {
    const result = await queryPostgres('DELETE FROM customers WHERE tenant_id = $1 AND id = $2', [tenantId, id])
    return Boolean(result.rowCount && result.rowCount > 0)
  }
  const result = db.prepare('DELETE FROM customers WHERE tenant_id = ? AND id = ?').run(tenantId, id)
  return result.changes > 0
}
