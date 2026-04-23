import { LockOutlined, UserOutlined } from '@ant-design/icons'
import { Alert, Button, Card, Checkbox, Form, Input, Space } from 'antd'
import { useEffect, useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
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

type LoginForm = {
  email: string
  password: string
  remember: boolean
}

export function LoginPage() {
  const { isAuthenticated, signIn } = useAuth()
  const tenant = useTenant()
  const navigate = useNavigate()
  const location = useLocation()
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [lockoutMsg, setLockoutMsg] = useState<string | null>(null)

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
      await signIn({ email: values.email, password: values.password })
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

            <Space direction="vertical" size={8} style={{ width: '100%' }}>
              <Button type="primary" htmlType="submit" loading={submitting} block>
                Entrar
              </Button>
            </Space>
          </Form>
        </Card>
      </div>
    </div>
  )
}
