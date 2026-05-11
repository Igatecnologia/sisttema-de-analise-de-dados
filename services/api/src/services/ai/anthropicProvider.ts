import { randomUUID } from 'node:crypto'
import type { AiProvider, ChatMessage, ChatRequest, StreamEvent, ToolDefinition } from './types.js'

/**
 * Provider para Anthropic Messages API.
 * Endpoint: https://api.anthropic.com/v1/messages
 * Docs: https://docs.anthropic.com/en/api/messages
 *
 * Diferenca chave do OpenAI:
 * - system prompt vai como TOP-LEVEL field (nao como message role:'system')
 * - tool_use e tool_result usam blocos de content tipados (nao tool_calls)
 * - streaming usa SSE com event types diferentes (content_block_start, content_block_delta, etc.)
 */

const DEFAULT_MODEL = 'claude-sonnet-4-6'
const BASE_URL = 'https://api.anthropic.com/v1'
const ANTHROPIC_VERSION = '2023-06-01'

type AnthropicTextBlock = { type: 'text'; text: string }
type AnthropicToolUseBlock = { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
type AnthropicToolResultBlock = { type: 'tool_result'; tool_use_id: string; content: string }
type AnthropicContentBlock = AnthropicTextBlock | AnthropicToolUseBlock | AnthropicToolResultBlock

type AnthropicMessage = {
  role: 'user' | 'assistant'
  content: string | AnthropicContentBlock[]
}

type AnthropicStreamEvent =
  | { type: 'message_start' }
  | { type: 'content_block_start'; index: number; content_block: AnthropicContentBlock }
  | { type: 'content_block_delta'; index: number; delta: { type: string; text?: string; partial_json?: string } }
  | { type: 'content_block_stop'; index: number }
  | { type: 'message_delta'; delta: { stop_reason?: string } }
  | { type: 'message_stop' }
  | { type: 'error'; error: { message: string } }
  | { type: 'ping' }

function describeStatusError(status: number): string {
  switch (status) {
    case 400: return 'Anthropic 400 — requisicao invalida.'
    case 401: return 'Anthropic 401 — chave invalida. Confira em console.anthropic.com.'
    case 403: return 'Anthropic 403 — sem permissao para este modelo.'
    case 404: return 'Anthropic 404 — modelo nao encontrado.'
    case 429: return 'Anthropic 429 — rate limit excedido.'
    case 500:
    case 502:
    case 503: return `Anthropic ${status} — instabilidade do servidor.`
    default: return `Anthropic HTTP ${status}`
  }
}

/**
 * Converte historico do formato interno (ChatMessage com toolCalls) para
 * o formato Anthropic (content blocks tipados).
 */
function toAnthropicMessages(messages: ChatMessage[]): AnthropicMessage[] {
  const out: AnthropicMessage[] = []
  for (const m of messages) {
    if (m.role === 'system') continue // system vai como field separado
    if (m.role === 'tool') {
      // tool_result vai dentro de uma message role:'user' (anthropic convention)
      out.push({
        role: 'user',
        content: [{
          type: 'tool_result',
          tool_use_id: m.toolCallId ?? 'unknown',
          content: m.content,
        }],
      })
    } else if (m.role === 'assistant' && m.toolCalls?.length) {
      const blocks: AnthropicContentBlock[] = []
      if (m.content) blocks.push({ type: 'text', text: m.content })
      for (const tc of m.toolCalls) {
        blocks.push({ type: 'tool_use', id: tc.id, name: tc.name, input: tc.args ?? {} })
      }
      out.push({ role: 'assistant', content: blocks })
    } else {
      out.push({ role: m.role as 'user' | 'assistant', content: m.content })
    }
  }
  return out
}

function toAnthropicTools(tools?: ToolDefinition[]) {
  if (!tools?.length) return undefined
  return tools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.parameters,
  }))
}

export type AnthropicConfig = {
  apiKey: string
  model: string
}

export class AnthropicProvider implements AiProvider {
  readonly name = 'anthropic' as const
  readonly displayName: string
  private readonly cfg: AnthropicConfig

  constructor(cfg: AnthropicConfig) {
    this.cfg = cfg
    this.displayName = `Anthropic (${cfg.model})`
  }

  async isAvailable(): Promise<boolean> {
    return Boolean(this.cfg.apiKey && this.cfg.model)
  }

  async *stream(req: ChatRequest): AsyncGenerator<StreamEvent, void, void> {
    const body = {
      model: this.cfg.model || DEFAULT_MODEL,
      system: req.systemPrompt,
      messages: toAnthropicMessages(req.messages),
      tools: toAnthropicTools(req.tools),
      stream: true,
      max_tokens: 1024,
      temperature: 0.3,
    }

    let response: Response
    try {
      response = await fetch(`${BASE_URL}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.cfg.apiKey,
          'anthropic-version': ANTHROPIC_VERSION,
        },
        body: JSON.stringify(body),
        signal: req.signal,
      })
    } catch (err) {
      yield { type: 'error', message: `Falha de rede Anthropic: ${(err as Error).message}` }
      return
    }

    if (!response.ok || !response.body) {
      let detail = ''
      try {
        const txt = await response.text()
        const match = /"message":\s*"([^"]+)"/.exec(txt)
        detail = match?.[1] ?? txt.slice(0, 200)
        console.error('[anthropic]', response.status, detail)
      } catch {
        /* ignora */
      }
      const base = describeStatusError(response.status)
      yield { type: 'error', message: detail ? `${base} Detalhe: ${detail}` : base }
      return
    }

    /**
     * Anthropic SSE: cada bloco (text ou tool_use) abre via content_block_start,
     * recebe deltas em content_block_delta e fecha em content_block_stop.
     * Buferizamos por index ate o stop para emitir token (texto) ou tool_call.
     */
    const blocks = new Map<number, { type: 'text' | 'tool_use'; text: string; toolId?: string; toolName?: string; toolArgsJson: string }>()

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const events = buffer.split('\n\n')
      buffer = events.pop() ?? ''
      for (const raw of events) {
        const lines = raw.split('\n').map((l) => l.trim()).filter(Boolean)
        const dataLine = lines.find((l) => l.startsWith('data:'))
        if (!dataLine) continue
        const payload = dataLine.slice(5).trim()
        if (!payload || payload === '[DONE]') continue
        let evt: AnthropicStreamEvent
        try {
          evt = JSON.parse(payload) as AnthropicStreamEvent
        } catch {
          continue
        }
        if (evt.type === 'error') {
          yield { type: 'error', message: evt.error.message }
          return
        }
        if (evt.type === 'content_block_start') {
          const cb = evt.content_block
          if (cb.type === 'text') {
            blocks.set(evt.index, { type: 'text', text: '', toolArgsJson: '' })
          } else if (cb.type === 'tool_use') {
            blocks.set(evt.index, {
              type: 'tool_use',
              text: '',
              toolId: cb.id,
              toolName: cb.name,
              toolArgsJson: '',
            })
          }
        } else if (evt.type === 'content_block_delta') {
          const block = blocks.get(evt.index)
          if (!block) continue
          if (evt.delta.type === 'text_delta' && evt.delta.text) {
            block.text += evt.delta.text
            yield { type: 'token', text: evt.delta.text }
          } else if (evt.delta.type === 'input_json_delta' && evt.delta.partial_json) {
            block.toolArgsJson += evt.delta.partial_json
          }
        } else if (evt.type === 'content_block_stop') {
          const block = blocks.get(evt.index)
          if (block?.type === 'tool_use' && block.toolName) {
            const args: Record<string, unknown> = (() => {
              try {
                return block.toolArgsJson ? (JSON.parse(block.toolArgsJson) as Record<string, unknown>) : {}
              } catch {
                return {}
              }
            })()
            yield {
              type: 'tool_call',
              call: { id: block.toolId ?? randomUUID(), name: block.toolName, args },
            }
          }
          blocks.delete(evt.index)
        }
      }
    }
    yield { type: 'done' }
  }
}
