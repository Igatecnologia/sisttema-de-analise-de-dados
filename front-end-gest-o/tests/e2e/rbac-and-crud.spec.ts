import { expect, test } from '@playwright/test'

test('admin abre modal de novo usuario', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Cenario apenas para admin')
  await page.goto('/usuarios')
  await expect(page.getByRole('heading', { name: 'Funcionários' })).toBeVisible()
  await page.getByRole('button', { name: 'Novo usuário' }).click()
  /** Modal aberto: campos Nome e E-mail visiveis. */
  await expect(page.getByLabel('Nome')).toBeVisible()
  await expect(page.getByLabel('E-mail')).toBeVisible()
})

test.describe.configure({ mode: 'serial' })
test('viewer entra em /usuarios mas nao pode criar', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'rbac-viewer', 'Cenario apenas para viewer')
  /**
   * Viewer tem `users:view` (todas as roles tem :view), entao acessa a pagina.
   * O botao "Novo usuario" eh renderizado mas fica `disabled` para viewer.
   */
  await page.goto('/usuarios')
  await expect(page.getByRole('heading', { name: 'Funcionários' })).toBeVisible()
  const createBtn = page.getByRole('button', { name: 'Novo usuário' })
  await expect(createBtn).toBeVisible()
  await expect(createBtn).toBeDisabled()
})
