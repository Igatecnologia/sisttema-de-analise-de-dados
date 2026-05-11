import { spawn, type ChildProcess } from 'node:child_process'
import { rmSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const frontendRoot = resolve(__dirname, '../..')
const repoRoot = resolve(frontendRoot, '../..')
const backendRoot = resolve(repoRoot, 'services/api')
const pidFile = resolve(__dirname, '.e2e-pids.json')

const apiUrl = 'http://127.0.0.1:3001/health/live'
const appUrl = 'http://127.0.0.1:4173'

function start(command: string, args: string[], cwd: string, env: NodeJS.ProcessEnv): ChildProcess {
  return spawn(command, args, {
    cwd,
    env,
    stdio: 'ignore',
    windowsHide: true,
  })
}

async function waitForUrl(url: string, timeoutMs: number) {
  const started = Date.now()
  let lastError: unknown
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url)
      if ([200, 204, 301, 302, 304, 400, 401, 402, 403].includes(response.status)) return
    } catch (error) {
      lastError = error
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 500))
  }
  throw new Error(`Timeout aguardando ${url}: ${String(lastError)}`)
}

export default async function globalSetup() {
  rmSync(resolve(__dirname, '.backend-data'), { recursive: true, force: true })

  const backend = start('node', ['--import', 'tsx', 'src/server.ts'], backendRoot, {
    ...process.env,
    NODE_ENV: 'development',
    PORT: '3001',
    PORT_MAX: '3001',
    START_SCHEDULERS: '0',
    IGA_DATA_DIR: resolve(frontendRoot, 'tests/e2e/.backend-data'),
    ADMIN_DEFAULT_EMAIL: process.env.E2E_ADMIN_EMAIL ?? 'admin@iga.com',
    ADMIN_DEFAULT_PASSWORD: process.env.E2E_ADMIN_PASSWORD ?? 'AdminTeste2026!',
    BILLING_GATE_DISABLED: '1',
    FRONTEND_URL: appUrl,
    PROXY_CACHE_TTL_MS: '0',
  })

  const frontend = start('node', ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '4173'], frontendRoot, {
    ...process.env,
    VITE_API_BASE_URL: 'http://127.0.0.1:3001',
    VITE_HTTP_TIMEOUT_MS: '180000',
  })

  writeFileSync(pidFile, JSON.stringify({ backend: backend.pid, frontend: frontend.pid }, null, 2))

  await Promise.all([
    waitForUrl(apiUrl, 60_000),
    waitForUrl(appUrl, 60_000),
  ])
}
