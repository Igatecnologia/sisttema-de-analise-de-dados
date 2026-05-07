import rateLimit, { type Options } from 'express-rate-limit'
import RedisStore from 'rate-limit-redis'
import { getRedisClient, hasRedisConfig } from '../services/redis.js'

/**
 * Wrapper de express-rate-limit que usa rate-limit-redis quando REDIS_URL esta
 * setado. Sem Redis, cai para o memory store padrao.
 *
 * Sprint 6 sobe 2+ app servers — memory store nao compartilha contadores entre
 * processos, entao o limiter eh enganado por round-robin. Redis store resolve.
 *
 * Uso:
 *   const loginLimiter = redisRateLimit({
 *     namespace: 'auth:login',  // chave Redis
 *     windowMs: 15 * 60_000,
 *     max: 20,
 *   })
 */
type RedisRateLimitOptions = Partial<Options> & {
  /** Prefixo da chave Redis. Default: 'iga:rl:'. */
  namespace?: string
  windowMs: number
  max: number
}

export function redisRateLimit(opts: RedisRateLimitOptions) {
  const { namespace, ...rest } = opts
  if (hasRedisConfig()) {
    try {
      const client = getRedisClient()
      return rateLimit({
        ...rest,
        standardHeaders: rest.standardHeaders ?? true,
        legacyHeaders: rest.legacyHeaders ?? false,
        store: new RedisStore({
          prefix: `iga:rl:${namespace ?? 'default'}:`,
          /** Async ioredis -> rate-limit-redis spec. */
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          sendCommand: (async (...args: string[]): Promise<any> => {
            if (client.status === 'wait') await client.connect()
            return client.call(args[0], ...args.slice(1))
          }) as never,
        }),
      })
    } catch {
      /** Falha ao conectar Redis: fallback para memory. */
    }
  }
  return rateLimit({
    ...rest,
    standardHeaders: rest.standardHeaders ?? true,
    legacyHeaders: rest.legacyHeaders ?? false,
  })
}
