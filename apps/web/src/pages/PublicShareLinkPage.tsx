import { LockOutlined } from '@ant-design/icons'
import { Alert, Card, Col, Layout, Row, Skeleton, Space, Statistic, Tag, Typography } from 'antd'
import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { Logo } from '../assets/logo'
import { getPublicShare } from '../services/publicSharesService'

export function PublicShareLinkPage() {
  const { token } = useParams()
  const shareQuery = useQuery({
    queryKey: ['publicShare', token],
    queryFn: () => getPublicShare(token ?? ''),
    enabled: Boolean(token),
    retry: false,
  })
  const share = shareQuery.data
  const payload = share?.payload as { revenue?: number; margin?: number; alerts?: number } | undefined

  return (
    <Layout style={{ minHeight: '100vh', padding: 24 }}>
      <Space direction="vertical" size={16} style={{ width: '100%', maxWidth: 1120, margin: '0 auto' }}>
        {shareQuery.isLoading ? <Card className="app-card" variant="borderless"><Skeleton active /></Card> : null}
        {shareQuery.isError ? <Alert type="error" showIcon title="Link indisponivel" description="Este link nao existe, expirou ou foi revogado." /> : null}
        <Card className="app-card" variant="borderless">
          <Space style={{ width: '100%', justifyContent: 'space-between' }} wrap>
            <Space>
              <Logo size="md" />
              <div>
                <Typography.Title level={4} style={{ margin: 0 }}>{share?.title ?? 'Dashboard compartilhado'}</Typography.Title>
                <Typography.Text type="secondary">{share?.description ?? 'Acesso somente leitura'}</Typography.Text>
              </div>
            </Space>
            <Tag icon={<LockOutlined />} color="blue">Link publico protegido</Tag>
          </Space>
        </Card>
        <Row gutter={[16, 16]}>
          <Col xs={24} md={8}><Card variant="borderless"><Statistic title="Receita" value={payload?.revenue ?? 0} prefix="R$" precision={2} /></Card></Col>
          <Col xs={24} md={8}><Card variant="borderless"><Statistic title="Margem" value={payload?.margin ?? 0} suffix="%" precision={1} /></Card></Col>
          <Col xs={24} md={8}><Card variant="borderless"><Statistic title="Alertas" value={payload?.alerts ?? 0} /></Card></Col>
        </Row>
        <Card className="app-card" variant="borderless">
          <Typography.Title level={5}>Resumo executivo</Typography.Title>
          <Typography.Paragraph>
            Link {token ? <Typography.Text code>{token}</Typography.Text> : null} renderizado em modo read-only.
            Os dados reais devem ser resolvidos pelo backend a partir do token publico.
          </Typography.Paragraph>
        </Card>
      </Space>
    </Layout>
  )
}
