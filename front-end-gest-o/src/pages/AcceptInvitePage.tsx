import { Button, Card, Form, Input, Result, Typography } from 'antd'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { acceptInvite } from '../services/authService'

export function AcceptInvitePage() {
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const tenant = params.get('tenant') ?? ''
  const [done, setDone] = useState(false)

  async function onFinish(values: { name: string; password: string }) {
    await acceptInvite({ token, name: values.name, password: values.password })
    setDone(true)
  }

  return (
    <div className="login-shell">
      <Card className="app-card" style={{ width: 'min(540px, 92vw)' }}>
        {done ? (
          <Result status="success" title="Convite aceito" extra={<Link to={`/login${tenant ? `?tenant=${tenant}` : ''}`}>Entrar</Link>} />
        ) : (
          <>
            <Typography.Title level={2}>Aceitar convite</Typography.Title>
            <Form layout="vertical" onFinish={onFinish}>
              <Form.Item name="name" label="Nome" rules={[{ required: true, min: 2 }]}>
                <Input maxLength={120} />
              </Form.Item>
              <Form.Item name="password" label="Senha" rules={[{ required: true, min: 12 }]}>
                <Input.Password maxLength={128} />
              </Form.Item>
              <Button type="primary" htmlType="submit" disabled={!token} block>Criar acesso</Button>
            </Form>
          </>
        )}
      </Card>
    </div>
  )
}
