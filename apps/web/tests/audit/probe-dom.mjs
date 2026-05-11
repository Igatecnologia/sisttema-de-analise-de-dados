// Mostra a estrutura de landmarks (main/nav/header) na DOM de uma URL.
import { chromium } from '@playwright/test'

const URL = process.argv[2] ?? 'http://localhost:5173/login'

const browser = await chromium.launch()
const page = await browser.newPage()
await page.goto(URL, { waitUntil: 'networkidle' })
await page.waitForTimeout(2000)

const info = await page.evaluate(() => {
  const landmarks = ['main', 'nav', 'header', 'footer', 'aside']
  const result = {}
  for (const tag of landmarks) {
    const nodes = Array.from(document.querySelectorAll(tag))
    const byRole = Array.from(document.querySelectorAll(`[role="${tag}"]`))
    result[tag] = {
      tagCount: nodes.length,
      roleCount: byRole.length,
      tagSamples: nodes.slice(0, 2).map((n) => `${n.tagName}#${n.id || '?'}.${n.className?.split(' ').join('.') || '?'} (children=${n.children.length})`),
      roleSamples: byRole.slice(0, 2).map((n) => `${n.tagName}[role=${n.getAttribute('role')}]#${n.id || '?'}`),
    }
  }
  // Also check if <main> exists as ancestor of any specific node
  const root = document.getElementById('root')
  result.rootHTML = root?.outerHTML.slice(0, 2000) ?? '(no #root)'
  return result
})

console.log(JSON.stringify(info, null, 2))
await browser.close()
