-- ─────────────────────────────────────────────────────────────────────────────
-- IGA Gestao — esquema canonico do SQLite (espelha db/sqlite.ts).
-- Mantenha sincronizado com `db/sqlite.ts` (CREATE TABLE inline + ALTER TABLE).
-- Tabelas multi-tenant carregam `tenant_id` para defense-in-depth.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL DEFAULT 'default',
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL,
  status TEXT NOT NULL,
  permissions_json TEXT NULL,
  password_hash TEXT NOT NULL,
  must_change_password INTEGER NOT NULL DEFAULT 0,
  email_verified_at TEXT NULL,
  preferences_json TEXT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tenants (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  subtitle TEXT NOT NULL DEFAULT 'Automacao & Tecnologia',
  logo_url TEXT NULL,
  primary_color TEXT NULL,
  enabled_modules_json TEXT NOT NULL DEFAULT '[]',
  connector_id TEXT NOT NULL DEFAULT 'iga-custom-api',
  segment TEXT NOT NULL DEFAULT 'industry',
  plan TEXT NOT NULL DEFAULT 'trial',
  trial_ends_at TEXT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS datasources (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  api_url TEXT NOT NULL,
  auth_method TEXT NOT NULL,
  auth_credentials_encrypted TEXT NULL,
  status TEXT NOT NULL,
  last_checked_at TEXT NULL,
  last_error TEXT NULL,
  field_mappings_json TEXT NOT NULL,
  erp_endpoints_json TEXT NOT NULL,
  is_auth_source INTEGER NOT NULL DEFAULT 0,
  login_endpoint TEXT NULL,
  data_endpoint TEXT NULL,
  password_mode TEXT NULL,
  login_field_user TEXT NULL,
  login_field_password TEXT NULL,
  pagination_style TEXT NULL,
  page_param TEXT NULL,
  per_page_param TEXT NULL,
  default_per_page INTEGER NULL,
  cursor_param TEXT NULL,
  cursor_response_field TEXT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL DEFAULT 'default',
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS alerts (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  type TEXT NOT NULL,
  severity TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TEXT NOT NULL,
  read_at TEXT NULL
);

CREATE TABLE IF NOT EXISTS copilot_messages (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL DEFAULT 'default',
  user_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS scheduled_reports (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL DEFAULT 'default',
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  report_type TEXT NOT NULL,
  frequency TEXT NOT NULL,
  cron_expr TEXT NOT NULL,
  recipients_json TEXT NOT NULL,
  format TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  last_sent_at TEXT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NULL,
  tenant_id TEXT NULL,
  action TEXT NOT NULL,
  resource TEXT NOT NULL,
  metadata_json TEXT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL,
  is_secret INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  updated_by TEXT NULL
);

CREATE TABLE IF NOT EXISTS auth_action_tokens (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  user_id TEXT NULL,
  email TEXT NOT NULL,
  type TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tenant_onboarding (
  tenant_id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'pending',
  company_profile_json TEXT NOT NULL DEFAULT '{}',
  data_setup_json TEXT NOT NULL DEFAULT '{}',
  team_invites_json TEXT NOT NULL DEFAULT '[]',
  import_status TEXT NOT NULL DEFAULT 'idle',
  import_progress INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  prefix TEXT NOT NULL,
  secret_hash TEXT NOT NULL,
  scopes_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  last_used_at TEXT NULL,
  created_at TEXT NOT NULL,
  revoked_at TEXT NULL
);

CREATE TABLE IF NOT EXISTS saved_views (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  page_key TEXT NOT NULL,
  name TEXT NOT NULL,
  params TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS public_shares (
  token TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NULL,
  payload_json TEXT NOT NULL,
  expires_at TEXT NULL,
  revoked_at TEXT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_tenant_email ON users(tenant_id, email);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_tenant_email_unique ON users(tenant_id, lower(email));
CREATE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug);
CREATE INDEX IF NOT EXISTS idx_datasources_tenant ON datasources(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_alerts_tenant_created ON alerts(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_copilot_user_created ON copilot_messages(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scheduled_reports_active ON scheduled_reports(active, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_user_created ON audit_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auth_action_tokens_lookup ON auth_action_tokens(type, token_hash, expires_at);
CREATE INDEX IF NOT EXISTS idx_api_keys_tenant ON api_keys(tenant_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_api_keys_secret_hash ON api_keys(secret_hash);
CREATE INDEX IF NOT EXISTS idx_saved_views_tenant_page ON saved_views(tenant_id, page_key, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_public_shares_tenant ON public_shares(tenant_id, created_at DESC);
