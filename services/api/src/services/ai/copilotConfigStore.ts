import { getDb } from '../../db/sqlite.js'
import { getPostgresPool, hasPostgresConfig } from '../../db/postgres.js'
import { decryptSecret, encryptSecret, isEncryptedPayload } from '../crypto.js'

/**
 * Config do copiloto persistida em SQLite/PostgreSQL (tabela app_settings).
 *
 * Suporta multiplos providers IA: o tenant escolhe um e fornece sua propria
 * API key. Chaves criptografadas com AES-256-GCM e nunca retornadas em
 * texto pelo endpoint publico.
 *
 * Providers suportados:
 *  - openai: OpenAI direto (gpt-4o, gpt-4o-mini, etc.)
 *  - anthropic: Claude (Opus 4.7, Sonnet 4.6, Haiku 4.5, etc.)
 *  - gemini: Google Gemini (2.0 Flash, 1.5 Pro)
 *  - groq: Groq Cloud (Llama 3.3, Mixtral) — free tier 30 rpm
 *  - openrouter: OpenRouter (qualquer modelo via OpenAI-compatible)
 *  - custom: baseUrl arbitraria (Ollama, LM Studio, vLLM, self-hosted)
 *  - local: fallback offline sem rede
 */

export type CopilotProviderChoice =
  | 'auto'
  | 'openai'
  | 'anthropic'
  | 'gemini'
  | 'groq'
  | 'openrouter'
  | 'custom'
  | 'local'

export type CopilotConfig = {
  provider: CopilotProviderChoice
  apiKey: string | null
  model: string | null
  /** baseUrl somente para 'custom'. Outros providers tem URL fixa. */
  baseUrl: string | null
}

export type CopilotConfigPublic = {
  provider: CopilotProviderChoice
  apiKeySet: boolean
  apiKeyMasked: string | null
  model: string | null
  baseUrl: string | null
}

const KEY = 'copilot_config'

const DEFAULT_CONFIG: CopilotConfig = {
  provider: 'auto',
  apiKey: null,
  model: null,
  baseUrl: null,
}

type StoredShape = {
  provider: CopilotProviderChoice
  apiKey: unknown
  model: string | null
  baseUrl: string | null
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

/**
 * Migracao transparente do schema antigo (so groq):
 *   { provider, groqApiKey, groqModel }
 * para o novo:
 *   { provider, apiKey, model, baseUrl }
 */
function migrateLegacyShape(parsed: unknown): StoredShape | null {
  if (!parsed || typeof parsed !== 'object') return null
  const o = parsed as Record<string, unknown>
  if ('apiKey' in o || 'baseUrl' in o) {
    return {
      provider: (o.provider as CopilotProviderChoice) ?? 'auto',
      apiKey: o.apiKey,
      model: (o.model as string | null) ?? null,
      baseUrl: (o.baseUrl as string | null) ?? null,
    }
  }
  // legacy: groqApiKey/groqModel
  if ('groqApiKey' in o || 'groqModel' in o) {
    const provider = (o.provider as CopilotProviderChoice) ?? 'auto'
    return {
      provider: provider === 'groq' || provider === 'auto' ? provider : 'auto',
      apiKey: o.groqApiKey,
      model: (o.groqModel as string | null) ?? null,
      baseUrl: null,
    }
  }
  return null
}

export async function getCopilotConfig(): Promise<CopilotConfig> {
  const raw = await readStoredJson()
  if (!raw) return { ...DEFAULT_CONFIG }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { ...DEFAULT_CONFIG }
  }

  const stored = migrateLegacyShape(parsed)
  if (!stored) return { ...DEFAULT_CONFIG }

  let apiKey: string | null = null
  if (isEncryptedPayload(stored.apiKey)) {
    try {
      apiKey = decryptSecret(stored.apiKey)
    } catch {
      apiKey = null
    }
  }

  return {
    provider: stored.provider ?? 'auto',
    apiKey,
    model: stored.model ?? null,
    baseUrl: stored.baseUrl ?? null,
  }
}

export async function getCopilotConfigPublic(): Promise<CopilotConfigPublic> {
  const cfg = await getCopilotConfig()
  return {
    provider: cfg.provider,
    apiKeySet: Boolean(cfg.apiKey),
    apiKeyMasked: cfg.apiKey ? maskKey(cfg.apiKey) : null,
    model: cfg.model,
    baseUrl: cfg.baseUrl,
  }
}

export type UpdateCopilotConfigInput = {
  provider?: CopilotProviderChoice
  /** string: define nova chave; null: limpa; undefined: mantem. */
  apiKey?: string | null
  model?: string | null
  baseUrl?: string | null
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
    apiKey: resolveSecret(input.apiKey, current.apiKey),
    model: input.model !== undefined ? input.model : current.model,
    baseUrl: input.baseUrl !== undefined ? input.baseUrl : current.baseUrl,
  }

  const stored: StoredShape = {
    provider: next.provider,
    apiKey: next.apiKey ? encryptSecret(next.apiKey) : null,
    model: next.model,
    baseUrl: next.baseUrl,
  }

  const now = new Date().toISOString()
  await writeStoredJson(JSON.stringify(stored), updatedBy, now)

  return getCopilotConfigPublic()
}
