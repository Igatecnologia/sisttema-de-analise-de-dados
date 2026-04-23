/**
 * Camada de abstração para error tracking.
 * Substitua a implementação ao integrar Sentry, Datadog, Rollbar, etc.
 *
 * Para Sentry:
 *   import * as Sentry from '@sentry/react'
 *   Sentry.init({ dsn: '...', environment: import.meta.env.VITE_APP_STAGE })
 *   E substitua as funções abaixo por chamadas ao Sentry.
 */

type ErrorContext = {
  component?: string
  action?: string
  userId?: string
  tenantId?: string
  extra?: Record<string, unknown>
}

/**
 * Reporta um erro para o sistema de monitoring.
 * Em produção, envia para Sentry/Datadog.
 * Em dev, loga no console.
 */
export function captureError(error: unknown, context?: ErrorContext) {
  const isDev = import.meta.env.DEV

  if (isDev) {
    console.error('[ErrorTracker]', error, context)
    return
  }

  // PRODUÇÃO: Integrar com Sentry/Datadog aqui
  // Sentry.captureException(error, { extra: context })

  // Fallback: POST para endpoint de logging interno
  try {
    const payload = {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      ...context,
      timestamp: new Date().toISOString(),
      url: window.location.href,
      userAgent: navigator.userAgent,
    }

    // Fire-and-forget para não bloquear o usuário
    void fetch('/api/v1/ops/client-error', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch(() => {
      // Se o endpoint não existe, falha silenciosamente
    })
  } catch {
    // Nunca deixar o error tracker quebrar a app
  }
}

/**
 * Registra um breadcrumb (migalha de pão) para contexto de debugging.
 */
export function addBreadcrumb(message: string, category?: string) {
  if (import.meta.env.DEV) {
    console.debug(`[Breadcrumb:${category ?? 'general'}]`, message)
  }
  // Sentry.addBreadcrumb({ message, category, level: 'info' })
}

/**
 * Define o usuário atual no tracker (para associar erros ao user).
 */
export function setTrackerUser(user: { id: string; email?: string } | null) {
  if (import.meta.env.DEV && user) {
    console.debug('[ErrorTracker] User set:', user.id)
  }
  // Sentry.setUser(user ? { id: user.id, email: user.email } : null)
}

/**
 * Define o tenant atual no tracker.
 */
export function setTrackerTenant(tenantId: string) {
  if (import.meta.env.DEV) {
    console.debug('[ErrorTracker] Tenant set:', tenantId)
  }
  // Sentry.setTag('tenant', tenantId)
}
