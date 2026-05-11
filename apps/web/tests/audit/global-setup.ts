import { chromium, request } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const API_BASE = process.env.AUDIT_API_BASE ?? 'http://localhost:3000'
const WEB_BASE = 'http://localhost:5173'
const ADMIN_BASE = 'http://localhost:3003'
const ADMIN_EMAIL = process.env.AUDIT_ADMIN_EMAIL ?? 'admin@iga.com'
const ADMIN_PASS = process.env.AUDIT_ADMIN_PASS ?? 'IgaGestao@2026!'

export const STORAGE_STATE = resolve(__dirname, '.auth/admin.json')

/**
 * Loga uma unica vez e salva storageState. Todos os tests do audit reutilizam
 * a mesma sessao — evita bater no rate limit de /auth/login (20 req/15min) e
 * no lockout (5 falhas em 10min na mesma conta).
 *
 * Cookies do dominio `localhost` valem pra TODAS as portas (3000, 5173, 3003)
 * porque cookies sao keyed por hostname, nao por porta.
 */
async function globalSetup() {
  mkdirSync(dirname(STORAGE_STATE), { recursive: true })

  const api = await request.newContext()
  const loginResp = await api.post(`${API_BASE}/api/v1/auth/login`, {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASS },
    headers: { Origin: WEB_BASE, 'Content-Type': 'application/json' },
  })
  if (!loginResp.ok()) {
    throw new Error(`[audit] login falhou: ${loginResp.status()} ${await loginResp.text()}`)
  }
  const body = await loginResp.json()

  if (body.token) {
    await api.post(`${API_BASE}/api/v1/legal/accept-terms`, {
      headers: { Authorization: `Bearer ${body.token}`, Origin: WEB_BASE },
    }).catch(() => undefined)
  }

  // Pega os Set-Cookie via headers da response e materializa em storageState
  // Mais robusto que api.storageState() (que so captura cookies do contexto API).
  // Usamos um browser real pra distribuir os cookies em dominios consistentes.
  const browser = await chromium.launch()
  const context = await browser.newContext()
  await context.request.post(`${API_BASE}/api/v1/auth/login`, {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASS },
    headers: { Origin: WEB_BASE, 'Content-Type': 'application/json' },
  })
  if (body.token) {
    await context.request.post(`${API_BASE}/api/v1/legal/accept-terms`, {
      headers: { Authorization: `Bearer ${body.token}`, Origin: WEB_BASE },
    }).catch(() => undefined)
  }

  // Materializa overlays-supressao em localStorage de TODOS os origins que serao visitados.
  const page = await context.newPage()
  for (const origin of [WEB_BASE, ADMIN_BASE]) {
    await page.goto(`${origin}/login`, { waitUntil: 'domcontentloaded', timeout: 30_000 }).catch(() => undefined)
    await page.evaluate(() => {
      try {
        localStorage.setItem(
          'iga.cookieConsent.v1',
          JSON.stringify({ essential: true, analytics: false, marketing: false, decidedAt: new Date().toISOString() }),
        )
        localStorage.setItem('iga.guided-tour.done', '1')
        localStorage.setItem('iga.betaWelcome.dismissed.v1', '1')
        localStorage.setItem('iga.trialBanner.dismissed.v1', '1')
      } catch { /* noop */ }
    }).catch(() => undefined)
  }

  await context.storageState({ path: STORAGE_STATE })
  await api.dispose()
  await browser.close()

  writeFileSync(
    join(dirname(STORAGE_STATE), 'login-meta.json'),
    JSON.stringify({ loggedAt: new Date().toISOString(), email: ADMIN_EMAIL }, null, 2),
    'utf-8',
  )
}

export default globalSetup
