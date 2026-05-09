import { createContext, useContext } from 'react'
import type { AuthSession } from './authStorage'

export type SignInOutcome = { kind: 'ok' } | { kind: 'mfa-required' }

export type AuthContextValue = {
  session: AuthSession | null
  isAuthenticated: boolean
  signIn: (input: { email: string; password: string; totp?: string }) => Promise<SignInOutcome>
  signOut: () => void
  /** Aplica mutação na sessão atual (ex.: limpar `mustChangePassword` após troca). */
  updateSession: (updater: (prev: AuthSession) => AuthSession) => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

