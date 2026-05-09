import { expect, test } from '@playwright/test'

test('admin ve a acao de novo usuario', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Cenario apenas para admin')
  await page.goto('/usuarios')
  await expect(page.getByText(/Funcion.rios/).first()).toBeVisible()
  await expect(page.getByText(/Novo usu.rio/).first()).toBeVisible()
})

test.describe.configure({ mode: 'serial' })
test('viewer acessa /usuarios sem permissao de escrita', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'rbac-viewer', 'Cenario apenas para viewer')
  await page.goto('/usuarios')
  await expect(page.getByText(/Funcion.rios/).first()).toBeVisible()
  await expect(page.getByText(/Acesso restrito a administradores|Falha ao carregar|Forbidden/i)).toBeVisible()
  const createBtn = page.getByRole('button', { name: /Novo usu.rio/ }).first()
  await expect(createBtn).toBeVisible()
  await expect(createBtn).toBeDisabled()
})
