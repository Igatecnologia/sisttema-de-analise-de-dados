import type { AuthSession } from '../auth/authStorage'
import { defaultPermissionsForRole } from '../auth/permissions'
import { postValidated } from '../api/validatedHttp'
import { localLoginResponseSchema, sgbrUsuarioLoginResponseSchema } from '../api/schemas'
import { http } from './http'
import { getAuthDataSource } from './dataSourceService'

type SignInInput = { email: string; password: string }

function resolvePermissionsByRole(role: 'admin' | 'manager' | 'viewer'): AuthSession['permissions'] {
  return defaultPermissionsForRole(role)
}

/** Mensagem genérica — não revela se o usuário existe ou não */
const INVALID_CREDENTIALS_MSG = 'Usuário ou senha incorretos.'

/**
 * Tenta login local (usuarios do proprio sistema).
 * Se falhar com 401, e houver fonte SGBR configurada como auth, tenta via proxy.
 */
export async function signIn(input: SignInInput): Promise<AuthSession> {
  const login = input.email.trim()
  if (!login) throw new Error('Informe o usuário.')

  // 1. Tenta login local
  try {
    const data = await postValidated(
      http,
      '/api/v1/auth/login',
      { email: login, password: input.password },
      localLoginResponseSchema,
    )

    const permissions: AuthSession['permissions'] =
      data.permissions && data.permissions.length > 0
        ? data.permissions
        : resolvePermissionsByRole(data.user.role)

    return {
      token: data.token,
      user: {
        ...data.user,
        mustChangePassword: data.user.mustChangePassword ?? false,
      },
      permissions,
    }
  } catch (localErr) {
    const is401 =
      localErr instanceof Error &&
      (localErr.message.includes('401') || localErr.message.includes('incorretos'))

    if (!is401) {
      throw new Error('Falha ao conectar com o servidor. Tente novamente.')
    }

    // 2. Se houver fonte SGBR marcada como auth, tenta via proxy
    const authSource = getAuthDataSource()
    if (authSource) {
      try {
        const data = await postValidated(
          http,
          '/api/proxy/login',
          { login, password: input.password },
          sgbrUsuarioLoginResponseSchema,
        )

        const email = data.email?.trim() || `${data.nome_usuario}@local`

        return {
          token: data.token,
          user: {
            id: String(data.id_usuario),
            name: data.nome_usuario,
            email,
            role: 'viewer',
          },
          permissions: resolvePermissionsByRole('viewer'),
        }
      } catch {
        throw new Error(INVALID_CREDENTIALS_MSG)
      }
    }

    throw new Error(INVALID_CREDENTIALS_MSG)
  }
}
