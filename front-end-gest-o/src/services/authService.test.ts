import { beforeEach, describe, expect, it, vi } from 'vitest'
import { signIn } from './authService'
import { postValidated } from '../api/validatedHttp'
import { getAuthDataSource } from './dataSourceService'

vi.mock('../api/validatedHttp', () => ({
  postValidated: vi.fn(),
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
    vi.mocked(postValidated).mockResolvedValueOnce({
      token: 'local-token',
      user: { id: '1', name: 'Admin', email: 'admin@demo.local', role: 'admin' },
    })
    const session = await signIn({ email: 'admin@demo.local', password: 'demo@2026!' })
    expect(session.user.role).toBe('admin')
    expect(session.permissions).toContain('users:write')
  })

  it('falha com credencial inválida', async () => {
    vi.mocked(postValidated).mockRejectedValueOnce(new Error('401'))
    await expect(signIn({ email: 'admin@demo.local', password: 'x' })).rejects.toThrow(
      'Usuário ou senha incorretos.',
    )
  })
})
