import type { Request, Response, NextFunction } from 'express'
import { findUserByIdForTenantAsync } from '../userStorage.js'
import {
  buildSessionBinding,
  cleanupExpiredSqliteSessions,
  detectUaFamily,
  readSession,
  registerSession,
  revokeAllSessionsForUser,
  revokeSession,
  type SessionBinding,
} from '../services/sessionStore.js'
import { verifySessionJwt } from '../services/sessionJwt.js'

export interface AuthenticatedRequest extends Request {
  userId: string
  userRole: string
  tenantId: string
}

function readTokenFromCookie(req: Request): string | null {
  const cookieHeader = req.headers.cookie
  if (!cookieHeader) return null
  const pairs = cookieHeader.split(';')
  for (const pair of pairs) {
    const [rawName, ...rawValue] = pair.trim().split('=')
    if (rawName !== 'iga_session') continue
    const value = rawValue.join('=')
    return value ? decodeURIComponent(value) : null
  }
  return null
}

export function registerToken(
  token: string,
  userId: string,
  tenantId: string,
  binding?: SessionBinding,
) {
  if (!tenantId || !tenantId.trim()) {
    throw new Error('[auth.registerToken] tenantId obrigatorio')
  }
  return registerSession(token, userId, tenantId, binding)
}

export function revokeToken(token: string) {
  return revokeSession(token)
}

export function revokeAllUserSessions(userId: string): Promise<number> {
  return revokeAllSessionsForUser(userId)
}

setInterval(() => {
  void cleanupExpiredSqliteSessions()
}, 15 * 60 * 1000).unref()

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization
  const bearerToken = header?.startsWith('Bearer ') ? header.slice(7) : null
  const token = bearerToken ?? readTokenFromCookie(req)
  if (!token) {
    return res.status(401).json({ message: 'Token nao fornecido' })
  }

  const sessionRow = await readSession(token)
  if (!sessionRow) {
    return res.status(401).json({ message: 'Token invalido ou expirado' })
  }

  const jwtClaims = verifySessionJwt(token)
  if (token.includes('.') && !jwtClaims) {
    await revokeToken(token)
    return res.status(401).json({ message: 'Token invalido ou expirado' })
  }
  if (jwtClaims && (jwtClaims.sub !== sessionRow.userId || jwtClaims.tid !== sessionRow.tenantId)) {
    await revokeToken(token)
    return res.status(401).json({ message: 'Token invalido ou expirado' })
  }

  if (Date.now() > sessionRow.expiresAt) {
    await revokeToken(token)
    return res.status(401).json({ message: 'Sessao expirada. Faca login novamente.' })
  }

  /** Sessão sem tenantId é dado corrompido (legado pré-multi-tenant). Revogar — não cair em 'default'. */
  if (!sessionRow.tenantId || !sessionRow.tenantId.trim()) {
    await revokeToken(token)
    return res.status(401).json({ message: 'Sessao invalida. Faca login novamente.' })
  }

  const user = await findUserByIdForTenantAsync(sessionRow.userId, sessionRow.tenantId)
  if (!user || user.status !== 'active') {
    await revokeToken(token)
    return res.status(401).json({ message: 'Usuario inativo' })
  }

  /**
   * SEC-2.5: session binding — UA family mudou drasticamente (chrome <-> safari)
   * indica session hijack ou cookie roubado. Forca reauth.
   * IP nao bloqueia (celular muda subnet); fica para alerta por email.
   */
  if (sessionRow.uaFamily) {
    const currentFamily = detectUaFamily(typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : '')
    if (currentFamily !== 'other' && sessionRow.uaFamily !== 'other' && currentFamily !== sessionRow.uaFamily) {
      await revokeToken(token)
      return res.status(401).json({ message: 'Sessao expirada por mudanca de dispositivo. Faca login novamente.' })
    }
  }

  const authReq = req as AuthenticatedRequest
  authReq.userId = user.id
  authReq.userRole = user.role
  authReq.tenantId = sessionRow.tenantId
  next()
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  void requireAuth(req, res, () => {
    if ((req as AuthenticatedRequest).userRole !== 'admin') {
      return res.status(403).json({ message: 'Acesso restrito a administradores' })
    }
    next()
  })
}
