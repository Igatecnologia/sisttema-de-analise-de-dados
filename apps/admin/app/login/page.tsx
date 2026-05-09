'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { api, ApiError } from '@/lib/api'
import {
  Activity,
  ArrowRight,
  Building2,
  Crown,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  Mail,
  ShieldCheck,
  Sparkles,
  TrendingUp,
} from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
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
        setError('Conta valida, mas nao esta autorizada a acessar o painel super-admin.')
        return
      }
      router.replace('/')
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message || 'Falha ao entrar.')
      } else {
        setError('Erro de conexao.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main
      className="min-h-screen grid"
      style={{
        gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.05fr)',
      }}
    >
      {/* === Coluna esquerda: form === */}
      <div
        className="flex flex-col justify-center px-8 sm:px-12 lg:px-20 py-12"
        style={{ background: 'var(--bg)' }}
      >
        <div className="w-full max-w-md mx-auto">
          {/* Brand minimalista no topo */}
          <header className="mb-12 flex items-center gap-3">
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{
                background: 'linear-gradient(135deg, #FFD700, #F59E0B)',
                boxShadow: '0 8px 24px rgba(245, 158, 11, 0.3)',
              }}
            >
              <Crown size={22} color="#0a0e14" strokeWidth={2.5} />
            </div>
            <div>
              <div className="text-sm font-bold leading-tight">IGA Super Admin</div>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Cross-tenant operations
              </div>
            </div>
          </header>

          <div className="mb-10">
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-2">
              Bem-vindo de volta
            </h1>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              Acesso restrito ao time de operacao do IGA. Use sua conta com privilegios super-admin.
            </p>
          </div>

          <form onSubmit={onSubmit} className="space-y-5">
            <div>
              <label
                htmlFor="login-email"
                className="block text-[11px] uppercase tracking-[0.08em] font-semibold mb-2"
                style={{ color: 'var(--text-muted)' }}
              >
                Email
              </label>
              <div className="relative group">
                <Mail
                  size={17}
                  className="absolute left-4 top-1/2 -translate-y-1/2 transition-colors"
                  style={{ color: 'var(--text-faint)' }}
                />
                <input
                  id="login-email"
                  type="email"
                  required
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-12 pr-4 py-3.5 rounded-xl outline-none text-sm transition-all"
                  style={{
                    background: 'var(--surface-2)',
                    border: '1px solid var(--border)',
                    color: 'var(--text)',
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = 'var(--accent)'
                    e.currentTarget.style.boxShadow = `0 0 0 3px var(--accent-strong)`
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border)'
                    e.currentTarget.style.boxShadow = 'none'
                  }}
                  placeholder="seu@email.com"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="login-password"
                className="block text-[11px] uppercase tracking-[0.08em] font-semibold mb-2"
                style={{ color: 'var(--text-muted)' }}
              >
                Senha
              </label>
              <div className="relative group">
                <Lock
                  size={17}
                  className="absolute left-4 top-1/2 -translate-y-1/2"
                  style={{ color: 'var(--text-faint)' }}
                />
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-12 pr-12 py-3.5 rounded-xl outline-none text-sm transition-all"
                  style={{
                    background: 'var(--surface-2)',
                    border: '1px solid var(--border)',
                    color: 'var(--text)',
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = 'var(--accent)'
                    e.currentTarget.style.boxShadow = `0 0 0 3px var(--accent-strong)`
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border)'
                    e.currentTarget.style.boxShadow = 'none'
                  }}
                  placeholder="••••••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg transition-colors"
                  style={{ color: 'var(--text-muted)' }}
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error ? (
              <div
                role="alert"
                className="text-sm px-4 py-3 rounded-xl flex items-start gap-2.5 animate-fade-in"
                style={{
                  background: 'rgba(239, 68, 68, 0.08)',
                  border: '1px solid rgba(239, 68, 68, 0.25)',
                  color: '#fca5a5',
                }}
              >
                <ShieldCheck size={16} className="mt-0.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            ) : null}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3.5 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: 'linear-gradient(135deg, #FFD700, #F59E0B)',
                color: '#0a0e14',
                boxShadow: submitting ? 'none' : '0 8px 24px rgba(245, 158, 11, 0.25)',
                fontSize: 14,
              }}
            >
              {submitting ? (
                <>
                  <span
                    className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"
                    aria-hidden
                  />
                  Entrando...
                </>
              ) : (
                <>
                  Entrar no painel
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          {/* Footer info */}
          <div className="mt-10 pt-6 flex flex-col gap-3" style={{ borderTop: '1px solid var(--border-subtle, var(--border))' }}>
            <div className="flex items-center gap-4 flex-wrap text-xs" style={{ color: 'var(--text-muted)' }}>
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck size={12} style={{ color: '#10b981' }} />
                JWT HttpOnly
              </span>
              <span className="inline-flex items-center gap-1.5">
                <KeyRound size={12} style={{ color: '#3b82f6' }} />
                MFA opcional
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Lock size={12} style={{ color: '#a78bfa' }} />
                Audit log
              </span>
            </div>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Nao e super-admin? Use o app principal em{' '}
              <a
                href="http://localhost:5173"
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
                style={{ color: 'var(--accent)' }}
              >
                localhost:5173
              </a>
            </p>
          </div>
        </div>
      </div>

      {/* === Coluna direita: hero === */}
      <aside
        className="hidden lg:flex flex-col justify-between p-12 xl:p-16 relative overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, #1a1208 0%, #0f1620 50%, #0a0e14 100%)',
        }}
      >
        {/* Mesh gradient overlay */}
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(circle at 20% 20%, rgba(255, 215, 0, 0.10) 0%, transparent 40%), radial-gradient(circle at 80% 80%, rgba(245, 158, 11, 0.08) 0%, transparent 40%), radial-gradient(circle at 50% 100%, rgba(0, 0, 0, 0.4) 0%, transparent 60%)',
          }}
        />

        {/* Pattern de pontos */}
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none opacity-[0.05]"
          style={{
            backgroundImage:
              'radial-gradient(circle, #fff 1px, transparent 1px)',
            backgroundSize: '32px 32px',
          }}
        />

        {/* Top — badge */}
        <div className="relative z-10 flex items-center gap-2">
          <div
            className="px-3 py-1.5 rounded-full text-[11px] font-semibold uppercase tracking-[0.08em] inline-flex items-center gap-2"
            style={{
              background: 'rgba(255, 215, 0, 0.1)',
              border: '1px solid rgba(255, 215, 0, 0.2)',
              color: '#FFD700',
            }}
          >
            <Sparkles size={11} />
            Restricted access
          </div>
        </div>

        {/* Centro — mensagem */}
        <div className="relative z-10 max-w-xl">
          <h2
            className="text-4xl xl:text-5xl font-bold tracking-tight mb-5 text-white"
            style={{ letterSpacing: '-0.02em', lineHeight: 1.1 }}
          >
            Operacao cross-tenant.
            <br />
            <span
              style={{
                background: 'linear-gradient(135deg, #FFD700, #F59E0B)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              Visao total do SaaS.
            </span>
          </h2>
          <p
            className="text-base xl:text-lg leading-relaxed mb-10 max-w-lg"
            style={{ color: 'rgba(255,255,255,0.72)' }}
          >
            Gerencie tenants, monitore receita recorrente, audite eventos sensiveis e mantenha
            saude operacional do sistema — tudo em um painel unico.
          </p>

          {/* Features grid */}
          <div className="grid grid-cols-2 gap-3 max-w-md">
            <FeatureCard icon={<Building2 size={18} />} title="Tenants" desc="CRUD + impersonation" />
            <FeatureCard icon={<TrendingUp size={18} />} title="Billing" desc="MRR, churn, Stripe" />
            <FeatureCard icon={<Activity size={18} />} title="Sistema" desc="Health checks live" />
            <FeatureCard icon={<Sparkles size={18} />} title="IA Usage" desc="Custo por tenant" />
          </div>
        </div>

        {/* Bottom — stats */}
        <div className="relative z-10 flex items-center gap-6 pt-6">
          <Stat label="Endpoints" value="13+" />
          <div className="w-px h-10" style={{ background: 'rgba(255,255,255,0.12)' }} />
          <Stat label="Charts" value="recharts 3" />
          <div className="w-px h-10" style={{ background: 'rgba(255,255,255,0.12)' }} />
          <Stat label="Pages" value="8" />
        </div>
      </aside>
    </main>
  )
}

function FeatureCard({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode
  title: string
  desc: string
}) {
  return (
    <div
      className="p-3 rounded-xl backdrop-blur-sm transition-transform hover:scale-[1.02]"
      style={{
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center mb-2"
        style={{
          background: 'rgba(255, 215, 0, 0.12)',
          color: '#FFD700',
        }}
      >
        {icon}
      </div>
      <div className="text-[13px] font-semibold text-white leading-tight">{title}</div>
      <div className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.55)' }}>
        {desc}
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xl xl:text-2xl font-bold text-white tabular-nums">{value}</div>
      <div
        className="text-[11px] uppercase tracking-[0.08em] mt-0.5"
        style={{ color: 'rgba(255,255,255,0.5)' }}
      >
        {label}
      </div>
    </div>
  )
}
