/**
 * P2-06 (audit 2026-05-12): cache de respostas LLM por hash(prompt+context).
 *
 * Corta 20-30% dos custos AI sem perder qualidade: perguntas idênticas
 * (ex: "Vendas do mês") dentro de janela curta retornam a mesma resposta.
 *
 * Estratégia:
 *  - Redis com TTL 1h se REDIS_URL configurado
 *  - Fallback in-memory LRU 200 entradas pra dev/SQLite
 *  - Chave: SHA-256 de `tenantId|userId|userRole|provider|model|prompt|systemContextHash`
 *  - Valor: { text, tokensIn, tokensOut, provider, model, cachedAt }
 *  - Hit não chama provider — economia direta de tokens
 */
import { createHash } from 'node:crypto'
import { getRedisClient, hasRedisConfig } from '../redis.js'

export type CachedResponse = {
  text: string
  tokensIn: number
  tokensOut: number
  provider: string
  model: string
  cachedAt: string
}

const CACHE_TTL_SECONDS = 60 * 60 // 1 hora
const MEMORY_CAPACITY = 200

/** LRU simples in-memory (fallback). */
class LruCache<K, V> {
  private map = new Map<K, V>()
  constructor(private capacity: number) {}
  get(key: K): V | undefined {
    const v = this.map.get(key)
    if (v !== undefined) {
      this.map.delete(key)
      this.map.set(key, v)
    }
    return v
  }
  set(key: K, value: V) {
    if (this.map.has(key)) this.map.delete(key)
    else if (this.map.size >= this.capacity) {
      const first = this.map.keys().next().value
      if (first !== undefined) this.map.delete(first as K)
    }
    this.map.set(key, value)
  }
  size(): number { return this.map.size }
}

const memoryCache = new LruCache<string, { value: CachedResponse; expiresAt: number }>(MEMORY_CAPACITY)
const stats = { hits: 0, misses: 0, errors: 0 }

export type CacheKeyInput = {
  tenantId: string
  userId: string
  userRole: string
  provider: string
  model: string
  prompt: string
  /** Hash de contexto adicional (ex: data atual em pt-BR, system prompt). */
  contextHash?: string
}

export function computeCacheKey(input: CacheKeyInput): string {
  const raw = [
    input.tenantId,
    input.userId,
    input.userRole,
    input.provider,
    input.model,
    input.contextHash ?? '',
    /** Normaliza prompt: lowercase + trim de espaços extras (mesma pergunta com case
     *  diferente bate o mesmo cache). NÃO normaliza pontuação pra preservar nuances. */
    input.prompt.trim().toLowerCase().replace(/\s+/g, ' '),
  ].join('|')
  return `iga:ai:cache:${createHash('sha256').update(raw).digest('hex').slice(0, 32)}`
}

async function getFromRedis(key: string): Promise<CachedResponse | null> {
  try {
    const client = getRedisClient()
    if (client.status === 'wait') await client.connect()
    const raw = await client.get(key)
    if (!raw) return null
    return JSON.parse(raw) as CachedResponse
  } catch {
    stats.errors++
    return null
  }
}

async function setRedis(key: string, value: CachedResponse): Promise<void> {
  try {
    const client = getRedisClient()
    if (client.status === 'wait') await client.connect()
    await client.set(key, JSON.stringify(value), 'EX', CACHE_TTL_SECONDS)
  } catch {
    stats.errors++
  }
}

export async function getCachedResponse(input: CacheKeyInput): Promise<CachedResponse | null> {
  const key = computeCacheKey(input)
  if (hasRedisConfig()) {
    const hit = await getFromRedis(key)
    if (hit) { stats.hits++; return hit }
  } else {
    const entry = memoryCache.get(key)
    if (entry && entry.expiresAt > Date.now()) {
      stats.hits++
      return entry.value
    }
  }
  stats.misses++
  return null
}

export async function setCachedResponse(input: CacheKeyInput, value: CachedResponse): Promise<void> {
  const key = computeCacheKey(input)
  if (hasRedisConfig()) {
    await setRedis(key, value)
  } else {
    memoryCache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_SECONDS * 1000 })
  }
}

export function getCacheStats(): {
  hits: number
  misses: number
  errors: number
  hitRate: number
  memorySize: number
} {
  const total = stats.hits + stats.misses
  return {
    hits: stats.hits,
    misses: stats.misses,
    errors: stats.errors,
    hitRate: total === 0 ? 0 : Math.round((stats.hits / total) * 1000) / 10,
    memorySize: memoryCache.size(),
  }
}

export function resetCacheStats() {
  stats.hits = 0
  stats.misses = 0
  stats.errors = 0
}
