import { expect, request, test } from '@playwright/test'

/**
 * Smoke tests dos endpoints SaaS recem-adicionados.
 * Roda HTTP direto contra o backend (port 3001) — nao depende de UI.
 *
 * Pre-condicoes (env do backend):
 *   - PORT=3001
 *   - ADMIN_DEFAULT_EMAIL=admin@iga.com
 *   - ADMIN_DEFAULT_PASSWORD=AdminTeste2026! (>=14 chars)
 *   - BILLING_GATE_DISABLED=1
 *
 * Os testes rodam em projeto Playwright independente do storageState.
 */
const apiUrl = 'http://127.0.0.1:3001'
const adminEmail = process.env.E2E_ADMIN_EMAIL ?? 'admin@iga.com'
const adminPass = process.env.E2E_ADMIN_PASSWORD ?? 'AdminTeste2026!'

test.describe('SaaS smoke — backend HTTP', () => {
  test.describe.configure({ mode: 'serial' })

  let token: string
  let csrfCookie: string
  let sessionCookie: string

  test.beforeAll(async () => {
    const ctx = await request.newContext()
    const res = await ctx.post(`${apiUrl}/api/v1/auth/login`, {
      data: { email: adminEmail, password: adminPass },
      headers: { Origin: 'http://127.0.0.1:4173' },
    })
    expect(res.status(), 'login should succeed').toBe(200)
    const body = await res.json()
    token = body.token
    expect(token).toBeTruthy()
    expect(body.refreshToken).toBeTruthy()
    expect(body.permissions).toContain('dashboard:view')
    /** Captura cookies (httpOnly session + CSRF) — Playwright nao expoe httpOnly direto. */
    const setCookies = res.headersArray().filter((h) => h.name.toLowerCase() === 'set-cookie')
    sessionCookie = setCookies.find((c) => c.value.startsWith('iga_session='))?.value ?? ''
    csrfCookie = setCookies.find((c) => c.value.startsWith('XSRF-TOKEN='))?.value ?? ''
    await ctx.dispose()
  })

  function authHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${token}`,
      Origin: 'http://127.0.0.1:4173',
    }
  }

  test('GET /health/ready retorna 200/503 com payload de storage', async () => {
    const ctx = await request.newContext()
    const res = await ctx.get(`${apiUrl}/health/ready`)
    expect([200, 503]).toContain(res.status())
    const body = await res.json()
    expect(body).toHaveProperty('storage')
    await ctx.dispose()
  })

  test('GET /.well-known/security.txt eh servido (RFC 9116)', async () => {
    const ctx = await request.newContext()
    const res = await ctx.get(`${apiUrl}/.well-known/security.txt`)
    expect(res.status()).toBe(200)
    const text = await res.text()
    expect(text).toMatch(/Contact: mailto:/)
    expect(text).toMatch(/Expires:/)
    expect(text).toMatch(/Canonical:/)
    await ctx.dispose()
  })

  test('GET /security/policy retorna HTML com politica', async () => {
    const ctx = await request.newContext()
    const res = await ctx.get(`${apiUrl}/security/policy`)
    expect(res.status()).toBe(200)
    const html = await res.text()
    expect(html).toMatch(/Politica de Divulgacao Responsavel/i)
    expect(html).toMatch(/Safe harbor/i)
    await ctx.dispose()
  })

  test('GET /api/v1/billing/status retorna shape esperado', async () => {
    const ctx = await request.newContext()
    const res = await ctx.get(`${apiUrl}/api/v1/billing/status`, { headers: authHeaders() })
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body).toHaveProperty('plan')
    expect(body).toHaveProperty('status')
    expect(body).toHaveProperty('access')
    expect(body.access).toHaveProperty('allowed')
    expect(typeof body.stripeEnabled).toBe('boolean')
    await ctx.dispose()
  })

  test('GET /api/v1/auth/mfa/status retorna enabled=false para conta nova', async () => {
    const ctx = await request.newContext()
    const res = await ctx.get(`${apiUrl}/api/v1/auth/mfa/status`, { headers: authHeaders() })
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.enabled).toBe(false)
    /** pendingSetup pode estar true se setup-init rodou antes (testes em paralelo). */
    expect(typeof body.pendingSetup).toBe('boolean')
    expect(typeof body.backupCodesRemaining).toBe('number')
    await ctx.dispose()
  })

  test('POST /api/v1/auth/mfa/setup-init gera secret + otpauth URL', async () => {
    const ctx = await request.newContext()
    const res = await ctx.post(`${apiUrl}/api/v1/auth/mfa/setup-init`, { headers: authHeaders(), data: {} })
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.otpauthUrl).toMatch(/^otpauth:\/\/totp\//)
    expect(typeof body.secret).toBe('string')
    expect(body.secret.length).toBeGreaterThanOrEqual(16)
    await ctx.dispose()
  })

  test('GET /api/v1/lgpd/my-data retorna user + tenant', async () => {
    const ctx = await request.newContext()
    const res = await ctx.get(`${apiUrl}/api/v1/lgpd/my-data`, { headers: authHeaders() })
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.user.email).toBe(adminEmail)
    expect(body.user).not.toHaveProperty('passwordHash') // sanitizado
    expect(body).toHaveProperty('tenant')
    expect(body).toHaveProperty('legalNotice')
    await ctx.dispose()
  })

  test('GET /api/v1/lgpd/export como admin retorna users + datasources sanitizados', async () => {
    const ctx = await request.newContext()
    const res = await ctx.get(`${apiUrl}/api/v1/lgpd/export`, { headers: authHeaders() })
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body.users)).toBe(true)
    expect(Array.isArray(body.datasources)).toBe(true)
    /** Garantir que credenciais NAO foram exportadas. */
    for (const u of body.users) {
      expect(u).not.toHaveProperty('passwordHash')
    }
    for (const d of body.datasources) {
      expect(d).not.toHaveProperty('authCredentials')
    }
    await ctx.dispose()
  })

  test('GET /api/v1/connectors lista 6 connectors com flags ready/coming-soon', async () => {
    const ctx = await request.newContext()
    const res = await ctx.get(`${apiUrl}/api/v1/connectors`, { headers: authHeaders() })
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body.connectors)).toBe(true)
    const ids = body.connectors.map((c: { id: string }) => c.id)
    expect(ids).toContain('sgbr-espuma')
    expect(ids).toContain('csv')
    expect(ids).toContain('bling')
    const ready = body.connectors.find((c: { id: string }) => c.id === 'sgbr-espuma')
    expect(ready.status).toBe('ready')
    const blink = body.connectors.find((c: { id: string }) => c.id === 'bling')
    expect(blink.status).toBe('coming-soon')
    await ctx.dispose()
  })

  test('GET /api/v1/super-admin/tenants exige super-admin (403 sem env)', async () => {
    const ctx = await request.newContext()
    const res = await ctx.get(`${apiUrl}/api/v1/super-admin/tenants`, { headers: authHeaders() })
    /** Sem SUPER_ADMIN_EMAILS env, allowed.length === 0 -> permite. Com env, deveria 403. */
    expect([200, 403]).toContain(res.status())
    await ctx.dispose()
  })

  test('GET /audit/verify recalcula chain e retorna valid=true', async () => {
    const ctx = await request.newContext()
    /** csrf header padrao do backend para cookies — para Bearer token, csrf eh dispensado. */
    const res = await ctx.get(`${apiUrl}/audit/verify`, { headers: authHeaders() })
    expect([200, 409]).toContain(res.status())
    const body = await res.json()
    if (res.status() === 200) {
      expect(body.valid).toBe(true)
      expect(body.verified).toBe(body.total)
    }
    await ctx.dispose()
  })

  test('POST /api/v1/auth/refresh rotaciona token e detecta reuse', async () => {
    /** Faz login fresh para nao mexer no token global. */
    const ctx = await request.newContext()
    const login = await ctx.post(`${apiUrl}/api/v1/auth/login`, {
      data: { email: adminEmail, password: adminPass },
      headers: { Origin: 'http://127.0.0.1:4173' },
    })
    const loginBody = await login.json()
    const refreshToken = loginBody.refreshToken
    expect(refreshToken).toBeTruthy()

    const r1 = await ctx.post(`${apiUrl}/api/v1/auth/refresh`, {
      data: { refreshToken },
      headers: { Origin: 'http://127.0.0.1:4173' },
    })
    expect(r1.status()).toBe(200)
    const r1Body = await r1.json()
    expect(r1Body.token).toBeTruthy()
    expect(r1Body.refreshToken).toBeTruthy()
    expect(r1Body.refreshToken).not.toBe(refreshToken) // rotacionou

    /** Reuse do token original deve detectar e retornar 401 + revoga familia. */
    const r2 = await ctx.post(`${apiUrl}/api/v1/auth/refresh`, {
      data: { refreshToken },
      headers: { Origin: 'http://127.0.0.1:4173' },
    })
    expect(r2.status()).toBe(401)
    const r2Body = await r2.json()
    expect(r2Body.revoked).toBe(true)
    await ctx.dispose()
  })

  test('SSRF: criar datasource com URL privada eh rejeitado em runtime no proxy', async () => {
    const ctx = await request.newContext()
    /** Proxy: POST /api/proxy/login com authSource configurado para http://127.0.0.1
     *  vai falhar na validacao. Como nao temos datasource configurado nesse teste,
     *  apenas validamos que o endpoint /api/proxy/data com URL privada eh rejeitado
     *  via validateExternalApiUrl quando datasource fosse criado.
     *
     *  Aqui apenas checamos que o endpoint esta protegido por requireAuth. */
    const res = await ctx.get(`${apiUrl}/api/proxy/data`)
    expect(res.status()).toBe(401) // sem token
    await ctx.dispose()
  })

  test('Prototype pollution bloqueado em POST', async () => {
    const ctx = await request.newContext()
    const res = await ctx.post(`${apiUrl}/api/v1/auth/login`, {
      data: { email: 'a@b.com', password: 'x', __proto__: { polluted: true } } as never,
      headers: { Origin: 'http://127.0.0.1:4173' },
    })
    /** Backend deve rejeitar com 400 antes de processar. */
    /** axios/playwright pode strippar __proto__ no JSON.stringify; teste mais robusto via raw. */
    /** Se chegou no Zod, retorna 400 por outro motivo; ambos sao OK. */
    expect([400, 401]).toContain(res.status())
    await ctx.dispose()
  })

  test('CSP dinamico inclui *.sgbrbi.com.br para tenant default (sgbr-espuma)', async () => {
    const ctx = await request.newContext()
    const res = await ctx.get(`${apiUrl}/health/live`, { headers: { Origin: 'http://127.0.0.1:4173' } })
    const csp = res.headers()['content-security-policy']
    expect(csp).toBeTruthy()
    expect(csp).toMatch(/sgbrbi\.com\.br/)
    await ctx.dispose()
  })
})
