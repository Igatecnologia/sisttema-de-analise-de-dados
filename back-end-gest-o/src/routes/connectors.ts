import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { ConnectorRegistry } from '../connectors/connectorRegistry.js'

/**
 * GET /api/v1/connectors — lista connectors disponiveis (S8).
 * Frontend usa para popular marketplace de integracoes.
 */
export const connectorsRouter = Router()
connectorsRouter.use(requireAuth)

connectorsRouter.get('/', (_req, res) => {
  const list = ConnectorRegistry.list().map((c) => ({
    id: c.id,
    name: c.name,
    labels: c.labels,
    cspConnectSrc: c.cspConnectSrc,
    /** Areas que o connector suporta (chaves nao vazias em areaHints). */
    areas: Object.entries(c.areaHints)
      .filter(([, hints]) => hints.length > 0)
      .map(([area]) => area),
    warmTargets: c.warmTargets.map((t) => ({ label: t.label, area: t.area })),
    /** Stub status: sgbr-espuma e csv/generic sao "ready"; bling/tiny/omie sao "coming-soon" ate plumb da API real. */
    status: c.id === 'sgbr-espuma' || c.id === 'generic' || c.id === 'csv' ? 'ready' : 'coming-soon',
  }))
  res.json({ connectors: list })
})
