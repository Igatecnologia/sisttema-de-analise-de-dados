import jwt from 'jsonwebtoken'
import { randomUUID } from 'node:crypto'

/**
 * Proxy do Node para o microservico iga-ai (Python).
 *
 * - Emite JWT shared secret (HS256, 5min TTL, aud=iga-ai, iss=iga-backend)
 * - Faz POST /chat para o iga-ai como SSE
 * - Re-emite eventos para o cliente Node (que ja faz seu proprio SSE)
 *
 * Feature flag: COPILOT_USE_V2_TENANTS (CSV de tenant_id), ou COPILOT_USE_V2=*
 * para todos. Sem env, V2 nunca ativa — V1 (TS) eh default.
 */

const ALG = 'HS256'
const TTL_SECONDS = 5 * 60

export type SharedClaims = {
  sub: string // user_id
  tid: string // tenant_id
  role: string
  plan: string
  name?: string
  goal?: number | null
}

export function shouldUseV2(tenantId: string): boolean {
  const flag = process.env.COPILOT_USE_V2?.trim()
  if (flag === '*' || flag === '1' || flag === 'true') return true
  const csv = process.env.COPILOT_USE_V2_TENANTS?.trim()
  if (!csv) return false
  return csv.split(',').map((s) => s.trim()).includes(tenantId)
}

export function isV2Configured(): boolean {
  return Boolean(process.env.IGA_AI_BASE_URL && process.env.IGA_AI_SHARED_SECRET)
}

export function signSharedJwt(claims: SharedClaims): string {
  const secret = process.env.IGA_AI_SHARED_SECRET
  if (!secret) throw new Error('IGA_AI_SHARED_SECRET nao configurado')
  return jwt.sign(
    {
      iss: 'iga-backend',
      aud: 'iga-ai',
      sub: claims.sub,
      tid: claims.tid,
      role: claims.role,
      plan: claims.plan,
      name: claims.name,
      goal: claims.goal ?? null,
      jti: randomUUID(),
    },
    secret,
    { algorithm: ALG, expiresIn: TTL_SECONDS },
  )
}

export type V2StreamEvent =
  | { type: 'token'; text: string }
  | { type: 'tool_call'; name: string; args: Record<string, unknown> }
  | { type: 'done' }
  | { type: 'error'; message: string }

/**
 * Chama POST /chat do iga-ai e re-emite eventos como AsyncGenerator.
 */
export async function* proxyChatToV2(opts: {
  claims: SharedClaims
  history: Array<{ role: 'user' | 'assistant'; content: string }>
  userPrompt: string
  monthlyGoal?: number | null
  sessionId?: string
  signal?: AbortSignal
}): AsyncGenerator<V2StreamEvent, void, void> {
  const baseUrl = process.env.IGA_AI_BASE_URL
  if (!baseUrl) {
    yield { type: 'error', message: 'IGA_AI_BASE_URL nao configurado' }
    return
  }

  const token = signSharedJwt(opts.claims)
  let response: Response
  try {
    response = await fetch(`${baseUrl.replace(/\/$/, '')}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...(opts.sessionId ? { 'X-AI-Conversation-Id': opts.sessionId } : {}),
      },
      body: JSON.stringify({
        user_prompt: opts.userPrompt,
        history: opts.history,
        user_name: opts.claims.name,
        monthly_goal: opts.monthlyGoal ?? null,
        session_id: opts.sessionId,
      }),
      signal: opts.signal,
    })
  } catch (err) {
    yield { type: 'error', message: `Falha de rede iga-ai: ${(err as Error).message}` }
    return
  }

  if (!response.ok || !response.body) {
    yield { type: 'error', message: `iga-ai HTTP ${response.status}` }
    return
  }

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
      const dataLine = raw
        .split('\n')
        .map((l) => l.trim())
        .find((l) => l.startsWith('data:'))
      if (!dataLine) continue
      const payload = dataLine.slice(5).trim()
      if (!payload) continue
      try {
        const parsed = JSON.parse(payload) as V2StreamEvent
        yield parsed
        if (parsed.type === 'done' || parsed.type === 'error') return
      } catch {
        /* ignora linha invalida */
      }
    }
  }
}
