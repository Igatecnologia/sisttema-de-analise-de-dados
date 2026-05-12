import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import argon2 from 'argon2'
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

/**
 * UPSERT idempotente de **um** user. Substitui o anti-pattern de chamar
 * `writeAllUsersAsync([...all, user])` que apagava todos os users antes.
 * Escopo de tenant é respeitado via `tenant_id` no INSERT/UPDATE.
 */
export async function upsertUserAsync(user: UserRecord): Promise<void> {
  if (usePostgresStorage()) {
    const contextClient = getPostgresClientFromContext()
    const client = contextClient ?? await getPostgresPool().connect()
    const ownsConnection = !contextClient
    try {
      await client.query(
        `
        INSERT INTO users (
          id, tenant_id, name, email, role, status, permissions_json, password_hash,
          must_change_password, email_verified_at, preferences_json, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NULL, $11, $12)
        ON CONFLICT (id) DO UPDATE SET
          tenant_id = EXCLUDED.tenant_id,
          name = EXCLUDED.name,
          email = EXCLUDED.email,
          role = EXCLUDED.role,
          status = EXCLUDED.status,
          permissions_json = EXCLUDED.permissions_json,
          password_hash = EXCLUDED.password_hash,
          must_change_password = EXCLUDED.must_change_password,
          email_verified_at = EXCLUDED.email_verified_at,
          updated_at = EXCLUDED.updated_at
        `,
        [
          user.id,
          user.tenantId,
          user.name,
          user.email.toLowerCase(),
          user.role,
          user.status,
          user.permissions?.length ? JSON.stringify(user.permissions) : null,
          user.passwordHash,
          user.mustChangePassword ?? false,
          user.emailVerifiedAt ?? null,
          user.createdAt,
          user.updatedAt,
        ],
      )
    } finally {
      if (ownsConnection) client.release()
    }
    invalidateUserCache()
    return
  }
  // SQLite (dev): emula UPSERT por delete-then-insert sem afetar outros users.
  db.prepare('DELETE FROM users WHERE id = ?').run(user.id)
  db.prepare(`
    INSERT INTO users (
      id, tenant_id, name, email, role, status, permissions_json, password_hash, must_change_password, email_verified_at, preferences_json, created_at, updated_at
    ) VALUES (@id, @tenant_id, @name, @email, @role, @status, @permissions_json, @password_hash, @must_change_password, @email_verified_at, NULL, @created_at, @updated_at)
  `).run({
    id: user.id,
    tenant_id: user.tenantId,
    name: user.name,
    email: user.email.toLowerCase(),
    role: user.role,
    status: user.status,
    permissions_json: user.permissions?.length ? JSON.stringify(user.permissions) : null,
    password_hash: user.passwordHash,
    must_change_password: user.mustChangePassword ? 1 : 0,
    email_verified_at: user.emailVerifiedAt ?? null,
    created_at: user.createdAt,
    updated_at: user.updatedAt,
  })
  invalidateUserCache()
}

/**
 * DELETE escopado por tenant — evita apagar user de outro tenant por id colidido.
 * Retorna true se deletou; false caso não exista no tenant informado.
 */
export async function deleteUserByIdAsync(userId: string, tenantId: string): Promise<boolean> {
  assertTenantId(tenantId, 'deleteUserByIdAsync')
  if (!userId) return false
  if (usePostgresStorage()) {
    const result = await queryPostgres(
      'DELETE FROM users WHERE id = $1 AND tenant_id = $2',
      [userId, tenantId],
    )
    invalidateUserCache()
    return Boolean(result.rowCount && result.rowCount > 0)
  }
  const result = db.prepare('DELETE FROM users WHERE id = ? AND tenant_id = ?').run(userId, tenantId)
  invalidateUserCache()
  return result.changes > 0
}

/**
 * @deprecated Anti-pattern: faz UPSERT em cada item mas NÃO remove users
 * que não estão na lista. Use `upsertUserAsync` para mutações pontuais
 * e `deleteUserByIdAsync` para remoções. Mantida apenas para fluxos de seed.
 */
export async function writeAllUsersAsync(items: UserRecord[]) {
  for (const item of items) {
    await upsertUserAsync(item)
  }
}

export function genUserId(): string {
  return `usr_${randomBytes(6).toString('hex')}_${Date.now().toString(36)}`
}

// ─── Password hashing — argon2id (OWASP recommended, SEC-1.2) ──────────────
//
// Formato suportado em verify (precedencia top-down):
//   v3 (atual): "$argon2id$..."         — argon2id (memory-hard, SOTA)
//   v2 (legado): "scrypt$2$<salt>$<hash>" — scrypt N=131072 (interim hardening)
//   v1 (legado): "<salt>:<hash>"          — scrypt defaults (codigo original)
//
// Hashes novos SEMPRE usam argon2id. `isLegacyPasswordHash` detecta v1/v2 para
// forcar rehash no proximo login bem-sucedido (graceful migration).

const ARGON2_OPTS = {
  type: argon2.argon2id,
  memoryCost: 65536, // 64 MB — OWASP m=64MB
  timeCost: 3,       // OWASP t=3
  parallelism: 4,    // OWASP p=4
} as const

const SCRYPT_V2_N = 131072
const SCRYPT_V2_R = 8
const SCRYPT_V2_P = 1
const SCRYPT_V2_LEN = 64
const SCRYPT_V2_MAXMEM = 256 * 1024 * 1024

export async function hashUserPasswordAsync(password: string): Promise<string> {
  return argon2.hash(password, ARGON2_OPTS)
}

/**
 * API legada (sincrona) usada em seedAdmin e fluxos que ainda nao migraram.
 * Mantida com scrypt v2 — chamadores async devem preferir `hashUserPasswordAsync`.
 */
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

function verifyScryptV2(password: string, stored: string): boolean {
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

function verifyScryptV1(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':')
  if (!salt || !hash) return false
  const derived = scryptSync(password, salt, 64)
  const expected = Buffer.from(hash, 'hex')
  if (expected.length !== derived.length) return false
  return timingSafeEqual(derived, expected)
}

/**
 * Verify sincrono — necessario para o fluxo legado (login chama em mid-request).
 * Para argon2id usamos `verifySync` que internamente roda blocking; para scrypt
 * tambem eh sync. Em throughput alto considerar mover login todo para async.
 */
export function verifyUserPassword(password: string, stored: string): boolean {
  if (!stored) return false
  if (stored.startsWith('$argon2')) {
    /** argon2 nao expoe verifySync; checagem em userStorage usa async path. */
    throw new Error('Use verifyUserPasswordAsync para hashes argon2id')
  }
  if (stored.startsWith('scrypt$2$')) return verifyScryptV2(password, stored)
  return verifyScryptV1(password, stored)
}

/** Verify async — suporta argon2id + fallbacks scrypt v2/v1 (transparente). */
export async function verifyUserPasswordAsync(password: string, stored: string): Promise<boolean> {
  if (!stored) return false
  if (stored.startsWith('$argon2')) {
    try {
      return await argon2.verify(stored, password)
    } catch {
      return false
    }
  }
  if (stored.startsWith('scrypt$2$')) return verifyScryptV2(password, stored)
  return verifyScryptV1(password, stored)
}

/** Detecta hash em formato legado — chame para forcar rehash no proximo login. */
export function isLegacyPasswordHash(stored: string): boolean {
  return Boolean(stored) && !stored.startsWith('$argon2')
}
