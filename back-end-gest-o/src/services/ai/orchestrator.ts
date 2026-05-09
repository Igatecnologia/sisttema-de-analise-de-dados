import { resolveProvider } from './providerFactory.js'
import { TOOL_DEFINITIONS, executeTool } from './tools.js'
import { buildDynamicSystemPrompt, resolvePromptContext } from './systemPrompt.js'
import type { AiProvider, ChatMessage, StreamEvent } from './types.js'
import { logAudit } from '../auditLog.js'

type OrchestratorOptions = {
  history: ChatMessage[]
  userPrompt: string
  userId: string
  userName: string
  userRole: string
  tenantId: string
  monthlyGoal?: number | null
  signal?: AbortSignal
  /** provider forçado (para testes) — default: resolve via env */
  provider?: AiProvider
}

const MAX_TOOL_ROUNDS = 4 // trava contra loop infinito de tool calls

function isRateLimitLikeError(message: string): boolean {
  const m = message.toLowerCase()
  return (
    m.includes('429') ||
    m.includes('rate limit') ||
    m.includes('quota') ||
    m.includes('cota excedida') ||
    m.includes('tokens per day') ||
    m.includes('tpm') ||
    m.includes('tps')
  )
}

/** Classifica o erro em buckets — útil para audit/analytics sem vazar mensagem. */
function classifyError(message: string): string {
  const m = message.toLowerCase()
  if (isRateLimitLikeError(m)) return 'rate_limit'
  if (m.includes('401') || m.includes('403')) return 'auth'
  if (m.includes('timeout') || m.includes('aborted')) return 'timeout'
  if (m.includes('rede') || m.includes('network') || m.includes('fetch')) return 'network'
  if (m.includes('500') || m.includes('502') || m.includes('503')) return 'upstream_5xx'
  return 'other'
}

/**
 * Executa o ciclo chat ↔ tool calling e emite StreamEvents prontos para SSE.
 * Mantém contrato estável: consumer só precisa lidar com 'token', 'done', 'error'
 * — tool_calls são resolvidos internamente e realimentados ao modelo.
 */
export async function* runCopilot(opts: OrchestratorOptions): AsyncGenerator<StreamEvent, void, void> {
  const provider = opts.provider ?? (await resolveProvider())
  const messages: ChatMessage[] = [...opts.history, { role: 'user', content: opts.userPrompt }]

  const promptCtx = resolvePromptContext({
    userName: opts.userName || 'Usuário',
    userRole: opts.userRole,
    tenantId: opts.tenantId,
    monthlyGoal: opts.monthlyGoal,
  })
  const systemPrompt = buildDynamicSystemPrompt(promptCtx)

  /** Em prod, NÃO logar prompt do usuário — pode conter dados sensíveis do tenant. */
  const isProduction = process.env.NODE_ENV === 'production'
  if (!isProduction) {
    console.log(`[copilot] provider=${provider.name} rounds=iniciando prompt="${opts.userPrompt.slice(0, 60)}"`)
  } else {
    console.log(`[copilot] provider=${provider.name} tenant=${opts.tenantId} userPromptLen=${opts.userPrompt.length}`)
  }

  /**
   * Telemetria: registramos METADATA apenas, nunca conteúdo.
   * Útil para descobrir top intents (via tools chamadas), tempo médio,
   * taxa de erro e custo aproximado por tenant — base para decidir
   * cutover Python (AI-3) com dados reais.
   */
  const startedAt = Date.now()
  const toolsCalledThisConversation: string[] = []
  let totalRounds = 0
  let hadError = false
  logAudit({
    userId: opts.userId,
    tenantId: opts.tenantId,
    action: 'copilot_message_started',
    resource: 'copilot',
    metadata: { provider: provider.name, userPromptLen: opts.userPrompt.length },
  })

  for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
    totalRounds = round + 1
    if (!isProduction) console.log(`[copilot] round ${round + 1} de ${MAX_TOOL_ROUNDS}`)
    const toolCallsThisRound: Array<{ id: string; name: string; args: Record<string, unknown> }> = []
    let assistantText = ''

    const stream = provider.stream({
      systemPrompt,
      messages,
      tools: TOOL_DEFINITIONS,
      signal: opts.signal,
    })

    for await (const evt of stream) {
      if (evt.type === 'token') {
        assistantText += evt.text
        yield evt
      } else if (evt.type === 'tool_call') {
        toolCallsThisRound.push(evt.call)
        // Não vazamos o tool_call para o cliente — é detalhe interno.
      } else if (evt.type === 'error') {
        console.error(`[copilot] erro: ${evt.message}`)
        hadError = true
        const shouldFallbackLocal =
          provider.name !== 'local' &&
          (
            // fallback antigo (erro logo no início)
            (round === 0 && assistantText === '' && toolCallsThisRound.length === 0) ||
            // novo: fallback agressivo para cota/rate-limit em qualquer rodada
            isRateLimitLikeError(evt.message)
          )
        if (shouldFallbackLocal) {
          const { LocalProvider } = await import('./localProvider.js')
          const fallback = new LocalProvider()
          console.warn('[copilot] fallback para provider local por erro no provider remoto')
          logAudit({
            userId: opts.userId,
            tenantId: opts.tenantId,
            action: 'copilot_provider_fallback',
            resource: 'copilot',
            metadata: { from: provider.name, to: 'local' },
          })
          yield* runCopilot({ ...opts, provider: fallback })
          return
        }
        logAudit({
          userId: opts.userId,
          tenantId: opts.tenantId,
          action: 'copilot_error',
          resource: 'copilot',
          metadata: { provider: provider.name, round, errorClass: classifyError(evt.message) },
        })
        yield evt
        return
      } else if (evt.type === 'done') {
        if (!isProduction) {
          console.log(`[copilot] round ${round + 1} fim — text=${assistantText.length}ch tools=${toolCallsThisRound.length}`)
        }
        break
      }
    }

    // Sem tool calls: resposta final
    if (toolCallsThisRound.length === 0) {
      logAudit({
        userId: opts.userId,
        tenantId: opts.tenantId,
        action: 'copilot_response_completed',
        resource: 'copilot',
        metadata: {
          provider: provider.name,
          rounds: totalRounds,
          toolsCalled: toolsCalledThisConversation,
          uniqueTools: [...new Set(toolsCalledThisConversation)].length,
          latencyMs: Date.now() - startedAt,
          hadError,
        },
      })
      yield { type: 'done' }
      return
    }

    // Registra a mensagem do assistente COM os tool_calls — formato OpenAI
    // exige: user → assistant{tool_calls} → tool{result} → assistant(texto).
    // Sem isso, o modelo não percebe que já pediu a tool e pede infinitamente.
    messages.push({
      role: 'assistant',
      content: assistantText,
      toolCalls: toolCallsThisRound.map((c) => ({ id: c.id, name: c.name, args: c.args })),
    })

    // Executa cada tool e anexa como mensagem role:'tool'
    for (const call of toolCallsThisRound) {
      /** Em prod, NÃO logar args — podem conter filtros com dados de cliente. */
      if (!isProduction) {
        console.log(`[copilot] executando tool: ${call.name}`, call.args)
      } else {
        console.log(`[copilot] executando tool: ${call.name}`)
      }
      toolsCalledThisConversation.push(call.name)
      const toolStartedAt = Date.now()
      let result: unknown
      let toolError = false
      try {
        result = await executeTool(call.name, call.args, {
          userId: opts.userId,
          userRole: opts.userRole,
          tenantId: opts.tenantId,
        })
        if (typeof result === 'object' && result !== null && 'error' in result) {
          toolError = true
        }
      } catch (err) {
        toolError = true
        result = { error: `Falha ao executar ${call.name}: ${(err as Error).message}` }
      }
      logAudit({
        userId: opts.userId,
        tenantId: opts.tenantId,
        action: 'copilot_tool_called',
        resource: 'copilot',
        metadata: {
          tool: call.name,
          round: totalRounds,
          latencyMs: Date.now() - toolStartedAt,
          ok: !toolError,
        },
      })
      messages.push({
        role: 'tool',
        toolName: call.name,
        toolCallId: call.id,
        content: JSON.stringify(result),
      })
    }
  }

  // Se saiu do loop por limite de rounds, emite fechamento limpo
  logAudit({
    userId: opts.userId,
    tenantId: opts.tenantId,
    action: 'copilot_response_completed',
    resource: 'copilot',
    metadata: {
      provider: provider.name,
      rounds: totalRounds,
      toolsCalled: toolsCalledThisConversation,
      uniqueTools: [...new Set(toolsCalledThisConversation)].length,
      latencyMs: Date.now() - startedAt,
      hadError,
      exitReason: 'max_rounds',
    },
  })
  yield { type: 'done' }
}
