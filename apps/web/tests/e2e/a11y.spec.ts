import { expect, test } from '@playwright/test'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const axePath = require.resolve('axe-core/axe.min.js')

type AxeResult = {
  violations: Array<{ id: string; impact: 'minor' | 'moderate' | 'serious' | 'critical'; help: string; nodes: unknown[] }>
}

async function runAxe(page: import('@playwright/test').Page): Promise<AxeResult> {
  await page.addScriptTag({ path: axePath })
  return page.evaluate(async () => {
    const axe = (window as unknown as {
      axe: { run: (context?: unknown, options?: unknown) => Promise<AxeResult> }
    }).axe
    return axe.run(document.body, {
      resultTypes: ['violations'],
      rules: { 'color-contrast': { enabled: false } },
    })
  })
}

test.describe('A11y baseline (axe-core)', () => {
  test('Dashboard sem violacoes critical', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'a11y rodado apenas em chromium')
    await page.goto('/gestao')
    await expect(page.getByRole('heading', { name: /Dashboard|Gest.o|IGA/i })).toBeVisible()
    const result = await runAxe(page)
    expect(result.violations.filter((v) => v.impact === 'critical')).toHaveLength(0)
  })

  test('Login sem violacoes critical', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'a11y rodado apenas em chromium')
    await page.goto('/login')
    await expect(page.getByRole('heading', { name: /entrar|login/i })).toBeVisible()
    const result = await runAxe(page)
    expect(result.violations.filter((v) => v.impact === 'critical')).toHaveLength(0)
  })

  test('Register sem violacoes critical', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'a11y rodado apenas em chromium')
    await page.goto('/register')
    await expect(page.getByRole('heading', { name: /criar conta|register/i })).toBeVisible()
    const result = await runAxe(page)
    expect(result.violations.filter((v) => v.impact === 'critical')).toHaveLength(0)
  })
})
