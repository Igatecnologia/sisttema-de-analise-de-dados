import { promises as dns } from 'node:dns'
import { logWarn } from './structuredLog.js'

/**
 * SEC-3.9 — Anti-fraud no registro.
 * Tres camadas:
 *  1) Disposable email domains — lista curada das mais comuns
 *  2) MX record validation — o dominio precisa ter MX para receber email
 *  3) Velocity check — max 5 registros do mesmo IP em 1h
 *
 * Em ambiente de teste (NODE_ENV=test) o MX check eh skipado para nao depender
 * de DNS externo nos vitests.
 */

/** Top ~50 dominios descartaveis. Lista enxuta — extender via env DISPOSABLE_EMAIL_EXTRA. */
const DISPOSABLE_DOMAINS = new Set<string>([
  '10minutemail.com', '10minutemail.net', 'tempmail.com', 'temp-mail.org',
  'guerrillamail.com', 'guerrillamailblock.com', 'sharklasers.com',
  'mailinator.com', 'mailinator.net', 'mailnesia.com', 'maildrop.cc',
  'yopmail.com', 'yopmail.net', 'yopmail.fr',
  'trashmail.com', 'trashmail.net', 'trbvm.com',
  'dispostable.com', 'getairmail.com', 'mintemail.com',
  'throwawaymail.com', 'fakeinbox.com', 'mytemp.email',
  'tempinbox.com', 'mailcatch.com', 'spambox.us',
  'tempmailo.com', 'emailondeck.com', 'mohmal.com',
  'spamgourmet.com', 'getnada.com', 'temporary-mail.net',
  'inboxbear.com', 'mail-temp.com', 'mailpoof.com',
  'tmpmail.org', 'tmpmail.net', 'minuteinbox.com',
  'mailtemp.uk', 'fakemail.net', 'fake-mail.net',
])

function loadExtraDisposable(): Set<string> {
  const extra = process.env.DISPOSABLE_EMAIL_EXTRA?.trim()
  if (!extra) return DISPOSABLE_DOMAINS
  const merged = new Set(DISPOSABLE_DOMAINS)
  for (const d of extra.split(',').map((x) => x.trim().toLowerCase()).filter(Boolean)) merged.add(d)
  return merged
}

const disposableSet = loadExtraDisposable()

export function isDisposableEmail(email: string): boolean {
  const at = email.lastIndexOf('@')
  if (at < 0) return false
  const domain = email.slice(at + 1).toLowerCase()
  if (disposableSet.has(domain)) return true
  /** Tambem cobre subdominios obvios: "abc.10minutemail.com" -> bloqueia. */
  for (const d of disposableSet) {
    if (domain.endsWith(`.${d}`)) return true
  }
  return false
}

export type MxValidation = { ok: true } | { ok: false; reason: 'invalid' | 'no_mx' | 'lookup_failed' }

export async function validateMx(email: string): Promise<MxValidation> {
  if (process.env.NODE_ENV === 'test') return { ok: true }
  if (process.env.SKIP_MX_VALIDATION === '1') return { ok: true }
  const at = email.lastIndexOf('@')
  if (at < 0) return { ok: false, reason: 'invalid' }
  const domain = email.slice(at + 1).toLowerCase()
  try {
    const records = await dns.resolveMx(domain)
    if (!records || records.length === 0) return { ok: false, reason: 'no_mx' }
    return { ok: true }
  } catch (err) {
    /** ENOTFOUND/ENODATA significam que o dominio nao existe ou nao tem MX. */
    const code = (err as NodeJS.ErrnoException).code
    if (code === 'ENOTFOUND' || code === 'ENODATA') return { ok: false, reason: 'no_mx' }
    /** Falhas transitorias (timeout, etc.) — nao bloquear o registro. */
    logWarn('antifraud.mx_lookup_failed', { domain, code })
    return { ok: false, reason: 'lookup_failed' }
  }
}

/** Velocity check em memoria. Para producao multi-instancia, migrar para Redis. */
type VelocityEntry = { count: number; firstAt: number }
const velocityByIp = new Map<string, VelocityEntry>()
const VELOCITY_WINDOW_MS = 60 * 60 * 1000 /** 1h */
const VELOCITY_MAX = Number(process.env.REGISTER_VELOCITY_MAX ?? 5)

export type VelocityResult = { allowed: true } | { allowed: false; retryAfterSec: number }

export function checkRegistrationVelocity(ip: string): VelocityResult {
  const now = Date.now()
  const entry = velocityByIp.get(ip)
  if (!entry || now - entry.firstAt > VELOCITY_WINDOW_MS) {
    velocityByIp.set(ip, { count: 1, firstAt: now })
    return { allowed: true }
  }
  if (entry.count >= VELOCITY_MAX) {
    const retryAfterSec = Math.max(1, Math.ceil((entry.firstAt + VELOCITY_WINDOW_MS - now) / 1000))
    return { allowed: false, retryAfterSec }
  }
  entry.count += 1
  velocityByIp.set(ip, entry)
  return { allowed: true }
}

/** Util para testes — limpa estado interno. */
export function _resetVelocityForTests() {
  velocityByIp.clear()
}
