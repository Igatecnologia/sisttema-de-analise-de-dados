import { Queue, Worker, type Job } from 'bullmq'
import { runBackup } from './dbBackup.js'
import { runCopilotRetentionOnce } from './copilotRetention.js'
import { runScheduledReportsOnce } from './scheduledReports.js'
import { runWarmCacheOnce } from './warmCache.js'
import { runAlertsEngineOnce } from '../routes/alerts.js'
import { runTrialLifecycleOnce } from './trialLifecycle.js'
import { getBullRedisConnection, hasRedisConfig } from '../services/redis.js'

const QUEUE_NAME = 'iga-background-jobs'

type BackgroundJobName =
  | 'warmCache'
  | 'dbBackup'
  | 'copilotRetention'
  | 'scheduledReports'
  | 'alertsEngine'
  | 'trialLifecycle'

type BackgroundJobDefinition = {
  name: BackgroundJobName
  everyMs: number
  run: () => void | Promise<void>
}

const JOBS: BackgroundJobDefinition[] = [
  { name: 'warmCache', everyMs: 12 * 60_000, run: runWarmCacheOnce },
  { name: 'dbBackup', everyMs: 6 * 60 * 60_000, run: () => { runBackup() } },
  { name: 'copilotRetention', everyMs: 24 * 60 * 60_000, run: runCopilotRetentionOnce },
  { name: 'scheduledReports', everyMs: 60_000, run: runScheduledReportsOnce },
  { name: 'alertsEngine', everyMs: 5 * 60_000, run: runAlertsEngineOnce },
  { name: 'trialLifecycle', everyMs: 6 * 60 * 60_000, run: runTrialLifecycleOnce },
]

function getJobDefinition(name: string): BackgroundJobDefinition {
  const def = JOBS.find((job) => job.name === name)
  if (!def) throw new Error(`Job desconhecido: ${name}`)
  return def
}

async function processBackgroundJob(job: Job) {
  const def = getJobDefinition(job.name)
  await def.run()
}

export async function startBackgroundJobQueue() {
  if (!hasRedisConfig()) return null

  const connection = getBullRedisConnection()
  const queue = new Queue(QUEUE_NAME, { connection })
  const worker = new Worker(QUEUE_NAME, processBackgroundJob, {
    connection,
    concurrency: Number(process.env.BULLMQ_WORKER_CONCURRENCY ?? 2),
  })

  worker.on('failed', (job, err) => {
    console.error(`[IGA][QUEUE] Job ${job?.name ?? 'unknown'} falhou:`, err.message)
  })

  for (const job of JOBS) {
    await queue.add(
      job.name,
      {},
      {
        jobId: `repeat:${job.name}`,
        repeat: { every: job.everyMs },
        removeOnComplete: 20,
        removeOnFail: 50,
      },
    )
    await queue.add(
      job.name,
      {},
      {
        delay: 5_000,
        removeOnComplete: 20,
        removeOnFail: 50,
      },
    )
  }

  await worker.waitUntilReady()
  console.log('[IGA][QUEUE] BullMQ ativo', {
    queue: QUEUE_NAME,
    jobs: JOBS.map((job) => job.name),
  })

  return { queue, worker }
}
