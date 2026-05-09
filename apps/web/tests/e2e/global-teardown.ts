import { existsSync, readFileSync, rmSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const pidFile = resolve(__dirname, '.e2e-pids.json')

function killTree(pid: unknown) {
  if (typeof pid !== 'number' || !Number.isFinite(pid)) return
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' })
    return
  }
  try {
    process.kill(-pid, 'SIGKILL')
  } catch {
    try { process.kill(pid, 'SIGKILL') } catch { /* noop */ }
  }
}

export default async function globalTeardown() {
  if (!existsSync(pidFile)) return
  const pids = JSON.parse(readFileSync(pidFile, 'utf8')) as { backend?: number; frontend?: number }
  killTree(pids.frontend)
  killTree(pids.backend)
  rmSync(pidFile, { force: true })
}
