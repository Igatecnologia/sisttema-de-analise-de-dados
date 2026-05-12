import { describe, expect, it } from 'vitest'
import { ipMatchesAllowlist, sanitizeAllowlist, validateAllowlistEntry } from './ipAllowlist.js'

describe('ipMatchesAllowlist', () => {
  it('allowlist vazia aceita qualquer IP (sem restrição)', () => {
    expect(ipMatchesAllowlist('1.2.3.4', [])).toBe(true)
    expect(ipMatchesAllowlist('::1', [])).toBe(true)
  })

  it('IPv4 exato bate', () => {
    expect(ipMatchesAllowlist('200.150.10.5', ['200.150.10.5'])).toBe(true)
    expect(ipMatchesAllowlist('200.150.10.6', ['200.150.10.5'])).toBe(false)
  })

  it('IPv4 CIDR /24', () => {
    expect(ipMatchesAllowlist('200.150.0.50', ['200.150.0.0/24'])).toBe(true)
    expect(ipMatchesAllowlist('200.150.1.50', ['200.150.0.0/24'])).toBe(false)
  })

  it('IPv6 exato', () => {
    expect(ipMatchesAllowlist('::1', ['::1'])).toBe(true)
  })

  it('IPv6 CIDR /32', () => {
    expect(ipMatchesAllowlist('2a02:6ea0:e234::22', ['2a02:6ea0::/32'])).toBe(true)
    expect(ipMatchesAllowlist('2a03:1234::1', ['2a02:6ea0::/32'])).toBe(false)
  })

  it('IPv4-mapped IPv6 (Fly/Vercel) normaliza para IPv4', () => {
    /** ::ffff:200.150.10.5 deve casar com 200.150.10.5 (exato)
     *  e com 200.150.0.0/16 (range que cobre 200.150.x.x) */
    expect(ipMatchesAllowlist('::ffff:200.150.10.5', ['200.150.10.5'])).toBe(true)
    expect(ipMatchesAllowlist('::ffff:200.150.10.5', ['200.150.0.0/16'])).toBe(true)
    /** /24 só cobre 200.150.0.x, então 200.150.10.5 fica de fora */
    expect(ipMatchesAllowlist('::ffff:200.150.10.5', ['200.150.0.0/24'])).toBe(false)
    expect(ipMatchesAllowlist('::ffff:200.150.0.50', ['200.150.0.0/24'])).toBe(true)
  })

  it('várias entradas — basta uma bater', () => {
    expect(ipMatchesAllowlist('10.0.0.1', ['200.150.0.0/24', '10.0.0.1', '8.8.8.8'])).toBe(true)
  })

  it('entradas inválidas no allowlist são ignoradas (não derruba auth)', () => {
    expect(ipMatchesAllowlist('1.2.3.4', ['lixo', '999.999.999.999', '1.2.3.4'])).toBe(true)
    expect(ipMatchesAllowlist('5.5.5.5', ['lixo', '999.999.999.999', '1.2.3.4'])).toBe(false)
  })

  it('IP inválido na request → bloqueia', () => {
    expect(ipMatchesAllowlist('not-an-ip', ['1.2.3.4'])).toBe(false)
    expect(ipMatchesAllowlist('', ['1.2.3.4'])).toBe(false)
  })
})

describe('validateAllowlistEntry', () => {
  it('aceita IPv4 exato', () => {
    expect(validateAllowlistEntry('1.2.3.4')).toBeNull()
  })
  it('aceita CIDR válido', () => {
    expect(validateAllowlistEntry('200.150.0.0/24')).toBeNull()
    expect(validateAllowlistEntry('2a02::/32')).toBeNull()
  })
  it('rejeita lixo', () => {
    expect(validateAllowlistEntry('abc')).toMatch(/inválido|invalido/i)
    expect(validateAllowlistEntry('')).toMatch(/vazia/)
  })
  it('rejeita prefixo CIDR fora do range', () => {
    expect(validateAllowlistEntry('1.2.3.4/33')).toMatch(/prefixo/)
    expect(validateAllowlistEntry('::1/-1')).toMatch(/prefixo/)
  })
})

describe('sanitizeAllowlist', () => {
  it('remove inválidos, dedup, lower, limita 50', () => {
    const r = sanitizeAllowlist(['1.2.3.4', '1.2.3.4', 'LIXO', '', '1.2.3.4 ', 'AB:CD::/32'])
    expect(r).toContain('1.2.3.4')
    expect(r).toContain('ab:cd::/32')
    expect(r).not.toContain('LIXO')
    expect(r.length).toBeLessThanOrEqual(50)
  })

  it('input não-array vira lista vazia', () => {
    expect(sanitizeAllowlist(null)).toEqual([])
    expect(sanitizeAllowlist('1.2.3.4')).toEqual([])
  })
})
