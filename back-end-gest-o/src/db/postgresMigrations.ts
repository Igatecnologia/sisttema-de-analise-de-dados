export type PostgresMigration = {
  id: string
  sql: string
}

export const POSTGRES_MIGRATIONS: PostgresMigration[] = [
  {
    id: '001_initial_schema',
    sql: `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL,
  status TEXT NOT NULL,
  permissions_json JSONB NULL,
  password_hash TEXT NOT NULL,
  must_change_password BOOLEAN NOT NULL DEFAULT false,
  preferences_json JSONB NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
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
  last_checked_at TIMESTAMPTZ NULL,
  last_error TEXT NULL,
  field_mappings_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  erp_endpoints_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_auth_source BOOLEAN NOT NULL DEFAULT false,
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
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL DEFAULT 'default',
  expires_at BIGINT NOT NULL,
  created_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS alerts (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  type TEXT NOT NULL,
  severity TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  read_at TIMESTAMPTZ NULL
);

CREATE TABLE IF NOT EXISTS copilot_messages (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS scheduled_reports (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  report_type TEXT NOT NULL,
  frequency TEXT NOT NULL,
  cron_expr TEXT NOT NULL,
  recipients_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  format TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  last_sent_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_log (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NULL,
  action TEXT NOT NULL,
  resource TEXT NOT NULL,
  metadata_json JSONB NULL,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value_json JSONB NOT NULL,
  is_secret BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL,
  updated_by TEXT NULL
);

CREATE TABLE IF NOT EXISTS auth_action_tokens (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL DEFAULT 'default',
  user_id TEXT NULL,
  email TEXT NOT NULL,
  type TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ NULL,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_datasources_tenant ON datasources(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_alerts_tenant_created ON alerts(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_copilot_user_created ON copilot_messages(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scheduled_reports_active ON scheduled_reports(active, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_user_created ON audit_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auth_action_tokens_lookup ON auth_action_tokens(type, token_hash, expires_at);
`,
  },
  {
    id: '002_multi_tenant_foundation',
    sql: `
CREATE TABLE IF NOT EXISTS tenants (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  subtitle TEXT NOT NULL DEFAULT 'Automacao & Tecnologia',
  logo_url TEXT NULL,
  primary_color TEXT NULL,
  enabled_modules JSONB NOT NULL DEFAULT '[]'::jsonb,
  connector_id TEXT NOT NULL DEFAULT 'sgbr-espuma',
  plan TEXT NOT NULL DEFAULT 'trial',
  trial_ends_at TIMESTAMPTZ NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO tenants (
  id, slug, name, subtitle, logo_url, primary_color, enabled_modules, connector_id, plan, trial_ends_at, status, created_at, updated_at
) VALUES (
  'default',
  'default',
  'IGA',
  'Automacao & Tecnologia',
  NULL,
  NULL,
  '["dashboard","financeiro","relatorios","usuarios","auditoria","producao","ficha_tecnica","comercial","compras","estoque","alertas","suporte","datasources","operations"]'::jsonb,
  'sgbr-espuma',
  'trial',
  NULL,
  'active',
  now(),
  now()
) ON CONFLICT (id) DO NOTHING;

ALTER TABLE users ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT 'default';
ALTER TABLE copilot_messages ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT 'default';
ALTER TABLE scheduled_reports ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT 'default';
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS tenant_id TEXT NULL;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS connector_id TEXT NOT NULL DEFAULT 'sgbr-espuma';
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS plan TEXT NOT NULL DEFAULT 'trial';
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ NULL;

ALTER TABLE datasources
  ADD CONSTRAINT fk_datasources_tenant
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
  ON UPDATE CASCADE
  ON DELETE RESTRICT
  NOT VALID;

ALTER TABLE sessions
  ADD CONSTRAINT fk_sessions_tenant
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
  ON UPDATE CASCADE
  ON DELETE CASCADE
  NOT VALID;

ALTER TABLE alerts
  ADD CONSTRAINT fk_alerts_tenant
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
  ON UPDATE CASCADE
  ON DELETE CASCADE
  NOT VALID;

CREATE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug);
CREATE INDEX IF NOT EXISTS idx_users_tenant_email ON users(tenant_id, email);
CREATE INDEX IF NOT EXISTS idx_copilot_tenant_user_created ON copilot_messages(tenant_id, user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scheduled_reports_tenant_active ON scheduled_reports(tenant_id, active, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_tenant_created ON audit_log(tenant_id, created_at DESC);

ALTER TABLE datasources ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE copilot_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_datasources ON datasources;
CREATE POLICY tenant_isolation_datasources ON datasources
  USING (tenant_id = current_setting('app.current_tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));

DROP POLICY IF EXISTS tenant_isolation_sessions ON sessions;
CREATE POLICY tenant_isolation_sessions ON sessions
  USING (tenant_id = current_setting('app.current_tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));

DROP POLICY IF EXISTS tenant_isolation_alerts ON alerts;
CREATE POLICY tenant_isolation_alerts ON alerts
  USING (tenant_id = current_setting('app.current_tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));

DROP POLICY IF EXISTS tenant_isolation_users ON users;
CREATE POLICY tenant_isolation_users ON users
  USING (tenant_id = current_setting('app.current_tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));

DROP POLICY IF EXISTS tenant_isolation_copilot_messages ON copilot_messages;
CREATE POLICY tenant_isolation_copilot_messages ON copilot_messages
  USING (tenant_id = current_setting('app.current_tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));

DROP POLICY IF EXISTS tenant_isolation_scheduled_reports ON scheduled_reports;
CREATE POLICY tenant_isolation_scheduled_reports ON scheduled_reports
  USING (tenant_id = current_setting('app.current_tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));

DROP POLICY IF EXISTS tenant_isolation_audit_log ON audit_log;
CREATE POLICY tenant_isolation_audit_log ON audit_log
  USING (tenant_id IS NULL OR tenant_id = current_setting('app.current_tenant_id', true))
  WITH CHECK (tenant_id IS NULL OR tenant_id = current_setting('app.current_tenant_id', true));
`,
  },
  {
    id: '003_enforce_rls_and_tenant_unique_users',
    sql: `
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_tenant_email_unique ON users(tenant_id, lower(email));

ALTER TABLE datasources FORCE ROW LEVEL SECURITY;
ALTER TABLE sessions FORCE ROW LEVEL SECURITY;
ALTER TABLE alerts FORCE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;
ALTER TABLE copilot_messages FORCE ROW LEVEL SECURITY;
ALTER TABLE scheduled_reports FORCE ROW LEVEL SECURITY;
ALTER TABLE audit_log FORCE ROW LEVEL SECURITY;
`,
  },
  {
    id: '004_application_role_for_rls',
    sql: `
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'iga_app') THEN
    CREATE ROLE iga_app NOLOGIN NOSUPERUSER NOBYPASSRLS;
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO iga_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO iga_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO iga_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO iga_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO iga_app;
`,
  },
  {
    id: '005_sprint_3_4_auth_connectors',
    sql: `
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS connector_id TEXT NOT NULL DEFAULT 'sgbr-espuma';
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS plan TEXT NOT NULL DEFAULT 'trial';
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ NULL;

CREATE TABLE IF NOT EXISTS auth_action_tokens (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL DEFAULT 'default',
  user_id TEXT NULL,
  email TEXT NOT NULL,
  type TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ NULL,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS tenant_onboarding (
  tenant_id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'pending',
  company_profile_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  data_setup_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  team_invites_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  import_status TEXT NOT NULL DEFAULT 'idle',
  import_progress INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_auth_action_tokens_lookup ON auth_action_tokens(type, token_hash, expires_at);

ALTER TABLE auth_action_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_onboarding ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_action_tokens FORCE ROW LEVEL SECURITY;
ALTER TABLE tenant_onboarding FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_auth_action_tokens ON auth_action_tokens;
CREATE POLICY tenant_isolation_auth_action_tokens ON auth_action_tokens
  USING (tenant_id = current_setting('app.current_tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));

DROP POLICY IF EXISTS tenant_isolation_tenant_onboarding ON tenant_onboarding;
CREATE POLICY tenant_isolation_tenant_onboarding ON tenant_onboarding
  USING (tenant_id = current_setting('app.current_tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));

GRANT SELECT, INSERT, UPDATE, DELETE ON auth_action_tokens TO iga_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON tenant_onboarding TO iga_app;
`,
  },
  {
    id: '006_audit_log_hash_chain',
    sql: `
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS prev_hash TEXT NULL;
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS row_hash TEXT NULL;

-- Tampering protection: a aplicacao so pode INSERT em audit_log.
-- UPDATE/DELETE viram negados pelo Postgres mesmo se a politica RLS deixar passar.
REVOKE UPDATE, DELETE ON audit_log FROM iga_app;
GRANT SELECT, INSERT ON audit_log TO iga_app;
`,
  },
  {
    id: '007_password_history_session_binding',
    sql: `
CREATE TABLE IF NOT EXISTS user_password_history (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_user_password_history_user ON user_password_history(user_id, created_at DESC);
GRANT SELECT, INSERT, DELETE ON user_password_history TO iga_app;
GRANT USAGE, SELECT ON SEQUENCE user_password_history_id_seq TO iga_app;

-- Sessao binding (SEC-2.5): IP/UA fingerprint e pais inicial.
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS ip_hash TEXT NULL;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS ua_hash TEXT NULL;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS ua_family TEXT NULL;
`,
  },
  {
    id: '008_user_mfa',
    sql: `
CREATE TABLE IF NOT EXISTS user_mfa (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  secret_encrypted TEXT NOT NULL,
  backup_codes_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  enabled_at TIMESTAMPTZ NULL,
  last_used_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);
GRANT SELECT, INSERT, UPDATE, DELETE ON user_mfa TO iga_app;
`,
  },
  {
    id: '009_refresh_tokens',
    sql: `
CREATE TABLE IF NOT EXISTS refresh_tokens (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL,
  family_id TEXT NOT NULL,
  parent_hash TEXT NULL,
  used_at TIMESTAMPTZ NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  ip_hash TEXT NULL,
  ua_hash TEXT NULL,
  revoked_at TIMESTAMPTZ NULL
);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id, expires_at);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_family ON refresh_tokens(family_id);
GRANT SELECT, INSERT, UPDATE ON refresh_tokens TO iga_app;
`,
  },
  {
    id: '010_subscriptions',
    sql: `
CREATE TABLE IF NOT EXISTS subscriptions (
  tenant_id TEXT PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  plan TEXT NOT NULL DEFAULT 'trial',
  status TEXT NOT NULL DEFAULT 'trialing',
  stripe_customer_id TEXT NULL,
  stripe_subscription_id TEXT NULL,
  current_period_end TIMESTAMPTZ NULL,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  grace_until TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status, current_period_end);
GRANT SELECT, INSERT, UPDATE, DELETE ON subscriptions TO iga_app;
`,
  },
  {
    id: '011_saas_product_tables',
    sql: `
CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  prefix TEXT NOT NULL,
  secret_hash TEXT NOT NULL UNIQUE,
  scopes_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'active',
  last_used_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ NULL
);
CREATE INDEX IF NOT EXISTS idx_api_keys_tenant ON api_keys(tenant_id, created_at DESC);

CREATE TABLE IF NOT EXISTS saved_views (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  page_key TEXT NOT NULL,
  name TEXT NOT NULL,
  params TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_saved_views_tenant_page ON saved_views(tenant_id, page_key, created_at DESC);

CREATE TABLE IF NOT EXISTS public_shares (
  token TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NULL,
  payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  expires_at TIMESTAMPTZ NULL,
  revoked_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_public_shares_tenant ON public_shares(tenant_id, created_at DESC);

ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys FORCE ROW LEVEL SECURITY;
ALTER TABLE saved_views FORCE ROW LEVEL SECURITY;
ALTER TABLE public_shares FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_api_keys ON api_keys;
CREATE POLICY tenant_isolation_api_keys ON api_keys
  USING (tenant_id = current_setting('app.current_tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));

DROP POLICY IF EXISTS tenant_isolation_saved_views ON saved_views;
CREATE POLICY tenant_isolation_saved_views ON saved_views
  USING (tenant_id = current_setting('app.current_tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));

DROP POLICY IF EXISTS tenant_isolation_public_shares_write ON public_shares;
CREATE POLICY tenant_isolation_public_shares_write ON public_shares
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));

DROP POLICY IF EXISTS public_share_read_by_token ON public_shares;
CREATE POLICY public_share_read_by_token ON public_shares
  FOR SELECT
  USING (revoked_at IS NULL AND (expires_at IS NULL OR expires_at > now()));

GRANT SELECT, INSERT, UPDATE, DELETE ON api_keys TO iga_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON saved_views TO iga_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON public_shares TO iga_app;
`,
  },
  {
    id: '012_tenant_segment',
    sql: `
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS segment TEXT NOT NULL DEFAULT 'industry';
CREATE INDEX IF NOT EXISTS idx_tenants_segment ON tenants(segment);
`,
  },
  {
    id: '013_customers',
    sql: `
CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  document TEXT NULL,
  email TEXT NULL,
  phone TEXT NULL,
  contact_name TEXT NULL,
  address_json JSONB NULL,
  credit_limit_cents BIGINT NULL,
  notes TEXT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_customers_tenant ON customers(tenant_id, lower(name));
CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_tenant_document_unique
  ON customers(tenant_id, document) WHERE document IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_tenant_email_unique
  ON customers(tenant_id, lower(email)) WHERE email IS NOT NULL;

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_customers ON customers;
CREATE POLICY tenant_isolation_customers ON customers
  USING (tenant_id = current_setting('app.current_tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));

GRANT SELECT, INSERT, UPDATE, DELETE ON customers TO iga_app;
`,
  },
]
