import { beforeEach, describe, expect, it, vi } from 'vitest'
import { signIn } from './authService'
import { http } from './http'
import { getAuthDataSource } from './dataSourceService'

vi.mock('./http', () => ({
  http: { post: vi.fn() },
}))

vi.mock('./dataSourceService', () => ({
  getAuthDataSource: vi.fn(),
}))

describe('authService', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(getAuthDataSource).mockReturnValue(null)
  })

  it('retorna sessão válida para admin', async () => {
    vi.mocked(http.post).mockResolvedValueOnce({
      data: {
        token: 'local-token',
        user: { id: '1', name: 'Admin', email: 'admin@demo.local', role: 'admin' },
      },
    } as never)
    const result = await signIn({ email: 'admin@demo.local', password: 'demo@2026!' })
    expect(result.kind).toBe('ok')
    if (result.kind === 'ok') {
      expect(result.session.user.role).toBe('admin')
      expect(result.session.permissions).toContain('users:write')
    }
  })

  it('detecta mfa-required quando backend retorna flag', async () => {
    vi.mocked(http.post).mockResolvedValueOnce({
      data: { mfaRequired: true },
    } as never)
    const result = await signIn({ email: 'admin@demo.local', password: 'demo@2026!' })
    expect(result.kind).toBe('mfa-required')
  })

  it('falha com credencial inválida', async () => {
    vi.mocked(http.post).mockRejectedValueOnce(new Error('401'))
    await expect(signIn({ email: 'admin@demo.local', password: 'x' })).rejects.toThrow(
      'Usuário ou senha incorretos.',
    )
  })
})
