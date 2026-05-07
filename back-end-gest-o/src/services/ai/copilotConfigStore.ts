import { getDb } from '../../db/sqlite.js'
import { getPostgresPool, hasPostgresConfig } from '../../db/postgres.js'
import { decryptSecret, encryptSecret, isEncryptedPayload } from '../crypto.js'

/**
 * Config do copiloto persistida em SQLite/PostgreSQL (tabela app_settings).
 * Permite que cada instalação configure sua própria chave Groq sem expô-la
 * no .exe. Chaves criptografadas com AES-256-GCM.
 */

export type CopilotProviderChoice = 'auto' | 'groq' | 'local'

export type CopilotConfig = {
  provider: CopilotProviderChoice
  groqApiKey: string | null
  groqModel: string | null
}

export type CopilotConfigPublic = Omit<CopilotConfig, 'groqApiKey'> & {
  groqApiKeySet: boolean
  groqApiKeyMasked: string | null
}

const KEY = 'copilot_config'

const DEFAULT_CONFIG: CopilotConfig = {
  provider: 'auto',
  groqApiKey: null,
  groqModel: 'llama-3.3-70b-versatile',
}

type StoredShape = {
  provider: CopilotProviderChoice
  groqApiKey: unknown
  groqModel: string | null
}

function usePostgresStorage(): boolean {
  return process.env.IGA_STORAGE_DRIVER === 'postgres' && hasPostgresConfig()
}

function maskKey(key: string): string {
  if (key.length <= 8) return '••••'
  return `${key.slice(0, 4)}••••${key.slice(-4)}`
}

async function readStoredJson(): Promise<string | null> {
  if (usePostgresStorage()) {
    const result = await getPostgresPool().query<{ value_json: string }>(
      'SELECT value_json FROM app_settings WHERE key = $1',
      [KEY],
    )
    return result.rows[0]?.value_json ?? null
  }
  const db = getDb()
  const row = db.prepare('SELECT value_json FROM app_settings WHERE key = ?').get(KEY) as
    | { value_json: string }
    | undefined
  return row?.value_json ?? null
}

async function writeStoredJson(json: string, updatedBy: string, now: string) {
  if (usePostgresStorage()) {
    await getPostgresPool().query(
      `INSERT INTO app_settings (key, value_json, is_secret, updated_at, updated_by)
       VALUES ($1, $2, TRUE, $3, $4)
       ON CONFLICT (key) DO UPDATE SET
         value_json = EXCLUDED.value_json,
         updated_at = EXCLUDED.updated_at,
         updated_by = EXCLUDED.updated_by`,
      [KEY, json, now, updatedBy],
    )
    return
  }
  const db = getDb()
  db.prepare(`
    INSERT INTO app_settings (key, value_json, is_secret, updated_at, updated_by)
    VALUES (?, ?, 1, ?, ?)
    ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at, updated_by = excluded.updated_by
  `).run(KEY, json, now, updatedBy)
}

export async function getCopilotConfig(): Promise<CopilotConfig> {
  const raw = await readStoredJson()
  if (!raw) return { ...DEFAULT_CONFIG }

  let parsed: StoredShape
  try {
    parsed = JSON.parse(raw) as StoredShape
  } catch {
    return { ...DEFAULT_CONFIG }
  }

  let groqApiKey: string | null = null
  if (isEncryptedPayload(parsed.groqApiKey)) {
    try {
      groqApiKey = decryptSecret(parsed.groqApiKey)
    } catch {
      groqApiKey = null
    }
  }

  return {
    provider: parsed.provider ?? 'auto',
    groqApiKey,
    groqModel: parsed.groqModel ?? DEFAULT_CONFIG.groqModel,
  }
}

export async function getCopilotConfigPublic(): Promise<CopilotConfigPublic> {
  const cfg = await getCopilotConfig()
  return {
    provider: cfg.provider,
    groqApiKeySet: Boolean(cfg.groqApiKey),
    groqApiKeyMasked: cfg.groqApiKey ? maskKey(cfg.groqApiKey) : null,
    groqModel: cfg.groqModel,
  }
}

export type UpdateCopilotConfigInput = {
  provider?: CopilotProviderChoice
  /** string: define nova chave; null: limpa; undefined: mantém. */
  groqApiKey?: string | null
  groqModel?: string | null
}

function resolveSecret(input: string | null | undefined, current: string | null): string | null {
  if (input === undefined) return current
  if (input === null || input.trim() === '') return null
  return input.trim()
}

export async function updateCopilotConfig(
  input: UpdateCopilotConfigInput,
  updatedBy: string,
): Promise<CopilotConfigPublic> {
  const current = await getCopilotConfig()
  const next: CopilotConfig = {
    provider: input.provider ?? current.provider,
    groqApiKey: resolveSecret(input.groqApiKey, current.groqApiKey),
    groqModel: input.groqModel ?? current.groqModel,
  }

  const stored: StoredShape = {
    provider: next.provider,
    groqApiKey: next.groqApiKey ? encryptSecret(next.groqApiKey) : null,
    groqModel: next.groqModel,
  }

  const now = new Date().toISOString()
  await writeStoredJson(JSON.stringify(stored), updatedBy, now)

  return getCopilotConfigPublic()
}
