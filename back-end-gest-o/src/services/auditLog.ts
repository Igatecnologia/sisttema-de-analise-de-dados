/**
 * Serviço de audit log — registra eventos de segurança na tabela audit_log.
 * Nunca loga dados sensíveis (senhas, tokens, credenciais).
 *
 * Adapter incremental: usa PostgreSQL quando IGA_STORAGE_DRIVER=postgres,
 * caso contrário cai para SQLite (dev local).
 */
import { randomBytes } from 'node:crypto'
import { getDb } from '../db/sqlite.js'
import { getPostgresPool, hasPostgresConfig } from '../db/postgres.js'

const db = getDb()

const insertStmt = db.prepare(`
  INSERT INTO audit_log (id, user_id, action, resource, metadata_json, created_at)
  VALUES (?, ?, ?, ?, ?, ?)
`)

function usePostgresStorage(): boolean {
  return process.env.IGA_STORAGE_DRIVER === 'postgres' && hasPostgresConfig()
}

type AuditEntry = {
  userId?: string | null
  action: string
  resource: string
  metadata?: Record<string, unknown>
}

export function logAudit(entry: AuditEntry) {
  const id = randomBytes(8).toString('hex')
  const now = new Date().toISOString()
  const meta = entry.metadata ? JSON.stringify(entry.metadata) : null

  if (usePostgresStorage()) {
    // Fire-and-forget: audit nunca deve bloquear o fluxo principal.
    void getPostgresPool()
      .query(
        `INSERT INTO audit_log (id, user_id, action, resource, metadata_json, created_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [id, entry.userId ?? null, entry.action, entry.resource, meta, now],
      )
      .catch(() => {
        // Melhor esforço — falha de audit nao quebra request.
      })
    return
  }

  try {
    insertStmt.run(id, entry.userId ?? null, entry.action, entry.resource, meta, now)
  } catch {
    // Melhor esforço — nunca deve impedir o fluxo principal
  }
}
