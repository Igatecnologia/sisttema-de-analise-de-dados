/**
 * T-A1 (audit 2026-05-12): cobertura do MFA/TOTP — setup, verify, backup codes, disable.
 *
 * Roda contra SQLite local (sem IGA_STORAGE_DRIVER=postgres) para evitar dep
 * de DB externo. Cobre os caminhos críticos:
 *  - init/confirm setup
 *  - verifyMfaToken com TOTP correto/errado
 *  - backup code consumido apenas 1x
 *  - regenerateBackupCodes invalida antigos
 *  - disableMfa zera registro
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { generateSync } from 'otplib'
import { randomBytes } from 'node:crypto'
import {
  confirmMfaSetup,
  disableMfa,
  getMfaStatus,
  initMfaSetup,
  regenerateBackupCodes,
  verifyMfaToken,
} from './mfa.js'

function makeUserId(): string {
  return `usr_test_${randomBytes(6).toString('hex')}`
}

/** Extrai o secret base32 do otpauth_url retornado pelo initMfaSetup. */
function extractSecret(otpauthUrl: string): string {
  const match = otpauthUrl.match(/secret=([A-Z2-7]+)/)
  if (!match) throw new Error(`otpauth_url sem secret: ${otpauthUrl}`)
  return match[1]
}

function totpNow(secret: string): string {
  const token = generateSync({ secret })
  if (typeof token !== 'string' || !/^\d{6}$/.test(token)) {
    throw new Error(`Falha ao gerar TOTP: ${String(token)}`)
  }
  return token
}

describe('MFA/TOTP (SQLite local)', () => {
  beforeEach(() => {
    delete process.env.IGA_STORAGE_DRIVER
  })

  afterEach(async () => {
    // limpeza preventiva — disable é idempotente
  })

  describe('getMfaStatus', () => {
    it('retorna { enabled: false, pendingSetup: false } para user sem registro', async () => {
      const userId = makeUserId()
      const status = await getMfaStatus(userId)
      expect(status).toEqual({ enabled: false, pendingSetup: false, backupCodesRemaining: 0 })
    })
  })

  describe('initMfaSetup', () => {
    it('gera otpauthUrl + secret válidos e marca pendingSetup', async () => {
      const userId = makeUserId()
      const result = await initMfaSetup(userId, 'test@iga.com', 'IGA Test')
      expect(result.secret).toBeTruthy()
      expect(result.otpauthUrl).toMatch(/^otpauth:\/\/totp\/IGA%20Test:test%40iga\.com\?/)
      expect(result.otpauthUrl).toContain('secret=')

      const status = await getMfaStatus(userId)
      expect(status.enabled).toBe(false)
      expect(status.pendingSetup).toBe(true)
      expect(status.backupCodesRemaining).toBe(0)
      await disableMfa(userId)
    })

    it('chamar 2x sobrescreve o secret (re-issue após cancelar setup)', async () => {
      const userId = makeUserId()
      const first = await initMfaSetup(userId, 'test@iga.com', 'IGA')
      const second = await initMfaSetup(userId, 'test@iga.com', 'IGA')
      expect(second.secret).not.toBe(first.secret)
      await disableMfa(userId)
    })
  })

  describe('confirmMfaSetup', () => {
    it('TOTP correto habilita MFA e retorna 10 backup codes', async () => {
      const userId = makeUserId()
      const { otpauthUrl } = await initMfaSetup(userId, 'test@iga.com', 'IGA')
      const secret = extractSecret(otpauthUrl)

      const result = await confirmMfaSetup(userId, totpNow(secret))
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.backupCodes).toHaveLength(10)
        for (const code of result.backupCodes) {
          expect(code).toMatch(/^[0-9a-f]{8}$/)
        }
      }
      const status = await getMfaStatus(userId)
      expect(status.enabled).toBe(true)
      expect(status.pendingSetup).toBe(false)
      expect(status.backupCodesRemaining).toBe(10)
      await disableMfa(userId)
    })

    it('TOTP inválido retorna { ok: false, reason: invalid_token }', async () => {
      const userId = makeUserId()
      await initMfaSetup(userId, 'test@iga.com', 'IGA')
      const result = await confirmMfaSetup(userId, '000000')
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.reason).toBe('invalid_token')
      // MFA permanece pendente
      const status = await getMfaStatus(userId)
      expect(status.enabled).toBe(false)
      expect(status.pendingSetup).toBe(true)
      await disableMfa(userId)
    })

    it('user sem setup pendente retorna { ok: false, reason: no_pending }', async () => {
      const userId = makeUserId()
      const result = await confirmMfaSetup(userId, '123456')
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.reason).toBe('no_pending')
    })

    it('confirm depois de já habilitado retorna no_pending (não pode re-confirmar)', async () => {
      const userId = makeUserId()
      const { otpauthUrl } = await initMfaSetup(userId, 'test@iga.com', 'IGA')
      const secret = extractSecret(otpauthUrl)
      await confirmMfaSetup(userId, totpNow(secret))
      const again = await confirmMfaSetup(userId, totpNow(secret))
      expect(again.ok).toBe(false)
      if (!again.ok) expect(again.reason).toBe('no_pending')
      await disableMfa(userId)
    })
  })

  describe('verifyMfaToken', () => {
    it('TOTP atual válido retorna { ok: true, usedBackupCode: false }', async () => {
      const userId = makeUserId()
      const { otpauthUrl } = await initMfaSetup(userId, 'test@iga.com', 'IGA')
      const secret = extractSecret(otpauthUrl)
      await confirmMfaSetup(userId, totpNow(secret))

      const result = await verifyMfaToken(userId, totpNow(secret))
      expect(result.ok).toBe(true)
      if (result.ok) expect(result.usedBackupCode).toBe(false)
      await disableMfa(userId)
    })

    it('TOTP errado falha sem efeito colateral', async () => {
      const userId = makeUserId()
      const { otpauthUrl } = await initMfaSetup(userId, 'test@iga.com', 'IGA')
      const secret = extractSecret(otpauthUrl)
      await confirmMfaSetup(userId, totpNow(secret))

      const result = await verifyMfaToken(userId, '000000')
      expect(result.ok).toBe(false)
      // não consome nada
      const status = await getMfaStatus(userId)
      expect(status.backupCodesRemaining).toBe(10)
      await disableMfa(userId)
    })

    it('MFA desabilitado retorna { ok: false } para qualquer token', async () => {
      const userId = makeUserId()
      const result = await verifyMfaToken(userId, '123456')
      expect(result.ok).toBe(false)
    })

    it('backup code consumido decrementa contagem e não funciona 2x', async () => {
      const userId = makeUserId()
      const { otpauthUrl } = await initMfaSetup(userId, 'test@iga.com', 'IGA')
      const secret = extractSecret(otpauthUrl)
      const setup = await confirmMfaSetup(userId, totpNow(secret))
      if (!setup.ok) throw new Error('setup falhou')
      const [code] = setup.backupCodes

      // primeira tentativa: valida
      const first = await verifyMfaToken(userId, code)
      expect(first.ok).toBe(true)
      if (first.ok) expect(first.usedBackupCode).toBe(true)

      const statusAfter = await getMfaStatus(userId)
      expect(statusAfter.backupCodesRemaining).toBe(9)

      // segunda tentativa com o mesmo código: falha
      const second = await verifyMfaToken(userId, code)
      expect(second.ok).toBe(false)

      await disableMfa(userId)
    })

    it('backup code aceita maiúsculas/espacos (normalização)', async () => {
      const userId = makeUserId()
      const { otpauthUrl } = await initMfaSetup(userId, 'test@iga.com', 'IGA')
      const secret = extractSecret(otpauthUrl)
      const setup = await confirmMfaSetup(userId, totpNow(secret))
      if (!setup.ok) throw new Error('setup falhou')
      const [code] = setup.backupCodes

      // simulação: user digita com case e espaços
      const messy = ` ${code.toUpperCase()} `
      const result = await verifyMfaToken(userId, messy)
      expect(result.ok).toBe(true)
      await disableMfa(userId)
    })

    it('token formato inválido (5 dígitos, 9 hex) retorna { ok: false }', async () => {
      const userId = makeUserId()
      const { otpauthUrl } = await initMfaSetup(userId, 'test@iga.com', 'IGA')
      const secret = extractSecret(otpauthUrl)
      await confirmMfaSetup(userId, totpNow(secret))

      expect((await verifyMfaToken(userId, '12345')).ok).toBe(false)
      expect((await verifyMfaToken(userId, '1234567')).ok).toBe(false)
      expect((await verifyMfaToken(userId, 'abcdefghi')).ok).toBe(false)
      expect((await verifyMfaToken(userId, 'GHIJKLMN')).ok).toBe(false) // não é hex
      await disableMfa(userId)
    })
  })

  describe('regenerateBackupCodes', () => {
    it('gera novos 10 codes e invalida os antigos', async () => {
      const userId = makeUserId()
      const { otpauthUrl } = await initMfaSetup(userId, 'test@iga.com', 'IGA')
      const secret = extractSecret(otpauthUrl)
      const setup = await confirmMfaSetup(userId, totpNow(secret))
      if (!setup.ok) throw new Error('setup falhou')
      const [oldCode] = setup.backupCodes

      const newCodes = await regenerateBackupCodes(userId)
      expect(newCodes).not.toBeNull()
      expect(newCodes).toHaveLength(10)
      // novos códigos não devem incluir o antigo
      expect(newCodes!.includes(oldCode)).toBe(false)

      // tentar usar o código antigo: falha
      const result = await verifyMfaToken(userId, oldCode)
      expect(result.ok).toBe(false)

      // novo código funciona
      const ok = await verifyMfaToken(userId, newCodes![0])
      expect(ok.ok).toBe(true)
      await disableMfa(userId)
    })

    it('retorna null se MFA não habilitado', async () => {
      const userId = makeUserId()
      const result = await regenerateBackupCodes(userId)
      expect(result).toBeNull()
    })
  })

  describe('disableMfa', () => {
    it('apaga o registro completamente', async () => {
      const userId = makeUserId()
      const { otpauthUrl } = await initMfaSetup(userId, 'test@iga.com', 'IGA')
      const secret = extractSecret(otpauthUrl)
      await confirmMfaSetup(userId, totpNow(secret))
      expect((await getMfaStatus(userId)).enabled).toBe(true)

      await disableMfa(userId)

      const status = await getMfaStatus(userId)
      expect(status).toEqual({ enabled: false, pendingSetup: false, backupCodesRemaining: 0 })
    })

    it('é idempotente — chamar 2x sem MFA não falha', async () => {
      const userId = makeUserId()
      await disableMfa(userId)
      await disableMfa(userId)
      expect((await getMfaStatus(userId)).enabled).toBe(false)
    })
  })
})
