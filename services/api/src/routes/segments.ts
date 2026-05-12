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

/**
 * P2-01 (audit 2026-05-12): Quick Insights por segmento.
 *
 * GET /api/v1/segments/templates  — lista todos os pacotes disponíveis
 * GET /api/v1/segments/templates/:segment — detalha 1 (widgets+alerts+reports)
 *
 * Frontend usa pra renderizar o card "Aplicar pacote pronto pra Indústria"
 * no onboarding/empty state. A aplicação efetiva (criar widgets/alerts no
 * DB) é feita por outro endpoint quando o usuário confirmar.
 */
import { getSegmentTemplate, listSegmentTemplates } from '../services/segmentTemplates.js'
import { isBusinessSegment } from '../segments.js'

segmentsRouter.get('/templates', publicLimiter, (_req, res) => {
  res.setHeader('Cache-Control', 'public, max-age=600')
  res.json({ templates: listSegmentTemplates() })
})

segmentsRouter.get('/templates/:segment', publicLimiter, (req, res) => {
  const seg = String(req.params.segment ?? '').toLowerCase()
  if (!isBusinessSegment(seg)) return res.status(404).json({ message: 'Segmento desconhecido' })
  res.setHeader('Cache-Control', 'public, max-age=600')
  res.json(getSegmentTemplate(seg))
})
