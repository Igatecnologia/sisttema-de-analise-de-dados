import { Button, Card, Form, Input, Result, Select, Steps, Typography } from 'antd'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { registerSelfService } from '../services/authService'
import { useTenant } from '../tenant/TenantContext'

type RegisterForm = {
  companyName: string
  slug: string
  name: string
  email: string
  password: string
  connectorId: string
}

export function RegisterPage() {
  const tenant = useTenant()
  const [created, setCreated] = useState<{ slug: string; token?: string } | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function onFinish(values: RegisterForm) {
    setSubmitting(true)
    try {
      const response = await registerSelfService(values)
      setCreated({ slug: response.tenant.slug, token: response.verification?.token })
      const { trackEvent } = await import('../services/analytics')
      trackEvent('auth_register', { connectorId: values.connectorId, slug: response.tenant.slug })
    } finally {
      setSubmitting(false)
    }
  }

  if (created) {
    return (
      <div className="login-shell">
        <Card className="app-card" style={{ width: 'min(720px, 92vw)' }}>
          <Result
            status="success"
            title="Empresa criada"
            subTitle="Seu trial de 14 dias esta ativo. Verifique o email e conclua o onboarding."
            extra={[
              created.token ? <Link key="verify" to={`/verify-email?tenant=${created.slug}&token=${created.token}`}>Verificar email</Link> : null,
              <Link key="login" to={`/login?tenant=${created.slug}`}>Entrar</Link>,
            ]}
          />
        </Card>
      </div>
    )
  }

  return (
    <div className="login-shell register-shell">
      <div className="login-card-wrap" style={{ maxWidth: 980 }}>
        <div className="login-brand-strip">
          <img src={tenant.logoUrl} alt={tenant.companyName} className="login-header-logo" />
          <div>
            <div className="login-brand-text">Teste gratis</div>
            <div className="login-brand-sub">14 dias para validar dados, equipe e dashboards</div>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: 16 }}>
          <Card className="app-card">
            <Steps
              size="small"
              current={0}
              items={[{ title: 'Empresa' }, { title: 'Admin' }, { title: 'Onboarding' }]}
              style={{ marginBottom: 24 }}
            />
            <Typography.Title level={2}>Criar conta</Typography.Title>
            <Form<RegisterForm> layout="vertical" onFinish={onFinish} initialValues={{ connectorId: 'sgbr-espuma' }}>
              <Form.Item name="companyName" label="Empresa" rules={[{ required: true, min: 2 }]}>
                <Input maxLength={160} />
              </Form.Item>
              <Form.Item name="slug" label="Slug do tenant" rules={[{ required: true, pattern: /^[a-z0-9][a-z0-9-]*[a-z0-9]$/ }]}>
                <Input maxLength={64} placeholder="minha-empresa" />
              </Form.Item>
              <Form.Item name="connectorId" label="Conector" rules={[{ required: true }]}>
                <Select options={[
                  { value: 'sgbr-espuma', label: 'SGBR Espuma' },
                  { value: 'iga-custom-api', label: 'API propria IGA' },
                  { value: 'generic', label: 'Generico' },
                ]} />
              </Form.Item>
              <Form.Item name="name" label="Seu nome" rules={[{ required: true, min: 2 }]}>
                <Input maxLength={120} />
              </Form.Item>
              <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email' }]}>
                <Input maxLength={254} />
              </Form.Item>
              <Form.Item name="password" label="Senha" rules={[{ required: true, min: 12 }]}>
                <Input.Password maxLength={128} />
              </Form.Item>
              <Button type="primary" htmlType="submit" loading={submitting} block>Criar trial</Button>
            </Form>
          </Card>
          <aside style={{ padding: 24, borderRadius: 16, background: 'rgba(22,119,255,0.08)', border: '1px solid rgba(22,119,255,0.18)' }}>
            <Typography.Title level={3}>Trial pronto para dados reais</Typography.Title>
            <Typography.Paragraph>Conecte SGBR BI, API generica ou uma API propria criada pela IGA quando o ERP nao tiver API oficial.</Typography.Paragraph>
            <Typography.Text strong>Inclui:</Typography.Text>
            <ul>
              <li>14 dias de teste</li>
              <li>Conectores por tenant</li>
              <li>Permissoes por perfil</li>
            </ul>
          </aside>
        </div>
      </div>
    </div>
  )
}
