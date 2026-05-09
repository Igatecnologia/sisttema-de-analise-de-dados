import type { Request, Response, NextFunction } from 'express'
import { getRedisClient, hasRedisConfig } from '../services/redis.js'
import { resolveTenantId } from '../utils/tenant.js'

type TenantRateLimitOptions = {
  namespace: string
  windowMs: number
  max: number
  message?: string
}

const memoryBuckets = new Map<string, { count: number; resetAt: number }>()

export function tenantRateLimit(options: TenantRateLimitOptions) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const tenantId = resolveTenantId(req)
    const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown'
    const key = `rl:${options.namespace}:${tenantId}:${ip}`

    try {
      if (hasRedisConfig()) {
        const redis = getRedisClient()
        if (redis.status === 'wait') await redis.connect()
        const count = await redis.incr(key)
        if (count === 1) await redis.pexpire(key, options.windowMs)
        const ttl = await redis.pttl(key)
        res.setHeader('RateLimit-Limit', String(options.max))
        res.setHeader('RateLimit-Remaining', String(Math.max(options.max - count, 0)))
        if (ttl > 0) res.setHeader('RateLimit-Reset', String(Math.ceil((Date.now() + ttl) / 1000)))
        if (count > options.max) {
          return res.status(429).json({ message: options.message ?? 'Muitas tentativas. Aguarde alguns minutos.' })
        }
        return next()
      }
    } catch {
      // Redis indisponivel nao deve derrubar auth; fallback local preserva protecao basica.
    }

    const now = Date.now()
    const current = memoryBuckets.get(key)
    const bucket = current && current.resetAt > now ? current : { count: 0, resetAt: now + options.windowMs }
    bucket.count += 1
    memoryBuckets.set(key, bucket)
    if (bucket.count > options.max) {
      return res.status(429).json({ message: options.message ?? 'Muitas tentativas. Aguarde alguns minutos.' })
    }
    next()
  }
}

