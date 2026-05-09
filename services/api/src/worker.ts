import 'dotenv/config'
import { getProxyOperationalSnapshot } from './routes/proxy.js'
import { startAlertsEngine } from './routes/alerts.js'
import { startScheduledReportsJob } from './jobs/scheduledReports.js'
import { startBackupScheduler } from './jobs/dbBackup.js'
import { startCopilotRetentionJob } from './jobs/copilotRetention.js'
import { startWarmCacheJob } from './jobs/warmCache.js'
import { startTrialLifecycleJob } from './jobs/trialLifecycle.js'
import { startBackgroundJobQueue } from './jobs/backgroundQueue.js'
import { readAll as ensureDataSourcesFile } from './storage.js'
import { readAllUsers as ensureUsersFile } from './userStorage.js'
import { seedDefaultAdmin } from './seedAdmin.js'
import { seedDefaultDataSources } from './seedDataSources.js'

ensureUsersFile()
ensureDataSourcesFile()
seedDefaultAdmin()
seedDefaultDataSources()

const queueRuntime = await startBackgroundJobQueue()
if (!queueRuntime) {
  console.warn('[IGA Worker] REDIS_URL ausente; usando schedulers em memoria como fallback.')
  startAlertsEngine()
  startScheduledReportsJob()
  startBackupScheduler()
  startCopilotRetentionJob()
  startWarmCacheJob()
  startTrialLifecycleJob()
}

console.log('[IGA Worker] jobs iniciados', {
  proxy: getProxyOperationalSnapshot().stats,
  queue: queueRuntime ? 'bullmq' : 'memory',
})

async function shutdown(signal: string) {
  console.log(`[IGA Worker] ${signal} - encerrando...`)
  if (queueRuntime) {
    await queueRuntime.worker.close()
    await queueRuntime.queue.close()
  }
  process.exit(0)
}

process.on('SIGTERM', () => { void shutdown('SIGTERM') })
process.on('SIGINT', () => { void shutdown('SIGINT') })
