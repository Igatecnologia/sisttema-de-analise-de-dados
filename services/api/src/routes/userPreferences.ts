import { Router } from 'express'
import { z } from 'zod'
import { getDb } from '../db/sqlite.js'
import { getPostgresPool, hasPostgresConfig } from '../db/postgres.js'
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth.js'

const preferencesSchema = z.object({
  theme: z.enum(['light', 'dark']).optional(),
  sidebarCollapsed: z.boolean().optional(),
  defaultDateRange: z.string().max(40).optional(),
  monthlyRevenueGoal: z.number().nonnegative().optional(),
  favoriteReports: z.array(z.string().max(120)).max(50).optional(),
  alertSubscriptions: z.array(z.string().max(80)).max(50).optional(),
  dashboardLayout: z.array(z.string().max(80)).max(40).optional(),
  /** Layout de widgets por pagina: { dashboard: ['a','b'], operacional: [...] } */
  pageLayouts: z.record(z.string().max(40), z.array(z.string().max(80)).max(40)).optional(),
  /** P0-05 (audit 2026-05-12): LGPD Art. 18 IX — revogação granular de consentimento.
   *  Quando true, /copilot/chat retorna 403 sem processar nada. */
  copilotOptOut: z.boolean().optional(),
})

/**
 * Helper para outros módulos checarem o opt-out sem ter que parsear JSON
 * manualmente. Retorna `true` se o user explicitamente desativou o Copilot.
 */
export async function isCopilotOptedOut(userId: string): Promise<boolean> {
  const raw = await readPreferencesJson(userId)
  if (!raw) return false
  try {
    const parsed = JSON.parse(raw) as { copilotOptOut?: unknown }
    return parsed.copilotOptOut === true
  } catch {
    return false
  }
}

export const userPreferencesRouter = Router()
userPreferencesRouter.use(requireAuth)
const db = getDb()

function usePostgresStorage(): boolean {
  return process.env.IGA_STORAGE_DRIVER === 'postgres' && hasPostgresConfig()
}

async function readPreferencesJson(userId: string): Promise<string | null> {
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

async function writePreferencesJson(userId: string, json: string, updatedAt: string) {
  if (usePostgresStorage()) {
    await getPostgresPool().query(
      'UPDATE users SET preferences_json = $1, updated_at = $2 WHERE id = $3',
      [json, updatedAt, userId],
    )
    return
  }
  db.prepare('UPDATE users SET preferences_json = ?, updated_at = ? WHERE id = ?').run(json, updatedAt, userId)
}

userPreferencesRouter.get('/me/preferences', async (req, res) => {
  const authReq = req as AuthenticatedRequest
  const raw = await readPreferencesJson(authReq.userId)
  const parsed = raw ? JSON.parse(raw) : {}
  res.json(parsed)
})

userPreferencesRouter.put('/me/preferences', async (req, res) => {
  const authReq = req as AuthenticatedRequest
  const parsed = preferencesSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'Preferências inválidas' })
  }
  // Faz MERGE com as preferências existentes (patch parcial) — antes sobrescrevia
  // tudo e perdia theme/favoriteReports/etc ao salvar só layout.
  const raw = await readPreferencesJson(authReq.userId)
  const current = raw ? (JSON.parse(raw) as Record<string, unknown>) : {}
  const merged = {
    ...current,
    ...parsed.data,
    pageLayouts: {
      ...((current.pageLayouts as Record<string, string[]> | undefined) ?? {}),
      ...(parsed.data.pageLayouts ?? {}),
    },
  }
  await writePreferencesJson(authReq.userId, JSON.stringify(merged), new Date().toISOString())
  res.json(merged)
})
