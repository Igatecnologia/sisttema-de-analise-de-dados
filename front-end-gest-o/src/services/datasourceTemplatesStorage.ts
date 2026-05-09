/**
 * Templates de datasource salvos localmente por tenant.
 *
 * Decisão consciente: localStorage em vez de backend. Por quê?
 * - Templates são preferência pessoal/operacional, não dado de negócio
 * - Sincronizar entre dispositivos não é crítico para o caso de uso
 * - Reduz superfície da API e migrações
 * - Se o cliente quiser sincronizar entre devices, exporta JSON e importa
 *
 * Quando virar dor (3+ dispositivos por usuário, ou time grande compartilhando),
 * migrar para backend é trivial — esta interface é o contrato.
 */

const STORAGE_KEY_PREFIX = 'iga.ds-templates'

export type DataSourceTemplate = {
  id: string
  name: string
  /** Notas livres do usuário sobre quando usar o template. */
  notes?: string
  /** Snapshot dos campos do form — sem credenciais sensíveis em claro. */
  payload: Record<string, unknown>
  createdAt: string
  /** Última vez que foi aplicado — útil pra ordenar por uso recente. */
  lastUsedAt: string | null
}

function storageKey(tenantId: string): string {
  return `${STORAGE_KEY_PREFIX}:${tenantId}`
}

function readRaw(tenantId: string): DataSourceTemplate[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(storageKey(tenantId))
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter((t): t is DataSourceTemplate => Boolean(t && typeof t === 'object' && (t as DataSourceTemplate).id))
  } catch {
    return []
  }
}

function writeRaw(tenantId: string, list: DataSourceTemplate[]): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(storageKey(tenantId), JSON.stringify(list))
  } catch {
    /** Quota cheia ou storage desabilitado — degrada silencioso. */
  }
}

export function listTemplates(tenantId: string): DataSourceTemplate[] {
  return readRaw(tenantId).sort((a, b) => {
    /** Última usada primeiro; quem nunca usou cai pra criação desc. */
    const aT = a.lastUsedAt ?? a.createdAt
    const bT = b.lastUsedAt ?? b.createdAt
    return bT.localeCompare(aT)
  })
}

export function saveTemplate(
  tenantId: string,
  template: { name: string; notes?: string; payload: Record<string, unknown> },
): DataSourceTemplate {
  const all = readRaw(tenantId)
  const id = `tpl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const now = new Date().toISOString()
  /** Sanitiza payload: nunca persistimos senha em claro nem token. */
  const safePayload = { ...template.payload }
  delete safePayload.apiPassword
  delete safePayload.authCredentials
  const created: DataSourceTemplate = {
    id,
    name: template.name.trim(),
    notes: template.notes?.trim() || undefined,
    payload: safePayload,
    createdAt: now,
    lastUsedAt: null,
  }
  writeRaw(tenantId, [created, ...all])
  return created
}

export function markTemplateUsed(tenantId: string, id: string): void {
  const all = readRaw(tenantId)
  const idx = all.findIndex((t) => t.id === id)
  if (idx < 0) return
  all[idx] = { ...all[idx], lastUsedAt: new Date().toISOString() }
  writeRaw(tenantId, all)
}

export function deleteTemplate(tenantId: string, id: string): void {
  const all = readRaw(tenantId).filter((t) => t.id !== id)
  writeRaw(tenantId, all)
}

export function exportTemplates(tenantId: string): string {
  return JSON.stringify(readRaw(tenantId), null, 2)
}

export function importTemplates(tenantId: string, json: string): { imported: number; skipped: number } {
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    return { imported: 0, skipped: 0 }
  }
  if (!Array.isArray(parsed)) return { imported: 0, skipped: 0 }
  const existing = readRaw(tenantId)
  const existingIds = new Set(existing.map((t) => t.id))
  let imported = 0
  let skipped = 0
  for (const raw of parsed) {
    if (!raw || typeof raw !== 'object') {
      skipped += 1
      continue
    }
    const t = raw as DataSourceTemplate
    if (!t.id || !t.name || existingIds.has(t.id)) {
      skipped += 1
      continue
    }
    existing.push(t)
    imported += 1
  }
  writeRaw(tenantId, existing)
  return { imported, skipped }
}
