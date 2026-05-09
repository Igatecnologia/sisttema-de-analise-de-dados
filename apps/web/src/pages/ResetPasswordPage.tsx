import { Button, Card, Form, Input, Result, Typography } from 'antd'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { resetPassword } from '../services/authService'

export function ResetPasswordPage() {
  const [params] = useSearchParams()
  const [done, setDone] = useState(false)
  const token = params.get('token') ?? ''
  const tenant = params.get('tenant') ?? ''
  async function onFinish(values: { password: string }) {
    await resetPassword(token, values.password)
    setDone(true)
  }
  return (
    <div className="login-shell">
      <Card className="app-card" style={{ width: 'min(520px, 92vw)' }}>
        {done ? (
          <Result status="success" title="Senha alterada" extra={<Link to={`/login${tenant ? `?tenant=${tenant}` : ''}`}>Entrar</Link>} />
        ) : (
          <>
            <Typography.Title level={2}>Nova senha</Typography.Title>
            <Form layout="vertical" onFinish={onFinish}>
              <Form.Item name="password" label="Senha" rules={[{ required: true, min: 12 }]}>
                <Input.Password maxLength={128} />
              </Form.Item>
              <Button type="primary" htmlType="submit" disabled={!token} block>Salvar senha</Button>
            </Form>
          </>
        )}
      </Card>
    </div>
  )
}
