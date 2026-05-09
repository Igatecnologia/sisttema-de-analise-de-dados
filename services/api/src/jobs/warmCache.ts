/**
 * Warm Cache — mantem os endpoints declarados no connector do tenant sempre quentes.
 *
 * Comportamento:
 * - Para cada tenant com datasources, le `connector.warmTargets`
 * - Cada target eh resolvido via `findDsIdForArea(area, connector)`
 * - Se o connector nao tem warm targets, o tenant eh ignorado
 * - Fire-and-forget: nunca bloqueia o boot
 */
import { readAll } from '../storage.js'
import { fetchProxyDataForTool } from '../routes/proxy.js'
import { ConnectorRegistry } from '../connectors/connectorRegistry.js'
import { findDsIdForAreaIn } from '../connectors/findDsIdForArea.js'
import { findTenantBySlug } from '../tenantStorage.js'
import type { IndustryConnector, WarmTarget } from '../connectors/industryConnector.js'

const WARM_INTERVAL_MS = 12 * 60_000 // 12 min — cache TTL eh 15min, renova antes de expirar
const INITIAL_DELAY_MS = 10_000 // 10s pos-boot — deixa o backend estabilizar

type WarmResult = { tenantId: string; label: string; ms: number; rows: number; ok: boolean }

async function warmOne(
  target: WarmTarget,
  tenantId: string,
  connector: IndustryConnector,
  tenantSources: ReturnType<typeof readAll>,
): Promise<WarmResult> {
  const start = Date.now()
  const dsId = findDsIdForAreaIn(tenantSources, target.area, connector)
  if (!dsId) return { tenantId, label: target.label, ms: 0, rows: 0, ok: false }

  try {
    const result = await fetchProxyDataForTool({
      tenantId,
      dsId,
      query: { requireDsId: '1', ...target.query },
    })
    const ms = Date.now() - start
    const rows = result.ok ? result.rows.length : 0
    return { tenantId, label: target.label, ms, rows, ok: result.ok }
  } catch {
    return { tenantId, label: target.label, ms: Date.now() - start, rows: 0, ok: false }
  }
}

export async function runWarmCacheOnce() {
  const all = readAll()
  if (all.length === 0) return

  const tenantIds = [...new Set(all.map((d) => d.tenantId))]
  const startTotal = Date.now()
  const allResults: WarmResult[] = []
  let warmedTenants = 0

  for (const tenantId of tenantIds) {
    const tenantSources = all.filter((d) => d.tenantId === tenantId)
    if (tenantSources.length === 0) continue
    const tenant = await findTenantBySlug(tenantId)
    const connector = ConnectorRegistry.get(tenant?.connectorId)
    if (connector.warmTargets.length === 0) continue

    warmedTenants++
    const results = await Promise.all(
      connector.warmTargets.map((t) => warmOne(t, tenantId, connector, tenantSources)),
    )
    allResults.push(...results)
  }

  if (warmedTenants === 0) return

  const totalMs = Date.now() - startTotal
  const succeeded = allResults.filter((r) => r.ok)
  const summary = succeeded
    .map((r) => `${r.tenantId}/${r.label}:${r.rows}rows/${Math.round(r.ms / 1000)}s`)
    .join(', ')
  const failed = allResults.filter((r) => !r.ok).map((r) => `${r.tenantId}/${r.label}`)
  console.log(
    `[IGA][WARM] ${warmedTenants} tenant(s) em ${Math.round(totalMs / 1000)}s — ${summary}${failed.length ? ` | sem fonte: ${failed.join(', ')}` : ''}`,
  )
}

export function startWarmCacheJob() {
  setTimeout(() => {
    runWarmCacheOnce().catch((err) => {
      console.error('[IGA][WARM] Erro no preload:', err instanceof Error ? err.message : err)
    })
    setInterval(() => {
      runWarmCacheOnce().catch((err) => {
        console.error('[IGA][WARM] Erro no warm:', err instanceof Error ? err.message : err)
      })
    }, WARM_INTERVAL_MS).unref()
  }, INITIAL_DELAY_MS).unref()
}
