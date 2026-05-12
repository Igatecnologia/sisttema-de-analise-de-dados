import rateLimit, { ipKeyGenerator, type Options } from 'express-rate-limit'
import RedisStore from 'rate-limit-redis'
import { getRedisClient, hasRedisConfig } from '../services/redis.js'

/**
 * Default keyGenerator que normaliza o IP via `ipKeyGenerator` (IPv6-safe).
 * O Fly.io entrega clientes via IPv6 — usar `req.ip` direto faz o express-rate-limit
 * v7+ rejeitar com ValidationError, deixando a request travada por 30s no proxy.
 * Chamadores podem sobrescrever o keyGenerator (ex.: bucket por email no /forgot).
 */
function defaultIpKeyGenerator(req: import('express').Request) {
  return ipKeyGenerator(req.ip ?? req.socket.remoteAddress ?? 'unknown')
}

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
  const keyGenerator = rest.keyGenerator ?? defaultIpKeyGenerator
  if (hasRedisConfig()) {
    try {
      const client = getRedisClient()
      return rateLimit({
        ...rest,
        keyGenerator,
        standardHeaders: rest.standardHeaders ?? true,
        legacyHeaders: rest.legacyHeaders ?? false,
        store: new RedisStore({
          prefix: `iga:rl:${namespace ?? 'default'}:`,
          /** Async ioredis -> rate-limit-redis spec. */
          sendCommand: (async (...args: string[]): Promise<unknown> => {
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
    keyGenerator,
    standardHeaders: rest.standardHeaders ?? true,
    legacyHeaders: rest.legacyHeaders ?? false,
  })
}
