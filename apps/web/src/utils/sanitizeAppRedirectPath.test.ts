import { describe, expect, it } from 'vitest'
import { sanitizeAppRedirectPath } from './sanitizeAppRedirectPath'

describe('sanitizeAppRedirectPath', () => {
  it('aceita apenas caminhos relativos à origem', () => {
    expect(sanitizeAppRedirectPath('/dashboard')).toBe('/dashboard')
    expect(sanitizeAppRedirectPath('/financeiro')).toBe('/financeiro')
    expect(sanitizeAppRedirectPath('/relatorios?x=1')).toBe('/relatorios?x=1')
  })

  it('rejeita protocol-relative e URLs absolutas em string', () => {
    expect(sanitizeAppRedirectPath('//evil.example/phish', '/dashboard')).toBe('/dashboard')
    expect(sanitizeAppRedirectPath('https://evil.example', '/dashboard')).toBe('/dashboard')
    expect(sanitizeAppRedirectPath('javascript:alert(1)', '/dashboard')).toBe('/dashboard')
  })

  it('rejeita backslash e null bytes', () => {
    expect(sanitizeAppRedirectPath('/x\\y', '/dashboard')).toBe('/dashboard')
    expect(sanitizeAppRedirectPath('/x\0y', '/dashboard')).toBe('/dashboard')
  })

  it('evita redirecionar de volta para /login', () => {
    expect(sanitizeAppRedirectPath('/login', '/dashboard')).toBe('/dashboard')
    expect(sanitizeAppRedirectPath('/login/return', '/dashboard')).toBe('/dashboard')
    expect(sanitizeAppRedirectPath('/login?next=/x', '/dashboard')).toBe('/dashboard')
  })

  it('usa fallback para tipos inválidos ou vazio', () => {
    expect(sanitizeAppRedirectPath(undefined, '/dashboard')).toBe('/dashboard')
    expect(sanitizeAppRedirectPath(null, '/a')).toBe('/a')
    expect(sanitizeAppRedirectPath(123, '/a')).toBe('/a')
    expect(sanitizeAppRedirectPath('   ', '/a')).toBe('/a')
  })
})
