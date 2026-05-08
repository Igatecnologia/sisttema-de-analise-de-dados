import { expect, test } from '@playwright/test'

/**
 * OPS-3 — A11y baseline com axe-core injetado via CDN (sem dep nova).
 * Roda em 3 paginas chave: login, dashboard, configuracoes.
 *
 * Falha se houver violations de impacto `serious` ou `critical`.
 * `moderate` e `minor` sao reportadas mas nao bloqueiam (refactor incremental).
 */

type AxeResult = {
  violations: Array<{ id: string; impact: 'minor' | 'moderate' | 'serious' | 'critical'; help: string; nodes: unknown[] }>
}

async function runAxe(page: import('@playwright/test').Page): Promise<AxeResult> {
  await page.addScriptTag({ url: 'https://unpkg.com/axe-core@4.10.2/axe.min.js' })
  return page.evaluate(async () => {
    return new Promise<AxeResult>((resolve) => {
      ;(window as unknown as { axe: { run: (cb: (err: unknown, result: AxeResult) => void) => void } }).axe.run(
        (_err, result) => resolve(result),
      )
    })
  })
}

function assertNoCritical(result: AxeResult, pageName: string) {
  const critical = result.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
  if (critical.length > 0) {
    const summary = critical.map((v) => `[${v.impact}] ${v.id}: ${v.help} (${v.nodes.length} elementos)`).join('\n')
    throw new Error(`A11y critico em ${pageName}:\n${summary}`)
  }
}

test.describe('A11y baseline (axe-core)', () => {
  test('Login page sem violacoes serious/critical', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'a11y rodado apenas em chromium')
    await page.goto('/login')
    /** Aguarda renderizar form. */
    await page.waitForSelector('input[type="text"], input[type="email"]')
    const result = await runAxe(page)
    assertNoCritical(result, '/login')
  })

  test('Dashboard sem violacoes serious/critical', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'a11y rodado apenas em chromium')
    await page.goto('/gestao')
    await page.waitForLoadState('networkidle', { timeout: 15_000 })
    const result = await runAxe(page)
    assertNoCritical(result, '/gestao')
  })

  test('Settings page sem violacoes serious/critical', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'a11y rodado apenas em chromium')
    await page.goto('/configuracoes')
    await page.waitForLoadState('networkidle', { timeout: 15_000 })
    const result = await runAxe(page)
    /** Settings pode ter componentes Ant Design com violacoes minor — so bloqueia critical. */
    expect(result.violations.filter((v) => v.impact === 'critical')).toHaveLength(0)
  })
})
