/**
 * OPS-2 — Smoke load test com k6.
 *
 * Uso:
 *   k6 run load-tests/smoke.k6.js
 *
 * Variaveis de ambiente:
 *   API_URL          — URL base do backend (default http://127.0.0.1:3001)
 *   ADMIN_EMAIL      — email admin do tenant default
 *   ADMIN_PASSWORD   — senha admin
 *
 * Cenario: smoke test — 5 VUs simultaneos, 30s, valida endpoints publicos
 * + 1 fluxo autenticado. Objetivo: validar que tudo esta de pe.
 *
 * SLOs validados:
 *   - p95 latencia < 1500ms
 *   - error rate < 1%
 */
import http from 'k6/http'
import { check, sleep, group } from 'k6'
import { Trend, Rate } from 'k6/metrics'

const apiUrl = __ENV.API_URL || 'http://127.0.0.1:3001'
const adminEmail = __ENV.ADMIN_EMAIL || 'admin@iga.com'
const adminPassword = __ENV.ADMIN_PASSWORD || 'AdminTeste2026!'

const loginLatency = new Trend('login_latency', true)
const errorRate = new Rate('errors')

export const options = {
  scenarios: {
    smoke: {
      executor: 'constant-vus',
      vus: 5,
      duration: '30s',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<1500'],
    errors: ['rate<0.01'],
    login_latency: ['p(95)<800'],
  },
}

export default function () {
  group('public health', () => {
    const r = http.get(`${apiUrl}/health/live`)
    const ok = check(r, { 'health/live 200': (res) => res.status === 200 })
    errorRate.add(!ok)
  })

  group('security.txt', () => {
    const r = http.get(`${apiUrl}/.well-known/security.txt`)
    const ok = check(r, {
      'security.txt 200': (res) => res.status === 200,
      'has Contact:': (res) => (res.body || '').toString().includes('Contact:'),
    })
    errorRate.add(!ok)
  })

  group('auth login', () => {
    const start = Date.now()
    const r = http.post(
      `${apiUrl}/api/v1/auth/login`,
      JSON.stringify({ email: adminEmail, password: adminPassword }),
      { headers: { 'Content-Type': 'application/json', Origin: 'http://127.0.0.1:4173' } },
    )
    loginLatency.add(Date.now() - start)
    const ok = check(r, {
      'login 200': (res) => res.status === 200,
      'has token': (res) => {
        try {
          return Boolean(JSON.parse(res.body).token)
        } catch {
          return false
        }
      },
    })
    errorRate.add(!ok)
  })

  sleep(1)
}
