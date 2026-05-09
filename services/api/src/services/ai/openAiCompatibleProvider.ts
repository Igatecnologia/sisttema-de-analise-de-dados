import { randomUUID } from 'node:crypto'
import type { AiProvider, ChatMessage, ChatRequest, StreamEvent, ToolDefinition } from './types.js'

/**
 * Provider generico para qualquer API OpenAI-compativel:
 * - OpenAI (https://api.openai.com/v1)
 * - Groq (https://api.groq.com/openai/v1)
 * - OpenRouter (https://openrouter.ai/api/v1)
 * - DeepSeek (https://api.deepseek.com/v1)
 * - Together (https://api.together.xyz/v1)
 * - Ollama / LM Studio / vLLM auto-hospedados
 *
 * Todos seguem o contrato POST /chat/completions com tool_calls do OpenAI.
 */

/**
 * Alguns Llamas (3.1 8B em especial) ignoram o canal nativo de tool_calls e
 * emitem `<function=NOME args_key=val ...></function>` como TEXTO no content.
 * Interceptamos esse padrao, convertemos em tool_call e removemos do texto.
 */
const FN_TAG = /<function=([a-zA-Z_][\w]*)\s*([^>]*)>\s*<\/function>/g

function parseInlineArgs(rawArgs: string): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  const re = /([a-zA-Z_]\w*)=(?:"([^"]*)"|'([^']*)'|([^\s]+))/g
  let m: RegExpExecArray | null
  while ((m = re.exec(rawArgs)) !== null) {
    const key = m[1]
    const val = m[2] ?? m[3] ?? m[4] ?? ''
    const num = Number(val)
    if (val === 'true') out[key] = true
    else if (val === 'false') out[key] = false
    else if (val !== '' && !Number.isNaN(num)) out[key] = num
    else out[key] = val
  }
  return out
}

type OpenAiToolCall = {
  id?: string
  index?: number
  type?: 'function'
  function?: { name?: string; arguments?: string }
}

type OpenAiMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string | null
  tool_calls?: OpenAiToolCall[]
  tool_call_id?: string
  name?: string
}

type OpenAiChunk = {
  choices?: Array<{
    delta?: { content?: string | null; tool_calls?: OpenAiToolCall[] }
    finish_reason?: string | null
  }>
  error?: { message?: string; type?: string }
}

function normalizeToolCall(call: { id: string; name: string; argsJson: string }): {
  id: string
  name: string
  args: Record<string, unknown>
} {
  let name = call.name.trim()
  let argsJson = call.argsJson
  const braceIdx = name.indexOf('{')
  if (braceIdx > 0) {
    const stuffed = name.slice(braceIdx)
    name = name.slice(0, braceIdx).trim()
    if (!argsJson || argsJson.trim() === '' || argsJson.trim() === '{}') {
      argsJson = stuffed
    }
  }
  try {
    const args = argsJson ? (JSON.parse(argsJson) as Record<string, unknown>) : {}
    return { id: call.id, name, args }
  } catch {
    return { id: call.id, name, args: {} }
  }
}

function describeStatusError(status: number, providerLabel: string): string {
  switch (status) {
    case 400: return `${providerLabel} 400 — requisicao invalida.`
    case 401: return `${providerLabel} 401 — chave invalida. Confira sua API key.`
    case 403: return `${providerLabel} 403 — sem permissao para este modelo.`
    case 404: return `${providerLabel} 404 — modelo nao encontrado.`
    case 429: return `${providerLabel} 429 — cota excedida. Aguarde 1 min.`
    case 500:
    case 502:
    case 503: return `${providerLabel} ${status} — instabilidade do servidor. Tente novamente.`
    default: return `${providerLabel} HTTP ${status}`
  }
}

function toOpenAiMessages(systemPrompt: string, messages: ChatMessage[]): OpenAiMessage[] {
  const out: OpenAiMessage[] = []
  if (systemPrompt) out.push({ role: 'system', content: systemPrompt })
  for (const m of messages) {
    if (m.role === 'tool') {
      out.push({
        role: 'tool',
        content: m.content,
        tool_call_id: m.toolCallId ?? m.toolName ?? 'unknown',
        name: m.toolName,
      })
    } else if (m.role === 'assistant' && m.toolCalls?.length) {
      out.push({
        role: 'assistant',
        content: m.content || null,
        tool_calls: m.toolCalls.map((tc) => ({
          id: tc.id,
          type: 'function',
          function: { name: tc.name, arguments: JSON.stringify(tc.args ?? {}) },
        })),
      })
    } else if (m.role !== 'system') {
      out.push({ role: m.role, content: m.content })
    }
  }
  return out
}

function toOpenAiTools(tools?: ToolDefinition[]) {
  if (!tools?.length) return undefined
  return tools.map((t) => ({
    type: 'function' as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }))
}

export type OpenAiCompatibleConfig = {
  apiKey: string
  baseUrl: string
  model: string
  /** Label amigavel: "OpenAI", "Groq", "OpenRouter", etc. */
  displayLabel: string
  /** Header customizado (OpenRouter exige X-Title). Opcional. */
  extraHeaders?: Record<string, string>
}

export class OpenAiCompatibleProvider implements AiProvider {
  readonly name = 'openai-compatible' as const
  readonly displayName: string
  private readonly cfg: OpenAiCompatibleConfig

  constructor(cfg: OpenAiCompatibleConfig) {
    this.cfg = cfg
    this.displayName = cfg.displayLabel
  }

  async isAvailable(): Promise<boolean> {
    return Boolean(this.cfg.apiKey && this.cfg.baseUrl && this.cfg.model)
  }

  async *stream(req: ChatRequest): AsyncGenerator<StreamEvent, void, void> {
    const body = {
      model: this.cfg.model,
      messages: toOpenAiMessages(req.systemPrompt, req.messages),
      tools: toOpenAiTools(req.tools),
      stream: true,
      temperature: 0.3,
      max_tokens: 800,
    }

    let response: Response
    try {
      response = await fetch(`${this.cfg.baseUrl.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.cfg.apiKey}`,
          ...(this.cfg.extraHeaders ?? {}),
        },
        body: JSON.stringify(body),
        signal: req.signal,
      })
    } catch (err) {
      yield { type: 'error', message: `Falha de rede ${this.cfg.displayLabel}: ${(err as Error).message}` }
      return
    }

    if (!response.ok || !response.body) {
      let detail = ''
      if (response.status >= 400 && response.status < 500 && response.status !== 401) {
        try {
          const txt = await response.text()
          const match = /"message":\s*"([^"]+)"/.exec(txt)
          detail = match?.[1] ?? txt.slice(0, 200)
          console.error(`[${this.cfg.displayLabel}]`, response.status, detail)
        } catch {
          /* ignora */
        }
      }
      const base = describeStatusError(response.status, this.cfg.displayLabel)
      yield { type: 'error', message: detail ? `${base} Detalhe: ${detail}` : base }
      return
    }

    const toolBuffers = new Map<number, { id: string; name: string; argsJson: string }>()

    let textBuf = ''
    const emitText = (flush: boolean): StreamEvent[] => {
      const events: StreamEvent[] = []
      FN_TAG.lastIndex = 0
      let match: RegExpExecArray | null
      let lastEnd = 0
      const matches: Array<{ start: number; end: number; name: string; args: Record<string, unknown> }> = []
      while ((match = FN_TAG.exec(textBuf)) !== null) {
        matches.push({
          start: match.index,
          end: match.index + match[0].length,
          name: match[1],
          args: parseInlineArgs(match[2]),
        })
      }
      for (const m of matches) {
        const before = textBuf.slice(lastEnd, m.start)
        if (before) events.push({ type: 'token', text: before })
        events.push({ type: 'tool_call', call: { id: randomUUID(), name: m.name, args: m.args } })
        lastEnd = m.end
      }
      let tail = textBuf.slice(lastEnd)
      if (!flush) {
        const lt = tail.lastIndexOf('<')
        if (lt !== -1 && !tail.includes('</function>', lt)) {
          const held = tail.slice(lt)
          tail = tail.slice(0, lt)
          textBuf = held
        } else {
          textBuf = ''
        }
      } else {
        textBuf = ''
      }
      if (tail) events.push({ type: 'token', text: tail })
      return events
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const raw of lines) {
        const line = raw.trim()
        if (!line.startsWith('data:')) continue
        const payload = line.slice(5).trim()
        if (!payload || payload === '[DONE]') continue
        let chunk: OpenAiChunk
        try {
          chunk = JSON.parse(payload) as OpenAiChunk
        } catch {
          continue
        }
        if (chunk.error) {
          const errMsg = chunk.error.message ?? `Erro desconhecido ${this.cfg.displayLabel}`
          const salvage = /tool '([^']+)'/.exec(errMsg)
          if (salvage) {
            const rawName = salvage[1]
            const braceIdx = rawName.indexOf('{')
            const cleanName = (braceIdx > 0 ? rawName.slice(0, braceIdx) : rawName).trim()
            const stuffedArgs = braceIdx > 0 ? rawName.slice(braceIdx) : '{}'
            let args: Record<string, unknown>
            try {
              args = JSON.parse(stuffedArgs) as Record<string, unknown>
            } catch {
              args = {}
            }
            console.warn(`[${this.cfg.displayLabel}] recuperando tool_call malformado:`, rawName, '→', cleanName)
            yield { type: 'tool_call', call: { id: randomUUID(), name: cleanName, args } }
            yield { type: 'done' }
            return
          }
          yield { type: 'error', message: errMsg }
          return
        }
        const choice = chunk.choices?.[0]
        const text = choice?.delta?.content
        if (text) {
          textBuf += text
          for (const evt of emitText(false)) yield evt
        }

        const tcs = choice?.delta?.tool_calls ?? []
        for (const tc of tcs) {
          const idx = tc.index ?? 0
          const current = toolBuffers.get(idx) ?? { id: tc.id ?? randomUUID(), name: '', argsJson: '' }
          if (tc.id) current.id = tc.id
          if (tc.function?.name) current.name += tc.function.name
          if (tc.function?.arguments) current.argsJson += tc.function.arguments
          toolBuffers.set(idx, current)
        }

        if (choice?.finish_reason === 'tool_calls') {
          for (const call of toolBuffers.values()) {
            yield { type: 'tool_call', call: normalizeToolCall(call) }
          }
          toolBuffers.clear()
        }
      }
    }
    for (const evt of emitText(true)) yield evt
    yield { type: 'done' }
  }
}
