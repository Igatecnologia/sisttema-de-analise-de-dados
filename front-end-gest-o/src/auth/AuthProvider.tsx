import { App } from 'antd'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AuthContext, type AuthContextValue } from './AuthContext'
import { getStoredSession, setStoredSession, type AuthSession } from './authStorage'
import { signIn as signInService } from '../services/authService'
import { onAuthSignOut } from './authEvents'
import { useSessionTimeout } from './useSessionTimeout'
import { http } from '../services/http'
import { tenantStorage } from '../tenant/tenantStorage'
import { queryClient } from '../query/queryClient'

/** Tempo de inatividade antes do auto-logout (30 minutos) */
const SESSION_TIMEOUT_MS = 30 * 60 * 1000

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { notification } = App.useApp()
  const [session, setSession] = useState<AuthSession | null>(() =>
    typeof window !== 'undefined' ? getStoredSession() : null,
  )
  const startupValidatedRef = useRef(false)

  const signOut = useCallback(async () => {
    // Tenta invalidar sessão no backend (fire-and-forget)
    try {
      await http.post('/api/v1/auth/logout').catch(() => {})
    } catch {
      // Falha silenciosa — o importante é limpar o frontend
    }

    setSession(null)
    setStoredSession(null)
    tenantStorage.removeItem('auth.session')

    // Limpar cache do React Query para evitar dados stale no re-login
    queryClient.clear()
  }, [])

  // Validar sessão armazenada com o backend no startup
  useEffect(() => {
    if (startupValidatedRef.current) return
    startupValidatedRef.current = true
    if (!session) return
    let cancelled = false

    http
      .get('/api/v1/auth/me')
      .then((response) => {
        if (cancelled) return
        const payload = response.data as {
          user: AuthSession['user']
          permissions: AuthSession['permissions']
        }
        setSession({
          user: payload.user,
          permissions: payload.permissions,
        })
      })
      .catch(() => {
        if (cancelled) return
        signOut()
      })

    return () => { cancelled = true }
  }, [session, signOut])

  // Auto-logout por inatividade
  useSessionTimeout(
    useCallback(() => {
      signOut()
      notification.warning({
        message: 'Sessão expirada',
        description: 'Você foi desconectado por inatividade. Faça login novamente.',
        duration: 0,
      })
    }, [signOut, notification]),
    SESSION_TIMEOUT_MS,
    !!session,
  )

  useEffect(() => {
    return onAuthSignOut(() => {
      signOut()
    })
  }, [signOut])

  const signIn = useCallback<AuthContextValue['signIn']>(
    async (input) => {
      const next = await signInService(input)
      try {
        const me = await http.get('/api/v1/auth/me')
        const payload = me.data as {
          user: AuthSession['user']
          permissions: AuthSession['permissions']
        }
        const normalized: AuthSession = { user: payload.user, permissions: payload.permissions }
        setSession(normalized)
        setStoredSession(normalized)
      } catch {
        // Fallback para modo legado/externo (ex.: proxy login específico)
        setSession(next)
        setStoredSession(next)
      }
      notification.success({
        message: 'Bem-vindo',
        description: next.user.name,
      })
    },
    [notification, setSession],
  )

  const updateSession = useCallback<AuthContextValue['updateSession']>((updater) => {
    setSession((prev) => {
      if (!prev) return prev
      const next = updater(prev)
      setStoredSession(next)
      return next
    })
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      isAuthenticated: !!session,
      signIn,
      signOut,
      updateSession,
    }),
    [session, signIn, signOut, updateSession],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
