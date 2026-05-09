import { Router } from 'express'
import { BUSINESS_SEGMENTS, SEGMENT_DEFINITIONS } from '../segments.js'
import { ConnectorRegistry } from '../connectors/connectorRegistry.js'
import { redisRateLimit } from '../middleware/redisRateLimit.js'

/**
 * Endpoint público — sem auth — para o RegisterPage e Onboarding listarem
 * segmentos disponíveis e os connectors compatíveis com cada um.
 *
 * Resposta exemplo:
 * {
 *   "segments": [
 *     { "id": "industry", "name": "Indústria", "description": "...",
 *       "defaultModules": [...], "recommendedConnectorId": "iga-custom-api",
 *       "compatibleConnectors": [{ "id": "...", "name": "..." }, ...]
 *     },
 *     ...
 *   ]
 * }
 */
export const segmentsRouter = Router()

/**
 * Rate limit por IP — endpoint público, alvo natural de DOS. 60 req/min cobre
 * uso humano normal (signup-flow precisa só 1-2 calls) e bloqueia abuso.
 */
const publicLimiter = redisRateLimit({
  namespace: 'public:segments',
  windowMs: 60 * 1000,
  max: 60,
  message: { message: 'Muitas requisições. Aguarde 1 minuto.' },
})

/**
 * Cache em memória — a resposta é puramente derivada de constantes do código,
 * não muda entre boots. Calculamos uma vez e servimos sempre.
 */
type SegmentResponse = {
  id: string
  name: string
  description: string
  defaultModules: string[]
  recommendedConnectorId: string
  compatibleConnectors: { id: string; name: string }[]
}

let cachedSegments: SegmentResponse[] | null = null

function buildSegments(): SegmentResponse[] {
  return BUSINESS_SEGMENTS.map((segmentId) => {
    const def = SEGMENT_DEFINITIONS[segmentId]
    const compatibleConnectors = ConnectorRegistry.listBySegment(segmentId).map((c) => ({
      id: c.id,
      name: c.name,
    }))
    return {
      id: def.id,
      name: def.name,
      description: def.description,
      defaultModules: def.defaultModules,
      recommendedConnectorId: def.recommendedConnectorId,
      compatibleConnectors,
    }
  })
}

segmentsRouter.get('/', publicLimiter, (_req, res) => {
  if (!cachedSegments) cachedSegments = buildSegments()
  res.setHeader('Cache-Control', 'public, max-age=3600')
  res.json({ segments: cachedSegments })
})
