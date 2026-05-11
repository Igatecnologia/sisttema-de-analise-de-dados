import { randomBytes } from 'node:crypto'
import { getDb } from './db/sqlite.js'
import { getPostgresClientFromContext, getPostgresPool, hasPostgresConfig, queryPostgres } from './db/postgres.js'
import { encryptSecret, decryptSecret, isEncryptedPayload } from './services/crypto.js'

export type DataSource = {
  id: string
  tenantId: string
  name: string
  type: string
  apiUrl: string
  authMethod: string
  authCredentials?: string
  status: string
  lastCheckedAt: string | null
  lastError: string | null
  fieldMappings: Array<{ standardField: string; sourceField: string; transform: string }>
  erpEndpoints: string[]
  isAuthSource: boolean
  loginEndpoint?: string
  dataEndpoint?: string
  passwordMode?: string
  loginFieldUser?: string
  loginFieldPassword?: string
  /** Configuração de paginação por datasource */
  paginationStyle?: string
  pageParam?: string
  perPageParam?: string
  defaultPerPage?: number
  cursorParam?: string
  cursorResponseField?: string
  createdAt: string
  updatedAt: string
}

const db = getDb()

function usePostgresStorage(): boolean {
  return process.env.IGA_STORAGE_DRIVER === 'postgres' && hasPostgresConfig()
}

function normalizeTimestamp(value: string | Date | null | undefined): string | null {
  if (!value) return null
  if (value instanceof Date) return value.toISOString()
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString()
}

/** Decripta credenciais lidas do banco. Suporta payload criptografado (JSON) e plaintext legado. */
function decryptStoredCredentials(raw: unknown): string | undefined {
  if (!raw) return undefined
  if (isEncryptedPayload(raw)) return decryptSecret(raw)
  const str = typeof raw === 'string' ? raw : JSON.stringify(raw)
  try {
    const parsed = JSON.parse(str) as unknown
    if (isEncryptedPayload(parsed)) return decryptSecret(parsed)
  } catch { /* não é JSON — plaintext legado */ }
  return str
}

function parseArray<T>(raw: unknown): T[] {
  if (!raw) return []
  if (Array.isArray(raw)) return raw as T[]
  return JSON.parse(String(raw)) as T[]
}

function mapRow(row: Record<string, unknown>): DataSource {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    name: String(row.name),
    type: String(row.type),
    apiUrl: String(row.api_url),
    authMethod: String(row.auth_method),
    authCredentials: decryptStoredCredentials(row.auth_credentials_encrypted),
    status: String(row.status),
    lastCheckedAt: row.last_checked_at ? String(row.last_checked_at) : null,
    lastError: row.last_error ? String(row.last_error) : null,
    fieldMappings: parseArray<DataSource['fieldMappings'][number]>(row.field_mappings_json),
    erpEndpoints: parseArray<string>(row.erp_endpoints_json),
    isAuthSource: row.is_auth_source === true || Number(row.is_auth_source ?? 0) === 1,
    loginEndpoint: row.login_endpoint ? String(row.login_endpoint) : undefined,
    dataEndpoint: row.data_endpoint ? String(row.data_endpoint) : undefined,
    passwordMode: row.password_mode ? String(row.password_mode) : undefined,
    loginFieldUser: row.login_field_user ? String(row.login_field_user) : undefined,
    loginFieldPassword: row.login_field_password ? String(row.login_field_password) : undefined,
    paginationStyle: row.pagination_style ? String(row.pagination_style) : undefined,
    pageParam: row.page_param ? String(row.page_param) : undefined,
    perPageParam: row.per_page_param ? String(row.per_page_param) : undefined,
    defaultPerPage: row.default_per_page ? Number(row.default_per_page) : undefined,
    cursorParam: row.cursor_param ? String(row.cursor_param) : undefined,
    cursorResponseField: row.cursor_response_field ? String(row.cursor_response_field) : undefined,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }
}

export function readAll(): DataSource[] {
  const rows = db.prepare('SELECT * FROM datasources ORDER BY created_at ASC').all() as Record<string, unknown>[]
  return rows.map(mapRow)
}

export async function readAllAsync(): Promise<DataSource[]> {
  if (usePostgresStorage()) {
    const rows = await queryPostgres('SELECT * FROM datasources ORDER BY created_at ASC')
    return rows.rows.map((row) => mapRow(row as Record<string, unknown>))
  }

  return readAll()
}

function assertTenantId(tenantId: string, fn: string): void {
  if (!tenantId || typeof tenantId !== 'string' || !tenantId.trim()) {
    throw new Error(`[storage.${fn}] tenantId obrigatorio`)
  }
}

/** Defense-in-depth: filtra no banco para nenhum caller esquecer de aplicar o WHERE. */
export function readAllForTenant(tenantId: string): DataSource[] {
  assertTenantId(tenantId, 'readAllForTenant')
  const rows = db
    .prepare('SELECT * FROM datasources WHERE tenant_id = ? ORDER BY created_at ASC')
    .all(tenantId) as Record<string, unknown>[]
  return rows.map(mapRow)
}

export async function readAllForTenantAsync(tenantId: string): Promise<DataSource[]> {
  assertTenantId(tenantId, 'readAllForTenantAsync')
  if (usePostgresStorage()) {
    const rows = await queryPostgres(
      'SELECT * FROM datasources WHERE tenant_id = $1 ORDER BY created_at ASC',
      [tenantId],
    )
    return rows.rows.map((row) => mapRow(row as Record<string, unknown>))
  }
  return readAllForTenant(tenantId)
}

export function writeAll(items: DataSource[]) {
  const clearStmt = db.prepare('DELETE FROM datasources')
  const insertStmt = db.prepare(`
    INSERT INTO datasources (
      id, tenant_id, name, type, api_url, auth_method, auth_credentials_encrypted, status, last_checked_at, last_error,
      field_mappings_json, erp_endpoints_json, is_auth_source, login_endpoint, data_endpoint, password_mode,
      login_field_user, login_field_password,
      pagination_style, page_param, per_page_param, default_per_page, cursor_param, cursor_response_field,
      created_at, updated_at
    ) VALUES (
      @id, @tenant_id, @name, @type, @api_url, @auth_method, @auth_credentials_encrypted, @status, @last_checked_at, @last_error,
      @field_mappings_json, @erp_endpoints_json, @is_auth_source, @login_endpoint, @data_endpoint, @password_mode,
      @login_field_user, @login_field_password,
      @pagination_style, @page_param, @per_page_param, @default_per_page, @cursor_param, @cursor_response_field,
      @created_at, @updated_at
    )
  `)
  const tx = db.transaction((records: DataSource[]) => {
    clearStmt.run()
    for (const item of records) {
      insertStmt.run({
        id: item.id,
        tenant_id: item.tenantId,
        name: item.name,
        type: item.type,
        api_url: item.apiUrl,
        auth_method: item.authMethod,
        auth_credentials_encrypted: item.authCredentials
          ? JSON.stringify(encryptSecret(item.authCredentials))
          : null,
        status: item.status,
        last_checked_at: item.lastCheckedAt,
        last_error: item.lastError,
        field_mappings_json: JSON.stringify(item.fieldMappings ?? []),
        erp_endpoints_json: JSON.stringify(item.erpEndpoints ?? []),
        is_auth_source: item.isAuthSource ? 1 : 0,
        login_endpoint: item.loginEndpoint ?? null,
        data_endpoint: item.dataEndpoint ?? null,
        password_mode: item.passwordMode ?? 'plain',
        login_field_user: item.loginFieldUser ?? 'login',
        login_field_password: item.loginFieldPassword ?? 'senha',
        pagination_style: item.paginationStyle ?? null,
        page_param: item.pageParam ?? null,
        per_page_param: item.perPageParam ?? null,
        default_per_page: item.defaultPerPage ?? null,
        cursor_param: item.cursorParam ?? null,
        cursor_response_field: item.cursorResponseField ?? null,
        created_at: normalizeTimestamp(item.createdAt) ?? new Date().toISOString(),
        updated_at: normalizeTimestamp(item.updatedAt) ?? new Date().toISOString(),
      })
    }
  })
  tx(items)
}

export async function writeAllAsync(items: DataSource[]) {
  if (usePostgresStorage()) {
    const contextClient = getPostgresClientFromContext()
    const client = contextClient ?? await getPostgresPool().connect()
    try {
      if (!contextClient) await client.query('BEGIN')
      await client.query('DELETE FROM datasources')
      for (const item of items) {
        await client.query(
          `
          INSERT INTO datasources (
            id, tenant_id, name, type, api_url, auth_method, auth_credentials_encrypted, status, last_checked_at, last_error,
            field_mappings_json, erp_endpoints_json, is_auth_source, login_endpoint, data_endpoint, password_mode,
            login_field_user, login_field_password,
            pagination_style, page_param, per_page_param, default_per_page, cursor_param, cursor_response_field,
            created_at, updated_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
            $11, $12, $13, $14, $15, $16,
            $17, $18,
            $19, $20, $21, $22, $23, $24,
            $25, $26
          )
          `,
          [
            item.id,
            item.tenantId,
            item.name,
            item.type,
            item.apiUrl,
            item.authMethod,
            item.authCredentials ? JSON.stringify(encryptSecret(item.authCredentials)) : null,
            item.status,
            item.lastCheckedAt,
            item.lastError,
            JSON.stringify(item.fieldMappings ?? []),
            JSON.stringify(item.erpEndpoints ?? []),
            item.isAuthSource,
            item.loginEndpoint ?? null,
            item.dataEndpoint ?? null,
            item.passwordMode ?? 'plain',
            item.loginFieldUser ?? 'login',
            item.loginFieldPassword ?? 'senha',
            item.paginationStyle ?? null,
            item.pageParam ?? null,
            item.perPageParam ?? null,
            item.defaultPerPage ?? null,
            item.cursorParam ?? null,
            item.cursorResponseField ?? null,
            normalizeTimestamp(item.createdAt) ?? new Date().toISOString(),
            normalizeTimestamp(item.updatedAt) ?? new Date().toISOString(),
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
    return
  }

  writeAll(items)
}

/** Fila de escrita — evita perder fontes quando vários POST /test ou CRUD rodam em paralelo. */
let datasourcesWriteChain: Promise<unknown> = Promise.resolve()

export function runWithDatasourcesLock<T>(fn: () => T | Promise<T>): Promise<T> {
  const run = datasourcesWriteChain.then(() => fn())
  datasourcesWriteChain = run.then(
    () => undefined,
    () => undefined,
  )
  return run
}

export function genId(): string {
  return `ds_${randomBytes(6).toString('hex')}_${Date.now().toString(36)}`
}
