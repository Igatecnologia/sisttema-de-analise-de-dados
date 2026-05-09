import { Router } from 'express'
import { BUSINESS_SEGMENTS, SEGMENT_DEFINITIONS } from '../segments.js'
import { ConnectorRegistry } from '../connectors/connectorRegistry.js'

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

segmentsRouter.get('/', (_req, res) => {
  const segments = BUSINESS_SEGMENTS.map((segmentId) => {
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
  res.json({ segments })
})
