import 'dotenv/config'
import { getDb } from './sqlite.js'
import { closePostgresPool, getPostgresPool, runPostgresMigrations } from './postgres.js'

type TableCopy = {
  table: string
  columns: string[]
  conflict: string
}

const TABLES: TableCopy[] = [
  {
    table: 'users',
    columns: [
      'id',
      'tenant_id',
      'name',
      'email',
      'role',
      'status',
      'permissions_json',
      'password_hash',
      'must_change_password',
      'preferences_json',
      'created_at',
      'updated_at',
    ],
    conflict: 'id',
  },
  {
    table: 'datasources',
    columns: [
      'id',
      'tenant_id',
      'name',
      'type',
      'api_url',
      'auth_method',
      'auth_credentials_encrypted',
      'status',
      'last_checked_at',
      'last_error',
      'field_mappings_json',
      'erp_endpoints_json',
      'is_auth_source',
      'login_endpoint',
      'data_endpoint',
      'password_mode',
      'login_field_user',
      'login_field_password',
      'pagination_style',
      'page_param',
      'per_page_param',
      'default_per_page',
      'cursor_param',
      'cursor_response_field',
      'created_at',
      'updated_at',
    ],
    conflict: 'id',
  },
  {
    table: 'sessions',
    columns: ['token', 'user_id', 'tenant_id', 'expires_at', 'created_at'],
    conflict: 'token',
  },
  {
    table: 'alerts',
    columns: ['id', 'tenant_id', 'type', 'severity', 'title', 'message', 'created_at', 'read_at'],
    conflict: 'id',
  },
  {
    table: 'copilot_messages',
    columns: ['id', 'tenant_id', 'user_id', 'role', 'content', 'created_at'],
    conflict: 'id',
  },
  {
    table: 'scheduled_reports',
    columns: [
      'id',
      'tenant_id',
      'user_id',
      'name',
      'report_type',
      'frequency',
      'cron_expr',
      'recipients_json',
      'format',
      'active',
      'last_sent_at',
      'created_at',
      'updated_at',
    ],
    conflict: 'id',
  },
  {
    table: 'app_settings',
    columns: ['key', 'value_json', 'is_secret', 'updated_at', 'updated_by'],
    conflict: 'key',
  },
]

function toPostgresValue(column: string, value: unknown): unknown {
  if (value == null) return null
  if (column.endsWith('_json')) {
    if (typeof value === 'string') return value || 'null'
    return JSON.stringify(value)
  }
  if (column === 'must_change_password' || column === 'is_auth_source' || column === 'active' || column === 'is_secret') {
    return Number(value) === 1 || value === true
  }
  return value
}

async function copyTable(copy: TableCopy): Promise<number> {
  const sqlite = getDb()
  const pg = getPostgresPool()
  const rows = sqlite.prepare(`SELECT ${copy.columns.join(', ')} FROM ${copy.table}`).all() as Record<string, unknown>[]
  if (rows.length === 0) return 0

  const placeholders = copy.columns.map((_, i) => `$${i + 1}`).join(', ')
  const updates = copy.columns
    .filter((column) => column !== copy.conflict)
    .map((column) => `${column} = EXCLUDED.${column}`)
    .join(', ')
  const sql = `
    INSERT INTO ${copy.table} (${copy.columns.join(', ')})
    VALUES (${placeholders})
    ON CONFLICT (${copy.conflict}) DO UPDATE SET ${updates}
  `

  for (const row of rows) {
    const values = copy.columns.map((column) => toPostgresValue(column, row[column]))
    await pg.query(sql, values)
  }
  return rows.length
}

async function copyAuditLog(): Promise<number> {
  const sqlite = getDb()
  const pg = getPostgresPool()
  const rows = sqlite
    .prepare('SELECT id, user_id, action, resource, metadata_json, created_at FROM audit_log ORDER BY id ASC')
    .all() as Record<string, unknown>[]
  if (rows.length === 0) return 0

  for (const row of rows) {
    await pg.query(
      `
      INSERT INTO audit_log (id, user_id, action, resource, metadata_json, created_at)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (id) DO UPDATE SET
        user_id = EXCLUDED.user_id,
        action = EXCLUDED.action,
        resource = EXCLUDED.resource,
        metadata_json = EXCLUDED.metadata_json,
        created_at = EXCLUDED.created_at
      `,
      [
        row.id,
        row.user_id ?? null,
        row.action,
        row.resource,
        row.metadata_json ? String(row.metadata_json) : null,
        row.created_at,
      ],
    )
  }
  await pg.query("SELECT setval(pg_get_serial_sequence('audit_log', 'id'), COALESCE((SELECT MAX(id) FROM audit_log), 1), true)")
  return rows.length
}

async function main() {
  await runPostgresMigrations()
  const copied: Record<string, number> = {}
  for (const table of TABLES) {
    copied[table.table] = await copyTable(table)
  }
  copied.audit_log = await copyAuditLog()
  console.log('[IGA][DB] SQLite -> PostgreSQL concluido:', copied)
}

main()
  .catch((err) => {
    console.error('[IGA][DB] Falha ao copiar SQLite para PostgreSQL:', err instanceof Error ? err.message : err)
    process.exitCode = 1
  })
  .finally(() => {
    void closePostgresPool()
  })
