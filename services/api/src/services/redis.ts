import { Redis } from 'ioredis'

let redis: Redis | null = null
let bullRedis: Redis | null = null

export function hasRedisConfig(): boolean {
  return Boolean(process.env.REDIS_URL?.trim())
}

export function getRedisClient(): Redis {
  const url = process.env.REDIS_URL?.trim()
  if (!url) {
    throw new Error('REDIS_URL nao configurada')
  }
  if (!redis) {
    redis = new Redis(url, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      enableReadyCheck: true,
      retryStrategy: (times) => Math.min(times * 200, 5_000),
    })
  }
  return redis
}

export function getBullRedisConnection(): Redis {
  const url = process.env.REDIS_URL?.trim()
  if (!url) {
    throw new Error('REDIS_URL nao configurada')
  }
  if (!bullRedis) {
    bullRedis = new Redis(url, {
      maxRetriesPerRequest: null,
      lazyConnect: true,
      enableReadyCheck: true,
      retryStrategy: (times) => Math.min(times * 200, 5_000),
    })
  }
  return bullRedis
}

export async function checkRedisHealth(): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!hasRedisConfig()) return { ok: false, message: 'REDIS_URL ausente' }
  try {
    const client = getRedisClient()
    if (client.status === 'wait') await client.connect()
    const pong = await client.ping()
    return pong === 'PONG' ? { ok: true } : { ok: false, message: `PING retornou ${pong}` }
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Falha ao conectar no Redis' }
  }
}

export async function closeRedisClient() {
  if (!redis) return
  redis.disconnect()
  redis = null
  if (bullRedis) {
    bullRedis.disconnect()
    bullRedis = null
  }
}
