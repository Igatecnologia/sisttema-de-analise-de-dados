import { createHash } from 'node:crypto'

/**
 * Hash chain do audit log — detecta tampering retroativo.
 *
 * Para cada row, gravamos:
 *   row_hash = SHA-256( canonical(row) )
 *   prev_hash = row_hash da row imediatamente anterior (ou '' para a primeira)
 *
 * `canonical` serializa o registro como JSON com chaves ordenadas
 * alfabeticamente (determinismo). `prev_hash` faz parte do canonical, entao
 * editar QUALQUER row passada quebra a chain a partir dali.
 */

export type AuditRowForHash = {
  id: string
  user_id: string | null
  tenant_id: string | null
  action: string
  resource: string
  metadata_json: string | null
  created_at: string
  prev_hash: string
}

function canonicalize(row: AuditRowForHash): string {
  const ordered: Record<string, unknown> = {
    action: row.action,
    created_at: row.created_at,
    id: row.id,
    metadata_json: row.metadata_json ?? null,
    prev_hash: row.prev_hash,
    resource: row.resource,
    tenant_id: row.tenant_id ?? null,
    user_id: row.user_id ?? null,
  }
  return JSON.stringify(ordered)
}

export function computeAuditRowHash(row: AuditRowForHash): string {
  return createHash('sha256').update(canonicalize(row), 'utf8').digest('hex')
}
