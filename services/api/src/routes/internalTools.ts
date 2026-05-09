import { Router } from 'express'
import jwt from 'jsonwebtoken'
import { executeTool } from '../services/ai/tools.js'

/**
 * Endpoints internos consumidos pelo microservico iga-ai (Python).
 *
 * Auth: JWT shared secret (HS256, IGA_AI_SHARED_SECRET), aud=iga-ai, iss=iga-backend.
 * NAO usa cookie de sessao — eh uma comunicacao server-to-server.
 *
 * Cada endpoint executa a tool correspondente do orchestrator com o tenant_id
 * e role extraidos do JWT, garantindo RLS aplicado.
 */

export const internalToolsRouter = Router()

type SharedClaims = {
  iss: string
  aud: string
  sub: string
  tid: string
  role: string
  plan: string
  name?: string
  goal?: number | null
  exp: number
  iat: number
  jti?: string
}

function verifyShared(req: import('express').Request): SharedClaims | null {
  const auth = req.headers.authorization
  if (!auth || !auth.toLowerCase().startsWith('bearer ')) return null
  const token = auth.slice(7).trim()
  const secret = process.env.IGA_AI_SHARED_SECRET
  if (!secret) return null
  try {
    return jwt.verify(token, secret, {
      algorithms: ['HS256'],
      audience: 'iga-ai',
      issuer: 'iga-backend',
    }) as SharedClaims
  } catch {
    return null
  }
}

/**
 * POST /api/v1/_internal/tools/:name
 * Body: argumentos da tool em JSON
 * Auth: JWT shared (Bearer)
 */
internalToolsRouter.post('/:name', async (req, res) => {
  const claims = verifyShared(req)
  if (!claims) {
    return res.status(401).json({ error: 'invalid_shared_jwt' })
  }
  const toolName = req.params.name
  const args = (req.body && typeof req.body === 'object') ? (req.body as Record<string, unknown>) : {}
  try {
    const result = await executeTool(toolName, args, {
      userId: claims.sub,
      userRole: claims.role,
      tenantId: claims.tid,
    })
    return res.json(result)
  } catch (err) {
    const msg = (err as Error).message
    console.error(`[internal-tools] ${toolName} erro: ${msg}`)
    return res.status(500).json({ error: 'tool_execution_failed', message: msg })
  }
})
