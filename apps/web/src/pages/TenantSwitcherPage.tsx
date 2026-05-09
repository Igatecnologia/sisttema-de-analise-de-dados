import { AppstoreOutlined, CheckCircleOutlined, PlusOutlined } from '@ant-design/icons'
import { App, Button, Card, Col, Row, Skeleton, Space, Tag, Typography } from 'antd'
import { useMutation, useQuery } from '@tanstack/react-query'
import { PageHeaderCard } from '../components/PageHeaderCard'
import { queryKeys } from '../query/queryKeys'
import { listOrganizations, switchOrganization } from '../services/organizationsService'

export function TenantSwitcherPage() {
  const { message, notification } = App.useApp()
  const organizationsQuery = useQuery({ queryKey: queryKeys.organizations(), queryFn: listOrganizations })
  const switchMutation = useMutation({
    mutationFn: switchOrganization,
    onSuccess: async (result) => {
      await navigator.clipboard?.writeText(result.slug).catch(() => undefined)
      notification.info({ message: result.message, description: `Slug copiado: ${result.slug}` })
      message.info('Entre novamente selecionando a organizacao copiada.')
    },
  })
  const organizations = organizationsQuery.data ?? []

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <PageHeaderCard
        title="Organizacoes"
        subtitle="Alternancia de tenants preparada para o plugin de organizacoes."
        extra={<Button type="primary" icon={<PlusOutlined />}>Nova organizacao</Button>}
      />
      {organizationsQuery.isLoading ? <Card className="app-card" variant="borderless"><Skeleton active /></Card> : null}
      <Row gutter={[16, 16]}>
        {organizations.map((org) => {
          const active = org.current
          return (
            <Col xs={24} md={12} xl={8} key={org.id}>
              <Card className="app-card" variant="borderless">
                <Space direction="vertical" size={14} style={{ width: '100%' }}>
                  <Space style={{ justifyContent: 'space-between', width: '100%' }} align="start">
                    <Space>
                      <AppstoreOutlined />
                      <Typography.Title level={5} style={{ margin: 0 }}>{org.name}</Typography.Title>
                    </Space>
                    {active ? <Tag icon={<CheckCircleOutlined />} color="green">Atual</Tag> : <Tag>{org.status}</Tag>}
                  </Space>
                  <Typography.Text type="secondary">{org.subtitle}</Typography.Text>
                  <Space wrap>
                    <Tag color="blue">Plano {org.plan}</Tag>
                    <Tag>{org.status}</Tag>
                  </Space>
                  <Button block type={active ? 'default' : 'primary'} disabled={active} loading={switchMutation.isPending} onClick={() => switchMutation.mutate(org.slug)}>
                    {active ? 'Conectado' : 'Alternar'}
                  </Button>
                </Space>
              </Card>
            </Col>
          )
        })}
      </Row>
    </Space>
  )
}
