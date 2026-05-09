import { Alert, Button, Card, Form, Input, Typography } from 'antd'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { requestPasswordReset } from '../services/authService'

export function ForgotPasswordPage() {
  const [params] = useSearchParams()
  const tenant = params.get('tenant') ?? ''
  const [token, setToken] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  async function onFinish(values: { email: string }) {
    setSubmitting(true)
    try {
      const response = await requestPasswordReset(values.email)
      setToken(response.token ?? '')
    } finally {
      setSubmitting(false)
    }
  }
  return (
    <div className="login-shell">
      <Card className="app-card" style={{ width: 'min(520px, 92vw)' }}>
        <Typography.Title level={2}>Recuperar senha</Typography.Title>
        {token !== null ? (
          <Alert
            type="success"
            showIcon
            message="Se o email existir, enviaremos as instrucoes."
            description={token ? <Link to={`/reset-password?${tenant ? `tenant=${tenant}&` : ''}token=${token}`}>Abrir reset de senha</Link> : null}
          />
        ) : (
          <Form layout="vertical" onFinish={onFinish}>
            <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email' }]}>
              <Input maxLength={254} />
            </Form.Item>
            <Button type="primary" htmlType="submit" loading={submitting} block>Enviar</Button>
          </Form>
        )}
      </Card>
    </div>
  )
}
