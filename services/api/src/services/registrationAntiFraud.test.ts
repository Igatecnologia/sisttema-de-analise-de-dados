import { afterEach, describe, expect, it } from 'vitest'
import {
  _resetVelocityForTests,
  checkRegistrationVelocity,
  isDisposableEmail,
} from './registrationAntiFraud.js'

describe('registrationAntiFraud', () => {
  afterEach(async () => {
    await _resetVelocityForTests()
  })

  describe('isDisposableEmail', () => {
    it('bloqueia mailinator.com', () => {
      expect(isDisposableEmail('foo@mailinator.com')).toBe(true)
    })

    it('bloqueia subdominio de tempmail.com', () => {
      expect(isDisposableEmail('foo@bar.tempmail.com')).toBe(true)
    })

    it('permite gmail.com', () => {
      expect(isDisposableEmail('user@gmail.com')).toBe(false)
    })

    it('permite dominio corporativo', () => {
      expect(isDisposableEmail('contato@igagestao.com.br')).toBe(false)
    })

    it('retorna false para email malformado', () => {
      expect(isDisposableEmail('semarroba')).toBe(false)
    })
  })

  describe('checkRegistrationVelocity', () => {
    it('permite ate 5 registros do mesmo IP em 1h', async () => {
      for (let i = 0; i < 5; i += 1) {
        const r = await checkRegistrationVelocity('1.2.3.4')
        expect(r.allowed).toBe(true)
      }
    })

    it('bloqueia o 6o registro do mesmo IP', async () => {
      for (let i = 0; i < 5; i += 1) await checkRegistrationVelocity('5.6.7.8')
      const result = await checkRegistrationVelocity('5.6.7.8')
      expect(result.allowed).toBe(false)
      if (!result.allowed) expect(result.retryAfterSec).toBeGreaterThan(0)
    })

    it('IPs diferentes nao se afetam', async () => {
      for (let i = 0; i < 5; i += 1) await checkRegistrationVelocity('9.9.9.9')
      const blocked = await checkRegistrationVelocity('9.9.9.9')
      const fresh = await checkRegistrationVelocity('10.10.10.10')
      expect(blocked.allowed).toBe(false)
      expect(fresh.allowed).toBe(true)
    })
  })
})
