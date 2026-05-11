import { expect, request, test } from '@playwright/test'

const adminEmail = process.env.E2E_ADMIN_EMAIL ?? 'admin@iga.com'
const adminPass = process.env.E2E_ADMIN_PASSWORD ?? 'AdminTeste2026!'
const apiUrl = process.env.E2E_API_BASE_URL ?? 'http://127.0.0.1:3001'
const appOrigin = process.env.E2E_WEB_BASE_URL ?? 'http://127.0.0.1:4173'

/** Pre-popula consentimentos e tours para overlays nao bloquearem os cenarios. */
async function prepareE2eLocalState(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    try {
      window.localStorage.setItem(
        'iga.cookieConsent.v1',
        JSON.stringify({ essential: true, analytics: false, marketing: false, decidedAt: new Date().toISOString() }),
      )
      window.localStorage.setItem('iga.guided-tour.done', '1')
      window.localStorage.setItem('iga.betaWelcome.dismissed.v1', '1')
    } catch { /* ignore */ }
  })
}

async function acceptTermsWithBearer(token: string) {
  const api = await request.newContext()
  await api.post(`${apiUrl}/api/v1/legal/accept-terms`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Origin: appOrigin,
    },
  })
  await api.dispose()
}

test('cria storage states de auth', async ({ browser }) => {
  test.setTimeout(120_000)
  console.log('[auth.setup] login api')
  const api = await request.newContext()
  const adminLogin = await api.post(`${apiUrl}/api/v1/auth/login`, {
    data: { email: adminEmail, password: adminPass },
    headers: { Origin: appOrigin },
  })
  expect(adminLogin.status()).toBe(200)
  console.log('[auth.setup] admin api ok')
  const adminLoginBody = await adminLogin.json()
  await acceptTermsWithBearer(adminLoginBody.token)
  console.log('[auth.setup] admin terms ok')

  if (process.env.E2E_FORCE_VIEWER === '1') {
    await api.post(`${apiUrl}/api/v1/users`, {
      data: {
        name: 'Viewer E2E',
        email: 'viewer@admin.com',
        password: 'admin123',
        role: 'viewer',
        status: 'active',
      },
      headers: {
        Authorization: `Bearer ${adminLoginBody.token}`,
        Origin: appOrigin,
      },
    })

    const viewerLogin = await api.post(`${apiUrl}/api/v1/auth/login`, {
      data: { email: 'viewer@admin.com', password: 'admin123' },
      headers: { Origin: appOrigin },
    })
    expect(viewerLogin.status()).toBe(200)
    const viewerLoginBody = await viewerLogin.json()
    await acceptTermsWithBearer(viewerLoginBody.token)
    console.log('[auth.setup] viewer api ok')
  }
  await api.dispose()
  console.log('[auth.setup] api disposed')

  const admin = await browser.newPage()
  console.log('[auth.setup] admin page open')
  await prepareE2eLocalState(admin)
  await admin.goto('/login')
  console.log('[auth.setup] admin login page')
  await admin.getByLabel('Email').fill(adminEmail)
  await admin.getByLabel('Senha').fill(adminPass)
  await admin.getByRole('button', { name: 'Entrar' }).click()
  console.log('[auth.setup] admin submitted')
  await expect(admin).toHaveURL(/gestao/, { timeout: 30_000 })
  console.log('[auth.setup] admin redirected')
  await admin.context().storageState({ path: 'tests/e2e/.auth/admin.json' })
  await admin.close()
  console.log('[auth.setup] admin storage saved')

  if (process.env.E2E_FORCE_VIEWER !== '1') {
    return
  }

  const viewer = await browser.newPage()
  console.log('[auth.setup] viewer page open')
  await prepareE2eLocalState(viewer)
  await viewer.goto('/login')
  console.log('[auth.setup] viewer login page')
  await viewer.getByLabel('Email').fill('viewer@admin.com')
  await viewer.getByLabel('Senha').fill('admin123')
  await viewer.getByRole('button', { name: 'Entrar' }).click()
  console.log('[auth.setup] viewer submitted')
  await expect(viewer).toHaveURL(/gestao/, { timeout: 30_000 })
  console.log('[auth.setup] viewer redirected')
  await viewer.context().storageState({ path: 'tests/e2e/.auth/viewer.json' })
  await viewer.close()
  console.log('[auth.setup] viewer storage saved')
})
