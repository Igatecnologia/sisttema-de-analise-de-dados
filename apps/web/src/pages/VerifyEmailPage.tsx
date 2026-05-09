import { Button, Card, Result } from 'antd'
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { verifyEmail } from '../services/authService'

export function VerifyEmailPage() {
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const tenant = params.get('tenant') ?? ''
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>(token ? 'loading' : 'error')
  const [cooldown, setCooldown] = useState(45)
  useEffect(() => {
    if (!token) return
    verifyEmail(token).then(() => setStatus('ok')).catch(() => setStatus('error'))
  }, [token])
  useEffect(() => {
    if (status !== 'error' || cooldown <= 0) return
    const id = window.setTimeout(() => setCooldown((value) => Math.max(value - 1, 0)), 1000)
    return () => window.clearTimeout(id)
  }, [cooldown, status])
  return (
    <div className="login-shell">
      <Card className="app-card" style={{ width: 'min(560px, 92vw)' }}>
        <Result
          status={status === 'ok' ? 'success' : status === 'error' ? 'error' : 'info'}
          title={status === 'ok' ? 'Email verificado' : status === 'error' ? 'Link invalido ou expirado' : 'Verificando email'}
          extra={status === 'ok'
            ? <Link to={`/onboarding${tenant ? `?tenant=${tenant}` : ''}`}><Button type="primary">Continuar</Button></Link>
            : (
              <>
                <Button disabled={cooldown > 0}>{cooldown > 0 ? `Reenviar em ${cooldown}s` : 'Reenviar verificacao'}</Button>
                <Link to="/login">Entrar</Link>
              </>
            )}
        />
      </Card>
    </div>
  )
}
