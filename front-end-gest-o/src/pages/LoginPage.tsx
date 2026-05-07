import { LockOutlined, UserOutlined } from '@ant-design/icons'
import { Alert, Button, Card, Checkbox, Form, Input, Space } from 'antd'
import { useEffect, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { PageHeaderCard } from '../components/PageHeaderCard'
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

  // Adiciona o token do captcha no header da proxima requisicao
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
        // Se o backend estiver indisponivel, não marcar como "nao configurado".
        if (mounted) setConfigured(null)
      })
    return () => { mounted = false }
  }, [])

  if (isAuthenticated) return <Navigate to={from} replace />

  async function onFinish(values: LoginForm) {
    const { allowed, waitSeconds } = checkLoginAllowed()
    if (!allowed) {
      setLockoutMsg(`Muitas tentativas. Aguarde ${waitSeconds}s antes de tentar novamente.`)
      return
    }
    setLockoutMsg(null)

    /** Persistência precisa ser definida ANTES do signIn — o `setStoredSession`
     *  dentro do AuthProvider lê a preferência salva pra decidir o storage. */
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
      /** Reaplica a sessão no storage correto (caso tenha mudado o checkbox antes do signIn). */
      const sess = (await import('../auth/authStorage')).getStoredSession()
      if (sess) setStoredSession(sess, values.remember)
      if (values.remember) setRememberedEmail(values.email)
      else setRememberedEmail('')
      recordLoginAttempt(true)
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

  return (
    <div className="login-shell">
      <div className="login-card-wrap">
        <div className="login-brand-strip">
          {tenant.logoUrl ? (
            <img
              src={tenant.logoUrl}
              alt={tenant.companyName}
              className="login-header-logo"
            />
          ) : null}
          <div>
            <div className="login-brand-text">{tenant.companyName}</div>
            <div className="login-brand-sub">{tenant.subtitle}</div>
          </div>
        </div>
        <PageHeaderCard
          title="Entrar"
          subtitle={`Acesse o painel ${tenant.companyName} com suas credenciais.`}
        />

        {configured === false && (
          <Alert
            type="warning"
            showIcon
            message="Sistema ainda nao configurado"
            description="Entre em contato com o administrador para configurar a conexao com o seu sistema."
            style={{ marginTop: 16 }}
          />
        )}

        <Card className="app-card" style={{ marginTop: 16, borderRadius: 14 }}>
          <Form<LoginForm>
            layout="vertical"
            onFinish={onFinish}
            initialValues={{
              email: getRememberedEmail(),
              password: '',
              remember: getRememberPreference(),
            }}
            scrollToFirstError
          >
            {lockoutMsg ? (
              <Alert type="warning" showIcon message={lockoutMsg} className="login-error-alert" />
            ) : null}

            {errorMsg ? (
              <Alert type="error" showIcon message={errorMsg} className="login-error-alert" />
            ) : null}

            <Form.Item
              label="Usuário"
              name="email"
              rules={[
                { required: true, message: 'Informe o usuário.' },
                { max: 254, message: 'Máximo 254 caracteres.' },
              ]}
              normalize={(v: string) => v.trim()}
            >
              <Input
                prefix={<UserOutlined />}
                placeholder="Email ou usuário"
                autoComplete="username"
                maxLength={254}
              />
            </Form.Item>

            <Form.Item
              label="Senha"
              name="password"
              rules={[
                { required: true, message: 'Informe a senha.' },
                { min: 1, message: 'Senha não pode ser vazia.' },
              ]}
            >
              <Input.Password
                prefix={<LockOutlined />}
                placeholder="Senha"
                autoComplete="current-password"
                maxLength={128}
              />
            </Form.Item>

            <Form.Item name="remember" valuePropName="checked" style={{ marginBottom: 12 }}>
              <Checkbox>Manter conectado neste computador</Checkbox>
            </Form.Item>

            <div style={{ marginBottom: 12 }}>
              <TurnstileWidget onToken={setCaptchaToken} />
            </div>

            {mfaRequired ? (
              <Form.Item
                label="Codigo de autenticacao (2FA)"
                name="totp"
                rules={[
                  { required: true, message: 'Informe o codigo do app autenticador.' },
                  { min: 6, message: 'Minimo 6 digitos.' },
                  { max: 16, message: 'Maximo 16 caracteres.' },
                ]}
              >
                <Input
                  placeholder="6 digitos do app ou codigo de backup"
                  autoComplete="one-time-code"
                  inputMode="numeric"
                  maxLength={16}
                  autoFocus
                />
              </Form.Item>
            ) : null}

            <Space direction="vertical" size={8} style={{ width: '100%' }}>
              <Button type="primary" htmlType="submit" loading={submitting} block>
                {mfaRequired ? 'Verificar codigo' : 'Entrar'}
              </Button>
              <Space style={{ justifyContent: 'space-between', width: '100%' }}>
                <Link to="/forgot-password">Esqueci minha senha</Link>
                <Link to="/register">Criar trial</Link>
              </Space>
            </Space>
          </Form>
        </Card>
      </div>
    </div>
  )
}
