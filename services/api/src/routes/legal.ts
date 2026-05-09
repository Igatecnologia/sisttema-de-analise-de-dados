import { Router } from 'express'
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth.js'
import {
  PRIVACY_VERSION,
  TERMS_VERSION,
  getTermsStatus,
  recordAcceptance,
} from '../services/termsAcceptance.js'
import { logAudit } from '../services/auditLog.js'

export const legalRouter = Router()

legalRouter.use(requireAuth)

/**
 * GET /api/v1/legal/terms-status
 * Retorna se o usuario logado precisa aceitar nova versao de Termos/Privacidade.
 * O frontend chama no boot e mostra modal blocker se needsAcceptance=true.
 */
legalRouter.get('/terms-status', (req, res) => {
  const authReq = req as AuthenticatedRequest
  const status = getTermsStatus(authReq.userId)
  res.json(status)
})

/**
 * POST /api/v1/legal/accept-terms
 * Registra aceite da versao atual com hash do documento + IP/UA hash + timestamp.
 * Idempotente: aceitar duas vezes a mesma versao gera 2 registros (historico).
 */
legalRouter.post('/accept-terms', (req, res) => {
  const authReq = req as AuthenticatedRequest
  const ip = (req.ip ?? req.socket?.remoteAddress ?? '').toString()
  const userAgent = req.header('user-agent') ?? ''
  const record = recordAcceptance({
    tenantId: authReq.tenantId,
    userId: authReq.userId,
    ip,
    userAgent,
  })
  logAudit({
    userId: authReq.userId,
    tenantId: authReq.tenantId,
    action: 'terms_accepted',
    resource: 'legal',
    metadata: {
      termsVersion: TERMS_VERSION,
      privacyVersion: PRIVACY_VERSION,
      documentHash: record.documentHash,
    },
  })
  res.status(201).json({
    accepted: true,
    termsVersion: record.termsVersion,
    privacyVersion: record.privacyVersion,
    acceptedAt: record.acceptedAt,
  })
})
