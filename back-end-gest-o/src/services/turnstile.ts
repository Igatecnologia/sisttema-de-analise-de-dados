import { fetch as uFetch } from 'undici'

/**
 * Cloudflare Turnstile (SEC-2.2) — captcha sem dark patterns.
 *
 * Backend valida o token em /siteverify; frontend renderiza widget.
 * Disabled por padrao (`TURNSTILE_SECRET` ausente) — fail-open em dev.
 */
const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

export function isTurnstileEnabled(): boolean {
  return Boolean(process.env.TURNSTILE_SECRET?.trim())
}

export async function verifyTurnstileToken(token: string | undefined, remoteip?: string): Promise<boolean> {
  if (!isTurnstileEnabled()) return true
  if (!token || !token.trim()) return false
  const secret = process.env.TURNSTILE_SECRET!.trim()
  try {
    const body = new URLSearchParams({ secret, response: token, ...(remoteip ? { remoteip } : {}) })
    const res = await uFetch(SITEVERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
      signal: AbortSignal.timeout(5_000),
    })
    if (!res.ok) return false
    const data = await res.json() as { success?: boolean }
    return Boolean(data.success)
  } catch {
    return false
  }
}
