import { expect, test } from '@playwright/test'

test('relatorios renderiza titulo e busca', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Cenario validado no perfil admin')
  await page.goto('/relatorios')
  await expect(page.getByRole('heading', { name: 'Relatórios', exact: true })).toBeVisible()
  /** Placeholder atual da busca em ReportsPage. */
  await expect(page.getByPlaceholder('Nome do produto ou cliente...')).toBeVisible()
})

test('drill-through dashboard para Analises BI', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Cenario validado no perfil admin')
  await page.goto('/dashboard')
  /** O acesso rapido renderiza um <Link> envolvendo um <Card> com texto "Analises BI". */
  await page.getByRole('link', { name: /Analises BI/i }).first().click()
  await expect(page).toHaveURL(/dashboard\/analises/)
})

test('exportacao de relatorios disponivel', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Cenario validado no perfil admin')
  await page.goto('/relatorios')
  await page.getByRole('button', { name: /Exportar/ }).first().click()
  /** Dropdown abre com opcoes — pelo menos CSV e PDF aparecem. */
  await expect(page.getByText(/Exportar CSV/i)).toBeVisible()
  await expect(page.getByText(/Exportar PDF/i)).toBeVisible()
})
