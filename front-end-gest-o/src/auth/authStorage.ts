import { z } from 'zod'
import { getCurrentTenantId, tenantStorage } from '../tenant/tenantStorage'

/**
 * Schema de validação da sessão armazenada (apenas UI metadata — SEM token).
 * O token de sessão real vive no cookie HttpOnly `iga_session` (inacessível ao JS).
 * Aqui guardamos só nome/email/role/permissões pra hydratar a UI rapidamente
 * sem precisar bater em /me antes de renderizar — proteção XSS completa para
 * o token de autenticação.
 */
const sessionSchema = z.object({
  /** @deprecated — token NUNCA é mais salvo no client. Mantido como opcional
   *  apenas para permitir leitura de sessões antigas criadas antes da migração. */
  token: z.string().optional(),
  user: z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    email: z.string().min(1),
    role: z.enum(['admin', 'manager', 'viewer']),
    /** Bloqueia o app até troca de senha (seed admin ou reset). */
    mustChangePassword: z.boolean().optional(),
  }),
  permissions: z.array(z.string()),
})

export type AuthSession = z.infer<typeof sessionSchema>

const AUTH_KEY = 'auth.session'
const REMEMBER_KEY = 'auth.remember'
const EMAIL_KEY = 'auth.lastEmail'

function getSessionStorageKey(): string {
  return `t:${getCurrentTenantId()}:${AUTH_KEY}`
}

function getRememberKey(): string {
  return `t:${getCurrentTenantId()}:${REMEMBER_KEY}`
}

function getEmailKey(): string {
  return `t:${getCurrentTenantId()}:${EMAIL_KEY}`
}

/**
 * Sessão local guarda apenas payload de usuário/permissões para UX.
 * O cookie HttpOnly `iga_session` no backend é a fonte real de autenticação.
 */
export function getStoredSession(): AuthSession | null {
  for (const storage of [window.localStorage, window.sessionStorage]) {
    try {
      const raw = storage.getItem(getSessionStorageKey())
      if (!raw) continue
      const parsed = sessionSchema.safeParse(JSON.parse(raw))
      if (parsed.success) {
        // Migração: sessões antigas podem ter salvo o token junto. Retornamos
        // sem ele e re-persistimos sem o token, pra limpar o storage.
        if (parsed.data.token) {
          const { token: _drop, ...safe } = parsed.data
          void _drop
          storage.setItem(getSessionStorageKey(), JSON.stringify(safe))
          return safe as AuthSession
        }
        return parsed.data
      }
      storage.removeItem(getSessionStorageKey())
    } catch {
      try { storage.removeItem(getSessionStorageKey()) } catch { /* ignora */ }
    }
  }
  tenantStorage.removeItem(AUTH_KEY)
  return null
}

/**
 * `persistent=true` → salva em localStorage (sobrevive a fechar o app).
 * `persistent=false` → sessionStorage (some ao fechar a janela).
 * Quando `null`, limpa de ambos (logout).
 */
export function setStoredSession(session: AuthSession | null, persistent?: boolean) {
  if (!session) {
    window.localStorage.removeItem(getSessionStorageKey())
    window.sessionStorage.removeItem(getSessionStorageKey())
    tenantStorage.removeItem(AUTH_KEY)
    return
  }
  // Strip token antes de persistir — autenticação é 100% via cookie HttpOnly.
  // Se algum callsite ainda injetar token (backcompat), garantimos que nunca
  // toca o storage acessível a JS (defesa em profundidade contra XSS).
  const { token: _token, ...safeSession } = session
  void _token
  const usePersistent = persistent ?? getRememberPreference()
  const value = JSON.stringify(safeSession)
  if (usePersistent) {
    window.localStorage.setItem(getSessionStorageKey(), value)
    window.sessionStorage.removeItem(getSessionStorageKey())
  } else {
    window.sessionStorage.setItem(getSessionStorageKey(), value)
    window.localStorage.removeItem(getSessionStorageKey())
  }
}

/** Default true — UX desktop espera lembrar entre aberturas. */
export function getRememberPreference(): boolean {
  try {
    const raw = window.localStorage.getItem(getRememberKey())
    if (raw === null) return true
    return raw === '1'
  } catch { return true }
}

export function setRememberPreference(value: boolean) {
  try { window.localStorage.setItem(getRememberKey(), value ? '1' : '0') } catch { /* ignora */ }
}

/** Email do último login bem-sucedido — usado para autofill. Senha NUNCA é salva. */
export function getRememberedEmail(): string {
  try { return window.localStorage.getItem(getEmailKey()) ?? '' } catch { return '' }
}

export function setRememberedEmail(email: string) {
  try {
    if (email) window.localStorage.setItem(getEmailKey(), email)
    else window.localStorage.removeItem(getEmailKey())
  } catch { /* ignora */ }
}
