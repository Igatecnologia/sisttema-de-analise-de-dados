import { LockOutlined, MailOutlined, SafetyCertificateOutlined } from '@ant-design/icons'
import { Alert, Button, Checkbox, Divider, Form, Input, Space, Tag, Typography } from 'antd'
import { useEffect, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { useTenant } from '../tenant/TenantContext'
import { sanitizeAppRedirectPath } from '../utils/sanitizeAppRedirectPath'
import { checkLoginAllowed, recordLoginAttempt, getLoginAttemptsRemaining } from '../auth/loginThrottle'
import { listDataSourcesFromApi } from '../services/dataSourceService'
import {
  getRememberPreference,
  setRememberPreference,
  getRememberedEmail,
  setRememberedEmail,
  setStoredSession,
} from '../auth/authStorage'
import { TurnstileWidget } from '../components/TurnstileWidget'
import { http } from '../services/http'

type LoginForm = {
  email: string
  password: string
  remember: boolean
  totp?: string
}

export function LoginPage() {
  const { isAuthenticated, signIn } = useAuth()
  const tenant = useTenant()
  const navigate = useNavigate()
  const location = useLocation()
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [lockoutMsg, setLockoutMsg] = useState<string | null>(null)
  const [mfaRequired, setMfaRequired] = useState(false)
  const [captchaToken, setCaptchaToken] = useState<string>('')

  useEffect(() => {
    if (!captchaToken) return
    const interceptor = http.interceptors.request.use((config) => {
      if (config.url?.includes('/api/v1/auth/login')) {
        config.headers = config.headers ?? {}
        config.headers['X-Turnstile-Token'] = captchaToken
      }
      return config
    })
    return () => http.interceptors.request.eject(interceptor)
  }, [captchaToken])

  const from = sanitizeAppRedirectPath(
    (location.state as { from?: string } | null)?.from,
    '/gestao',
  )

  const [configured, setConfigured] = useState<boolean | null>(null)

  useEffect(() => {
    let mounted = true
    listDataSourcesFromApi()
      .then((items) => {
        if (mounted) setConfigured(items.length > 0)
      })
      .catch(() => {
        if (mounted) setConfigured(null)
      })
    return () => {
      mounted = false
    }
  }, [])

  if (isAuthenticated) return <Navigate to={from} replace />

  async function onFinish(values: LoginForm) {
    const { allowed, waitSeconds } = checkLoginAllowed()
    if (!allowed) {
      setLockoutMsg(`Muitas tentativas. Aguarde ${waitSeconds}s antes de tentar novamente.`)
      return
    }
    setLockoutMsg(null)

    setRememberPreference(values.remember)
    setSubmitting(true)
    setErrorMsg(null)
    try {
      const outcome = await signIn({
        email: values.email,
        password: values.password,
        totp: values.totp?.trim() || undefined,
      })
      if (outcome.kind === 'mfa-required') {
        setMfaRequired(true)
        setSubmitting(false)
        setErrorMsg(null)
        return
      }
      const sess = (await import('../auth/authStorage')).getStoredSession()
      if (sess) setStoredSession(sess, values.remember)
      if (values.remember) setRememberedEmail(values.email)
      else setRememberedEmail('')
      recordLoginAttempt(true)
      const { trackEvent, identifyUser } = await import('../services/analytics')
      if (sess?.user.id) identifyUser(sess.user.id, { role: sess.user.role })
      trackEvent('auth_login', { mfa: Boolean(values.totp) })
      navigate(from, { replace: true })
    } catch (err) {
      recordLoginAttempt(false)
      const remaining = getLoginAttemptsRemaining()
      const message = err instanceof Error ? err.message : 'Falha ao fazer login.'
      setErrorMsg(
        remaining > 0
          ? `${message} (${remaining} tentativa${remaining === 1 ? '' : 's'} restante${remaining === 1 ? '' : 's'})`
          : message,
      )
    } finally {
      setSubmitting(false)
    }
  }

  const primaryColor = tenant.primaryColor || '#1677ff'

  return (
    <div className="login-shell-premium">
      {/* Coluna esquerda: formulário */}
      <div className="login-form-pane">
        <div className="login-form-inner">
          {/* Brand minimalista no topo */}
          <header className="login-header">
            {tenant.logoUrl ? (
              <img src={tenant.logoUrl} alt={tenant.companyName} className="login-logo" />
            ) : null}
            <div className="login-brand">
              <Typography.Text strong style={{ fontSize: 14, lineHeight: 1.2 }}>
                {tenant.companyName}
              </Typography.Text>
              <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                {tenant.subtitle}
              </Typography.Text>
            </div>
          </header>

          <div className="login-form-content">
            <div className="login-headline">
              <Typography.Title level={2} style={{ marginBottom: 4, fontWeight: 700, letterSpacing: '-0.02em' }}>
                Bem-vindo de volta
              </Typography.Title>
              <Typography.Text type="secondary" style={{ fontSize: 14 }}>
                Acesse o painel para gerenciar sua operação.
              </Typography.Text>
            </div>

            {configured === false && (
              <Alert
                type="info"
                showIcon
                message="Sistema ainda não configurado"
                description="O administrador precisa configurar a conexão com seu ERP antes do primeiro uso."
                style={{ marginBottom: 16 }}
              />
            )}

            <Form<LoginForm>
              layout="vertical"
              onFinish={onFinish}
              initialValues={{
                email: getRememberedEmail(),
                password: '',
                remember: getRememberPreference(),
              }}
              scrollToFirstError
              size="large"
              requiredMark={false}
            >
              {lockoutMsg ? (
                <Alert type="warning" showIcon message={lockoutMsg} style={{ marginBottom: 16 }} />
              ) : null}

              {errorMsg ? (
                <Alert type="error" showIcon message={errorMsg} style={{ marginBottom: 16 }} />
              ) : null}

              <Form.Item
                label="Email ou usuário"
                name="email"
                rules={[
                  { required: true, message: 'Informe o email ou usuário.' },
                  { max: 254, message: 'Máximo 254 caracteres.' },
                ]}
                normalize={(v: string) => v.trim()}
              >
                <Input
                  prefix={<MailOutlined style={{ color: 'var(--qc-text-muted, #8c8c8c)' }} />}
                  placeholder="seu@email.com"
                  autoComplete="username"
                  maxLength={254}
                  autoFocus
                />
              </Form.Item>

              <Form.Item
                label={
                  <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                    <span>Senha</span>
                    <Link to="/forgot-password" style={{ fontSize: 13, fontWeight: 400 }}>
                      Esqueci minha senha
                    </Link>
                  </div>
                }
                name="password"
                rules={[
                  { required: true, message: 'Informe a senha.' },
                  { min: 1, message: 'Senha não pode ser vazia.' },
                ]}
              >
                <Input.Password
                  prefix={<LockOutlined style={{ color: 'var(--qc-text-muted, #8c8c8c)' }} />}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  maxLength={128}
                />
              </Form.Item>

              {mfaRequired ? (
                <Form.Item
                  label="Código de autenticação (2FA)"
                  name="totp"
                  rules={[
                    { required: true, message: 'Informe o código do app autenticador.' },
                    { min: 6, message: 'Mínimo 6 dígitos.' },
                    { max: 16, message: 'Máximo 16 caracteres.' },
                  ]}
                  extra="Use o código de 6 dígitos do seu app autenticador ou um código de backup."
                >
                  <Input
                    prefix={<SafetyCertificateOutlined style={{ color: 'var(--qc-text-muted, #8c8c8c)' }} />}
                    placeholder="123 456"
                    autoComplete="one-time-code"
                    inputMode="numeric"
                    maxLength={16}
                  />
                </Form.Item>
              ) : null}

              <Form.Item name="remember" valuePropName="checked" style={{ marginBottom: 16 }}>
                <Checkbox>Manter conectado neste computador</Checkbox>
              </Form.Item>

              <div style={{ marginBottom: 16 }}>
                <TurnstileWidget onToken={setCaptchaToken} />
              </div>

              <Button
                type="primary"
                htmlType="submit"
                loading={submitting}
                block
                size="large"
                style={{
                  height: 48,
                  fontSize: 15,
                  fontWeight: 600,
                  background: primaryColor,
                  borderColor: primaryColor,
                }}
              >
                {mfaRequired ? 'Verificar código' : 'Entrar'}
              </Button>

              <Divider style={{ margin: '24px 0 16px', fontSize: 12 }}>ou</Divider>

              <div style={{ textAlign: 'center' }}>
                <Typography.Text type="secondary" style={{ fontSize: 14 }}>
                  Ainda não tem conta?{' '}
                </Typography.Text>
                <Link to="/register" style={{ fontWeight: 600 }}>
                  Criar trial grátis
                </Link>
              </div>
            </Form>
          </div>

          <footer className="login-footer">
            <Space size={12} wrap>
              <Tag icon={<SafetyCertificateOutlined />} color="green" bordered={false} style={{ fontSize: 11 }}>
                SSL/TLS
              </Tag>
              <Tag color="blue" bordered={false} style={{ fontSize: 11 }}>
                MFA disponível
              </Tag>
              <Tag color="purple" bordered={false} style={{ fontSize: 11 }}>
                LGPD
              </Tag>
            </Space>
            <Typography.Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 12 }}>
              Ao entrar, você concorda com os{' '}
              <Link to="/legal/termos" style={{ fontSize: 11 }}>
                Termos
              </Link>{' '}
              e a{' '}
              <Link to="/legal/privacidade" style={{ fontSize: 11 }}>
                Política de Privacidade
              </Link>
              .
            </Typography.Text>
          </footer>
        </div>
      </div>

      {/* Coluna direita: hero/branding (escondida em mobile) */}
      <aside className="login-hero-pane" style={{ background: `linear-gradient(135deg, ${primaryColor}f0 0%, ${primaryColor}c0 60%, #0a1628 100%)` }}>
        <div className="login-hero-mesh" aria-hidden />
        <div className="login-hero-content">
          <div className="login-hero-top">
            {tenant.logoUrl ? (
              <img src={tenant.logoUrl} alt={tenant.companyName} className="login-hero-logo" />
            ) : null}
            <Typography.Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              {tenant.companyName} · {tenant.subtitle}
            </Typography.Text>
          </div>

          <div className="login-hero-message">
            <Typography.Title
              level={1}
              style={{
                color: '#fff',
                fontWeight: 700,
                fontSize: 'clamp(28px, 3.4vw, 44px)',
                lineHeight: 1.1,
                marginBottom: 16,
                letterSpacing: '-0.03em',
              }}
            >
              Gestão industrial com inteligência integrada.
            </Typography.Title>
            <Typography.Paragraph
              style={{
                color: 'rgba(255,255,255,0.8)',
                fontSize: 16,
                lineHeight: 1.6,
                marginBottom: 32,
                maxWidth: 480,
              }}
            >
              Conecte qualquer ERP, visualize indicadores em tempo real e tome decisões baseadas em dados —
              tudo num painel único, multi-segmento, com IA conversacional nativa.
            </Typography.Paragraph>

            <div className="login-hero-features">
              <FeatureRow
                title="Multi-ERP em 3 cliques"
                description="SGBR, Bling, Tiny, Omie, API própria ou CSV — conecte sua fonte e o painel se adapta."
              />
              <FeatureRow
                title="Copilot IA com 18 ferramentas"
                description="Pergunte em linguagem natural — o sistema executa consultas reais nas suas fontes."
              />
              <FeatureRow
                title="Segurança enterprise"
                description="MFA/TOTP, audit log com hash chain, isolamento RLS por tenant, criptografia AES-256."
              />
            </div>
          </div>

          <div className="login-hero-bottom">
            <div className="login-hero-stats">
              <div>
                <div className="login-hero-stat-value">4</div>
                <div className="login-hero-stat-label">Segmentos</div>
              </div>
              <div className="login-hero-divider" />
              <div>
                <div className="login-hero-stat-value">7</div>
                <div className="login-hero-stat-label">Conectores</div>
              </div>
              <div className="login-hero-divider" />
              <div>
                <div className="login-hero-stat-value">99,5%</div>
                <div className="login-hero-stat-label">Uptime SLA</div>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </div>
  )
}

function FeatureRow({ title, description }: { title: string; description: string }) {
  return (
    <div className="login-hero-feature">
      <div className="login-hero-feature-bullet">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
          <path d="M11.667 4L5.5 10.167 2.333 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <div>
        <div style={{ color: '#fff', fontSize: 15, fontWeight: 600, marginBottom: 2 }}>{title}</div>
        <div style={{ color: 'rgba(255,255,255,0.72)', fontSize: 13, lineHeight: 1.5 }}>{description}</div>
      </div>
    </div>
  )
}
