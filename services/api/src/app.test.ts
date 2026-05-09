/// <reference types="vitest" />
import request from 'supertest'
import { createApp } from './app.js'
import { registerToken } from './middleware/auth.js'
import { readAllUsersCached } from './userStorage.js'

describe('backend app', () => {
  const app = createApp({ startSchedulers: false })

  it('GET /health responde com status de saúde', async () => {
    const res = await request(app).get('/health')
    expect([200, 503]).toContain(res.status)
    expect(res.body).toHaveProperty('status')
    expect(res.body).toHaveProperty('storage')
  })

  it('GET /api/proxy/health sem token retorna 401', async () => {
    const res = await request(app).get('/api/proxy/health')
    expect(res.status).toBe(401)
  })

  it('GET /api/v1/tenants/default/config retorna branding publico', async () => {
    const res = await request(app).get('/api/v1/tenants/default/config')

    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({
      tenantId: 'default',
      slug: 'default',
      companyName: 'IGA',
    })
    expect(res.body.enabledModules).toContain('dashboard')
  })

  /** SEC-3.4 — CSP dinamico inclui hosts do connector mas nao vaza entre tenants. */
  it('CSP do tenant default (sgbr-espuma) inclui *.sgbrbi.com.br em connect-src', async () => {
    const res = await request(app).get('/api/v1/tenants/default/config')
    const csp = res.headers['content-security-policy'] ?? ''
    expect(csp).toContain('*.sgbrbi.com.br')
    expect(csp).toContain('default-src')
    expect(csp).toContain('frame-ancestors')
  })

  it('CSP inclui hosts CDN confiaveis (Stripe/Sentry/PostHog/Turnstile)', async () => {
    const res = await request(app).get('/api/v1/tenants/default/config')
    const csp = res.headers['content-security-policy'] ?? ''
    expect(csp).toMatch(/script-src[^;]*challenges\.cloudflare\.com/)
    expect(csp).toMatch(/script-src[^;]*posthog/)
    expect(csp).toMatch(/script-src[^;]*sentry-cdn/)
    expect(csp).toMatch(/connect-src[^;]*api\.stripe\.com/)
  })

  it('Headers cross-origin (COOP/CORP) e Reporting-Endpoints presentes', async () => {
    const res = await request(app).get('/health')
    expect(res.headers['cross-origin-opener-policy']).toBe('same-origin')
    expect(res.headers['cross-origin-resource-policy']).toBe('same-origin')
    expect(res.headers['reporting-endpoints']).toContain('csp-endpoint')
    expect(res.headers['permissions-policy']).toContain('camera=()')
  })

  it('GET /api/v1/tenants/current/settings retorna tenant autenticado', async () => {
    const user = readAllUsersCached()[0]
    expect(user).toBeDefined()
    const token = `test-token-tenant-settings-${Date.now()}`
    await registerToken(token, user.id, user.tenantId)

    const res = await request(app)
      .get('/api/v1/tenants/current/settings')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({
      id: user.tenantId,
      slug: user.tenantId,
      name: expect.any(String),
    })
    expect(res.body.enabledModules).toContain('dashboard')
  })

  it('GET /api/proxy/health com token válido retorna 200', async () => {
    const user = readAllUsersCached()[0]
    expect(user).toBeDefined()
    const token = `test-token-${Date.now()}`
    await registerToken(token, user.id, user.tenantId)

    const res = await request(app)
      .get('/api/proxy/health')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('status', 'ok')
    expect(res.body).toHaveProperty('stats')
    expect(res.body).toHaveProperty('tokenCacheSize')
  })

  it('GET /api/proxy/data com requireDsId e sem dsId retorna 422', async () => {
    const user = readAllUsersCached()[0]
    expect(user).toBeDefined()
    const token = `test-token-ds-${Date.now()}`
    await registerToken(token, user.id, user.tenantId)

    const res = await request(app)
      .get('/api/proxy/data')
      .query({ requireDsId: '1' })
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(422)
    expect(res.body).toHaveProperty('message')
  })

  it('GET /api/v1/ops/status com admin retorna 200 e proxy', async () => {
    const user = readAllUsersCached()[0]
    expect(user?.role).toBe('admin')
    const token = `test-token-ops-${Date.now()}`
    await registerToken(token, user.id, user.tenantId)

    const res = await request(app)
      .get('/api/v1/ops/status')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('proxy')
    expect(res.body.proxy).toHaveProperty('stats')
    expect(res.body).toHaveProperty('storage')
  })

  it('GET /api/v1/connectors inclui API propria IGA e schema', async () => {
    const user = readAllUsersCached()[0]
    expect(user).toBeDefined()
    const token = `test-token-connectors-${Date.now()}`
    await registerToken(token, user.id, user.tenantId)

    const list = await request(app)
      .get('/api/v1/connectors')
      .set('Authorization', `Bearer ${token}`)

    expect(list.status).toBe(200)
    expect(list.body.connectors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'iga-custom-api',
          status: 'ready',
          schemaUrl: '/api/v1/connectors/iga-custom-api/schema',
        }),
      ]),
    )

    const schema = await request(app)
      .get('/api/v1/connectors/iga-custom-api/schema')
      .set('Authorization', `Bearer ${token}`)

    expect(schema.status).toBe(200)
    expect(schema.body).toMatchObject({
      id: 'iga-custom-api',
      responseShape: expect.any(Object),
    })
    expect(schema.body.endpoints).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ area: 'vendas', path: '/iga/v1/vendas' }),
      ]),
    )
  })

  it('POST /api/v1/connectors/reload recarrega connectors externos', async () => {
    const user = readAllUsersCached()[0]
    expect(user).toBeDefined()
    const token = `test-token-connectors-reload-${Date.now()}`
    await registerToken(token, user.id, user.tenantId)

    const res = await request(app)
      .post('/api/v1/connectors/reload')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ ok: true, total: expect.any(Number), external: expect.any(Number) })
  })

  it('POST /api/v1/webhooks registra assinatura enterprise', async () => {
    const user = readAllUsersCached()[0]
    expect(user?.role).toBe('admin')
    const token = `test-token-webhooks-${Date.now()}`
    await registerToken(token, user.id, user.tenantId)

    const created = await request(app)
      .post('/api/v1/webhooks')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Teste externo',
        url: 'https://example.com/webhooks/iga',
        eventTypes: ['tenant.updated'],
        active: true,
      })

    expect(created.status).toBe(201)
    expect(created.body).toMatchObject({
      name: 'Teste externo',
      signingSecretPreview: expect.any(String),
    })
    expect(created.body.signingSecret).toBeUndefined()

    const list = await request(app)
      .get('/api/v1/webhooks')
      .set('Authorization', `Bearer ${token}`)

    expect(list.status).toBe(200)
    expect(list.body.subscriptions).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: created.body.id })]),
    )
  })
})
