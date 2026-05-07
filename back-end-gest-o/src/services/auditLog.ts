/**
 * Serviço de audit log com hash chain — registra eventos de segurança e
 * detecta tampering retroativo (SEC-1.3).
 *
 * Cada row carrega:
 *   prev_hash = row_hash da row anterior (cronologica)
 *   row_hash  = SHA-256( canonical(row) )
 *
 * Editar QUALQUER row passada quebra a chain a partir dali — vide
 * `verifyAuditChain()` em routes/audit.ts.
 *
 * Atomicidade:
 *   SQLite — db.transaction() (writer serializado em WAL)
 *   Postgres — pg_advisory_xact_lock(hashtext('iga_audit_chain'))
 */
import { randomBytes } from 'node:crypto'
import { getDb } from '../db/sqlite.js'
import { getPostgresPool, hasPostgresConfig } from '../db/postgres.js'
import { computeAuditRowHash, type AuditRowForHash } from '../utils/auditChainHash.js'

const db = getDb()

const selectLastHashStmt = db.prepare(
  'SELECT row_hash FROM audit_log WHERE row_hash IS NOT NULL ORDER BY id DESC LIMIT 1',
)
const insertWithChainStmt = db.prepare(`
  INSERT INTO audit_log (id, user_id, tenant_id, action, resource, metadata_json, created_at, prev_hash, row_hash)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`)

const insertSqliteWithChain = db.transaction(
  (row: AuditRowForHash) => {
    const last = selectLastHashStmt.get() as { row_hash: string } | undefined
    const prevHash = last?.row_hash ?? ''
    const rowWithPrev: AuditRowForHash = { ...row, prev_hash: prevHash }
    const rowHash = computeAuditRowHash(rowWithPrev)
    insertWithChainStmt.run(
      row.id,
      row.user_id,
      row.tenant_id,
      row.action,
      row.resource,
      row.metadata_json,
      row.created_at,
      prevHash,
      rowHash,
    )
  },
)

function usePostgresStorage(): boolean {
  return process.env.IGA_STORAGE_DRIVER === 'postgres' && hasPostgresConfig()
}

type AuditEntry = {
  userId?: string | null
  tenantId?: string | null
  action: string
  resource: string
  metadata?: Record<string, unknown>
}

async function insertPostgresWithChain(row: AuditRowForHash): Promise<void> {
  const pool = getPostgresPool()
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    /** Lock por chave logica — serializa todas as writes do audit chain. */
    await client.query("SELECT pg_advisory_xact_lock(hashtext('iga_audit_chain'))")
    const last = await client.query<{ row_hash: string | null }>(
      'SELECT row_hash FROM audit_log WHERE row_hash IS NOT NULL ORDER BY id DESC LIMIT 1',
    )
    const prevHash = last.rows[0]?.row_hash ?? ''
    const rowWithPrev: AuditRowForHash = { ...row, prev_hash: prevHash }
    const rowHash = computeAuditRowHash(rowWithPrev)
    await client.query(
      `INSERT INTO audit_log (user_id, tenant_id, action, resource, metadata_json, created_at, prev_hash, row_hash)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [row.user_id, row.tenant_id, row.action, row.resource, row.metadata_json, row.created_at, prevHash, rowHash],
    )
    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined)
    throw err
  } finally {
    client.release()
  }
}

export function logAudit(entry: AuditEntry) {
  const id = randomBytes(8).toString('hex')
  const now = new Date().toISOString()
  const meta = entry.metadata ? JSON.stringify(entry.metadata) : null
  const row: AuditRowForHash = {
    id,
    user_id: entry.userId ?? null,
    tenant_id: entry.tenantId ?? null,
    action: entry.action,
    resource: entry.resource,
    metadata_json: meta,
    created_at: now,
    prev_hash: '', // sobrescrito dentro da transacao com o valor real
  }

  if (usePostgresStorage()) {
    void insertPostgresWithChain(row).catch(() => {
      // Audit eh best-effort: nao quebra request se DB falhar.
    })
    return
  }

  try {
    insertSqliteWithChain(row)
  } catch {
    // Best effort
  }
}
