import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearLoginFailures,
  getLockState,
  LOCKOUT_CONFIG,
  recordLoginFailure,
} from './accountLockout.js'

describe('accountLockout (memStore — Redis ausente)', () => {
  const tenant = 'tenant-test'
  const email = `user${Math.random().toString(36).slice(2)}@example.com`

  beforeEach(() => {
    delete process.env.REDIS_URL
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })

  afterEach(async () => {
    await clearLoginFailures(tenant, email)
    vi.useRealTimers()
  })

  it('login limpo: nao locked, sem falhas', async () => {
    const state = await getLockState(tenant, email)
    expect(state.locked).toBe(false)
    expect(state.failuresInWindow).toBe(0)
    expect(state.lockoutCount24h).toBe(0)
  })

  it('lock apos MAX_FAILURES tentativas', async () => {
    for (let i = 0; i < LOCKOUT_CONFIG.MAX_FAILURES - 1; i++) {
      const state = await recordLoginFailure(tenant, email)
      expect(state.locked).toBe(false)
    }
    const final = await recordLoginFailure(tenant, email)
    expect(final.locked).toBe(true)
    expect(final.lockedUntil).toBeGreaterThan(Date.now())
  })

  it('clearLoginFailures destrava conta apos sucesso', async () => {
    for (let i = 0; i < LOCKOUT_CONFIG.MAX_FAILURES; i++) {
      await recordLoginFailure(tenant, email)
    }
    expect((await getLockState(tenant, email)).locked).toBe(true)

    await clearLoginFailures(tenant, email)
    const after = await getLockState(tenant, email)
    expect(after.locked).toBe(false)
    expect(after.failuresInWindow).toBe(0)
  })

  it('case-insensitive: email com maiuscula trata mesmo lock', async () => {
    for (let i = 0; i < LOCKOUT_CONFIG.MAX_FAILURES; i++) {
      await recordLoginFailure(tenant, email)
    }
    const upperState = await getLockState(tenant, email.toUpperCase())
    expect(upperState.locked).toBe(true)
  })

  it('tenants distintos nao compartilham lockout', async () => {
    for (let i = 0; i < LOCKOUT_CONFIG.MAX_FAILURES; i++) {
      await recordLoginFailure('tenant-A', email)
    }
    const stateA = await getLockState('tenant-A', email)
    const stateB = await getLockState('tenant-B', email)
    expect(stateA.locked).toBe(true)
    expect(stateB.locked).toBe(false)
    await clearLoginFailures('tenant-A', email)
  })
})
