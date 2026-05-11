/**
 * Backend smoke test — verifica todos os endpoints principais.
 * Uso: tsx tests/backend-smoke.ts
 */

const API = process.env.API_URL || 'http://localhost:3000'
const EMAIL = 'admin@iga.com'
const PASSWORD = 'IgaGestao@2026!'

type Result = {
  endpoint: string
  method: string
  status: number
  ok: boolean
  ms: number
  notes?: string
}

let cookieJar = ''
let csrfToken = ''

async function request(
  method: string,
  path: string,
  body?: unknown,
  options: { skipAuth?: boolean } = {},
): Promise<Result> {
  const url = `${API}${path}`
  const start = Date.now()
  const headers: Record<string, string> = {
    Accept: 'application/json',
  }
  if (body) headers['Content-Type'] = 'application/json'
  if (!options.skipAuth && cookieJar) headers['Cookie'] = cookieJar
  if (csrfToken && method !== 'GET') headers['X-XSRF-TOKEN'] = csrfToken

  let response: Response
  const ctrl = new AbortController()
  const tid = setTimeout(() => ctrl.abort(), 5000)
  try {
    response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
    })
  } catch (err) {
    clearTimeout(tid)
    return {
      endpoint: path,
      method,
      status: 0,
      ok: false,
      ms: Date.now() - start,
      notes: `network: ${(err as Error).message}`,
    }
  }
  clearTimeout(tid)
  const ms = Date.now() - start

  // Capturar cookies
  const setCookie = response.headers.get('set-cookie')
  if (setCookie) {
    const cookies: string[] = []
    setCookie.split(/,(?=\s*\w+=)/).forEach((c) => {
      const [pair] = c.split(';')
      cookies.push(pair.trim())
      if (pair.startsWith('XSRF-TOKEN=')) {
        csrfToken = decodeURIComponent(pair.split('=')[1])
      }
    })
    if (cookies.length > 0) cookieJar = cookies.join('; ')
  }

  return {
    endpoint: path,
    method,
    status: response.status,
    ok: response.status >= 200 && response.status < 400,
    ms,
  }
}

const results: Result[] = []

async function test(method: string, path: string, body?: unknown, opts?: { skipAuth?: boolean }) {
  const r = await request(method, path, body, opts)
  results.push(r)
  const symbol = r.ok ? '✓' : '✗'
  const lat = `${r.ms}ms`.padStart(7)
  console.log(`  ${symbol}  ${r.method.padEnd(6)} ${path.padEnd(50)} ${String(r.status).padStart(3)} ${lat} ${r.notes ?? ''}`)
}

async function main() {
  console.log('\n=== Backend smoke test ===\n')

  console.log('Health endpoints:')
  await test('GET', '/health', undefined, { skipAuth: true })
  await test('GET', '/health/live', undefined, { skipAuth: true })
  await test('GET', '/health/ready', undefined, { skipAuth: true })
  await test('GET', '/.well-known/security.txt', undefined, { skipAuth: true })

  console.log('\nPublic auth:')
  await test('POST', '/api/v1/auth/login', { email: EMAIL, password: PASSWORD }, { skipAuth: true })
  await test('GET', '/api/v1/auth/me')
  await test('GET', '/api/v1/segments', undefined, { skipAuth: true })

  console.log('\nDashboard / ERP / Finance:')
  await test('GET', '/dashboard?period=7d')
  await test('GET', '/finance/contas-pagar?dtDe=2026.01.01&dtAte=2026.05.09')
  await test('GET', '/erp/producao-diaria?dt_de=2026.01.01&dt_ate=2026.05.09')

  console.log('\nDatasources:')
  await test('GET', '/api/v1/datasources')

  console.log('\nAlerts / Audit / Reports:')
  await test('GET', '/api/v1/alerts')
  await test('GET', '/api/v1/audit')
  await test('GET', '/api/v1/scheduled-reports')

  console.log('\nBilling:')
  await test('GET', '/api/v1/billing/status')

  console.log('\nCopilot:')
  await test('GET', '/api/v1/copilot/mode')
  await test('GET', '/api/v1/copilot/history')

  console.log('\nUsers / Tenants:')
  await test('GET', '/api/v1/users')
  await test('GET', '/api/v1/tenants')

  console.log('\nSuper-admin:')
  await test('GET', '/api/v1/super-admin/tenants')
  await test('GET', '/api/v1/super-admin/metrics')
  await test('GET', '/api/v1/super-admin/audit-recent')
  await test('GET', '/api/v1/super-admin/users')
  await test('GET', '/api/v1/super-admin/system-health')
  await test('GET', '/api/v1/super-admin/subscriptions')
  await test('GET', '/api/v1/super-admin/audit-search')
  await test('GET', '/api/v1/super-admin/ai-usage?months=1')

  console.log('\nConnectors / Customers:')
  await test('GET', '/api/v1/connectors')
  await test('GET', '/api/v1/customers')

  console.log('\nAPI keys / Webhooks / Public shares:')
  await test('GET', '/api/v1/api-keys')
  await test('GET', '/api/v1/webhooks')
  await test('GET', '/api/v1/public-shares')

  console.log('\nLGPD / MFA:')
  await test('POST', '/api/v1/lgpd/my-data', {})
  await test('GET', '/api/v1/auth/mfa/status')

  // Sumario
  console.log('\n=== Resumo ===')
  const total = results.length
  const ok = results.filter((r) => r.ok).length
  const failed = results.filter((r) => !r.ok)
  const avgMs = Math.round(results.reduce((acc, r) => acc + r.ms, 0) / total)
  console.log(`Total:  ${total}`)
  console.log(`OK:     ${ok}/${total} (${Math.round((ok / total) * 100)}%)`)
  console.log(`Falhou: ${failed.length}`)
  console.log(`Avg:    ${avgMs}ms`)

  if (failed.length > 0) {
    console.log('\nFalhas:')
    for (const f of failed) {
      console.log(`  ${f.method} ${f.endpoint} → HTTP ${f.status} ${f.notes ?? ''}`)
    }
  }

  process.exit(failed.length > 0 ? 1 : 0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
