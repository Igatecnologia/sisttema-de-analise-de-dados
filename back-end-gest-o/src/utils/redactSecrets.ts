/**
 * Redaction de chaves sensiveis em objetos/arrays antes de logar.
 *
 * Cobre:
 *   password, currentPassword, newPassword, token, *Token, authorization,
 *   cookie, secret, apiKey, authCredentials, x-api-key, set-cookie, jwt
 *
 * Combina com `piiMask.ts` (mascara CPF/CNPJ/email/telefone/cartao em strings).
 */
import { maskPii } from './piiMask.js'

const SENSITIVE_KEY_PATTERNS = [
  /password/i,
  /token/i,
  /authorization/i,
  /\bcookie\b/i,
  /secret/i,
  /\bapi[_-]?key\b/i,
  /authcredentials/i,
  /\bjwt\b/i,
  /set-cookie/i,
  /x-csrf/i,
  /x-xsrf/i,
]

const REDACTED = '[REDACTED]'
const MAX_DEPTH = 6

function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEY_PATTERNS.some((p) => p.test(key))
}

function redactValue(value: unknown, depth: number): unknown {
  if (depth >= MAX_DEPTH) return '[MAX_DEPTH]'
  if (value == null) return value
  if (typeof value === 'string') return maskPii(value)
  if (typeof value !== 'object') return value
  if (Array.isArray(value)) return value.map((v) => redactValue(v, depth + 1))
  const out: Record<string, unknown> = {}
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (isSensitiveKey(key)) {
      out[key] = REDACTED
      continue
    }
    out[key] = redactValue(raw, depth + 1)
  }
  return out
}

/** Redact keys sensiveis e aplica maskPii em strings recursivamente. */
export function redactSecrets<T>(value: T): T {
  return redactValue(value, 0) as T
}
