import { ArrowLeftOutlined } from '@ant-design/icons'
import { Button, Card, Space, Table, Tag, Typography } from 'antd'
import { useParams, Link } from 'react-router-dom'
import { PageHeaderCard } from '../components/PageHeaderCard'

const events = [
  { id: '1', action: 'login.success', resource: 'auth', createdAt: new Date().toISOString(), ip: '127.0.0.1' },
  { id: '2', action: 'report.export', resource: 'relatorios', createdAt: new Date(Date.now() - 3600_000).toISOString(), ip: '127.0.0.1' },
  { id: '3', action: 'settings.update', resource: 'configuracoes', createdAt: new Date(Date.now() - 7200_000).toISOString(), ip: '127.0.0.1' },
]

export function AuditLogPerUserPage() {
  const { id } = useParams()
  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <PageHeaderCard
        title="Historico do usuario"
        subtitle={`Eventos filtrados para o usuario ${id ?? ''}.`}
        extra={<Button icon={<ArrowLeftOutlined />}><Link to="/usuarios">Voltar</Link></Button>}
      />
      <Card className="app-card" variant="borderless">
        <Table
          rowKey="id"
          dataSource={events}
          pagination={false}
          columns={[
            { title: 'Acao', dataIndex: 'action', render: (value) => <Typography.Text code>{value}</Typography.Text> },
            { title: 'Recurso', dataIndex: 'resource', render: (value) => <Tag>{value}</Tag> },
            { title: 'IP', dataIndex: 'ip' },
            { title: 'Data', dataIndex: 'createdAt', render: (value) => new Date(value).toLocaleString('pt-BR') },
          ]}
        />
      </Card>
    </Space>
  )
}
