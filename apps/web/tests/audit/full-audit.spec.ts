import { test, expect, type Page, type Request } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { AUDIT_ROUTES, BASE_URLS, type App } from './routes.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const RESULTS_DIR = resolve(__dirname, '../../audit-results')
const RUN_DIR = join(RESULTS_DIR, `run-${new Date().toISOString().replace(/[:.]/g, '-')}`)
const SCREENSHOT_DIR = join(RUN_DIR, 'screenshots')

const API_BASE = process.env.AUDIT_API_BASE ?? 'http://localhost:3000'

type PerfMetrics = {
  navStart: number
  ttfbMs: number | null
  domContentLoadedMs: number | null
  loadEventMs: number | null
  /** Largest Contentful Paint via PerformanceObserver. */
  lcpMs: number | null
  /** Cumulative Layout Shift. */
  cls: number | null
}

type RouteResult = {
  app: App
  path: string
  label: string
  status: 'ok' | 'warn' | 'error'
  durationMs: number
  perf: PerfMetrics
  screenshot: string
  consoleErrors: string[]
  consoleWarnings: string[]
  networkFailures: { url: string; status: number; statusText: string }[]
  pageErrors: string[]
  a11y: {
    violations: {
      id: string
      impact: string | null
      help: string
      nodes: number
      samples: { target: string; html: string; failureSummary?: string }[]
    }[]
    passes: number
    incomplete: number
  }
  pageError?: string
}

async function suppressOverlays(page: Page) {
  await page.addInitScript(() => {
    try {
      localStorage.setItem(
        'iga.cookieConsent.v1',
        JSON.stringify({ essential: true, analytics: false, marketing: false, decidedAt: new Date().toISOString() }),
      )
      localStorage.setItem('iga.guided-tour.done', '1')
      localStorage.setItem('iga.betaWelcome.dismissed.v1', '1')
      localStorage.setItem('iga.trialBanner.dismissed.v1', '1')
    } catch { /* noop */ }
  })
}

async function collectPerf(page: Page): Promise<PerfMetrics> {
  return page.evaluate<PerfMetrics>(() => {
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
    const ttfb = nav ? nav.responseStart - nav.requestStart : null
    const dcl = nav ? nav.domContentLoadedEventEnd - nav.fetchStart : null
    const loadEvt = nav ? nav.loadEventEnd - nav.fetchStart : null

    type PerfWindow = Window & {
      __auditLcp?: number
      __auditCls?: number
    }
    const w = window as PerfWindow

    return {
      navStart: nav?.startTime ?? 0,
      ttfbMs: ttfb,
      domContentLoadedMs: dcl,
      loadEventMs: loadEvt,
      lcpMs: typeof w.__auditLcp === 'number' ? w.__auditLcp : null,
      cls: typeof w.__auditCls === 'number' ? w.__auditCls : null,
    }
  })
}

async function installPerfObservers(page: Page) {
  await page.addInitScript(() => {
    try {
      type PerfWindow = Window & { __auditLcp?: number; __auditCls?: number }
      const w = window as PerfWindow
      w.__auditLcp = 0
      w.__auditCls = 0
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          w.__auditLcp = entry.startTime
        }
      }).observe({ type: 'largest-contentful-paint', buffered: true })

      new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as PerformanceEntry[]) {
          const ls = entry as PerformanceEntry & { value?: number; hadRecentInput?: boolean }
          if (!ls.hadRecentInput && typeof ls.value === 'number') {
            w.__auditCls = (w.__auditCls ?? 0) + ls.value
          }
        }
      }).observe({ type: 'layout-shift', buffered: true })
    } catch { /* noop */ }
  })
}

function safeName(s: string): string {
  return s.replace(/[^a-zA-Z0-9-_]/g, '_').slice(0, 60)
}

// ── Spec ────────────────────────────────────────────────────────────────────

const results: RouteResult[] = []

test.beforeAll(async () => {
  mkdirSync(SCREENSHOT_DIR, { recursive: true })
})

test.afterAll(async () => {
  const out = {
    generatedAt: new Date().toISOString(),
    apiBase: API_BASE,
    totals: {
      routes: results.length,
      ok: results.filter((r) => r.status === 'ok').length,
      warn: results.filter((r) => r.status === 'warn').length,
      error: results.filter((r) => r.status === 'error').length,
    },
    results,
  }
  writeFileSync(join(RUN_DIR, 'results.json'), JSON.stringify(out, null, 2), 'utf-8')
  console.log(`\n[audit] Resultados salvos em: ${RUN_DIR}`)
})

test.describe.configure({ mode: 'serial' })

for (const route of AUDIT_ROUTES) {
  test(`audit [${route.app}] ${route.path} — ${route.label}`, async ({ page }, testInfo) => {
    test.setTimeout(90_000)
    const consoleErrors: string[] = []
    const consoleWarnings: string[] = []
    const networkFailures: { url: string; status: number; statusText: string }[] = []
    const pageErrors: string[] = []

    page.on('console', (msg) => {
      const text = msg.text()
      // Reclassifica ruido conhecido (React/antd dev warnings impressos via console.error)
      // como warning em vez de error. Ajuste a lista quando aparecer nova fonte de noise.
      const looksLikeWarning =
        text.startsWith('Warning:') ||
        text.includes('may only be set via an HTTP header') ||
        text.includes('Download the React DevTools') ||
        text.includes('[antd:') ||
        text.includes('[axe]')
      if (msg.type() === 'error' && !looksLikeWarning) consoleErrors.push(text)
      else if (msg.type() === 'warning' || looksLikeWarning) consoleWarnings.push(text)
    })
    page.on('pageerror', (err) => pageErrors.push(`${err.name}: ${err.message}`))
    page.on('requestfailed', (req: Request) => {
      networkFailures.push({
        url: req.url(),
        status: 0,
        statusText: req.failure()?.errorText ?? 'failed',
      })
    })
    page.on('response', (res) => {
      const status = res.status()
      if (status >= 400 && status < 600) {
        // Ignora preflight 204 e known noise
        if (res.request().method() === 'OPTIONS') return
        networkFailures.push({ url: res.url(), status, statusText: res.statusText() })
      }
    })

    // Auth ja foi resolvido via storageState no globalSetup — nao loga por test.
    await suppressOverlays(page)
    await installPerfObservers(page)

    const url = `${BASE_URLS[route.app]}${route.path}`
    const started = Date.now()
    let pageError: string | undefined

    try {
      const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45_000 })
      if (resp && !resp.ok() && resp.status() !== 304) {
        pageError = `Navegacao retornou ${resp.status()}`
      }
      // Aguarda assentar — networkidle pode demorar em dev por causa de HMR
      await page.waitForLoadState('load', { timeout: 30_000 }).catch(() => undefined)
      await page.waitForTimeout(500) // permite efeito de mount/fade
    } catch (err) {
      pageError = err instanceof Error ? err.message : String(err)
    }

    const durationMs = Date.now() - started

    const screenshotPath = join(SCREENSHOT_DIR, `${route.app}_${safeName(route.path)}.png`)
    await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => undefined)

    // axe-core — analisa toda a pagina com regras default
    let a11yResult: RouteResult['a11y'] = { violations: [], passes: 0, incomplete: 0 }
    try {
      const axe = await new AxeBuilder({ page })
        .disableRules(['region']) // false-positive em SPAs com layout custom
        .analyze()
      a11yResult = {
        violations: axe.violations.map((v) => ({
          id: v.id,
          impact: v.impact ?? null,
          help: v.help,
          nodes: v.nodes.length,
          samples: v.nodes.slice(0, 3).map((n) => ({
            target: Array.isArray(n.target) ? n.target.join(' > ') : String(n.target),
            html: (n.html ?? '').slice(0, 220),
            failureSummary: n.failureSummary?.slice(0, 220),
          })),
        })),
        passes: axe.passes.length,
        incomplete: axe.incomplete.length,
      }
    } catch (err) {
      pageError = pageError ?? `axe falhou: ${err instanceof Error ? err.message : String(err)}`
    }

    const perf = await collectPerf(page).catch(() => ({
      navStart: 0, ttfbMs: null, domContentLoadedMs: null, loadEventMs: null, lcpMs: null, cls: null,
    } satisfies PerfMetrics))

    const hasError = Boolean(pageError) || consoleErrors.length > 0 || pageErrors.length > 0 || networkFailures.some((n) => n.status >= 500 || n.status === 0)
    const hasWarn = !hasError && (consoleWarnings.length > 0 || networkFailures.length > 0 || a11yResult.violations.some((v) => v.impact === 'serious' || v.impact === 'critical') || (perf.lcpMs ?? 0) > 2500)
    const status: RouteResult['status'] = hasError ? 'error' : hasWarn ? 'warn' : 'ok'

    results.push({
      app: route.app,
      path: route.path,
      label: route.label,
      status,
      durationMs,
      perf,
      screenshot: `screenshots/${route.app}_${safeName(route.path)}.png`,
      consoleErrors: consoleErrors.slice(0, 20),
      consoleWarnings: consoleWarnings.slice(0, 10),
      networkFailures: networkFailures.slice(0, 20),
      pageErrors,
      a11y: a11yResult,
      pageError,
    })

    await testInfo.attach('result.json', {
      body: JSON.stringify(results[results.length - 1], null, 2),
      contentType: 'application/json',
    })

    // Nao falha o teste mesmo com warn/error — o relatorio agrega tudo.
    expect(true).toBeTruthy()
  })
}
