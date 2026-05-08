/**
 * OPS-4 — Analytics events client.
 *
 * Estrategia agnostica:
 *  1) Sempre envia para o backend (`/api/v1/analytics/event`) que loga estruturado.
 *  2) Se PostHog snippet estiver carregado (window.posthog), tambem captura no client
 *     — habilita autocapture, session replay, feature flags.
 *
 * Para ativar PostHog:
 *  - Adicionar snippet oficial em index.html OU instalar `posthog-js`
 *  - Setar VITE_POSTHOG_KEY no .env.production
 */

import { http } from './http'

type PostHogClient = {
  capture: (name: string, props?: Record<string, unknown>) => void
  identify: (id: string, props?: Record<string, unknown>) => void
  reset: () => void
  isFeatureEnabled?: (flag: string) => boolean
}

declare global {
  interface Window {
    posthog?: PostHogClient
  }
}

function getPostHog(): PostHogClient | null {
  if (typeof window === 'undefined') return null
  return window.posthog ?? null
}

/**
 * Envia um evento de analytics. Nunca lanca — falhas sao silenciosas.
 * Eventos chave (snake_case): auth_login, auth_register, billing_checkout_started,
 * billing_subscribed, mfa_enabled, terms_accepted, connector_added, copilot_message_sent.
 */
export function trackEvent(name: string, props?: Record<string, unknown>): void {
  /** PostHog client-side (autocapture + replay). */
  try {
    getPostHog()?.capture(name, props)
  } catch {
    /** ignore */
  }
  /** Backend (centralizado, server-truth). */
  try {
    http.post('/api/v1/analytics/event', { name, props }).catch(() => {})
  } catch {
    /** ignore */
  }
}

export function identifyUser(userId: string, props?: Record<string, unknown>): void {
  try {
    getPostHog()?.identify(userId, props)
  } catch {
    /** ignore */
  }
}

export function resetAnalytics(): void {
  try {
    getPostHog()?.reset()
  } catch {
    /** ignore */
  }
}

export function isFeatureEnabled(flag: string): boolean {
  try {
    return Boolean(getPostHog()?.isFeatureEnabled?.(flag))
  } catch {
    return false
  }
}
