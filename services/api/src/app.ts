import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import { Sentry } from './observability/sentry.js'
import compression from 'compression'
import { existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { getProxyOperationalSnapshot, proxyRouter, setupReconcileAlertScheduler } from './routes/proxy.js'
import { dataSourceRouter } from './routes/datasources.js'
import { authRouter } from './routes/auth.js'
import { usersRouter } from './routes/users.js'
import { dashboardRouter } from './routes/dashboard.js'
import { reportsRouter } from './routes/reports.js'
import { auditRouter } from './routes/audit.js'
import { erpRouter } from './routes/erp.js'
import { financeRouter } from './routes/finance.js'
import { seedDefaultAdmin } from './seedAdmin.js'
import { seedDefaultDataSources } from './seedDataSources.js'
import { readAll as ensureDataSourcesFile } from './storage.js'
import { readAllUsers as ensureUsersFile } from './userStorage.js'
import { requireAuth, requireAdmin } from './middleware/auth.js'
import { requireAuthOrApiKeyScope } from './middleware/apiKeyAuth.js'
import { csrfProtection } from './middleware/csrf.js'
import { jsonRequestLog } from './middleware/requestLog.js'
import { blockPrototypePollution } from './middleware/blockPrototypePollution.js'
import { opsRouter } from './routes/ops.js'
import { alertsRouter, startAlertsEngine } from './routes/alerts.js'
import { userPreferencesRouter } from './routes/userPreferences.js'
import { searchRouter } from './routes/search.js'
import { copilotRouter } from './routes/copilot.js'
import { internalToolsRouter } from './routes/internalTools.js'
import { scheduledReportsRouter } from './routes/scheduledReports.js'
import { csvDatasetsRouter } from './routes/csvDatasets.js'
import { tenantsRouter } from './routes/tenants.js'
import { onboardingRouter } from './routes/onboarding.js'
import { billingRouter, stripeWebhookRouter } from './routes/billing.js'
import { subscriptionGate } from './middleware/subscriptionGate.js'
import { lgpdRouter } from './routes/lgpd.js'
import { superAdminRouter } from './routes/superAdmin.js'
import { securityRouter } from './routes/security.js'
import { connectorsRouter } from './routes/connectors.js'
import { webhooksRouter } from './routes/webhooks.js'
import { legalRouter } from './routes/legal.js'
import { analyticsRouter } from './routes/analytics.js'
import { leadsRouter } from './routes/leads.js'
import { apiKeysRouter } from './routes/apiKeys.js'
import { savedViewsRouter } from './routes/savedViews.js'
import { organizationsRouter } from './routes/organizations.js'
import { changelogRouter } from './routes/changelog.js'
import { helpRouter } from './routes/help.js'
import { publicSharesRouter } from './routes/publicShares.js'
import { segmentsRouter } from './routes/segments.js'
import { customersRouter } from './routes/customers.js'
import { forecastRouter } from './routes/forecast.js'
import { productionRouter } from './routes/production.js'
import { startScheduledReportsJob } from './jobs/scheduledReports.js'
import { startBackupScheduler } from './jobs/dbBackup.js'
import { startCopilotRetentionJob } from './jobs/copilotRetention.js'
import { startRefreshTokenCleanupJob } from './jobs/refreshTokenCleanup.js'
import { startDailyDigestJob } from './services/dailyDigest.js'
import { startWarmCacheJob } from './jobs/warmCache.js'
import { startTrialLifecycleJob } from './jobs/trialLifecycle.js'
import { startWebhookRecoveryLoop } from './services/webhookDispatcher.js'
import { getDbPath } from './db/sqlite.js'
import { checkPostgresHealth, hasPostgresConfig, postgresTenantContext } from './db/postgres.js'
import { checkRedisHealth, hasRedisConfig } from './services/redis.js'
import { ConnectorRegistry } from './connectors/connectorRegistry.js'
import { findTenantBySlug } from './tenantStorage.js'
import { resolveTenantId } from './utils/tenant.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

type CreateAppOptions = {
  startSchedulers?: boolean
}

export function createApp(options: CreateAppOptions = {}) {
  const app = express()
  // Render/Railway/Heroku usam proxy reverso — sem isso, cookies Secure não funcionam
  if (process.env.NODE_ENV === 'production') {
    app.set('trust proxy', 1)
  }
  const FRONTEND_URL = process.env.FRONTEND_URL ?? 'http://localhost:5173'
  const startSchedulers = options.startSchedulers ?? true

  app.use(helmet({
    contentSecurityPolicy: false,
    strictTransportSecurity: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  }))
  /** SEC-3.3 / SEC-3.4 — CSP dinamico multi-tenant.
   *  Hosts CDN confiaveis (PostHog, Sentry, Stripe, Turnstile) habilitados quando
   *  o tenant ativa observabilidade/billing. Para inline scripts (futuros) basta
   *  adicionar nonce — hoje a SPA Vite nao usa inline. */
  const TRUSTED_CDN_SCRIPT = [
    'https://challenges.cloudflare.com',
    'https://*.posthog.com',
    'https://browser.sentry-cdn.com',
    'https://*.ingest.sentry.io',
    'https://js.stripe.com',
  ]
  const TRUSTED_CDN_CONNECT = [
    'https://*.posthog.com',
    'https://*.ingest.sentry.io',
    'https://*.sentry.io',
    'https://api.stripe.com',
  ]
  const TRUSTED_FRAME = [
    'https://challenges.cloudflare.com',
    'https://js.stripe.com',
    'https://hooks.stripe.com',
  ]

  app.use(async (req, res, next) => {
    const tenant = await findTenantBySlug(resolveTenantId(req))
    const connector = ConnectorRegistry.get(tenant?.connectorId)
    const connectSrc = ["'self'", FRONTEND_URL, ...connector.cspConnectSrc, ...TRUSTED_CDN_CONNECT]
    res.setHeader('Content-Security-Policy', [
      "default-src 'self'",
      `script-src 'self' ${TRUSTED_CDN_SCRIPT.join(' ')}`,
      /** Ant Design exige unsafe-inline em style-attr; CSP nonce em style nao cobre attrs. */
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      `connect-src ${[...new Set(connectSrc)].join(' ')}`,
      `frame-src ${TRUSTED_FRAME.join(' ')}`,
      "frame-ancestors 'none'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "report-uri /api/v1/security/csp-report",
      "report-to csp-endpoint",
    ].join('; '))
    next()
  })
  app.use((_req, res, next) => {
    /** SEC-3.3 — headers cross-origin + Permissions-Policy + Reporting API. */
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()')
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin')
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin')
    /** COEP nao habilitado por default — pode quebrar imagens externas (logos do tenant, charts). */
    res.setHeader(
      'Reporting-Endpoints',
      'csp-endpoint="/api/v1/security/csp-report"',
    )
    next()
  })
  /** Gzip em todas as respostas — corta JSON do proxy SGBR em ~70-80%, payload de
   *  10MB vira ~2MB. Threshold 1KB pra não comprimir respostas curtas em vão. */
  app.use(compression({ threshold: 1024 }))
  /**
   * CORS dinamico (SEC-3.5): em prod aceita a FRONTEND_URL + qualquer subdomain do
   * dominio raiz configurado em CORS_TENANT_DOMAIN_REGEX (default igagestao.com.br).
   * Em dev adiciona as portas Vite comuns.
   */
  const isStrictlyDev = process.env.NODE_ENV === 'development'
  const tenantSubdomainRegex = process.env.CORS_TENANT_DOMAIN_REGEX
    ? new RegExp(process.env.CORS_TENANT_DOMAIN_REGEX)
    /** Default conservador: apenas subdominio do apex canonico igagestao.com.br.
     * Em prod, definir CORS_TENANT_DOMAIN_REGEX explicito para incluir o frontend
     * Vercel deste deploy (ex.: "^https://([a-z0-9-]+\\.igagestao\\.com\\.br|app-igagestao-xyz\\.vercel\\.app)$").
     * Evita aceitar QUALQUER *.vercel.app / *.onrender.com (risco de takeover). */
    : /^https:\/\/[a-z0-9-]+\.igagestao\.com\.br$/
  const staticAllowed = new Set(
    isStrictlyDev
      ? [FRONTEND_URL, 'http://localhost:5173', 'http://localhost:4173', 'http://localhost:3002', 'http://localhost:3003']
      : [FRONTEND_URL],
  )
  app.use(cors({
    origin: (origin, cb) => {
      /** Server-to-server (sem header Origin) — permitido. */
      if (!origin) return cb(null, true)
      if (staticAllowed.has(origin)) return cb(null, true)
      if (!isStrictlyDev && tenantSubdomainRegex.test(origin)) return cb(null, true)
      cb(new Error(`CORS denied: ${origin}`), false)
    },
    credentials: true,
  }))
  /** Stripe webhook precisa de raw body para validar assinatura — registrado ANTES do json. */
  app.use('/api/v1/billing', stripeWebhookRouter)
  /** Limite default 1mb pra todas as rotas; CSV upload usa endpoint dedicado abaixo com 12mb. */
  app.use((req, res, next) => {
    if (req.path.startsWith('/api/v1/csv-datasets') && req.method === 'POST') {
      return express.json({ limit: '12mb' })(req, res, next)
    }
    return express.json({ limit: '1mb' })(req, res, next)
  })
  app.use(blockPrototypePollution)
  app.use(csrfProtection)
  app.use(jsonRequestLog)
  app.use(postgresTenantContext)

  /** Endpoints publicos de seguranca: security.txt + policy + /security. */
  app.use(securityRouter)

  app.get('/health/live', (_req, res) => {
    res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: Math.round(process.uptime()),
    })
  })

  const getReadyPayload = async () => {
    const sqliteOk = existsSync(getDbPath())
    const postgres = hasPostgresConfig() ? await checkPostgresHealth() : null
    const redis = hasRedisConfig() ? await checkRedisHealth() : null
    const proxySnapshot = getProxyOperationalSnapshot()
    const sgbrLastErrorAt = proxySnapshot.stats.lastErrorAt
    const sgbrLastSuccessAt =
      proxySnapshot.reconcileAlert.status === 'ok' || proxySnapshot.reconcileAlert.status === 'alert'
        ? proxySnapshot.reconcileAlert.lastCheckAt
        : null

    const healthy =
      sqliteOk &&
      (postgres === null || postgres.ok) &&
      (redis === null || redis.ok)
    const mem = process.memoryUsage()
    return {
      status: healthy ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: Math.round(process.uptime()),
      version: process.env.APP_VERSION ?? process.env.npm_package_version ?? 'dev',
      node: process.version,
      memory: {
        rssMb: Math.round(mem.rss / 1024 / 1024),
        heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
        heapTotalMb: Math.round(mem.heapTotal / 1024 / 1024),
      },
      storage: {
        ok: healthy,
        sqlite: sqliteOk,
        postgres: postgres ? { ok: postgres.ok, message: postgres.ok ? null : postgres.message } : null,
        redis: redis ? { ok: redis.ok, message: redis.ok ? null : redis.message } : null,
      },
      sgbr: {
        lastSuccessAt: sgbrLastSuccessAt,
        lastErrorAt: sgbrLastErrorAt,
      },
    }
  }

  app.get('/health/ready', async (_req, res) => {
    const payload = await getReadyPayload()
    res.status(payload.status === 'ok' ? 200 : 503).json(payload)
  })

  app.get('/health', async (_req, res) => {
    const payload = await getReadyPayload()
    res.status(payload.status === 'ok' ? 200 : 503).json(payload)
  })

  app.use('/api/v1/auth', authRouter)
  app.use('/api/v1/ops', opsRouter)
  app.use('/api/v1/users', userPreferencesRouter)
  app.use('/api/v1/alerts', alertsRouter)
  app.use('/api/v1/search', searchRouter)
  app.use('/api/v1/copilot', copilotRouter)
  app.use('/api/v1/_internal/tools', internalToolsRouter)
  app.use('/api/v1/scheduled-reports', scheduledReportsRouter)
  app.use('/api/v1/csv-datasets', csvDatasetsRouter)
  app.use('/api/v1/tenants', tenantsRouter)
  app.use('/api/v1/onboarding', onboardingRouter)
  app.use('/api/v1/billing', billingRouter)
  app.use('/api/v1/lgpd', lgpdRouter)
  app.use('/api/v1/super-admin', superAdminRouter)
  app.use('/api/v1/connectors', connectorsRouter)
  app.use('/api/v1/webhooks', webhooksRouter)
  /** Legal antes do gate — modal de aceite precisa funcionar mesmo com billing pendente. */
  app.use('/api/v1/legal', legalRouter)
  /** Analytics tambem antes do gate — events de tela precisam fluir mesmo se billing falhou. */
  app.use('/api/v1/analytics', analyticsRouter)
  /** Leads (Beta capture) — sem auth, com anti-fraud + rate limit. */
  app.use('/api/v1/leads', leadsRouter)
  app.use('/api/v1/changelog', changelogRouter)
  app.use('/api/v1/help', helpRouter)
  app.use('/api/v1/public-shares', publicSharesRouter)
  app.use('/api/v1/segments', segmentsRouter)
  app.use('/api/v1/customers', customersRouter)
  app.use('/forecast', forecastRouter)
  app.use('/production', productionRouter)
  /** Gate de billing apos as rotas de auth/billing/onboarding/tenant config. */
  app.use(subscriptionGate)

  app.use('/api/v1/users', requireAdmin, usersRouter)
  app.use('/api/v1/api-keys', apiKeysRouter)
  app.use('/api/v1/saved-views', savedViewsRouter)
  app.use('/api/v1/orgs', organizationsRouter)
  app.use('/api/v1/datasources', dataSourceRouter)
  app.use('/api/proxy', proxyRouter)
  app.use('/dashboard', requireAuthOrApiKeyScope('dashboards:read'), dashboardRouter)
  app.use('/reports', requireAuthOrApiKeyScope('reports:read'), reportsRouter)
  app.use('/api/v1/audit', requireAdmin, auditRouter)
  app.use('/erp', requireAuth, erpRouter)
  app.use('/finance', requireAuth, financeRouter)

  /**
   * Modo "tudo-em-um": quando existir uma build do frontend em `SERVE_FRONTEND_DIR`
   * (ou no default `../front-end-dist`), o Express serve os arquivos estáticos e
   * faz fallback SPA para `index.html` em qualquer rota que não seja API.
   * Permite empacotar frontend + backend como um único processo (instalador Windows).
   */
  const serveDir = process.env.SERVE_FRONTEND_DIR?.trim() || join(__dirname, '..', 'front-end-dist')
  if (existsSync(join(serveDir, 'index.html'))) {
    console.log(`[IGA Backend] Servindo frontend estático de ${serveDir}`)
    app.use(express.static(serveDir, { index: false, maxAge: '1h' }))
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api/') || req.path.startsWith('/dashboard') || req.path.startsWith('/reports')
        || req.path.startsWith('/audit') || req.path.startsWith('/erp') || req.path.startsWith('/finance')
        || req.path === '/health') {
        return next()
      }
      res.sendFile(join(serveDir, 'index.html'))
    })
  }

  app.use((err: Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const status = (err as { status?: number }).status ?? 500
    if (status >= 500) {
      console.error('[IGA Backend] Erro interno:', err.message)
      /**
       * Sentry captura apenas 5xx — 4xx são erros de cliente esperados
       * (validation, auth) e gerariam ruído. Tags ajudam a filtrar no
       * dashboard sem expor PII.
       */
      Sentry.withScope((scope) => {
        scope.setTag('http.method', req.method)
        scope.setTag('http.route', req.route?.path ?? req.path)
        scope.setTag('http.status', String(status))
        Sentry.captureException(err)
      })
    }
    res.status(status).json({
      message: status < 500 ? err.message : 'Erro interno do servidor',
    })
  })

  /** Garante seed inicial após inicialização do SQLite. */
  ensureUsersFile()
  ensureDataSourcesFile()
  seedDefaultAdmin()
  seedDefaultDataSources()
  if (startSchedulers) setupReconcileAlertScheduler()
  if (startSchedulers) startAlertsEngine()
  if (startSchedulers) startScheduledReportsJob()
  if (startSchedulers) startBackupScheduler()
  if (startSchedulers) startCopilotRetentionJob()
  if (startSchedulers) startRefreshTokenCleanupJob()
  if (startSchedulers) startDailyDigestJob()
  if (startSchedulers) startWarmCacheJob()
  if (startSchedulers) startTrialLifecycleJob()
  if (startSchedulers) startWebhookRecoveryLoop()

  return app
}
