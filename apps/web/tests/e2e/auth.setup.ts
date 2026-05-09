import { expect, request, test } from '@playwright/test'

const adminEmail = process.env.E2E_ADMIN_EMAIL ?? 'admin@iga.com'
const adminPass = process.env.E2E_ADMIN_PASSWORD ?? 'AdminTeste2026!'
const apiUrl = 'http://127.0.0.1:3001'
const appOrigin = 'http://127.0.0.1:4173'

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
  const api = await request.newContext()
  const adminLogin = await api.post(`${apiUrl}/api/v1/auth/login`, {
    data: { email: adminEmail, password: adminPass },
    headers: { Origin: appOrigin },
  })
  expect(adminLogin.status()).toBe(200)
  const adminLoginBody = await adminLogin.json()
  await acceptTermsWithBearer(adminLoginBody.token)

  if (process.env.CI !== 'true') {
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
  }
  await api.dispose()

  const admin = await browser.newPage()
  await prepareE2eLocalState(admin)
  await admin.goto('/login')
  await admin.getByLabel('Usuário').fill(adminEmail)
  await admin.getByLabel('Senha').fill(adminPass)
  await admin.getByRole('button', { name: 'Entrar' }).click()
  await expect(admin).toHaveURL(/gestao/, { timeout: 15_000 })
  await admin.context().storageState({ path: 'tests/e2e/.auth/admin.json' })
  await admin.close()

  if (process.env.CI === 'true') {
    return
  }

  const viewer = await browser.newPage()
  await prepareE2eLocalState(viewer)
  await viewer.goto('/login')
  await viewer.getByLabel('Usuário').fill('viewer@admin.com')
  await viewer.getByLabel('Senha').fill('admin123')
  await viewer.getByRole('button', { name: 'Entrar' }).click()
  await expect(viewer).toHaveURL(/gestao/, { timeout: 15_000 })
  await viewer.context().storageState({ path: 'tests/e2e/.auth/viewer.json' })
  await viewer.close()
})
