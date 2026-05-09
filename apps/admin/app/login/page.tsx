'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { api, ApiError } from '@/lib/api'
import { Crown, Lock, Mail } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      await api.post('/v1/auth/login', { email, password })
      const me = await api.get<{ isSuperAdmin?: boolean }>('/v1/auth/me')
      if (!me.isSuperAdmin) {
        setError('Conta válida, mas não está autorizada a acessar o painel super-admin.')
        return
      }
      router.replace('/')
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message || 'Falha ao entrar.')
      } else {
        setError('Erro de conexão.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center mb-8">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #FFD700, #F59E0B)' }}>
            <Crown size={32} color="#0a0e14" strokeWidth={2.5} />
          </div>
        </div>
        <h1 className="text-3xl font-bold text-center mb-2">IGA Super Admin</h1>
        <p className="text-center text-sm mb-10" style={{ color: 'var(--text-muted)' }}>
          Painel de operação cross-tenant. Acesso restrito.
        </p>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-xs uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
              Email
            </label>
            <div className="relative">
              <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-lg outline-none transition-colors"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}
                placeholder="seu@email.com"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
              Senha
            </label>
            <div className="relative">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-lg outline-none transition-colors"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}
                placeholder="••••••••"
              />
            </div>
          </div>

          {error ? (
            <div
              className="text-sm px-4 py-3 rounded-lg"
              style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5' }}
            >
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 rounded-lg font-semibold transition-all disabled:opacity-50"
            style={{ background: 'var(--accent)', color: '#0a0e14' }}
          >
            {submitting ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <p className="text-center text-xs mt-8" style={{ color: 'var(--text-muted)' }}>
          Não é super-admin? Use o app principal em <a href="http://localhost:5173" className="underline">localhost:5173</a>
        </p>
      </div>
    </main>
  )
}
