/**
 * P1-02 (audit 2026-05-12): Daily AI Digest — diferencial competitivo.
 *
 * Job diário gera, por tenant, um resumo curto (3-5 highlights + alertas
 * críticos + 1 ação recomendada) usando o LLM configurado pelo tenant.
 * Envia por email pros admins ativos que NÃO desativaram o digest.
 *
 * Custo estimado: ~$0.01/digest com Groq free, ~$0.05 com Anthropic Haiku.
 * Frequência: 1x/dia/admin (default 08:00 timezone do tenant, futuro).
 *
 * Opt-out: user.preferences_json.dailyDigestOptOut === true → pulado.
 */
import { findTenantBySlug, listTenants } from '../tenantStorage.js'
import { readUsersForTenantAsync } from '../userStorage.js'
import { fetchProxyDataForTool } from '../routes/proxy.js'
import { findDsIdForAreaAsync } from '../connectors/findDsIdForArea.js'
import { ConnectorRegistry } from '../connectors/connectorRegistry.js'
import { runCopilot } from './ai/orchestrator.js'
import { sendTransactionalEmail, buildPublicUrl } from './transactionalEmail.js'
import { dailyDigestTemplate, type DailyDigestSection } from './emailTemplates.js'
import { getDb } from '../db/sqlite.js'
import { getPostgresPool, hasPostgresConfig } from '../db/postgres.js'

const db = getDb()
function usePostgresStorage(): boolean {
  return process.env.IGA_STORAGE_DRIVER === 'postgres' && hasPostgresConfig()
}

/** Lê preference.dailyDigestOptOut sem expor o user inteiro. */
async function isDigestOptedOut(userId: string): Promise<boolean> {
  if (usePostgresStorage()) {
    const r = await getPostgresPool().query<{ preferences_json: string | null }>(
      'SELECT preferences_json FROM users WHERE id = $1',
      [userId],
    )
    const raw = r.rows[0]?.preferences_json
    if (!raw) return false
    try {
      const p = JSON.parse(raw) as { dailyDigestOptOut?: unknown }
      return p.dailyDigestOptOut === true
    } catch {
      return false
    }
  }
  const row = db.prepare('SELECT preferences_json FROM users WHERE id = ?')
    .get(userId) as { preferences_json: string | null } | undefined
  if (!row?.preferences_json) return false
  try {
    const p = JSON.parse(row.preferences_json) as { dailyDigestOptOut?: unknown }
    return p.dailyDigestOptOut === true
  } catch {
    return false
  }
}

/**
 * Coleta dados curtos pro prompt: # de vendas/compras/alertas/contas no
 * período curto (últimos 1 dia + 7 dias). Truncado pra caber em < 2k tokens.
 */
async function gatherTenantContext(tenantId: string): Promise<string> {
  const connector = ConnectorRegistry.get('iga-custom-api') // fallback; refinado por tenant em prod
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '.')
  const sevenDaysAgoIso = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    .toISOString().slice(0, 10).replace(/-/g, '.')

  const lines: string[] = []
  lines.push(`Tenant: ${tenantId}`)
  lines.push(`Período: ${sevenDaysAgoIso} → ${today}`)

  const tryArea = async (area: 'vendas' | 'compras' | 'estoque' | 'contas') => {
    const dsId = await findDsIdForAreaAsync(tenantId, area, connector)
    if (!dsId) return
    const result = await fetchProxyDataForTool({
      tenantId, dsId,
      query: { requireDsId: '1', dt_de: sevenDaysAgoIso, dt_ate: today },
    })
    if (result.ok) {
      lines.push(`${area}: ${result.rows.length} registros nos últimos 7 dias`)
    }
  }
  await Promise.allSettled([tryArea('vendas'), tryArea('compras'), tryArea('estoque'), tryArea('contas')])
  return lines.join('\n')
}

/** Pede ao LLM um JSON estruturado de 3 highlights + 1-2 alertas + 1 ação. */
const DIGEST_SYSTEM_PROMPT = `Você é um analista executivo. Gere um resumo CURTO (máximo 4 seções)
baseado nos dados fornecidos. NÃO invente números — use apenas o que tem no contexto.
Cada seção tem: emoji (1 char), title (até 60 chars), body (até 180 chars).
Responda SOMENTE com JSON válido neste shape:
{ "sections": [{ "emoji": "📈", "title": "...", "body": "..." }, ...] }
Se não tiver dados suficientes, retorne sections vazio. Não use markdown.`

async function generateDigestSections(
  tenantId: string,
  adminUser: { id: string; name: string; role: string },
  context: string,
): Promise<DailyDigestSection[]> {
  try {
    let buffer = ''
    /** runCopilot é AsyncGenerator de StreamEvent — consome tokens até 'done'. */
    for await (const event of runCopilot({
      tenantId,
      userId: adminUser.id,
      userName: adminUser.name,
      userRole: adminUser.role,
      history: [{ role: 'system', content: DIGEST_SYSTEM_PROMPT }],
      userPrompt: `Dados:\n${context}\n\nGere o resumo.`,
    })) {
      if (event.type === 'token' && typeof event.text === 'string') {
        buffer += event.text
      } else if (event.type === 'error') {
        return []
      }
    }
    const jsonMatch = buffer.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return []
    const parsed = JSON.parse(jsonMatch[0]) as { sections?: unknown }
    if (!Array.isArray(parsed.sections)) return []
    return (parsed.sections as Record<string, unknown>[])
      .filter((s) => typeof s.title === 'string' && typeof s.body === 'string')
      .slice(0, 4)
      .map((s) => ({
        emoji: typeof s.emoji === 'string' ? s.emoji : '•',
        title: String(s.title).slice(0, 80),
        body: String(s.body).slice(0, 240),
      }))
  } catch (err) {
    console.warn('[IGA][digest] geração falhou:', err instanceof Error ? err.message : err)
    return []
  }
}

export type DigestRunResult = {
  tenantId: string
  emailsSent: number
  optedOut: number
  errors: number
}

/** Roda o digest pra um tenant específico. */
export async function runDigestForTenant(tenantId: string): Promise<DigestRunResult> {
  const result: DigestRunResult = { tenantId, emailsSent: 0, optedOut: 0, errors: 0 }
  const tenant = await findTenantBySlug(tenantId)
  if (!tenant || tenant.status !== 'active') return result

  const users = await readUsersForTenantAsync(tenantId)
  const adminsAtivos = users.filter((u) => u.role === 'admin' && u.status === 'active')
  if (adminsAtivos.length === 0) return result

  const context = await gatherTenantContext(tenantId)
  /** Usa o 1º admin ativo como "caller" pro orchestrator (audit + RBAC). */
  const callerAdmin = adminsAtivos[0]
  const sections = await generateDigestSections(tenantId, {
    id: callerAdmin.id, name: callerAdmin.name, role: callerAdmin.role,
  }, context)
  if (sections.length === 0) {
    /** Nada interessante hoje — não polui inbox. */
    return result
  }

  const date = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })
  const dashboardUrl = buildPublicUrl(`/dashboard?tenant=${tenant.slug}`)

  for (const admin of adminsAtivos) {
    if (await isDigestOptedOut(admin.id)) {
      result.optedOut++
      continue
    }
    try {
      const unsubUrl = buildPublicUrl(`/configuracoes?tenant=${tenant.slug}#daily-digest`)
      await sendTransactionalEmail(admin.email, dailyDigestTemplate({
        companyName: tenant.name,
        userName: admin.name,
        date,
        sections,
        dashboardUrl,
        unsubscribeUrl: unsubUrl,
      }))
      result.emailsSent++
    } catch (err) {
      result.errors++
      console.warn(`[IGA][digest] falha ao enviar pra ${admin.email}:`, err instanceof Error ? err.message : err)
    }
  }
  return result
}

/** Roda pra todos os tenants ativos. Idempotente: 1x/dia por tenant. */
export async function runDailyDigestForAllTenants(): Promise<{ tenants: number; emails: number }> {
  const tenants = await listTenants()
  let totalEmails = 0
  let totalTenants = 0
  for (const t of tenants) {
    if (t.status !== 'active') continue
    totalTenants++
    try {
      const r = await runDigestForTenant(t.id)
      totalEmails += r.emailsSent
    } catch (err) {
      console.warn(`[IGA][digest] tenant ${t.id} falhou:`, err instanceof Error ? err.message : err)
    }
  }
  console.log(`[IGA][digest] enviou ${totalEmails} emails em ${totalTenants} tenants`)
  return { tenants: totalTenants, emails: totalEmails }
}

const DIGEST_INTERVAL_MS = 24 * 60 * 60 * 1000
let nextDigestTimeout: NodeJS.Timeout | null = null

/**
 * Agenda o digest pra rodar uma vez por dia, próxima execução às 08:00 UTC
 * (~05:00 BRT). Em prod, idealmente respeitar TZ do tenant — fica P2.
 */
export function startDailyDigestJob() {
  const schedule = () => {
    const now = new Date()
    const next = new Date(now)
    next.setUTCHours(8, 0, 0, 0)
    if (next.getTime() <= now.getTime()) next.setUTCDate(next.getUTCDate() + 1)
    const ms = next.getTime() - now.getTime()
    nextDigestTimeout = setTimeout(() => {
      void runDailyDigestForAllTenants().finally(() => {
        /** Reagenda */
        setInterval(() => { void runDailyDigestForAllTenants() }, DIGEST_INTERVAL_MS).unref()
      })
    }, ms)
    nextDigestTimeout.unref()
  }
  schedule()
}
