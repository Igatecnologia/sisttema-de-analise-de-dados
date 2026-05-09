import { OpenAiCompatibleProvider } from './openAiCompatibleProvider.js'
import { AnthropicProvider } from './anthropicProvider.js'
import { GeminiProvider } from './geminiProvider.js'
import { LocalProvider } from './localProvider.js'
import { getCopilotConfig, type CopilotProviderChoice } from './copilotConfigStore.js'
import type { AiProvider } from './types.js'

/**
 * Presets de provider — baseUrl + modelo default por tipo.
 * O usuario fornece apenas a API key e (opcionalmente) o modelo.
 */
export const PROVIDER_PRESETS: Record<Exclude<CopilotProviderChoice, 'auto' | 'local' | 'custom'>, {
  baseUrl: string
  defaultModel: string
  label: string
  type: 'openai-compatible' | 'anthropic' | 'gemini'
  extraHeaders?: Record<string, string>
}> = {
  openai: {
    baseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
    label: 'OpenAI',
    type: 'openai-compatible',
  },
  anthropic: {
    baseUrl: 'https://api.anthropic.com/v1',
    defaultModel: 'claude-sonnet-4-6',
    label: 'Anthropic Claude',
    type: 'anthropic',
  },
  gemini: {
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    defaultModel: 'gemini-2.0-flash',
    label: 'Google Gemini',
    type: 'gemini',
  },
  groq: {
    baseUrl: 'https://api.groq.com/openai/v1',
    defaultModel: 'llama-3.3-70b-versatile',
    label: 'Groq',
    type: 'openai-compatible',
  },
  openrouter: {
    baseUrl: 'https://openrouter.ai/api/v1',
    defaultModel: 'anthropic/claude-3.5-sonnet',
    label: 'OpenRouter',
    type: 'openai-compatible',
    extraHeaders: { 'X-Title': 'IGA Gestao Copilot' },
  },
}

/**
 * Resolve env vars como fallback (compat com .env existente).
 * Ordem: env > config no banco > preset default.
 */
function resolveFromEnv(): Partial<{ provider: CopilotProviderChoice; apiKey: string; model: string; baseUrl: string }> {
  const out: ReturnType<typeof resolveFromEnv> = {}
  const envProvider = process.env.COPILOT_PROVIDER?.trim().toLowerCase() as CopilotProviderChoice | undefined
  if (envProvider) out.provider = envProvider
  // Compat: GROQ_API_KEY ainda funciona se provider=groq
  const groqKey = process.env.GROQ_API_KEY?.trim()
  const openaiKey = process.env.OPENAI_API_KEY?.trim()
  const anthropicKey = process.env.ANTHROPIC_API_KEY?.trim()
  const geminiKey = process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_API_KEY?.trim()
  const copilotKey = process.env.COPILOT_API_KEY?.trim()

  if (copilotKey) out.apiKey = copilotKey
  else if (envProvider === 'openai' && openaiKey) out.apiKey = openaiKey
  else if (envProvider === 'anthropic' && anthropicKey) out.apiKey = anthropicKey
  else if (envProvider === 'gemini' && geminiKey) out.apiKey = geminiKey
  else if (envProvider === 'groq' && groqKey) out.apiKey = groqKey
  else if (groqKey) out.apiKey = groqKey // legacy fallback

  const envModel = process.env.COPILOT_MODEL?.trim() || process.env.GROQ_MODEL?.trim()
  if (envModel) out.model = envModel
  const envBaseUrl = process.env.COPILOT_BASE_URL?.trim()
  if (envBaseUrl) out.baseUrl = envBaseUrl
  return out
}

function buildProvider(
  provider: CopilotProviderChoice,
  apiKey: string | null,
  model: string | null,
  baseUrl: string | null,
): AiProvider | null {
  if (provider === 'local' || !apiKey) return null

  if (provider === 'custom') {
    if (!baseUrl) return null
    return new OpenAiCompatibleProvider({
      apiKey,
      baseUrl,
      model: model || 'default',
      displayLabel: 'Custom (OpenAI-compatible)',
    })
  }

  const preset = PROVIDER_PRESETS[provider as keyof typeof PROVIDER_PRESETS]
  if (!preset) return null

  if (preset.type === 'anthropic') {
    return new AnthropicProvider({ apiKey, model: model || preset.defaultModel })
  }
  if (preset.type === 'gemini') {
    return new GeminiProvider({ apiKey, model: model || preset.defaultModel })
  }
  return new OpenAiCompatibleProvider({
    apiKey,
    baseUrl: preset.baseUrl,
    model: model || preset.defaultModel,
    displayLabel: preset.label,
    extraHeaders: preset.extraHeaders,
  })
}

/**
 * Resolucao com precedencia: env var > config no banco > local fallback.
 *
 * Em modo "auto": tenta primeiro provider configurado; cai para local se
 * todos falharem isAvailable().
 */
export async function resolveProvider(): Promise<AiProvider> {
  const dbCfg = await getCopilotConfig()
  const env = resolveFromEnv()

  const provider = (env.provider ?? dbCfg.provider ?? 'auto') as CopilotProviderChoice
  const apiKey = env.apiKey ?? dbCfg.apiKey ?? null
  const model = env.model ?? dbCfg.model ?? null
  const baseUrl = env.baseUrl ?? dbCfg.baseUrl ?? null

  const local = new LocalProvider()

  if (provider === 'local') return local

  if (provider === 'auto') {
    // Tenta cada provider configurado em ordem de preferencia
    const candidates: CopilotProviderChoice[] = ['anthropic', 'openai', 'gemini', 'groq', 'openrouter']
    for (const cand of candidates) {
      const p = buildProvider(cand, apiKey, model, baseUrl)
      if (p && (await p.isAvailable())) return p
    }
    return local
  }

  const p = buildProvider(provider, apiKey, model, baseUrl)
  if (p && (await p.isAvailable())) return p
  return local
}
