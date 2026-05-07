/**
 * Cache compartilhado com Redis + fallback em memoria local.
 *
 * Padrao igual ao usado em proxy.ts (token cache + response cache):
 * - Quando REDIS_URL configurada, usa Redis (chave + TTL).
 * - Se Redis cair em runtime, fallback transparente para Map em memoria
 *   (LRU simples, descarta mais antigas).
 * - Quando Redis nao configurada, usa so o Map local (modo dev/single-node).
 *
 * Uso:
 *   const cache = createSharedCache<EstoqueRow[]>({
 *     namespace: 'erp:estoque',
 *     ttlMs: 15 * 60_000,
 *     maxLocalEntries: 64,
 *   })
 *
 *   const cached = await cache.get(key)
 *   if (cached) return cached
 *   const fresh = await fetchData()
 *   await cache.set(key, fresh)
 */

import { getRedisClient, hasRedisConfig } from './redis.js'

type Entry<T> = { value: T; expiresAt: number }

export type SharedCacheOptions = {
  /** Prefixo unico das chaves Redis (ex: `erp:estoque`). Final fica `iga:cache:<namespace>:<key>`. */
  namespace: string
  /** TTL em milissegundos. */
  ttlMs: number
  /** Limite de entradas no cache local (LRU). Default 128. */
  maxLocalEntries?: number
}

export type SharedCache<T> = {
  get(key: string): Promise<T | null>
  set(key: string, value: T): Promise<void>
  invalidate(key: string): Promise<void>
  /** Apenas para testes. */
  _localSize(): number
}

export function createSharedCache<T>(options: SharedCacheOptions): SharedCache<T> {
  const { namespace, ttlMs } = options
  const maxLocalEntries = options.maxLocalEntries ?? 128
  const local = new Map<string, Entry<T>>()
  const ttlSeconds = Math.max(1, Math.ceil(ttlMs / 1000))

  function redisKey(key: string): string {
    return `iga:cache:${namespace}:${key}`
  }

  function readLocal(key: string): T | null {
    const entry = local.get(key)
    if (!entry) return null
    if (Date.now() >= entry.expiresAt) {
      local.delete(key)
      return null
    }
    // LRU touch
    local.delete(key)
    local.set(key, entry)
    return entry.value
  }

  function writeLocal(key: string, value: T) {
    local.set(key, { value, expiresAt: Date.now() + ttlMs })
    while (local.size > maxLocalEntries) {
      const oldestKey = local.keys().next().value
      if (!oldestKey) break
      local.delete(oldestKey)
    }
  }

  return {
    async get(key: string): Promise<T | null> {
      if (hasRedisConfig()) {
        try {
          const client = getRedisClient()
          if (client.status === 'wait') await client.connect()
          const raw = await client.get(redisKey(key))
          if (raw) return JSON.parse(raw) as T
        } catch {
          // Redis indisponivel — fallback transparente para memoria.
        }
      }
      return readLocal(key)
    },

    async set(key: string, value: T): Promise<void> {
      if (hasRedisConfig()) {
        try {
          const client = getRedisClient()
          if (client.status === 'wait') await client.connect()
          await client.set(redisKey(key), JSON.stringify(value), 'EX', ttlSeconds)
          return
        } catch {
          // Fallback em memoria.
        }
      }
      writeLocal(key, value)
    },

    async invalidate(key: string): Promise<void> {
      local.delete(key)
      if (hasRedisConfig()) {
        try {
          const client = getRedisClient()
          if (client.status === 'wait') await client.connect()
          await client.del(redisKey(key))
        } catch {
          // Best-effort.
        }
      }
    },

    _localSize(): number {
      return local.size
    },
  }
}
