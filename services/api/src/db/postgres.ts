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

/**
 * A-C1 (audit 2026-05-12): patch minimo de robustez.
 *
 * Antes: BEGIN dependia de `res.on('finish'/'close')` para COMMIT/ROLLBACK.
 * Se a query inicial (BEGIN/SET LOCAL/SELECT set_config) falhava, `next(err)`
 * caia no handler global mas a conexao ja tinha sido pega do pool sem
 * ROLLBACK garantido. Tambem: `release()` era chamado sem await — qualquer
 * erro nele virava `unhandledRejection` (causou o crash + reboot do Fly hoje).
 *
 * Mudancas:
 *  1) try/catch ao redor do BEGIN/SET inicial — se falhar, ROLLBACK + release
 *     ANTES de propagar via next(err).
 *  2) `client.on('error', ...)` swallow + audit — sem isso, qualquer erro
 *     async no client (timeout server-side, idle_in_transaction kill) virava
 *     uncaughtException que reinicia o processo.
 *  3) Idempotencia de release via flag `finished` mantida; await em
 *     COMMIT/ROLLBACK.
 *  4) Fallback para garantir release no `next tick` se nem finish nem close
 *     dispararem (defesa em profundidade).
 */
/**
 * Rotas que operam cross-tenant por design (super-admin manage tenants/users
 * de outros tenants, internal tools chamados pelo iga-ai). Estas rotas pulam
 * o RLS context porque `SET app.current_tenant_id = <admin_tenant>` bloquearia
 * qualquer INSERT/UPDATE/DELETE em outro tenant. Acesso ainda é gated por
 * `requireSuperAdmin` (SUPER_ADMIN_EMAILS env) e auth do internalTools.
 */
const CROSS_TENANT_PREFIXES = ['/api/v1/super-admin', '/api/v1/_internal/']

export function postgresTenantContext(req: Request, res: Response, next: NextFunction) {
  if (process.env.IGA_STORAGE_DRIVER !== 'postgres' || !hasPostgresConfig() || !req.path.startsWith('/api/')) {
    return next()
  }
  if (CROSS_TENANT_PREFIXES.some((p) => req.path.startsWith(p))) {
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
        } catch (err) {
          /** Postgres pode ter encerrado a conexao (timeout, idle-in-transaction).
           *  Nao re-lancamos: connection pool ja vai descartar. */
          console.warn('[IGA][pg-middleware] release() commit/rollback falhou:', err instanceof Error ? err.message : err)
        } finally {
          try { client.release() } catch { /* idempotente */ }
        }
      }

      /** Sem este listener, erros async no client (ex: server-side termination
       *  via idle_in_transaction_session_timeout) viram uncaughtException. */
      client.on('error', (err) => {
        console.warn('[IGA][pg-middleware] client error event:', err.message)
        void release(false)
      })

      try {
        await client.query('BEGIN')
        await client.query('SET LOCAL ROLE iga_app')
        await client.query("SELECT set_config('app.current_tenant_id', $1, true)", [tenantId])
      } catch (initErr) {
        /** BEGIN/SET falhou — libera conexao IMEDIATAMENTE antes de cair no
         *  error handler global. Senao a conexao fica "presa" no pool ate
         *  idle_in_transaction matar (5min). */
        await release(false)
        return next(initErr)
      }

      res.on('finish', () => { void release(res.statusCode < 500) })
      res.on('close', () => { void release(false) })

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
