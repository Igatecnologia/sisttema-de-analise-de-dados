/**
 * Testes do sharedCache — foco no comportamento de failover.
 *
 * Cobre:
 * - Hit/miss basico em modo memoria pura (sem REDIS_URL).
 * - Expiracao por TTL.
 * - LRU: descarta entrada mais antiga ao exceder o limite.
 * - Failover: quando Redis cai (get/set lancam excecao), cache continua
 *   funcionando via memoria local sem propagar erro.
 * - invalidate remove entrada local.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

const ORIGINAL_REDIS_URL = process.env.REDIS_URL

afterEach(() => {
  if (ORIGINAL_REDIS_URL == null) {
    delete process.env.REDIS_URL
  } else {
    process.env.REDIS_URL = ORIGINAL_REDIS_URL
  }
  vi.resetModules()
  vi.restoreAllMocks()
})

describe('sharedCache — modo memoria (REDIS_URL ausente)', () => {
  beforeEach(() => {
    delete process.env.REDIS_URL
    vi.resetModules()
  })

  it('grava e le um valor', async () => {
    const { createSharedCache } = await import('./sharedCache.js')
    const cache = createSharedCache<string>({ namespace: 'test:basic', ttlMs: 1_000 })

    expect(await cache.get('k1')).toBeNull()
    await cache.set('k1', 'valor-1')
    expect(await cache.get('k1')).toBe('valor-1')
  })

  it('expira apos o TTL', async () => {
    vi.useFakeTimers()
    const { createSharedCache } = await import('./sharedCache.js')
    const cache = createSharedCache<string>({ namespace: 'test:ttl', ttlMs: 1_000 })

    await cache.set('k', 'valor')
    expect(await cache.get('k')).toBe('valor')

    vi.advanceTimersByTime(1_500)
    expect(await cache.get('k')).toBeNull()

    vi.useRealTimers()
  })

  it('LRU descarta entrada mais antiga ao exceder maxLocalEntries', async () => {
    const { createSharedCache } = await import('./sharedCache.js')
    const cache = createSharedCache<number>({
      namespace: 'test:lru',
      ttlMs: 60_000,
      maxLocalEntries: 3,
    })

    await cache.set('a', 1)
    await cache.set('b', 2)
    await cache.set('c', 3)
    expect(cache._localSize()).toBe(3)

    await cache.set('d', 4)
    expect(cache._localSize()).toBe(3)
    expect(await cache.get('a')).toBeNull() // mais antigo, descartado
    expect(await cache.get('d')).toBe(4)
  })

  it('LRU touch: get move entrada para o final', async () => {
    const { createSharedCache } = await import('./sharedCache.js')
    const cache = createSharedCache<number>({
      namespace: 'test:lru-touch',
      ttlMs: 60_000,
      maxLocalEntries: 3,
    })

    await cache.set('a', 1)
    await cache.set('b', 2)
    await cache.set('c', 3)

    // Acessa 'a' — vira o mais recente, 'b' passa a ser o mais antigo
    await cache.get('a')

    // Adiciona 'd' — deve descartar 'b' (mais antigo apos o touch)
    await cache.set('d', 4)
    expect(await cache.get('a')).toBe(1)
    expect(await cache.get('b')).toBeNull()
    expect(await cache.get('c')).toBe(3)
    expect(await cache.get('d')).toBe(4)
  })

  it('invalidate remove entrada', async () => {
    const { createSharedCache } = await import('./sharedCache.js')
    const cache = createSharedCache<string>({ namespace: 'test:inv', ttlMs: 60_000 })

    await cache.set('k', 'v')
    expect(await cache.get('k')).toBe('v')
    await cache.invalidate('k')
    expect(await cache.get('k')).toBeNull()
  })

  it('namespaces sao isolados', async () => {
    const { createSharedCache } = await import('./sharedCache.js')
    const cacheA = createSharedCache<string>({ namespace: 'ns:a', ttlMs: 60_000 })
    const cacheB = createSharedCache<string>({ namespace: 'ns:b', ttlMs: 60_000 })

    await cacheA.set('mesma-chave', 'valor-a')
    await cacheB.set('mesma-chave', 'valor-b')

    expect(await cacheA.get('mesma-chave')).toBe('valor-a')
    expect(await cacheB.get('mesma-chave')).toBe('valor-b')
  })
})

describe('sharedCache — failover quando Redis falha', () => {
  beforeEach(() => {
    process.env.REDIS_URL = 'redis://localhost:6399' // porta invalida proposital
    vi.resetModules()
  })

  it('get nao propaga erro quando Redis lanca — fallback para memoria', async () => {
    vi.doMock('./redis.js', () => ({
      hasRedisConfig: () => true,
      getRedisClient: () => ({
        status: 'ready',
        get: vi.fn().mockRejectedValue(new Error('Connection refused')),
        set: vi.fn().mockRejectedValue(new Error('Connection refused')),
        del: vi.fn().mockRejectedValue(new Error('Connection refused')),
        connect: vi.fn(),
      }),
    }))

    const { createSharedCache } = await import('./sharedCache.js')
    const cache = createSharedCache<string>({ namespace: 'test:failover', ttlMs: 60_000 })

    // get nao deve lancar — cai pra memoria local
    await expect(cache.get('inexistente')).resolves.toBeNull()
  })

  it('set nao propaga erro quando Redis lanca — grava em memoria', async () => {
    vi.doMock('./redis.js', () => ({
      hasRedisConfig: () => true,
      getRedisClient: () => ({
        status: 'ready',
        get: vi.fn().mockRejectedValue(new Error('Connection refused')),
        set: vi.fn().mockRejectedValue(new Error('Connection refused')),
        del: vi.fn().mockRejectedValue(new Error('Connection refused')),
        connect: vi.fn(),
      }),
    }))

    const { createSharedCache } = await import('./sharedCache.js')
    const cache = createSharedCache<string>({ namespace: 'test:set-failover', ttlMs: 60_000 })

    // set nao deve lancar
    await expect(cache.set('k', 'v')).resolves.toBeUndefined()
    // valor deve estar disponivel no cache local
    expect(await cache.get('k')).toBe('v')
  })

  it('Redis disponivel: usa Redis e ignora memoria local', async () => {
    const store = new Map<string, string>()
    vi.doMock('./redis.js', () => ({
      hasRedisConfig: () => true,
      getRedisClient: () => ({
        status: 'ready',
        get: vi.fn(async (key: string) => store.get(key) ?? null),
        set: vi.fn(async (key: string, value: string) => {
          store.set(key, value)
          return 'OK'
        }),
        del: vi.fn(async (key: string) => {
          store.delete(key)
          return 1
        }),
        connect: vi.fn(),
      }),
    }))

    const { createSharedCache } = await import('./sharedCache.js')
    const cache = createSharedCache<{ name: string }>({
      namespace: 'test:redis-ok',
      ttlMs: 60_000,
    })

    await cache.set('k', { name: 'maria' })
    expect(store.size).toBe(1)
    expect(store.get('iga:cache:test:redis-ok:k')).toBe('{"name":"maria"}')

    const value = await cache.get('k')
    expect(value).toEqual({ name: 'maria' })
    // Cache local NAO foi populado quando Redis funcionou
    expect(cache._localSize()).toBe(0)
  })

  it('Redis cai no meio da operacao: nova chamada usa memoria sem ruido', async () => {
    let redisAlive = true
    vi.doMock('./redis.js', () => ({
      hasRedisConfig: () => true,
      getRedisClient: () => ({
        status: 'ready',
        get: vi.fn(async () => {
          if (!redisAlive) throw new Error('ECONNREFUSED')
          return null
        }),
        set: vi.fn(async () => {
          if (!redisAlive) throw new Error('ECONNREFUSED')
          return 'OK'
        }),
        del: vi.fn(async () => {
          if (!redisAlive) throw new Error('ECONNREFUSED')
          return 1
        }),
        connect: vi.fn(),
      }),
    }))

    const { createSharedCache } = await import('./sharedCache.js')
    const cache = createSharedCache<string>({ namespace: 'test:flap', ttlMs: 60_000 })

    // 1. Redis vivo: set retorna ok
    await cache.set('k', 'antes')
    // 2. Simula Redis caindo
    redisAlive = false
    // 3. set continua funcionando (fallback memoria)
    await expect(cache.set('k', 'depois')).resolves.toBeUndefined()
    // 4. Valor agora vem do fallback local
    expect(await cache.get('k')).toBe('depois')
    // 5. Redis volta — nada quebra
    redisAlive = true
    await expect(cache.set('k2', 'recovered')).resolves.toBeUndefined()
  })
})
