import { expect, test } from '@playwright/test'

test('admin acessa painel de operacao', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Apenas perfil admin')
  await page.goto('/admin/operacao')
  await expect(page.getByText('Operação do sistema')).toBeVisible()
  await expect(page.getByText('Snapshot')).toBeVisible()
})
