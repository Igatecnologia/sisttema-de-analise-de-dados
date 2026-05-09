/**
 * Webapp audit standalone — testa todas as telas do sistema rodando no
 * Docker stack (frontend :5173, backend :3000).
 *
 * Uso:
 *   cd apps/web && npx playwright test tests/webapp-audit.ts --project=chromium
 *   ou
 *   cd apps/web && npx tsx tests/webapp-audit.ts
 *
 * O script:
 *   1. Faz login via API (admin@iga.com / IgaGestao@2026!)
 *   2. Visita cada rota da lista
 *   3. Captura screenshot por rota
 *   4. Coleta erros do console
 *   5. Mede tempo de carregamento
 *   6. Gera relatorio JSON + markdown
 */

import { chromium, type Browser, type Page } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173'
const API_URL = process.env.API_URL || 'http://localhost:3000'
const EMAIL = process.env.AUDIT_EMAIL || 'admin@iga.com'
const PASSWORD = process.env.AUDIT_PASSWORD || 'IgaGestao@2026!'

const SCREENSHOTS_DIR = resolve(__dirname, '..', '..', '..', 'audit-screenshots')

type RouteResult = {
  route: string
  label: string
  status: 'ok' | 'error' | 'warning'
  loadMs: number
  consoleErrors: string[]
  pageErrors: string[]
  visibleHeadings: string[]
  hasContent: boolean
  screenshot?: string
  notes: string[]
}

const ROUTES: Array<{ path: string; label: string; group: string }> = [
  // Auth (public)
  { path: '/login', label: 'Login', group: 'Auth' },
  { path: '/register', label: 'Register', group: 'Auth' },
  { path: '/forgot-password', label: 'Forgot Password', group: 'Auth' },

  // Dashboards (auth)
  { path: '/gestao', label: 'Visão do gestor', group: 'Dashboards' },
  { path: '/dashboard', label: 'Visão geral', group: 'Dashboards' },
  { path: '/dashboard/analises', label: 'Análises BI', group: 'Dashboards' },
  { path: '/dashboard/vendas-analitico', label: 'Vendas analítico', group: 'Dashboards' },
  { path: '/alertas', label: 'Alertas', group: 'Dashboards' },
  { path: '/notificacoes', label: 'Notificações', group: 'Dashboards' },

  // Operação
  { path: '/producao', label: 'Produção', group: 'Operação' },
  { path: '/ficha-tecnica', label: 'Ficha Técnica', group: 'Operação' },
  { path: '/compras', label: 'Compras', group: 'Operação' },
  { path: '/notas-fiscais', label: 'Notas Fiscais', group: 'Operação' },
  { path: '/estoque', label: 'Estoque', group: 'Operação' },
  { path: '/clientes', label: 'Clientes', group: 'Operação' },

  // Financeiro
  { path: '/financeiro', label: 'Financeiro', group: 'Financeiro' },
  { path: '/relatorios', label: 'Relatórios', group: 'Financeiro' },
  { path: '/relatorios/galeria', label: 'Galeria de Relatórios', group: 'Financeiro' },
  { path: '/relatorios/agendados', label: 'Relatórios Agendados', group: 'Financeiro' },
  { path: '/visoes-salvas', label: 'Visões Salvas', group: 'Financeiro' },

  // Admin
  { path: '/configuracoes', label: 'Configurações', group: 'Admin' },
  { path: '/usuarios', label: 'Funcionários', group: 'Admin' },
  { path: '/orgs', label: 'Organizações', group: 'Admin' },
  { path: '/auditoria', label: 'Auditoria', group: 'Admin' },
  { path: '/api-keys', label: 'API Keys', group: 'Admin' },
  { path: '/billing', label: 'Plano e Cobrança', group: 'Admin' },
  { path: '/planos', label: 'Planos', group: 'Admin' },

  // Dados
  { path: '/fontes-de-dados', label: 'Fontes de Dados', group: 'Dados' },
  { path: '/integracoes/saude', label: 'Saúde Integrações', group: 'Dados' },
  { path: '/connectors', label: 'Conectores', group: 'Dados' },
  { path: '/webhooks', label: 'Webhooks', group: 'Dados' },

  // Conta
  { path: '/perfil', label: 'Meu Perfil', group: 'Conta' },
  { path: '/seguranca', label: 'Segurança', group: 'Conta' },
  { path: '/seguranca/lgpd', label: 'LGPD', group: 'Conta' },
  { path: '/boas-vindas', label: 'Onboarding', group: 'Conta' },

  // Suporte
  { path: '/ajuda', label: 'Central de Ajuda', group: 'Suporte' },
  { path: '/novidades', label: 'Novidades', group: 'Suporte' },
  { path: '/suporte/fale-conosco', label: 'Fale Conosco', group: 'Suporte' },
  { path: '/admin/operacao', label: 'Operação Admin', group: 'Suporte' },

  // Legal
  { path: '/legal/termos', label: 'Termos', group: 'Legal' },
  { path: '/legal/privacidade', label: 'Privacidade', group: 'Legal' },
  { path: '/legal/cookies', label: 'Cookies', group: 'Legal' },
  { path: '/legal/acessibilidade', label: 'Acessibilidade', group: 'Legal' },
]

async function login(page: Page) {
  console.log(`[audit] Login em ${API_URL}/api/v1/auth/login`)
  const response = await page.request.post(`${API_URL}/api/v1/auth/login`, {
    data: { email: EMAIL, password: PASSWORD },
  })
  if (!response.ok()) {
    throw new Error(`Login falhou: HTTP ${response.status()} ${await response.text()}`)
  }
  const body = await response.json()
  const cookies = await page.context().cookies()
  console.log(`[audit] Login OK. Cookies: ${cookies.length}, user: ${body?.user?.email}`)

  // Frontend exige localStorage com a sessao — setamos em pagina vazia da mesma origem.
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' })
  const safeSession = JSON.stringify({
    user: body.user,
    permissions: body.permissions,
    impersonation: body.impersonation ?? null,
  })
  await page.evaluate(
    ({ key, rememberKey, value, cookieKey, cookieValue, tourKey, themeKey, themeMode }) => {
      window.localStorage.setItem(key, value)
      window.localStorage.setItem(rememberKey, '1')
      window.localStorage.setItem(cookieKey, cookieValue)
      window.localStorage.setItem(tourKey, '1')
      // Modais auto-open dismissed para screenshots limpas
      window.localStorage.setItem('iga.betaWelcome.dismissed.v1', '1')
      window.localStorage.setItem('iga.terms.acceptance.dismissed.v1', '1')
      window.localStorage.setItem('iga-dismiss-sgbr-permissions-info', '1')
      document.cookie = `${themeKey}=${themeMode}; path=/; max-age=31536000; samesite=lax`
    },
    {
      key: 't:default:auth.session',
      rememberKey: 't:default:auth.remember',
      value: safeSession,
      cookieKey: 'iga.cookieConsent.v1',
      cookieValue: JSON.stringify({
        essential: true,
        analytics: false,
        marketing: false,
        decidedAt: new Date().toISOString(),
      }),
      tourKey: 'iga.guided-tour.done',
      themeKey: 'iga_theme_mode',
      themeMode: process.env.AUDIT_THEME ?? 'light',
    },
  )
  // theme via cookie ja foi setado no evaluate
  console.log(`[audit] Theme: ${process.env.AUDIT_THEME ?? 'light'}`)
}

async function auditRoute(
  page: Page,
  route: { path: string; label: string; group: string },
): Promise<RouteResult> {
  const consoleErrors: string[] = []
  const pageErrors: string[] = []

  const onConsole = (msg: import('@playwright/test').ConsoleMessage) => {
    if (msg.type() === 'error') {
      const txt = msg.text()
      // ignora ruido conhecido
      if (txt.includes('Failed to load resource') && txt.includes('502')) return
      if (txt.includes('Sentry')) return
      consoleErrors.push(txt)
    }
  }
  const onPageError = (err: Error) => {
    pageErrors.push(err.message)
  }
  page.on('console', onConsole)
  page.on('pageerror', onPageError)

  const startedAt = Date.now()
  try {
    await page.goto(`${BASE_URL}${route.path}`, { waitUntil: 'domcontentloaded', timeout: 15_000 })
    // Aguarda Suspense terminar (h1/h2/h3 visivel ou conteudo > 200 chars apos sidebar)
    await page
      .waitForFunction(
        () => {
          const root = document.querySelector('#root')
          if (!root) return false
          const text = (root.textContent ?? '').trim()
          if (text.length < 200) return false
          // Espera o spinner do Suspense desaparecer
          const stillLoading = root.querySelector('.ant-spin-spinning')
          return !stillLoading
        },
        { timeout: 10_000 },
      )
      .catch(() => {
        /* tolera — paginas legitimamente vazias */
      })
    // Pequeno wait extra pra animacoes terminarem
    await page.waitForTimeout(300)
  } catch (err) {
    const loadMs = Date.now() - startedAt
    page.off('console', onConsole)
    page.off('pageerror', onPageError)
    return {
      route: route.path,
      label: route.label,
      status: 'error',
      loadMs,
      consoleErrors,
      pageErrors: [...pageErrors, `Navegacao falhou: ${(err as Error).message}`],
      visibleHeadings: [],
      hasContent: false,
      notes: ['timeout ou erro de navegacao'],
    }
  }
  const loadMs = Date.now() - startedAt

  // Captura headings + tem conteudo?
  const visibleHeadings = await page.evaluate(() =>
    Array.from(document.querySelectorAll('h1, h2, h3'))
      .filter((el) => (el as HTMLElement).offsetParent !== null)
      .slice(0, 5)
      .map((el) => (el.textContent || '').trim().slice(0, 80))
      .filter(Boolean),
  )
  const hasContent = await page.evaluate(() => {
    const root = document.querySelector('#root')
    if (!root) return false
    return root.textContent !== null && root.textContent.trim().length > 50
  })

  // Screenshot
  let screenshot: string | undefined
  try {
    const safe = route.path.replace(/[\/?&=]/g, '_').replace(/^_/, '') || 'root'
    const fullPath = resolve(SCREENSHOTS_DIR, `${safe}.png`)
    mkdirSync(dirname(fullPath), { recursive: true })
    await page.screenshot({ path: fullPath, fullPage: false })
    screenshot = fullPath
  } catch {
    /* ignora */
  }

  page.off('console', onConsole)
  page.off('pageerror', onPageError)

  const notes: string[] = []
  if (!hasContent) notes.push('pagina renderizou pouco conteudo (<50 chars)')
  if (visibleHeadings.length === 0) notes.push('nenhum heading H1-H3 visivel')
  if (loadMs > 5000) notes.push(`carregamento lento (${loadMs}ms)`)

  const status: RouteResult['status'] =
    pageErrors.length > 0 || !hasContent ? 'error' : consoleErrors.length > 0 ? 'warning' : 'ok'

  return {
    route: route.path,
    label: route.label,
    status,
    loadMs,
    consoleErrors,
    pageErrors,
    visibleHeadings,
    hasContent,
    screenshot,
    notes,
  }
}

async function main() {
  mkdirSync(SCREENSHOTS_DIR, { recursive: true })

  console.log(`[audit] Inicializando navegador...`)
  const browser: Browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
  })
  const page = await context.newPage()

  try {
    await login(page)
  } catch (err) {
    console.error(`[audit] FATAL ${(err as Error).message}`)
    await browser.close()
    process.exit(1)
  }

  console.log(`[audit] Auditando ${ROUTES.length} rotas...`)
  const results: RouteResult[] = []
  for (const route of ROUTES) {
    process.stdout.write(`  ${route.label.padEnd(30)} `)
    const r = await auditRoute(page, route)
    const symbol = r.status === 'ok' ? '✓' : r.status === 'warning' ? '⚠' : '✗'
    console.log(`${symbol}  ${r.loadMs}ms  ${r.notes.join(', ')}`)
    results.push(r)
  }

  await browser.close()

  // Gerar relatorios
  const total = results.length
  const ok = results.filter((r) => r.status === 'ok').length
  const warning = results.filter((r) => r.status === 'warning').length
  const error = results.filter((r) => r.status === 'error').length
  const avgLoadMs = Math.round(results.reduce((acc, r) => acc + r.loadMs, 0) / total)

  console.log('')
  console.log('=== Resumo ===')
  console.log(`OK:       ${ok}/${total}`)
  console.log(`Warning:  ${warning}/${total}`)
  console.log(`Error:    ${error}/${total}`)
  console.log(`Avg load: ${avgLoadMs}ms`)

  // JSON
  const reportJson = resolve(__dirname, '..', '..', '..', 'audit-report.json')
  writeFileSync(
    reportJson,
    JSON.stringify({ summary: { total, ok, warning, error, avgLoadMs }, results }, null, 2),
  )
  console.log(`\nRelatorio JSON: ${reportJson}`)

  // Markdown
  const groups = ROUTES.reduce<Record<string, RouteResult[]>>((acc, r, idx) => {
    const key = r.group
    if (!acc[key]) acc[key] = []
    acc[key].push(results[idx])
    return acc
  }, {})

  const mdLines: string[] = []
  mdLines.push('# Webapp Audit Report')
  mdLines.push('')
  mdLines.push(`> Gerado em ${new Date().toISOString()}`)
  mdLines.push('')
  mdLines.push('## Resumo')
  mdLines.push('')
  mdLines.push(`- **Total de rotas**: ${total}`)
  mdLines.push(`- **OK**: ${ok}`)
  mdLines.push(`- **Warnings**: ${warning}`)
  mdLines.push(`- **Errors**: ${error}`)
  mdLines.push(`- **Tempo medio**: ${avgLoadMs}ms`)
  mdLines.push('')

  for (const [groupName, items] of Object.entries(groups)) {
    mdLines.push(`## ${groupName}`)
    mdLines.push('')
    mdLines.push('| Rota | Status | Tempo | Observacoes |')
    mdLines.push('|------|--------|-------|-------------|')
    for (const r of items) {
      const symbol = r.status === 'ok' ? '✅' : r.status === 'warning' ? '⚠️' : '❌'
      const obs = [
        ...r.notes,
        ...r.pageErrors.map((e) => `**page error**: ${e.slice(0, 60)}`),
        ...r.consoleErrors.slice(0, 2).map((e) => `console: ${e.slice(0, 60)}`),
      ].join('; ') || '—'
      mdLines.push(`| ${r.label} (\`${r.route}\`) | ${symbol} | ${r.loadMs}ms | ${obs} |`)
    }
    mdLines.push('')
  }

  // Erros agregados
  const allErrors = results.filter((r) => r.pageErrors.length > 0 || r.consoleErrors.length > 0)
  if (allErrors.length > 0) {
    mdLines.push('## Erros detectados')
    mdLines.push('')
    for (const r of allErrors) {
      mdLines.push(`### ${r.label} (\`${r.route}\`)`)
      if (r.pageErrors.length > 0) {
        mdLines.push('**Page errors:**')
        for (const e of r.pageErrors) {
          mdLines.push(`- \`${e.slice(0, 200)}\``)
        }
      }
      if (r.consoleErrors.length > 0) {
        mdLines.push('**Console errors:**')
        for (const e of r.consoleErrors.slice(0, 5)) {
          mdLines.push(`- \`${e.slice(0, 200)}\``)
        }
      }
      mdLines.push('')
    }
  }

  const reportMd = resolve(__dirname, '..', '..', '..', 'audit-report.md')
  writeFileSync(reportMd, mdLines.join('\n'))
  console.log(`Relatorio Markdown: ${reportMd}`)
  console.log(`Screenshots: ${SCREENSHOTS_DIR}`)

  process.exit(error > 0 ? 1 : 0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
