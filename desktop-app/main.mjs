import { app, BrowserWindow, dialog, shell } from 'electron'

/**
 * Performance: desabilita aceleração GPU em máquinas onde causa lag (drivers fracos
 * de Intel HD ou notebooks corporativos sem GPU dedicada). Pode ser reativada com
 * IGA_GPU=1. Por padrão, app fica leve e evita travas de renderização.
 */
if (process.env.IGA_GPU !== '1') {
  app.disableHardwareAcceleration()
}
/** Reduz consumo quando a janela está em background (alt-tab, minimizada). */
app.commandLine.appendSwitch('disable-renderer-backgrounding')
app.commandLine.appendSwitch('disable-background-timer-throttling')
import { existsSync, mkdirSync, appendFileSync, readFileSync, writeFileSync, chmodSync } from 'node:fs'
import { join } from 'node:path'
import { randomBytes } from 'node:crypto'
import { spawn } from 'node:child_process'
import { setTimeout as sleep } from 'node:timers/promises'
import { createServer } from 'node:net'
import http from 'node:http'
import { checkForUpdates } from './updater.mjs'

const BACKEND_PORT_PREFERRED = 3001
const BACKEND_PORT_MAX = 3010 /** tenta 3001..3010 antes de desistir */
let backendPort = BACKEND_PORT_PREFERRED
let appUrl = `http://127.0.0.1:${backendPort}`
let backendProcess = null

/**
 * Single-instance lock: evita 2 Electron abrindo 2 backends na mesma porta.
 * Se já houver instância, focamos ela e saímos.
 */
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
  process.exit(0)
}

app.on('second-instance', () => {
  const [existing] = BrowserWindow.getAllWindows().filter((w) => !w.isDestroyed())
  if (existing) {
    if (existing.isMinimized()) existing.restore()
    existing.focus()
  }
})

function getDataDir() {
  const dataDir = join(app.getPath('userData'), 'data')
  if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true })
  return dataDir
}

function getLogsDir() {
  const logsDir = join(app.getPath('userData'), 'logs')
  if (!existsSync(logsDir)) mkdirSync(logsDir, { recursive: true })
  return logsDir
}

/**
 * Garante que exista uma chave mestra de 32 bytes persistente em userData,
 * usada pelo backend (IGA_SECRETS_KEY) para criptografar segredos em repouso
 * — chaves de API do copiloto, credenciais de datasources etc. Cada instalação
 * tem a sua própria chave; nunca é embarcada no .exe. Se o arquivo for perdido,
 * todos os segredos criptografados ficam ilegíveis (usuário re-insere no app).
 */
function ensureSecretsKey() {
  const keyPath = join(getDataDir(), 'secrets.key')
  if (existsSync(keyPath)) {
    const content = readFileSync(keyPath, 'utf-8').trim()
    if (/^[a-f0-9]{64}$/i.test(content)) return content
    logToFile('warn', 'secrets.key corrompido — regenerando')
  }
  const hex = randomBytes(32).toString('hex')
  writeFileSync(keyPath, hex, { encoding: 'utf-8', mode: 0o600 })
  try {
    chmodSync(keyPath, 0o600)
  } catch {
    /* Windows: NTFS ACL gerenciada pelo userData do Electron */
  }
  logToFile('info', 'secrets.key gerado')
  return hex
}

/** Append a um arquivo de log diário — persiste erros para suporte remoto. */
function logToFile(level, message) {
  try {
    const date = new Date()
    const day = date.toISOString().slice(0, 10)
    const line = `[${date.toISOString()}] [${level}] ${message}\n`
    appendFileSync(join(getLogsDir(), `iga-${day}.log`), line, 'utf-8')
  } catch {
    /* se log falhar, não derruba o app */
  }
}

function resolveBackendRoot() {
  const packagedPath = join(process.resourcesPath, 'backend')
  if (existsSync(packagedPath)) return packagedPath
  const localPath = join(app.getAppPath(), 'backend')
  if (existsSync(localPath)) return localPath
  return packagedPath
}

function backendEntryPath() {
  return join(resolveBackendRoot(), 'dist', 'server.js')
}

/** Checa se a porta está livre (probe TCP). Retorna Promise<boolean>. */
function isPortFree(port) {
  return new Promise((resolve) => {
    const tester = createServer()
      .once('error', () => resolve(false))
      .once('listening', () => tester.close(() => resolve(true)))
      .listen(port, '127.0.0.1')
  })
}

async function findAvailablePort() {
  for (let p = BACKEND_PORT_PREFERRED; p <= BACKEND_PORT_MAX; p++) {
    // eslint-disable-next-line no-await-in-loop
    if (await isPortFree(p)) return p
  }
  return null
}

function waitForBackend(timeoutMs = 25000) {
  const startedAt = Date.now()
  return new Promise((resolve, reject) => {
    const tryConnect = () => {
      const req = http.get(`${appUrl}/health`, (res) => {
        res.resume()
        /** Aceita só 200 — qualquer outra coisa (503, 500) significa que o backend
         *  subiu porém em estado degradado, e seguir carregando mascara o erro. */
        if (res.statusCode === 200) {
          resolve(true)
          return
        }
        if (Date.now() - startedAt > timeoutMs) {
          reject(new Error(`Backend respondeu em ${appUrl}/health com status ${res.statusCode ?? 'desconhecido'}`))
          return
        }
        setTimeout(tryConnect, 600)
      })
      req.on('error', async () => {
        if (Date.now() - startedAt > timeoutMs) {
          reject(new Error(`Timeout ao iniciar backend local em ${appUrl}`))
          return
        }
        await sleep(600)
        tryConnect()
      })
    }
    tryConnect()
  })
}

async function startBackend() {
  const entry = backendEntryPath()
  const cwd = resolveBackendRoot()
  if (!existsSync(entry)) {
    throw new Error(`Backend não encontrado em: ${entry}`)
  }

  const port = await findAvailablePort()
  if (!port) {
    throw new Error(
      `Nenhuma porta livre entre ${BACKEND_PORT_PREFERRED} e ${BACKEND_PORT_MAX}. ` +
      `Feche o aplicativo que está usando essas portas e tente novamente.`,
    )
  }
  backendPort = port
  appUrl = `http://127.0.0.1:${backendPort}`
  logToFile('info', `Backend iniciando em ${appUrl}`)

  const backendRoot = resolveBackendRoot()
  const env = {
    ...process.env,
    ELECTRON_RUN_AS_NODE: '1',
    NODE_ENV: 'production',
    PORT: String(backendPort),
    PORT_MAX: String(backendPort + 9), // Permite fallback até +9 portas caso a reservada esteja em uso
    IGA_DATA_DIR: getDataDir(),
    FRONTEND_URL: appUrl,
    IGA_SECRETS_KEY: ensureSecretsKey(),
    SERVE_FRONTEND_DIR: join(backendRoot, 'front-end-dist'),
  }
  /** Credenciais padrão fixas (override por env do sistema).
   *  Decisão de produto: cliente final NÃO deve ter que ler FIRST_LOGIN.txt nem
   *  trocar senha no 1º login. Sempre que o admin é criado pelo seed, vem com
   *  estas credenciais e `mustChangePassword: false`. */
  env.ADMIN_DEFAULT_EMAIL = process.env.ADMIN_DEFAULT_EMAIL ?? 'iga@iga.com'
  env.ADMIN_DEFAULT_PASSWORD = process.env.ADMIN_DEFAULT_PASSWORD ?? 'IgaGestao@2026!'

  backendProcess = spawn(process.execPath, [entry], {
    cwd,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  backendProcess.stdout?.on('data', (chunk) => {
    const msg = chunk.toString().trim()
    console.log(`[backend] ${msg}`)
    // Captura porta real caso o backend faça fallback (ex: "http://localhost:3002")
    const portMatch = msg.match(/http:\/\/localhost:(\d+)/)
    if (portMatch) {
      const realPort = Number(portMatch[1])
      if (realPort !== backendPort) {
        logToFile('warn', `Backend usou porta ${realPort} em vez de ${backendPort} — ajustando`)
        backendPort = realPort
        appUrl = `http://127.0.0.1:${backendPort}`
      }
    }
    logToFile('backend', msg)
  })
  backendProcess.stderr?.on('data', (chunk) => {
    const msg = chunk.toString().trim()
    console.error(`[backend] ${msg}`)
    logToFile('backend-err', msg)
  })
  backendProcess.on('exit', (code) => {
    const msg = `backend finalizado com código ${code}`
    console.log(`[backend] ${msg}`)
    logToFile('info', msg)
  })

  await waitForBackend()
}

async function createMainWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 700,
    autoHideMenuBar: true,
    show: false,
    /** `backgroundColor` evita o flash branco enquanto o renderer carrega.
     *  NÃO usar `paintWhenInitiallyHidden:false` aqui — ele bloqueia o evento
     *  `ready-to-show`, que é justamente o gatilho do `win.show()` abaixo. */
    backgroundColor: '#0f4f78',
    webPreferences: {
      contextIsolation: true,
      sandbox: false,
      /** Produção: DevTools off. Usuário avançado pode reabilitar via IGA_DEVTOOLS=1. */
      devTools: process.env.IGA_DEVTOOLS === '1' || !app.isPackaged,
      /** Mantém renderer ativo em background pra evitar atrasos no retorno do alt-tab. */
      backgroundThrottling: false,
      /** Cache de disco do Chromium: reusa SPA bundles entre aberturas (boot mais rápido). */
      enableWebSQL: false,
    },
  })
  let shown = false
  const revealWindow = () => {
    if (shown || win.isDestroyed()) return
    shown = true
    win.show()
  }

  win.once('ready-to-show', revealWindow)
  win.webContents.once('did-finish-load', () => {
    logToFile('info', 'Renderer carregado (did-finish-load)')
    revealWindow()
  })
  win.webContents.on('did-fail-load', (_event, code, description, validatedURL) => {
    const msg = `Falha ao carregar UI (code=${code}): ${description} em ${validatedURL}`
    logToFile('error', msg)
  })
  win.webContents.on('render-process-gone', (_event, details) => {
    logToFile('error', `Renderer finalizado: reason=${details?.reason ?? 'desconhecido'}`)
  })

  await win.loadURL(appUrl)
  setTimeout(() => {
    if (!shown) {
      logToFile('warn', 'Fallback de exibição da janela após timeout')
      revealWindow()
    }
  }, 8000)
  return win
}

async function showFatalError(message) {
  logToFile('error', message)
  /** Dialog síncrono — bloqueia até o usuário responder, garantindo que a mensagem seja vista. */
  const choice = await dialog.showMessageBox({
    type: 'error',
    title: 'Erro ao iniciar IGA Gestao',
    message: 'Não foi possível iniciar o aplicativo.',
    detail: `${message}\n\nLogs salvos em:\n${getLogsDir()}`,
    buttons: ['Abrir pasta de logs', 'Fechar'],
    defaultId: 1,
    cancelId: 1,
  })
  if (choice.response === 0) {
    shell.openPath(getLogsDir()).catch(() => {})
  }
}

async function bootstrap() {
  const splashOpenedAt = Date.now()
  const splash = new BrowserWindow({
    width: 400,
    height: 400,
    frame: false,
    resizable: false,
    transparent: true,
    alwaysOnTop: true,
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, sandbox: true },
  })
  await splash.loadFile(join(app.getAppPath(), 'splash.html'))

  try {
    await startBackend()
    await createMainWindow()
    const elapsed = Date.now() - splashOpenedAt
    if (elapsed < 1200) await sleep(1200 - elapsed)
    if (!splash.isDestroyed()) splash.close()
    /** Check-for-updates fire-and-forget com delay de 30s para não competir com boot. */
    setTimeout(() => {
      checkForUpdates(app.getVersion(), logToFile).catch((err) => {
        logToFile('warn', `update check falhou: ${err?.message ?? err}`)
      })
    }, 30_000)
  } catch (error) {
    if (!splash.isDestroyed()) splash.close()
    await showFatalError(error instanceof Error ? error.message : String(error))
    app.quit()
  }
}

app.whenReady().then(bootstrap)

app.on('window-all-closed', () => {
  app.quit()
})

app.on('before-quit', () => {
  if (backendProcess && !backendProcess.killed) {
    backendProcess.kill()
  }
})

/** Última linha de defesa — se algum throw vazar até aqui, pelo menos fica em log. */
process.on('uncaughtException', (err) => {
  logToFile('fatal', `uncaughtException: ${err?.stack ?? err?.message ?? err}`)
})
process.on('unhandledRejection', (reason) => {
  logToFile('fatal', `unhandledRejection: ${reason instanceof Error ? reason.stack : String(reason)}`)
})
