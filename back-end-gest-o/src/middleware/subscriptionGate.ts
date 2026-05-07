// Subscription gate (S5) — bloqueia 402 Payment Required quando trial expirou
// e nao ha subscription ativa.
//
// Aplicado em rotas protegidas (apos requireAuth). Excecoes sempre permitidas:
//   /api/v1/auth        (login/logout/MFA)
//   /api/v1/billing     (checkout/portal)
//   /api/v1/tenants/:slug/config (branding publico)
//   /api/v1/onboarding  (setup)
//   /health             (probes)
import type { Request, Response, NextFunction } from 'express'
import type { AuthenticatedRequest } from './auth.js'
import { findTenantBySlug } from '../tenantStorage.js'
import { evaluateAccess, getSubscription } from '../services/subscriptionStore.js'

const ALLOW_PREFIXES = [
  '/api/v1/auth',
  '/api/v1/billing',
  '/api/v1/onboarding',
  '/health',
]

function isAllowed(path: string): boolean {
  if (path.startsWith('/api/v1/tenants/') && path.endsWith('/config')) return true
  return ALLOW_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`))
}

export async function subscriptionGate(req: Request, res: Response, next: NextFunction) {
  if (isAllowed(req.path)) return next()
  const authReq = req as Partial<AuthenticatedRequest>
  if (!authReq.tenantId) return next() // rotas nao autenticadas seguem
  const [tenant, subscription] = await Promise.all([
    findTenantBySlug(authReq.tenantId),
    getSubscription(authReq.tenantId),
  ])
  const verdict = evaluateAccess({ trialEndsAt: tenant?.trialEndsAt ?? null, subscription })
  if (verdict.allowed) return next()
  return res.status(402).json({
    message: verdict.reason === 'trial_expired'
      ? 'Trial expirado. Assine um plano para continuar.'
      : 'Sua assinatura nao esta ativa. Atualize o pagamento.',
    reason: verdict.reason,
    trialEndsAt: tenant?.trialEndsAt ?? null,
    subscriptionStatus: subscription?.status ?? null,
  })
}
