import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { getDb } from './db/sqlite.js'
import { getPostgresClientFromContext, getPostgresPool, hasPostgresConfig, queryPostgres } from './db/postgres.js'

export type UserRecord = {
  id: string
  tenantId: string
  name: string
  email: string
  role: 'admin' | 'manager' | 'viewer'
  status: 'active' | 'inactive'
  /** Se definido, substitui o pacote padrão do perfil. */
  permissions?: string[]
  passwordHash: string
  /** True enquanto o usuário ainda não trocou a senha inicial (seed ou reset admin). */
  mustChangePassword?: boolean
  emailVerifiedAt?: string | null
  createdAt: string
  updatedAt: string
}

const db = getDb()

function usePostgresStorage(): boolean {
  return process.env.IGA_STORAGE_DRIVER === 'postgres' && hasPostgresConfig()
}

function mapRow(row: Record<string, unknown>): UserRecord {
  const permissionsRaw = row.permissions_json
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id ?? 'default'),
    name: String(row.name),
    email: String(row.email),
    role: row.role as UserRecord['role'],
    status: row.status as UserRecord['status'],
    permissions: permissionsRaw
      ? Array.isArray(permissionsRaw)
        ? permissionsRaw as string[]
        : JSON.parse(String(permissionsRaw)) as string[]
      : undefined,
    passwordHash: String(row.password_hash),
    mustChangePassword: row.must_change_password === true || Number(row.must_change_password ?? 0) === 1,
    emailVerifiedAt: row.email_verified_at ? String(row.email_verified_at) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }
}

/** Cache de usuários com TTL — evita query repetida no middleware de auth */
const CACHE_TTL_MS = 30_000 // 30 segundos
let userCache: { data: UserRecord[]; expiresAt: number } | null = null

export function readAllUsersCached(): UserRecord[] {
  const now = Date.now()
  if (userCache && now < userCache.expiresAt) return userCache.data
  const rows = db.prepare('SELECT * FROM users ORDER BY created_at ASC').all() as Record<string, unknown>[]
  const data = rows.map(mapRow)
  userCache = { data, expiresAt: now + CACHE_TTL_MS }
  return data
}

export async function readAllUsersCachedAsync(): Promise<UserRecord[]> {
  const now = Date.now()

  if (usePostgresStorage()) {
    const rows = await queryPostgres('SELECT * FROM users ORDER BY created_at ASC')
    return rows.rows.map((row) => mapRow(row as Record<string, unknown>))
  }

  if (userCache && now < userCache.expiresAt) return userCache.data
  return readAllUsersCached()
}

/** Invalida o cache — chamar após qualquer escrita de usuários. */
export function invalidateUserCache() {
  userCache = null
}

/** Leitura direta (para operações de escrita que precisam de dados frescos) */
export function readAllUsers(): UserRecord[] {
  invalidateUserCache()
  return readAllUsersCached()
}

export async function readAllUsersAsync(): Promise<UserRecord[]> {
  invalidateUserCache()
  return readAllUsersCachedAsync()
}

function assertTenantId(tenantId: string, fn: string): void {
  if (!tenantId || typeof tenantId !== 'string' || !tenantId.trim()) {
    throw new Error(`[userStorage.${fn}] tenantId obrigatorio`)
  }
}

/** Defense-in-depth: filtra usuários por tenant — usar em rotas autenticadas. */
export async function readUsersForTenantAsync(tenantId: string): Promise<UserRecord[]> {
  assertTenantId(tenantId, 'readUsersForTenantAsync')
  if (usePostgresStorage()) {
    const rows = await queryPostgres(
      'SELECT * FROM users WHERE tenant_id = $1 ORDER BY created_at ASC',
      [tenantId],
    )
    return rows.rows.map((row) => mapRow(row as Record<string, unknown>))
  }
  const rows = db
    .prepare('SELECT * FROM users WHERE tenant_id = ? ORDER BY created_at ASC')
    .all(tenantId) as Record<string, unknown>[]
  return rows.map(mapRow)
}

/** Lookup escopado: nunca retorna usuario de outro tenant, mesmo que id colida. */
export async function findUserByIdForTenantAsync(
  userId: string,
  tenantId: string,
): Promise<UserRecord | null> {
  assertTenantId(tenantId, 'findUserByIdForTenantAsync')
  if (!userId) return null
  if (usePostgresStorage()) {
    const rows = await queryPostgres(
      'SELECT * FROM users WHERE id = $1 AND tenant_id = $2 LIMIT 1',
      [userId, tenantId],
    )
    const row = rows.rows[0] as Record<string, unknown> | undefined
    return row ? mapRow(row) : null
  }
  const row = db
    .prepare('SELECT * FROM users WHERE id = ? AND tenant_id = ? LIMIT 1')
    .get(userId, tenantId) as Record<string, unknown> | undefined
  return row ? mapRow(row) : null
}

export function writeAllUsers(items: UserRecord[]) {
  const clearStmt = db.prepare('DELETE FROM users')
  const insertStmt = db.prepare(`
    INSERT INTO users (
          id, tenant_id, name, email, role, status, permissions_json, password_hash, must_change_password, email_verified_at, preferences_json, created_at, updated_at
    ) VALUES (
      @id, @tenant_id, @name, @email, @role, @status, @permissions_json, @password_hash, @must_change_password, @email_verified_at, @preferences_json, @created_at, @updated_at
    )
  `)
  const tx = db.transaction((records: UserRecord[]) => {
    clearStmt.run()
    for (const item of records) {
      insertStmt.run({
        id: item.id,
        tenant_id: item.tenantId,
        name: item.name,
        email: item.email.toLowerCase(),
        role: item.role,
        status: item.status,
        permissions_json: item.permissions?.length ? JSON.stringify(item.permissions) : null,
        password_hash: item.passwordHash,
        must_change_password: item.mustChangePassword ? 1 : 0,
        email_verified_at: item.emailVerifiedAt ?? null,
        preferences_json: null,
        created_at: item.createdAt,
        updated_at: item.updatedAt,
      })
    }
  })
  tx(items)
  invalidateUserCache()
}

export async function writeAllUsersAsync(items: UserRecord[]) {
  if (usePostgresStorage()) {
    const contextClient = getPostgresClientFromContext()
    const client = contextClient ?? await getPostgresPool().connect()
    try {
      if (!contextClient) await client.query('BEGIN')
      await client.query('DELETE FROM users')
      for (const item of items) {
        await client.query(
          `
          INSERT INTO users (
            id, tenant_id, name, email, role, status, permissions_json, password_hash, must_change_password, email_verified_at, preferences_json, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NULL, $11, $12)
          `,
          [
            item.id,
            item.tenantId,
            item.name,
            item.email.toLowerCase(),
            item.role,
            item.status,
            item.permissions?.length ? JSON.stringify(item.permissions) : null,
            item.passwordHash,
            item.mustChangePassword ?? false,
            item.emailVerifiedAt ?? null,
            item.createdAt,
            item.updatedAt,
          ],
        )
      }
      if (!contextClient) await client.query('COMMIT')
    } catch (err) {
      if (!contextClient) await client.query('ROLLBACK')
      throw err
    } finally {
      if (!contextClient) client.release()
    }
    invalidateUserCache()
    return
  }

  writeAllUsers(items)
}

export function genUserId(): string {
  return `usr_${randomBytes(6).toString('hex')}_${Date.now().toString(36)}`
}

// ─── Password hashing (scrypt, zero deps) ──────────────────────────────────
//
// Formato versionado:
//   v2 (atual): "scrypt$2$<saltHex>$<hashHex>"  — N=2^17 (OWASP), r=8, p=1, len=64
//   v1 (legado): "<saltHex>:<hashHex>"          — N=2^14 default, mantido p/ compat
//
// Hashes novos sempre usam v2. Verificação detecta o formato e aceita v1 antigos
// até o usuário trocar de senha (re-hash automatico no proximo change-password).

const SCRYPT_V2_N = 131072 // 2^17, OWASP recomenda min p/ scrypt
const SCRYPT_V2_R = 8
const SCRYPT_V2_P = 1
const SCRYPT_V2_LEN = 64
// scrypt N=131072 + r=8 exige >= 128 * N * r = 128 MB de buffer
const SCRYPT_V2_MAXMEM = 256 * 1024 * 1024

export function hashUserPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  const derived = scryptSync(password, salt, SCRYPT_V2_LEN, {
    N: SCRYPT_V2_N,
    r: SCRYPT_V2_R,
    p: SCRYPT_V2_P,
    maxmem: SCRYPT_V2_MAXMEM,
  }).toString('hex')
  return `scrypt$2$${salt}$${derived}`
}

export function verifyUserPassword(password: string, stored: string): boolean {
  if (!stored) return false
  if (stored.startsWith('scrypt$2$')) {
    const [, , salt, hash] = stored.split('$')
    if (!salt || !hash) return false
    const derived = scryptSync(password, salt, SCRYPT_V2_LEN, {
      N: SCRYPT_V2_N,
      r: SCRYPT_V2_R,
      p: SCRYPT_V2_P,
      maxmem: SCRYPT_V2_MAXMEM,
    })
    const expected = Buffer.from(hash, 'hex')
    if (expected.length !== derived.length) return false
    return timingSafeEqual(derived, expected)
  }
  // Legado v1 (salt:hash) — defaults do Node (N=16384, r=8, p=1)
  const [salt, hash] = stored.split(':')
  if (!salt || !hash) return false
  const derived = scryptSync(password, salt, 64)
  const expected = Buffer.from(hash, 'hex')
  if (expected.length !== derived.length) return false
  return timingSafeEqual(derived, expected)
}

/** Detecta hash em formato legado — útil para forçar re-hash no próximo login. */
export function isLegacyPasswordHash(stored: string): boolean {
  return Boolean(stored) && !stored.startsWith('scrypt$')
}
