import { chromium } from '@playwright/test'

async function main() {
  const browser = await chromium.launch({ headless: true })
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()

  page.on('console', (msg) => {
    console.log(`[${msg.type()}] ${msg.text()}`)
  })
  page.on('pageerror', (e) => console.log(`[pageerror] ${e.message}`))
  page.on('requestfailed', (r) => console.log(`[reqfail] ${r.url()} ${r.failure()?.errorText}`))
  page.on('response', (r) => {
    if (r.status() >= 400) console.log(`[${r.status()}] ${r.url()}`)
  })

  // Login
  const r = await page.request.post('http://localhost:3000/api/v1/auth/login', {
    data: { email: 'admin@iga.com', password: 'IgaGestao@2026!' },
  })
  const body = await r.json()
  await page.goto('http://localhost:5173/login', { waitUntil: 'domcontentloaded' })
  await page.evaluate(
    ({ value }) => {
      window.localStorage.setItem('t:default:auth.session', value)
      window.localStorage.setItem('t:default:auth.remember', '1')
    },
    {
      value: JSON.stringify({
        user: body.user,
        permissions: body.permissions,
        impersonation: body.impersonation ?? null,
      }),
    },
  )

  console.log('--- Navigating to /dashboard ---')
  await page.goto('http://localhost:5173/dashboard', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(8000)

  const text = await page.evaluate(() => {
    const root = document.querySelector('#root')
    return {
      length: (root?.textContent ?? '').length,
      preview: (root?.textContent ?? '').slice(0, 500),
      html: document.body.innerHTML.slice(0, 2000),
    }
  })
  console.log('--- After 8s ---')
  console.log('text length:', text.length)
  console.log('preview:', JSON.stringify(text.preview).slice(0, 200))
  console.log('html sample:', text.html.replace(/\s+/g, ' ').slice(0, 800))

  await browser.close()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
