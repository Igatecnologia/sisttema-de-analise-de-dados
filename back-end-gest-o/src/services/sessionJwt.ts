import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { resolveDataDir } from '../paths.js'

export type SessionJwtClaims = {
  sub: string
  tid: string
  role: string
  plan: string
  jti: string
  iat: number
  exp: number
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url')
}

/**
 * Em dev, gera (ou lê) uma chave aleatória persistida em <dataDir>/.session-jwt-secret.
 * Substitui a chave hardcoded antiga ('iga-dev-session-jwt-secret-change-me'), que
 * permitia forjar JWTs caso a env nao estivesse setada e o codigo vazasse.
 */
let devSecretCache: string | null = null
function loadOrCreateDevSecret(): string {
  if (devSecretCache) return devSecretCache
  const dir = resolveDataDir()
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  const path = join(dir, '.session-jwt-secret')
  if (existsSync(path)) {
    devSecretCache = readFileSync(path, 'utf-8').trim()
    if (devSecretCache.length >= 32) return devSecretCache
  }
  devSecretCache = randomBytes(48).toString('hex')
  writeFileSync(path, devSecretCache, { encoding: 'utf-8', mode: 0o600 })
  console.warn(`[IGA][SEC] IGA_SESSION_JWT_SECRET ausente; usando segredo gerado em ${path} (ok em dev, nao em prod).`)
  return devSecretCache
}

function jwtSecret(): string {
  const secret = process.env.IGA_SESSION_JWT_SECRET ?? process.env.IGA_INTERNAL_JWT_SECRET ?? process.env.IGA_SECRETS_KEY
  if (secret?.trim()) return secret
  if (process.env.NODE_ENV === 'production') {
    throw new Error('IGA_SESSION_JWT_SECRET obrigatorio em producao')
  }
  return loadOrCreateDevSecret()
}

function signPart(value: string): string {
  return createHmac('sha256', jwtSecret()).update(value).digest('base64url')
}

export function signSessionJwt(input: Omit<SessionJwtClaims, 'jti' | 'iat' | 'exp'> & { ttlSeconds?: number }): string {
  const iat = Math.floor(Date.now() / 1000)
  const exp = iat + (input.ttlSeconds ?? 8 * 60 * 60)
  const claims: SessionJwtClaims = {
    sub: input.sub,
    tid: input.tid,
    role: input.role,
    plan: input.plan,
    jti: randomBytes(16).toString('hex'),
    iat,
    exp,
  }
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const payload = base64url(JSON.stringify(claims))
  return `${header}.${payload}.${signPart(`${header}.${payload}`)}`
}

export function verifySessionJwt(token: string): SessionJwtClaims | null {
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [header, payload, signature] = parts
  const expected = signPart(`${header}.${payload}`)
  const actualBuffer = Buffer.from(signature)
  const expectedBuffer = Buffer.from(expected)
  if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) return null
  try {
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Partial<SessionJwtClaims>
    if (!claims.sub || !claims.tid || !claims.role || !claims.plan || !claims.exp) return null
    if (Math.floor(Date.now() / 1000) >= claims.exp) return null
    return claims as SessionJwtClaims
  } catch {
    return null
  }
}
