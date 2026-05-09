import { describe, expect, it } from 'vitest'
import { API_BASE_URL } from './apiEnv'

describe('API_BASE_URL', () => {
  it('está definida como origem (sem /api duplicado no build de teste)', () => {
    expect(API_BASE_URL).toMatch(/^https?:\/\//)
    expect(API_BASE_URL).not.toMatch(/\/api\/?v?\d*$/i)
  })
})
