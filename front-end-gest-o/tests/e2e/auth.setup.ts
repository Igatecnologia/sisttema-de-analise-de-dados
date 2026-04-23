import { expect, test } from '@playwright/test'

const adminEmail = process.env.E2E_ADMIN_EMAIL ?? 'admin@iga.com'
const adminPass = process.env.E2E_ADMIN_PASSWORD ?? 'admin123'

test('cria storage states de auth', async ({ browser }) => {
  const admin = await browser.newPage()
  await admin.goto('/login')
  await admin.getByLabel('Usuário').fill(adminEmail)
  await admin.getByLabel('Senha').fill(adminPass)
  await admin.getByRole('button', { name: 'Entrar' }).click()
  await expect(admin).toHaveURL(/gestao/)
  await admin.context().storageState({ path: 'tests/e2e/.auth/admin.json' })
  await admin.close()

  if (process.env.CI === 'true') {
    return
  }

  const viewer = await browser.newPage()
  await viewer.goto('/login')
  await viewer.getByLabel('Usuário').fill('viewer@admin.com')
  await viewer.getByLabel('Senha').fill('admin')
  await viewer.getByRole('button', { name: 'Entrar' }).click()
  await expect(viewer).toHaveURL(/gestao/)
  await viewer.context().storageState({ path: 'tests/e2e/.auth/viewer.json' })
  await viewer.close()
})
