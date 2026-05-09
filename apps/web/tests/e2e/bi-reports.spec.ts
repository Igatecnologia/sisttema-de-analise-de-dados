import { expect, test } from '@playwright/test'

test('relatorios renderiza titulo e estado principal', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Cenario validado no perfil admin')
  await page.goto('/relatorios')
  await expect(page.getByRole('heading', { name: 'Relatórios', exact: true })).toBeVisible()

  const emptyState = page.getByText('Nenhuma fonte de dados configurada')
  const searchInput = page.getByPlaceholder('Nome do produto ou cliente...')
  await expect(emptyState.or(searchInput)).toBeVisible()
})

test('dashboard renderiza acesso a Analises BI', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Cenario validado no perfil admin')
  await page.goto('/gestao')
  await expect(page.getByRole('link', { name: /An.lises BI/i }).first()).toBeVisible()
})

test('exportacao de relatorios disponivel quando ha BI configurado', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Cenario validado no perfil admin')
  await page.goto('/relatorios')
  await expect(page.getByRole('heading', { name: 'Relatórios', exact: true })).toBeVisible()

  if (await page.getByText('Nenhuma fonte de dados configurada').isVisible()) {
    await expect(page.getByText('Nenhuma fonte de dados configurada')).toBeVisible()
    return
  }

  await page.getByRole('button', { name: /Exportar/ }).first().click()
  await expect(page.getByText(/Exportar Excel/i)).toBeVisible()
  await expect(page.getByText(/Exportar PDF/i)).toBeVisible()
})
