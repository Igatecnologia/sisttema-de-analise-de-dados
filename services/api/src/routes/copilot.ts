import { Router, type Response, type NextFunction, type Request } from 'express'
import { ipKeyGenerator } from 'express-rate-limit'
import { redisRateLimit } from '../middleware/redisRateLimit.js'
import { randomBytes } from 'node:crypto'
import { z } from 'zod'
import { requireAuth } from '../middleware/auth.js'
import { maxBodySize } from '../middleware/maxBodySize.js'
import { getDb } from '../db/sqlite.js'
import { getPostgresPool, hasPostgresConfig } from '../db/postgres.js'
import type { AuthenticatedRequest } from '../middleware/auth.js'
import { readAllUsersCachedAsync } from '../userStorage.js'
import { runCopilot } from '../services/ai/orchestrator.js'
import { resolveProvider } from '../services/ai/providerFactory.js'
import type { ChatMessage } from '../services/ai/types.js'
import { isV2Configured, proxyChatToV2, shouldUseV2 } from '../services/ai/v2Proxy.js'
import { resolveTenantId } from '../utils/tenant.js'
import { maskPii } from '../utils/piiMask.js'
import {
  getCopilotConfigPublic,
  updateCopilotConfig,
  type CopilotProviderChoice,
} from '../services/ai/copilotConfigStore.js'
import { evaluatePlanLimit } from '../services/planLimits.js'
import { isCopilotOptedOut } from './userPreferences.js'
import { getCacheStats } from '../services/ai/promptCache.js'

export const copilotRouter = Router()
/** Mensagens do copilot ficam em ~4-8KB; 32KB cobre prompts longos com folga. */
copilotRouter.use(maxBodySize(32 * 1024))
copilotRouter.use(requireAuth)
const db = getDb()

function usePostgresStorage(): boolean {
  return process.env.IGA_STORAGE_DRIVER === 'postgres' && hasPostgresConfig()
}

async function loadRecentHistoryAsync(userId: string, tenantId: string): Promise<ChatMessage[]> {
  if (usePostgresStorage()) {
    const result = await getPostgresPool().query<{ role: string; content: string }>(
      `SELECT role, content FROM copilot_messages
       WHERE user_id = $1 AND tenant_id = $2 ORDER BY created_at DESC LIMIT $3`,
      [userId, tenantId, MAX_HISTORY_MESSAGES],
    )
    return result.rows
      .reverse()
      .filter((r) => r.role === 'user' || r.role === 'assistant')
      .map((r) => ({ role: r.role as 'user' | 'assistant', content: r.content }))
  }
  return loadRecentHistory(userId, tenantId)
}

async function readUserPreferencesJson(userId: string): Promise<string | null> {
  if (usePostgresStorage()) {
    const result = await getPostgresPool().query<{ preferences_json: string | null }>(
      'SELECT preferences_json FROM users WHERE id = $1 LIMIT 1',
      [userId],
    )
    return result.rows[0]?.preferences_json ?? null
  }
  const row = db
    .prepare('SELECT preferences_json FROM users WHERE id = ? LIMIT 1')
    .get(userId) as { preferences_json: string | null } | undefined
  return row?.preferences_json ?? null
}

async function insertCopilotMessage(id: string, userId: string, tenantId: string, role: string, content: string, createdAt: string) {
  if (usePostgresStorage()) {
    await getPostgresPool().query(
      'INSERT INTO copilot_messages (id, tenant_id, user_id, role, content, created_at) VALUES ($1, $2, $3, $4, $5, $6)',
      [id, tenantId, userId, role, content, createdAt],
    )
    return
  }
  db.prepare(
    'INSERT INTO copilot_messages (id, tenant_id, user_id, role, content, created_at) VALUES (?, ?, ?, ?, ?, ?)',
  ).run(id, tenantId, userId, role, content, createdAt)
}

/** 20 msgs/min por usuário — evita abuso e estouro da free tier do Gemini. */
const chatLimiter = redisRateLimit({
  namespace: 'copilot:chat',
  windowMs: 60_000,
  max: 20,
  keyGenerator: (req) => {
    const userId = (req as AuthenticatedRequest).userId
    return userId ? `user:${userId}` : ipKeyGenerator(req.ip ?? '')
  },
  message: { message: 'Muitas perguntas em sequência. Aguarde um instante.' },
})

const ChatBody = z.object({
  prompt: z.string().trim().min(1, 'Prompt obrigatório').max(4000, 'Prompt muito longo (máx 4000)'),
})

const MAX_HISTORY_MESSAGES = 12 // últimas 6 trocas — melhor contexto conversacional

function writeEvent(res: Response, event: { type: string; text?: string; message?: string }) {
  res.write(`data: ${JSON.stringify(event)}\n\n`)
}

function sanitizeForManager(text: string): string {
  let out = text
  // remove ids técnicos comuns
  out = out.replace(/\bds_[a-z0-9_]+\b/gi, 'fonte')
  // neutraliza jargões técnicos comuns
  out = out.replace(/\b(endpoint|payload|schema|provider|header|token|tool(?:_call)?|api|http)\b/gi, '')
  // limpa espaços duplicados criados pelas substituições
  out = out.replace(/[ \t]{2,}/g, ' ').replace(/\s+\./g, '.').replace(/\s+,/g, ',')
  // Em stream SSE, remover espaço à esquerda em cada token cola a frase inteira.
  // Mantemos os espaços para preservar legibilidade.
  return out
}

function loadRecentHistory(userId: string, tenantId: string): ChatMessage[] {
  const rows = db
    .prepare(`
      SELECT role, content FROM copilot_messages
      WHERE user_id = ? AND tenant_id = ? ORDER BY created_at DESC LIMIT ?
    `)
    .all(userId, tenantId, MAX_HISTORY_MESSAGES) as Array<{ role: string; content: string }>
  return rows
    .reverse()
    .filter((r) => r.role === 'user' || r.role === 'assistant')
    .map((r) => ({ role: r.role as 'user' | 'assistant', content: r.content }))
}

copilotRouter.post('/chat', chatLimiter, async (req, res) => {
  const authReq = req as AuthenticatedRequest
  const tenantId = resolveTenantId(req)
  const parsed = ChatBody.safeParse(req.body ?? {})
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'Payload inválido' })
  }
  /** P0-05 (LGPD Art. 18 IX): respeitar opt-out granular do user. */
  if (await isCopilotOptedOut(authReq.userId)) {
    return res.status(403).json({
      message: 'Você desativou o Copilot nas suas preferências. Reative em /configuracoes.',
      reason: 'copilot_opted_out',
    })
  }
  const userPrompt = parsed.data.prompt
  const limit = await evaluatePlanLimit(tenantId, 'copilotMessagesMonthly')
  if (!limit.allowed) {
    return res.status(402).json({
      message: limit.message,
      reason: 'plan_limit_reached',
      resource: limit.key,
      plan: limit.plan,
      used: limit.used,
      limit: limit.limit,
    })
  }

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no') // desativa buffering em proxies reversos

  // Client disconnect → aborta provider
  const abort = new AbortController()
  req.on('close', () => abort.abort())

  const history = await loadRecentHistoryAsync(authReq.userId, tenantId)
  const currentUser = (await readAllUsersCachedAsync()).find((u) => u.id === authReq.userId)
  const userName = currentUser?.name?.trim() || 'Usuário'
  const prefix = `${userName}, `
  let prefixed = false

  // Ler meta mensal do usuário para injetar no contexto do prompt
  const prefRaw = await readUserPreferencesJson(authReq.userId)
  const parsedPrefs = prefRaw ? JSON.parse(prefRaw) : null
  const monthlyGoal = parsedPrefs?.monthlyRevenueGoal ?? parsedPrefs?.executiveTargets?.monthlyRevenue ?? null

  const now = new Date().toISOString()
  await insertCopilotMessage(
    `msg_${randomBytes(6).toString('hex')}`,
    authReq.userId,
    tenantId,
    'user',
    maskPii(userPrompt),
    now,
  )

  let assistantFull = ''
  // V2 (Python iga-ai) se feature flag liga + service configurado
  const useV2 = isV2Configured() && shouldUseV2(tenantId)
  if (useV2) {
    console.log(`[copilot] roteando para V2 (Python) tenant=${tenantId}`)
  }
  try {
    const v2Stream = useV2
      ? proxyChatToV2({
          claims: {
            sub: authReq.userId,
            tid: tenantId,
            role: authReq.userRole,
            plan: 'pro', // TODO: derivar do billing real
            name: userName,
            goal: monthlyGoal,
          },
          history: history
            .filter((m): m is { role: 'user' | 'assistant'; content: string } =>
              (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string',
            ),
          userPrompt,
          monthlyGoal,
          sessionId: undefined,
          signal: abort.signal,
        })
      : null
    const stream = v2Stream ?? runCopilot({
      history,
      userPrompt,
      userId: authReq.userId,
      userName,
      userRole: authReq.userRole,
      tenantId,
      monthlyGoal,
      signal: abort.signal,
    })
    for await (const evt of stream) {
      if (evt.type === 'token') {
        const base = !prefixed ? `${prefix}${evt.text}` : evt.text
        const text = sanitizeForManager(base)
        if (!prefixed) prefixed = true
        assistantFull += text
        writeEvent(res, { type: 'token', text })
      } else if (evt.type === 'error') {
        writeEvent(res, { type: 'token', text: `\n_(erro: ${evt.message})_` })
      } else if (evt.type === 'done') {
        break
      }
    }
  } catch (err) {
    console.error('[copilot] erro no stream:', (err as Error).message)
    writeEvent(res, { type: 'token', text: '\n_(falha inesperada no copiloto)_' })
  }

  // Garante que a UI nunca fique sem resposta visível ("...").
  if (!assistantFull.trim()) {
    const fallbackText =
      `${userName}, não consegui concluir essa resposta agora. ` +
      'Posso tentar novamente com um resumo geral ou com um período específico.'
    assistantFull = fallbackText
    writeEvent(res, { type: 'token', text: fallbackText })
  }

  if (assistantFull.trim()) {
    await insertCopilotMessage(
      `msg_${randomBytes(6).toString('hex')}`,
      authReq.userId,
      tenantId,
      'assistant',
      maskPii(assistantFull),
      new Date().toISOString(),
    )
  }

  writeEvent(res, { type: 'done' })
  res.end()
})

copilotRouter.get('/mode', async (_req, res) => {
  const provider = await resolveProvider()
  res.json({
    mode: provider.name === 'local' ? 'local-free' : provider.name,
    provider: provider.name,
    displayName: provider.displayName,
    paidApiEnabled: false,
    features: {
      streaming: true,
      toolCalling: provider.name !== 'local' || true,
      history: true,
    },
  })
})

copilotRouter.get('/history', async (req, res) => {
  const authReq = req as AuthenticatedRequest
  const tenantId = resolveTenantId(req)
  let rows: Array<{ id: string; role: string; content: string; created_at: string }>
  if (usePostgresStorage()) {
    const result = await getPostgresPool().query<{ id: string; role: string; content: string; created_at: string }>(
      'SELECT id, role, content, created_at FROM copilot_messages WHERE user_id = $1 AND tenant_id = $2 ORDER BY created_at DESC LIMIT 40',
      [authReq.userId, tenantId],
    )
    rows = result.rows
  } else {
    rows = db
      .prepare(
        'SELECT id, role, content, created_at FROM copilot_messages WHERE user_id = ? AND tenant_id = ? ORDER BY created_at DESC LIMIT 40',
      )
      .all(authReq.userId, tenantId) as Array<{ id: string; role: string; content: string; created_at: string }>
  }
  res.json(rows.reverse())
})

copilotRouter.delete('/history', async (req, res) => {
  const authReq = req as AuthenticatedRequest
  const tenantId = resolveTenantId(req)
  if (usePostgresStorage()) {
    await getPostgresPool().query('DELETE FROM copilot_messages WHERE user_id = $1 AND tenant_id = $2', [authReq.userId, tenantId])
  } else {
    db.prepare('DELETE FROM copilot_messages WHERE user_id = ? AND tenant_id = ?').run(authReq.userId, tenantId)
  }
  res.status(204).end()
})

/* ─── Configuração do Copiloto (admin-only) ───────────────────────────── */

function requireAdminRole(req: Request, res: Response, next: NextFunction) {
  if ((req as AuthenticatedRequest).userRole !== 'admin') {
    return res.status(403).json({ message: 'Acesso restrito a administradores' })
  }
  next()
}

const ProviderEnum = z.enum(['auto', 'openai', 'anthropic', 'gemini', 'groq', 'openrouter', 'custom', 'local'])

const ConfigUpdateBody = z.object({
  provider: ProviderEnum.optional(),
  apiKey: z.string().trim().max(500).nullable().optional(),
  model: z.string().trim().max(200).nullable().optional(),
  baseUrl: z.string().trim().url().max(500).nullable().optional(),
})

copilotRouter.get('/config', requireAdminRole, async (_req, res) => {
  res.json(await getCopilotConfigPublic())
})

copilotRouter.put('/config', requireAdminRole, async (req, res) => {
  const parsed = ConfigUpdateBody.safeParse(req.body ?? {})
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'Payload inválido' })
  }
  const authReq = req as AuthenticatedRequest
  const updated = await updateCopilotConfig(
    {
      provider: parsed.data.provider as CopilotProviderChoice | undefined,
      apiKey: parsed.data.apiKey,
      model: parsed.data.model,
      baseUrl: parsed.data.baseUrl,
    },
    authReq.userId,
  )
  res.json(updated)
})

/**
 * Valida a config atual fazendo uma chamada real de baixo custo ao provider
 * selecionado. Retorna {ok, provider, error?} — evita que o admin descubra
 * problema de chave só na primeira pergunta real do usuário.
 */
copilotRouter.post('/config/test', requireAdminRole, async (_req, res) => {
  try {
    const provider = await resolveProvider()
    if (provider.name === 'local') {
      return res.json({
        ok: true,
        provider: 'local',
        displayName: provider.displayName,
        note: 'Nenhum LLM configurado — usando modo local (regex + tools). Configure Gemini ou Ollama para respostas com IA real.',
      })
    }

    // Teste leve: 1 mensagem de 3 palavras, sem tools, coleta no máx 50 tokens
    let tokens = ''
    let errored: string | null = null
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 10_000)
    try {
      for await (const evt of provider.stream({
        systemPrompt: 'Responda apenas "ok".',
        messages: [{ role: 'user', content: 'ping' }],
        signal: controller.signal,
      })) {
        if (evt.type === 'token') {
          tokens += evt.text
          if (tokens.length > 50) break
        } else if (evt.type === 'error') {
          errored = evt.message
          break
        } else if (evt.type === 'done') {
          break
        }
      }
    } finally {
      clearTimeout(timer)
    }

    if (errored) {
      return res.status(502).json({ ok: false, provider: provider.name, error: errored })
    }
    return res.json({
      ok: true,
      provider: provider.name,
      displayName: provider.displayName,
      sample: tokens.trim().slice(0, 100),
    })
  } catch (err) {
    return res.status(500).json({ ok: false, error: (err as Error).message })
  }
})

/**
 * P2-08 (audit 2026-05-12): feedback 👍/👎 do user em respostas do Copilot.
 * Permite coletar signals pra refinar prompts, comparar providers, decidir
 * descontinuar tools que erram muito.
 */
const feedbackSchema = z.object({
  messageId: z.string().min(1).max(120),
  score: z.union([z.literal(1), z.literal(-1)]),
  comment: z.string().max(2000).optional(),
  provider: z.string().max(40).optional(),
  model: z.string().max(80).optional(),
})

copilotRouter.post('/feedback', async (req, res) => {
  const authReq = req as AuthenticatedRequest
  const parsed = feedbackSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'Dados invalidos' })
  const tenantId = resolveTenantId(req)
  const now = new Date().toISOString()
  /** UPSERT: user pode mudar 👍↔👎 ou adicionar comment posterior. */
  if (process.env.IGA_STORAGE_DRIVER === 'postgres' && hasPostgresConfig()) {
    await getPostgresPool().query(
      `INSERT INTO copilot_feedback (tenant_id, user_id, message_id, score, comment, provider, model, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (user_id, message_id) DO UPDATE SET
         score = EXCLUDED.score,
         comment = COALESCE(EXCLUDED.comment, copilot_feedback.comment),
         provider = COALESCE(EXCLUDED.provider, copilot_feedback.provider),
         model = COALESCE(EXCLUDED.model, copilot_feedback.model),
         created_at = EXCLUDED.created_at`,
      [tenantId, authReq.userId, parsed.data.messageId, parsed.data.score,
       parsed.data.comment ?? null, parsed.data.provider ?? null, parsed.data.model ?? null, now],
    )
  } else {
    getDb().prepare(`
      INSERT INTO copilot_feedback (tenant_id, user_id, message_id, score, comment, provider, model, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id, message_id) DO UPDATE SET
        score = excluded.score,
        comment = COALESCE(excluded.comment, copilot_feedback.comment),
        provider = COALESCE(excluded.provider, copilot_feedback.provider),
        model = COALESCE(excluded.model, copilot_feedback.model),
        created_at = excluded.created_at
    `).run(tenantId, authReq.userId, parsed.data.messageId, parsed.data.score,
      parsed.data.comment ?? null, parsed.data.provider ?? null, parsed.data.model ?? null, now)
  }
  res.status(201).json({ ok: true })
})

/** GET admin: agregados de feedback pra decidir provider/model/tool changes. */
copilotRouter.get('/feedback/stats', requireAdminRole, async (req, res) => {
  const tenantId = resolveTenantId(req)
  if (process.env.IGA_STORAGE_DRIVER === 'postgres' && hasPostgresConfig()) {
    const r = await getPostgresPool().query<{
      total: string; up: string; down: string; provider: string | null; model: string | null
    }>(
      `SELECT count(*)::text AS total,
              count(*) FILTER (WHERE score = 1)::text AS up,
              count(*) FILTER (WHERE score = -1)::text AS down,
              provider, model
       FROM copilot_feedback
       WHERE tenant_id = $1
       GROUP BY provider, model
       ORDER BY count(*) DESC
       LIMIT 50`,
      [tenantId],
    )
    return res.json({ tenantId, byProvider: r.rows })
  }
  const rows = getDb().prepare(`
    SELECT COUNT(*) AS total,
           SUM(CASE WHEN score = 1 THEN 1 ELSE 0 END) AS up,
           SUM(CASE WHEN score = -1 THEN 1 ELSE 0 END) AS down,
           provider, model
    FROM copilot_feedback
    WHERE tenant_id = ?
    GROUP BY provider, model
    ORDER BY COUNT(*) DESC
    LIMIT 50
  `).all(tenantId)
  res.json({ tenantId, byProvider: rows })
})

/** P2-06: stats do cache de IA pro dashboard admin. */
copilotRouter.get('/cache/stats', requireAdminRole, (_req, res) => {
  res.json(getCacheStats())
})
