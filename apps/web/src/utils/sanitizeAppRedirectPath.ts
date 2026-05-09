const LOGIN_PATH = '/login'

/**
 * Caminho seguro para `Navigate` / `navigate` após login.
 * Rejeita URLs absolutas, protocol-relative, barras invertidas,
 * encoding bypasses e redirecionamento para /login (evita loop).
 */
export function sanitizeAppRedirectPath(
  from: unknown,
  fallback: string = '/dashboard',
): string {
  if (typeof from !== 'string') return fallback

  // Decodifica para pegar bypasses com %2F, %5C etc.
  let t: string
  try {
    t = decodeURIComponent(from).trim()
  } catch {
    return fallback
  }

  // Bloqueia: URLs absolutas, protocol-relative, barras invertidas, null bytes, data/javascript URIs
  if (!t.startsWith('/')) return fallback
  if (t.startsWith('//')) return fallback
  if (t.includes('\\') || t.includes('\0')) return fallback
  if (/^\/[^/]*:/i.test(t)) return fallback // bloqueia /javascript: etc.

  // Bloqueia loop de login
  if (t === LOGIN_PATH || t.startsWith(`${LOGIN_PATH}/`) || t.startsWith(`${LOGIN_PATH}?`)) {
    return fallback
  }

  return t || fallback
}
