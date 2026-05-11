// Standalone probe — corre axe num punhado de URLs e imprime detalhe dos violations.
// Uso: node tests/audit/probe-a11y.mjs
import { chromium } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

const TARGETS = [
  'http://localhost:5173/login',
  'http://localhost:5173/legal/privacidade',
  'http://localhost:3003/connectors',
]

const browser = await chromium.launch()
const ctx = await browser.newContext()
const page = await ctx.newPage()

for (const url of TARGETS) {
  console.log(`\n=== ${url} ===`)
  try {
    await page.goto(url, { waitUntil: 'load', timeout: 30_000 })
    await page.waitForTimeout(800)
    const axe = await new AxeBuilder({ page }).disableRules(['region']).analyze()
    for (const v of axe.violations) {
      console.log(`\n  [${v.impact}] ${v.id}: ${v.help}`)
      for (const n of v.nodes.slice(0, 3)) {
        console.log(`    target: ${n.target.join(' > ')}`)
        console.log(`    html: ${(n.html ?? '').slice(0, 180)}`)
        if (n.failureSummary) console.log(`    why: ${n.failureSummary.slice(0, 220)}`)
      }
    }
  } catch (err) {
    console.log('  ERROR:', err.message)
  }
}
await browser.close()
