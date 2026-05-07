import type { Request, Response, NextFunction } from 'express'

/**
 * Defesa contra prototype pollution: rejeita JSON bodies que contenham
 * `__proto__`, `constructor` ou `prototype` em qualquer profundidade.
 *
 * Atacante que envia `{"__proto__":{"isAdmin":true}}` num parser permissivo
 * pode injetar propriedades em Object.prototype. Express+JSON.parse v18+ ja
 * neutraliza `__proto__` no parser, mas (a) nao protege `constructor.prototype`,
 * (b) nao cobre payloads parseados manualmente. Bloquear na borda eh defesa em
 * profundidade.
 */
const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype'])
const MAX_DEPTH = 12

function hasForbiddenKey(value: unknown, depth: number): boolean {
  if (depth >= MAX_DEPTH) return false
  if (value == null || typeof value !== 'object') return false
  if (Array.isArray(value)) {
    return value.some((v) => hasForbiddenKey(v, depth + 1))
  }
  for (const key of Object.keys(value as Record<string, unknown>)) {
    if (FORBIDDEN_KEYS.has(key)) return true
    const nested = (value as Record<string, unknown>)[key]
    if (hasForbiddenKey(nested, depth + 1)) return true
  }
  return false
}

export function blockPrototypePollution(req: Request, res: Response, next: NextFunction) {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return next()
  if (!req.body || typeof req.body !== 'object') return next()
  if (hasForbiddenKey(req.body, 0)) {
    return res.status(400).json({ message: 'Payload contem chaves nao permitidas.' })
  }
  next()
}
