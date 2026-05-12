import { createHash, timingSafeEqual } from 'node:crypto'
import type { NextFunction, Request, Response } from 'express'
import { getDb } from '../db/sqlite.js'
import { getPostgresPool, hasPostgresConfig } from '../db/postgres.js'
import { requireAuth, type AuthenticatedRequest } from './auth.js'
import { ipMatchesAllowlist } from '../utils/ipAllowlist.js'

type ApiKeyScope = 'reports:read' | 'dashboards:read' | 'datasources:read' | 'webhooks:write'

type ApiKeyAuthRow = {
  id: string
  tenant_id: string
  user_id: string
  secret_hash: string
  scopes_json: string | string[]
  status: string
  allowed_ips_json?: string | string[] | null
}

function parseAllowedIps(value: string | string[] | null | undefined): string[] {
  if (!value) return []
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === 'string')
  try {
    const parsed = JSON.parse(String(value))
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : []
  } catch {
    return []
  }
}

export interface ApiKeyAuthenticatedRequest extends AuthenticatedRequest {
  apiKeyId?: string
  apiKeyScopes?: ApiKeyScope[]
}

const db = getDb()

function usePostgresStorage(): boolean {
  return process.env.IGA_STORAGE_DRIVER === 'postgres' && hasPostgresConfig()
}

function hashSecret(secret: string): string {
  return createHash('sha256').update(secret).digest('hex')
}

function readBearer(req: Request): string | null {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) return null
  const token = header.slice(7).trim()
  return token.startsWith('iga_live_') ? token : null
}

function parseScopes(value: string | string[]): ApiKeyScope[] {
  const raw = Array.isArray(value) ? value : JSON.parse(String(value))
  return Array.isArray(raw) ? raw.filter((scope): scope is ApiKeyScope => (
    scope === 'reports:read' ||
    scope === 'dashboards:read' ||
    scope === 'datasources:read' ||
    scope === 'webhooks:write'
  )) : []
}

function hashEquals(a: string, b: string): boolean {
  const left = Buffer.from(a, 'hex')
  const right = Buffer.from(b, 'hex')
  return left.length === right.length && timingSafeEqual(left, right)
}

async function findApiKey(secret: string): Promise<ApiKeyAuthRow | null> {
  const secretHash = hashSecret(secret)
  if (usePostgresStorage()) {
    const result = await getPostgresPool().query<ApiKeyAuthRow>(`
      SELECT id, tenant_id, user_id, secret_hash, scopes_json, status, allowed_ips_json
      FROM api_keys
      WHERE secret_hash = $1 AND status = 'active'
      LIMIT 1
    `, [secretHash])
    const row = result.rows[0]
    return row && hashEquals(String(row.secret_hash), secretHash) ? row : null
  }

  const row = db.prepare(`
    SELECT id, tenant_id, user_id, secret_hash, scopes_json, status, allowed_ips_json
    FROM api_keys
    WHERE secret_hash = ? AND status = 'active'
    LIMIT 1
  `).get(secretHash) as ApiKeyAuthRow | undefined
  return row && hashEquals(String(row.secret_hash), secretHash) ? row : null
}

async function markApiKeyUsed(id: string) {
  const now = new Date().toISOString()
  if (usePostgresStorage()) {
    await getPostgresPool().query('UPDATE api_keys SET last_used_at = $1 WHERE id = $2', [now, id])
    return
  }
  db.prepare('UPDATE api_keys SET last_used_at = ? WHERE id = ?').run(now, id)
}

export function requireApiKeyScope(scope: ApiKeyScope) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const token = readBearer(req)
    if (!token) return res.status(401).json({ message: 'API key nao fornecida' })

    const key = await findApiKey(token)
    if (!key) return res.status(401).json({ message: 'API key invalida ou revogada' })

    /** P2-04: IP allowlist por API key (vazio = aceita qualquer IP). */
    const allowedIps = parseAllowedIps(key.allowed_ips_json)
    if (allowedIps.length > 0) {
      const clientIp = req.ip ?? req.socket.remoteAddress ?? ''
      if (!ipMatchesAllowlist(clientIp, allowedIps)) {
        return res.status(403).json({
          message: 'IP nao autorizado para esta API key',
          ip: clientIp,
        })
      }
    }

    const scopes = parseScopes(key.scopes_json)
    if (!scopes.includes(scope)) {
      return res.status(403).json({ message: 'Scope insuficiente', requiredScope: scope })
    }

    await markApiKeyUsed(key.id)
    const authReq = req as ApiKeyAuthenticatedRequest
    authReq.userId = key.user_id
    authReq.userRole = 'api_key'
    authReq.tenantId = key.tenant_id
    authReq.apiKeyId = key.id
    authReq.apiKeyScopes = scopes
    next()
  }
}

export function requireAuthOrApiKeyScope(scope: ApiKeyScope) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (readBearer(req)) return requireApiKeyScope(scope)(req, res, next)
    return requireAuth(req, res, next)
  }
}
