import { Button, Card, Result, Space, Typography } from 'antd'
import { ArrowRightOutlined } from '@ant-design/icons'

function getSuperAdminUrl(): string {
  if (typeof window === 'undefined') return 'https://admin.iga.com'
  return window.location.hostname === 'localhost' ? 'http://localhost:3003' : 'https://admin.iga.com'
}

export function SuperAdminMovedPage() {
  const url = getSuperAdminUrl()

  return (
    <div style={{ padding: 24, maxWidth: 720, margin: '0 auto' }}>
      <Card>
        <Result
          status="info"
          title="Super Admin agora é um app separado"
          subTitle={
            <Space direction="vertical" size={8}>
              <Typography.Text>
                Pra reduzir superfície de ataque e separar contextos, o painel de operações
                cross-tenant foi movido pra um app dedicado.
              </Typography.Text>
              <Typography.Text type="secondary" code>
                {url}
              </Typography.Text>
            </Space>
          }
          extra={
            <Button
              type="primary"
              size="large"
              icon={<ArrowRightOutlined />}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
            >
              Abrir Super Admin
            </Button>
          }
        />
      </Card>
    </div>
  )
}

export default SuperAdminMovedPage
