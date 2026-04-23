import { expect, test } from '@playwright/test'

test('filtros + gráficos em relatórios', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Cenário validado no perfil admin')
  await page.goto('/relatorios')
  await expect(page.getByText('Relatórios empresariais')).toBeVisible()
  await page.getByPlaceholder('Buscar por ID ou nome').fill('REP-00')
  await expect(page.locator('.recharts-wrapper')).toBeVisible()
})

test('drill-through dashboard para análises', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Cenário validado no perfil admin')
  await page.goto('/dashboard')
  await page.getByRole('link', { name: 'Abrir Análises BI' }).click()
  await expect(page).toHaveURL(/dashboard\/analises/)
})

test('exportação de relatórios disponível', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Cenário validado no perfil admin')
  await page.goto('/relatorios')
  await page.getByRole('button', { name: 'Exportar' }).click()
  await expect(page.getByText('Exportar CSV')).toBeVisible()
  await expect(page.getByText('Exportar Excel')).toBeVisible()
  await expect(page.getByText('Exportar PDF')).toBeVisible()
})
