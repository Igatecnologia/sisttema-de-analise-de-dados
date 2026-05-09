import 'dotenv/config'
/**
 * Sentry init DEVE vir antes de qualquer outro import que possa lançar
 * erros — assim a primeira exceção do processo já chega ao Sentry.
 */
import { initSentry, Sentry } from './observability/sentry.js'
initSentry()

import { createApp } from './app.js'
import { assertEnvValid } from './envValidation.js'

/** Em produção, aborta o boot se faltarem env vars críticas. No-op em dev. */
assertEnvValid()

const startSchedulers =
  process.env.IGA_PROCESS_ROLE !== 'web' && process.env.START_SCHEDULERS !== '0'
const app = createApp({ startSchedulers })
const PREFERRED_PORT = Number(process.env.PORT ?? 3000)
const MAX_PORT = Number(process.env.PORT_MAX ?? PREFERRED_PORT + 20)

function startServer(port: number) {
  const startedServer = app.listen(port, () => {
    console.log(`[IGA Backend] http://localhost:${port}`)
  })
  startedServer.on('error', (error: NodeJS.ErrnoException) => {
    if (error.code === 'EADDRINUSE' && port < MAX_PORT) {
      console.warn(`[IGA Backend] porta ${port} em uso, tentando ${port + 1}...`)
      server = startServer(port + 1)
      return
    }
    throw error
  })
  return startedServer
}

// Iniciar servidor com fallback de porta e graceful shutdown
let server = startServer(PREFERRED_PORT)

function shutdown(signal: string) {
  console.log(`[IGA Backend] ${signal} — encerrando...`)
  /** Garante que eventos pendentes do Sentry sejam enviados antes do exit. */
  Sentry.close(2000).finally(() => {
    server.close(() => process.exit(0))
    setTimeout(() => process.exit(1), 10_000)
  })
}
process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))

/**
 * Captura exceções que escapam de qualquer middleware/handler.
 * Sem isso, o processo Node morre silencioso em prod (sem stack no Sentry).
 */
process.on('uncaughtException', (err) => {
  Sentry.captureException(err)
  console.error('[IGA Backend] uncaughtException:', err)
  /** Política conservadora: deixa o process manager (Render) reiniciar. */
  Sentry.close(2000).finally(() => process.exit(1))
})

process.on('unhandledRejection', (reason) => {
  Sentry.captureException(reason instanceof Error ? reason : new Error(String(reason)))
  console.error('[IGA Backend] unhandledRejection:', reason)
})
