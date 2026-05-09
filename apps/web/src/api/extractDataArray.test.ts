import { describe, expect, it } from 'vitest'

/**
 * Espelho do backend: extrai array de dados de responses heterogêneas (SGBR
 * ora retorna array direto, ora `{data: [...]}`, ora `{items: [...]}`).
 * Se o frontend receber via proxy, o backend já normaliza — mas helper local
 * ajuda em testes de mapeamento.
 */
function extractArray(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload
  if (payload && typeof payload === 'object') {
    const obj = payload as Record<string, unknown>
    for (const key of ['data', 'items', 'rows', 'result']) {
      const val = obj[key]
      if (Array.isArray(val)) return val
    }
  }
  return []
}

describe('extractArray', () => {
  it('array direto retorna o próprio array', () => {
    const arr = [{ a: 1 }, { a: 2 }]
    expect(extractArray(arr)).toEqual(arr)
  })

  it('{ data: [...] } retorna data', () => {
    const arr = [{ x: 1 }]
    expect(extractArray({ data: arr })).toEqual(arr)
  })

  it('{ items: [...] } retorna items', () => {
    const arr = [{ y: 2 }]
    expect(extractArray({ items: arr })).toEqual(arr)
  })

  it('payload sem array conhecido retorna []', () => {
    expect(extractArray({ foo: 'bar' })).toEqual([])
  })

  it('null/undefined retornam []', () => {
    expect(extractArray(null)).toEqual([])
    expect(extractArray(undefined)).toEqual([])
  })

  it('primitivos retornam []', () => {
    expect(extractArray(42)).toEqual([])
    expect(extractArray('hello')).toEqual([])
  })
})
