import { expect, test } from '@playwright/test'

test('admin faz CRUD básico de usuário', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Cenário apenas para admin')
  await page.goto('/usuarios')
  await page.getByRole('button', { name: 'Novo usuário' }).click()
  await page.getByLabel('Nome').fill('Usuário E2E')
  await page.getByLabel('E-mail').fill(`e2e_${Date.now()}@empresa.com`)
  await page.getByLabel('Perfil').click()
  await page.locator('.ant-select-item-option-content', { hasText: 'Viewer' }).first().click()
  await page.getByRole('button', { name: 'Criar' }).click()
  await expect(page.getByText('Usuário criado')).toBeVisible()
})

test.describe.configure({ mode: 'serial' })
test('viewer recebe 403 em página restrita', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'rbac-viewer', 'Cenário apenas para viewer')
  await page.goto('/usuarios')
  await expect(page.getByText('Sem acesso')).toBeVisible()
})
