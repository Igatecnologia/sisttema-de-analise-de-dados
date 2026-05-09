import { randomUUID } from 'node:crypto'
import type { AiProvider, ChatMessage, ChatRequest, StreamEvent, ToolDefinition } from './types.js'

/**
 * Provider para Google Gemini API.
 * Endpoint: https://generativelanguage.googleapis.com/v1beta/models/{model}:streamGenerateContent
 * Docs: https://ai.google.dev/api/generate-content
 *
 * Diferencas:
 * - role 'system' nao existe — vai como `systemInstruction` top-level
 * - role 'assistant' eh 'model'
 * - tools usam `functionDeclarations`; calls aparecem como functionCall blocks
 * - tool result vai como role 'function' com functionResponse
 * - streaming usa NDJSON (linhas JSON), nao SSE
 */

const DEFAULT_MODEL = 'gemini-2.0-flash'
const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta'

type GeminiPart =
  | { text: string }
  | { functionCall: { name: string; args: Record<string, unknown> } }
  | { functionResponse: { name: string; response: { content: string } } }

type GeminiContent = {
  role: 'user' | 'model' | 'function'
  parts: GeminiPart[]
}

type GeminiChunk = {
  candidates?: Array<{
    content?: GeminiContent
    finishReason?: string
  }>
  error?: { message: string; code: number }
}

function describeStatusError(status: number): string {
  switch (status) {
    case 400: return 'Gemini 400 — requisicao invalida.'
    case 401:
    case 403: return 'Gemini 401/403 — chave invalida ou sem permissao. Confira em aistudio.google.com.'
    case 404: return 'Gemini 404 — modelo nao encontrado.'
    case 429: return 'Gemini 429 — rate limit excedido. Free tier: 15 RPM.'
    case 500:
    case 502:
    case 503: return `Gemini ${status} — instabilidade do servidor.`
    default: return `Gemini HTTP ${status}`
  }
}

function toGeminiContents(messages: ChatMessage[]): GeminiContent[] {
  const out: GeminiContent[] = []
  for (const m of messages) {
    if (m.role === 'system') continue
    if (m.role === 'tool') {
      out.push({
        role: 'function',
        parts: [{
          functionResponse: {
            name: m.toolName ?? 'unknown',
            response: { content: m.content },
          },
        }],
      })
    } else if (m.role === 'assistant' && m.toolCalls?.length) {
      const parts: GeminiPart[] = []
      if (m.content) parts.push({ text: m.content })
      for (const tc of m.toolCalls) {
        parts.push({ functionCall: { name: tc.name, args: tc.args ?? {} } })
      }
      out.push({ role: 'model', parts })
    } else {
      out.push({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      })
    }
  }
  return out
}

function toGeminiTools(tools?: ToolDefinition[]) {
  if (!tools?.length) return undefined
  return [{
    functionDeclarations: tools.map((t) => ({
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    })),
  }]
}

export type GeminiConfig = {
  apiKey: string
  model: string
}

export class GeminiProvider implements AiProvider {
  readonly name = 'gemini' as const
  readonly displayName: string
  private readonly cfg: GeminiConfig

  constructor(cfg: GeminiConfig) {
    this.cfg = cfg
    this.displayName = `Google Gemini (${cfg.model})`
  }

  async isAvailable(): Promise<boolean> {
    return Boolean(this.cfg.apiKey && this.cfg.model)
  }

  async *stream(req: ChatRequest): AsyncGenerator<StreamEvent, void, void> {
    const model = this.cfg.model || DEFAULT_MODEL
    const url = `${BASE_URL}/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse&key=${encodeURIComponent(this.cfg.apiKey)}`
    const body = {
      contents: toGeminiContents(req.messages),
      systemInstruction: req.systemPrompt ? { parts: [{ text: req.systemPrompt }] } : undefined,
      tools: toGeminiTools(req.tools),
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 1024,
      },
    }

    let response: Response
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: req.signal,
      })
    } catch (err) {
      yield { type: 'error', message: `Falha de rede Gemini: ${(err as Error).message}` }
      return
    }

    if (!response.ok || !response.body) {
      let detail = ''
      try {
        const txt = await response.text()
        const match = /"message":\s*"([^"]+)"/.exec(txt)
        detail = match?.[1] ?? txt.slice(0, 200)
        console.error('[gemini]', response.status, detail)
      } catch {
        /* ignora */
      }
      const base = describeStatusError(response.status)
      yield { type: 'error', message: detail ? `${base} Detalhe: ${detail}` : base }
      return
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
        let chunk: GeminiChunk
        try {
          chunk = JSON.parse(payload) as GeminiChunk
        } catch {
          continue
        }
        if (chunk.error) {
          yield { type: 'error', message: chunk.error.message }
          return
        }
        const candidate = chunk.candidates?.[0]
        if (!candidate?.content?.parts) continue
        for (const part of candidate.content.parts) {
          if ('text' in part && part.text) {
            yield { type: 'token', text: part.text }
          } else if ('functionCall' in part && part.functionCall) {
            yield {
              type: 'tool_call',
              call: {
                id: randomUUID(),
                name: part.functionCall.name,
                args: part.functionCall.args ?? {},
              },
            }
          }
        }
      }
    }
    yield { type: 'done' }
  }
}
