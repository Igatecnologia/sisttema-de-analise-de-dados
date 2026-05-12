import pg from 'pg'
import { AsyncLocalStorage } from 'node:async_hooks'
import type { Request, Response, NextFunction } from 'express'
import { POSTGRES_MIGRATIONS } from './postgresMigrations.js'
import { resolveTenantId } from '../utils/tenant.js'
import { verifySessionJwt } from '../services/sessionJwt.js'

const { Pool } = pg

let pool: pg.Pool | null = null
const requestPgClient = new AsyncLocalStorage<pg.PoolClient>()

export function hasPostgresConfig(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim())
}

export function getPostgresPool(): pg.Pool {
  const connectionString = process.env.DATABASE_URL?.trim()
  if (!connectionString) {
    throw new Error('DATABASE_URL nao configurada')
  }
  if (!pool) {
    pool = new Pool({
      connectionString,
      max: Number(process.env.POSTGRES_POOL_MAX ?? 10),
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
      /**
       * SSL handling para providers gerenciados (Supabase, Render, Neon).
       * - POSTGRES_SSL=1 + POSTGRES_SSL_REJECT_UNAUTHORIZED=0 (default): conexao
       *   criptografada mas sem validar cert. Necessario p/ Supabase pooler que
       *   usa cert intermediario nao incluido na CA store padrao do Node.
       * - POSTGRES_SSL=1 + POSTGRES_SSL_REJECT_UNAUTHORIZED=1: full validation.
       *   Use quando voce tem o CA bundle do provider (PGSSLROOTCERT via filesystem).
       */
      ssl: process.env.POSTGRES_SSL === '1'
        ? { rejectUnauthorized: process.env.POSTGRES_SSL_REJECT_UNAUTHORIZED === '1' }
        : undefined,
    })
  }
  return pool
}

export function getPostgresClientFromContext(): pg.PoolClient | null {
  return requestPgClient.getStore() ?? null
}

export async function queryPostgres<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<pg.QueryResult<T>> {
  const client = getPostgresClientFromContext()
  if (client) return client.query<T>(text, params)
  return getPostgresPool().query<T>(text, params)
}

function readCookie(cookieHeader: string | undefined, name: string): string | null {
  if (!cookieHeader) return null
  for (const pair of cookieHeader.split(';')) {
    const [rawName, ...rawValue] = pair.trim().split('=')
    if (rawName !== name) continue
    const value = rawValue.join('=')
    return value ? decodeURIComponent(value) : null
  }
  return null
}

function resolveTenantIdForPostgresContext(req: Request): string {
  const auth = req.headers.authorization
  const bearerToken = auth?.startsWith('Bearer ') ? auth.slice(7).trim() : null
  const sessionToken = bearerToken && bearerToken.includes('.')
    ? bearerToken
    : readCookie(req.headers.cookie, 'iga_session')
  const claims = sessionToken ? verifySessionJwt(sessionToken) : null
  if (claims?.tid) return claims.tid
  return resolveTenantId(req)
}

export function postgresTenantContext(req: Request, res: Response, next: NextFunction) {
  if (process.env.IGA_STORAGE_DRIVER !== 'postgres' || !hasPostgresConfig() || !req.path.startsWith('/api/')) {
    return next()
  }

  const tenantId = resolveTenantIdForPostgresContext(req)

  getPostgresPool()
    .connect()
    .then(async (client) => {
      let finished = false
      const release = async (commit: boolean) => {
        if (finished) return
        finished = true
        try {
          await client.query(commit ? 'COMMIT' : 'ROLLBACK')
        } catch {
          // A conexao sera liberada de qualquer forma.
        } finally {
          client.release()
        }
      }

      await client.query('BEGIN')
      await client.query('SET LOCAL ROLE iga_app')
      await client.query("SELECT set_config('app.current_tenant_id', $1, true)", [tenantId])

      res.on('finish', () => {
        void release(res.statusCode < 500)
      })
      res.on('close', () => {
        void release(false)
      })

      requestPgClient.run(client, () => next())
    })
    .catch((err: unknown) => next(err))
}

export async function checkPostgresHealth(): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!hasPostgresConfig()) return { ok: false, message: 'DATABASE_URL ausente' }
  try {
    await getPostgresPool().query('SELECT 1')
    return { ok: true }
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Falha ao conectar no PostgreSQL' }
  }
}

export async function runPostgresMigrations(): Promise<string[]> {
  const pgPool = getPostgresPool()
  const client = await pgPool.connect()
  const applied: string[] = []
  try {
    await client.query('BEGIN')
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `)

    for (const migration of POSTGRES_MIGRATIONS) {
      const existing = await client.query('SELECT id FROM schema_migrations WHERE id = $1', [migration.id])
      if (existing.rowCount && existing.rowCount > 0) continue
      await client.query(migration.sql)
      await client.query('INSERT INTO schema_migrations (id) VALUES ($1)', [migration.id])
      applied.push(migration.id)
    }

    await client.query('COMMIT')
    return applied
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

export async function closePostgresPool() {
  if (!pool) return
  await pool.end()
  pool = null
}
