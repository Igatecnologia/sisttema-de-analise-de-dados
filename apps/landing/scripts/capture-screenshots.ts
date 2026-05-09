/**
 * Captura screenshots das telas chave do app real para usar como mockups
 * na landing page. Roda contra http://127.0.0.1:4173 (preview build).
 *
 * Uso:
 *   cd landing-page && npx tsx scripts/capture-screenshots.ts
 *
 * Pré-requisito: backend em :3001 + frontend preview em :4173, com admin
 * `admin@iga.com / AdminTeste2026!`.
 *
 * Output: landing-page/public/screenshots/{name}-{viewport}.png
 */
import { chromium, type Page } from 'playwright'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'

const APP_URL = process.env.APP_URL ?? 'http://127.0.0.1:4173'
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? 'admin@iga.com'
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? 'AdminTeste2026!'
const OUT_DIR = join(process.cwd(), 'public', 'screenshots')

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
] as const

const PAGES = [
  { slug: 'dashboard', path: '/gestao', label: 'Dashboard executivo' },
  { slug: 'producao', path: '/producao', label: 'Produção em tempo real' },
  { slug: 'estoque', path: '/estoque', label: 'Estoque inteligente' },
  { slug: 'financeiro', path: '/financeiro', label: 'Financeiro completo' },
  { slug: 'vendas', path: '/vendas', label: 'Vendas analítico' },
  { slug: 'configuracoes', path: '/configuracoes', label: 'Configurações' },
] as const

async function login(page: Page) {
  /** Pre-popula localStorage para esconder cookie banner + tour guiado + trial banner. */
  await page.addInitScript(() => {
    try {
      window.localStorage.setItem(
        'iga.cookieConsent.v1',
        JSON.stringify({
          essential: true,
          analytics: false,
          marketing: false,
          decidedAt: new Date().toISOString(),
        }),
      )
      window.localStorage.setItem('iga.guided-tour.done', '1')
      window.localStorage.setItem('iga.trialBanner.dismissed', '1')
    } catch {
      /* noop */
    }
  })
  await page.goto(`${APP_URL}/login`)
  await page.getByLabel('Usuário').fill(ADMIN_EMAIL)
  await page.getByLabel('Senha').fill(ADMIN_PASSWORD)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await page.waitForURL(/gestao/, { timeout: 20_000 })
  console.log('  ✓ login OK')

  /** Aceita Termos via UI — modal blocker SEC-4.4 cobre as telas. */
  try {
    await page.waitForTimeout(1500) /* espera modal renderizar */
    const checkbox = page.getByRole('checkbox', { name: /li e concordo/i })
    if (await checkbox.isVisible({ timeout: 3000 }).catch(() => false)) {
      await checkbox.check()
      const acceptBtn = page.getByRole('button', { name: /aceitar e continuar/i })
      await acceptBtn.click({ timeout: 3000 })
      await page.waitForTimeout(1200)
      console.log('  ✓ termos aceitos via UI')
    } else {
      console.log('  · modal de termos não apareceu (já aceito)')
    }
  } catch (err) {
    console.warn(`  ! aceite termos falhou: ${(err as Error).message}`)
  }

  /** Fecha guided tour se aparecer. */
  try {
    const skipBtn = page.getByRole('button', { name: /pular|skip|fechar/i }).first()
    if (await skipBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
      await skipBtn.click({ timeout: 2000 })
      await page.waitForTimeout(500)
    }
  } catch {
    /* noop */
  }
}

async function captureLogin(viewportName: string) {
  console.log(`\n  • login (${viewportName})`)
  const browser = await chromium.launch()
  const context = await browser.newContext({
    viewport: VIEWPORTS.find((v) => v.name === viewportName)!,
    deviceScaleFactor: 2,
  })
  const page = await context.newPage()
  await page.goto(`${APP_URL}/login`)
  await page.waitForLoadState('networkidle', { timeout: 15_000 })
  /** Aguarda animações de entrada. */
  await page.waitForTimeout(800)
  const out = join(OUT_DIR, `login-${viewportName}.png`)
  await page.screenshot({ path: out, fullPage: false })
  console.log(`    → ${out}`)
  await browser.close()
}

async function captureAuthenticatedPages(viewportName: string) {
  const viewport = VIEWPORTS.find((v) => v.name === viewportName)!
  const browser = await chromium.launch()
  const context = await browser.newContext({ viewport, deviceScaleFactor: 2 })
  const page = await context.newPage()

  console.log(`\n[${viewportName} ${viewport.width}×${viewport.height}]`)
  await login(page)

  /** CSS para esconder elementos transient (banners de billing, tour overlay residual). */
  const HIDE_TRANSIENT_CSS = `
    /* Trial banner topo (Ant Alert error) */
    .app-shell > .ant-alert,
    [class*="trialBanner"],
    [class*="TrialBanner"],
    /* Tour guiado residual */
    [class*="react-joyride"],
    .__floater,
    /* Cookie consent residual */
    [class*="cookieConsent"],
    /* Notificações Ant Design no topo direito */
    .ant-notification,
    .ant-message {
      display: none !important;
    }
  `

  for (const p of PAGES) {
    console.log(`  • ${p.slug}`)
    try {
      await page.goto(`${APP_URL}${p.path}`, { waitUntil: 'domcontentloaded', timeout: 20_000 })
      /** Aguarda hidratação + chart draw-in (animação 1.6s + buffer). */
      await page.waitForTimeout(3500)
      await page.addStyleTag({ content: HIDE_TRANSIENT_CSS })
      await page.waitForTimeout(300)
      const out = join(OUT_DIR, `${p.slug}-${viewportName}.png`)
      await page.screenshot({ path: out, fullPage: false })
      console.log(`    → ${out}`)
    } catch (err) {
      console.warn(`    ! falhou: ${(err as Error).message}`)
      /** Tenta capturar mesmo assim — pode ter renderizado parcialmente. */
      try {
        const out = join(OUT_DIR, `${p.slug}-${viewportName}.png`)
        await page.screenshot({ path: out, fullPage: false })
        console.log(`    → ${out} (parcial)`)
      } catch {
        /** Silencioso. */
      }
    }
  }

  /** Captura Copilot drawer aberto sobre o dashboard. */
  console.log('  • copilot (drawer)')
  try {
    await page.goto(`${APP_URL}/gestao`)
    await page.waitForLoadState('networkidle', { timeout: 12_000 })
    await page.waitForTimeout(1200)
    /** Tenta abrir Copilot via Cmd+K ou botão flutuante; fallback: keyboard shortcut. */
    const copilotBtn = page.getByRole('button', { name: /copilot|ai|ia/i }).first()
    if ((await copilotBtn.count()) > 0) {
      await copilotBtn.click({ timeout: 3000 })
      await page.waitForTimeout(800)
    }
    const out = join(OUT_DIR, `copilot-${viewportName}.png`)
    await page.screenshot({ path: out, fullPage: false })
    console.log(`    → ${out}`)
  } catch (err) {
    console.warn(`    ! copilot falhou: ${(err as Error).message}`)
  }

  await browser.close()
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true })
  console.log(`Capturando screenshots em ${OUT_DIR}`)

  for (const v of VIEWPORTS) {
    await captureLogin(v.name)
    await captureAuthenticatedPages(v.name)
  }

  console.log('\n✓ concluído')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
