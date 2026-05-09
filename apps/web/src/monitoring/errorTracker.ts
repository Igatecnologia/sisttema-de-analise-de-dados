/**
 * Camada fina sobre @sentry/react. Quando VITE_SENTRY_DSN está vazio,
 * Sentry.init é no-op e estas funções degradam para console em dev e
 * silêncio em prod.
 */
import * as Sentry from '@sentry/react'

type ErrorContext = {
  component?: string
  action?: string
  userId?: string
  tenantId?: string
  extra?: Record<string, unknown>
}

export function captureError(error: unknown, context?: ErrorContext) {
  const isDev = import.meta.env.DEV
  if (isDev) {
    console.error('[ErrorTracker]', error, context)
  }
  Sentry.withScope((scope) => {
    if (context?.component) scope.setTag('component', context.component)
    if (context?.action) scope.setTag('action', context.action)
    if (context?.userId) scope.setUser({ id: context.userId })
    if (context?.tenantId) scope.setTag('tenant', context.tenantId)
    if (context?.extra) scope.setExtras(context.extra)
    Sentry.captureException(error)
  })
}

export function addBreadcrumb(message: string, category?: string) {
  if (import.meta.env.DEV) {
    console.debug(`[Breadcrumb:${category ?? 'general'}]`, message)
  }
  Sentry.addBreadcrumb({ message, category, level: 'info' })
}

export function setTrackerUser(user: { id: string; email?: string } | null) {
  Sentry.setUser(user ? { id: user.id, email: user.email } : null)
}

export function setTrackerTenant(tenantId: string) {
  Sentry.setTag('tenant', tenantId)
}
