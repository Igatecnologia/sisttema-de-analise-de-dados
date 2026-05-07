import { Alert, Button, Card, Col, Descriptions, Popconfirm, Row, Skeleton, Space, Statistic, Table, Tag, message } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useEffect, useState } from 'react'
import { PageHeaderCard } from '../components/PageHeaderCard'
import { http } from '../services/http'

type TenantRow = {
  id: string
  slug: string
  name: string
  plan: string
  status: string
  trialEndsAt: string | null
  createdAt: string
  userCount: number
}

type TenantsResponse = {
  total: number
  tenants: TenantRow[]
  metrics: { byPlan: Record<string, number>; byStatus: Record<string, number> }
}

type Metrics = {
  mrrBrlFormatted: string
  activeSubscriptions: number
  trialingTenants: number
  suspendedTenants: number
  canceledSubscriptions: number
}

export function SuperAdminPage() {
  const [tenants, setTenants] = useState<TenantsResponse | null>(null)
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [forbidden, setForbidden] = useState(false)

  async function refresh() {
    setLoading(true)
    try {
      const [t, m] = await Promise.all([
        http.get<TenantsResponse>('/api/v1/super-admin/tenants'),
        http.get<Metrics>('/api/v1/super-admin/metrics'),
      ])
      setTenants(t.data)
      setMetrics(m.data)
    } catch (err) {
      const e = err as { response?: { status?: number } }
      if (e.response?.status === 403) setForbidden(true)
      else message.error('Falha ao carregar dados de super-admin')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
  }, [])

  async function suspendTenant(id: string) {
    try {
      await http.post(`/api/v1/super-admin/tenants/${id}/suspend`)
      message.success('Tenant suspenso')
      void refresh()
    } catch {
      message.error('Falha ao suspender')
    }
  }

  async function activateTenant(id: string) {
    try {
      await http.post(`/api/v1/super-admin/tenants/${id}/activate`)
      message.success('Tenant ativado')
      void refresh()
    } catch {
      message.error('Falha ao ativar')
    }
  }

  if (forbidden) {
    return (
      <div style={{ padding: 16 }}>
        <Alert
          type="error"
          showIcon
          message="Acesso restrito"
          description="Esta area eh exclusiva para super-administradores. Configure SUPER_ADMIN_EMAILS no backend."
        />
      </div>
    )
  }

  const columns: ColumnsType<TenantRow> = [
    { title: 'Slug', dataIndex: 'slug', key: 'slug' },
    { title: 'Nome', dataIndex: 'name', key: 'name' },
    {
      title: 'Plano',
      dataIndex: 'plan',
      key: 'plan',
      render: (plan: string) => <Tag color={plan === 'enterprise' ? 'gold' : plan === 'pro' ? 'blue' : 'default'}>{plan}</Tag>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (s: string) => <Tag color={s === 'active' ? 'green' : s === 'suspended' ? 'red' : 'default'}>{s}</Tag>,
    },
    { title: 'Usuarios', dataIndex: 'userCount', key: 'userCount', align: 'right' },
    {
      title: 'Trial ate',
      dataIndex: 'trialEndsAt',
      key: 'trialEndsAt',
      render: (v: string | null) => (v ? new Date(v).toLocaleDateString('pt-BR') : '—'),
    },
    {
      title: 'Acoes',
      key: 'actions',
      render: (_, record) =>
        record.status === 'suspended' ? (
          <Popconfirm title="Reativar este tenant?" onConfirm={() => activateTenant(record.id)}>
            <Button size="small" type="link">Ativar</Button>
          </Popconfirm>
        ) : (
          <Popconfirm title="Suspender este tenant? Acesso bloqueado imediatamente." onConfirm={() => suspendTenant(record.id)}>
            <Button size="small" type="link" danger>Suspender</Button>
          </Popconfirm>
        ),
    },
  ]

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <PageHeaderCard title="Super Admin" subtitle="Painel cross-tenant — uso restrito." />

      {loading ? <Skeleton active /> : metrics ? (
        <Row gutter={[16, 16]}>
          <Col xs={12} md={6}><Card><Statistic title="MRR" value={metrics.mrrBrlFormatted} /></Card></Col>
          <Col xs={12} md={6}><Card><Statistic title="Ativos" value={metrics.activeSubscriptions} /></Card></Col>
          <Col xs={12} md={6}><Card><Statistic title="Em trial" value={metrics.trialingTenants} /></Card></Col>
          <Col xs={12} md={6}><Card><Statistic title="Suspensos" value={metrics.suspendedTenants} /></Card></Col>
        </Row>
      ) : null}

      {tenants ? (
        <Card title={`Tenants (${tenants.total})`}>
          <Descriptions size="small" column={{ xs: 1, md: 4 }} style={{ marginBottom: 16 }}>
            {Object.entries(tenants.metrics.byPlan).map(([k, v]) => (
              <Descriptions.Item key={`p-${k}`} label={`Plano ${k}`}>{v}</Descriptions.Item>
            ))}
            {Object.entries(tenants.metrics.byStatus).map(([k, v]) => (
              <Descriptions.Item key={`s-${k}`} label={`Status ${k}`}>{v}</Descriptions.Item>
            ))}
          </Descriptions>
          <Table<TenantRow>
            rowKey="id"
            columns={columns}
            dataSource={tenants.tenants}
            size="small"
            pagination={{ pageSize: 25 }}
          />
        </Card>
      ) : null}

      <Card>
        <Space direction="vertical" size={4}>
          <Button onClick={refresh}>Atualizar</Button>
        </Space>
      </Card>
    </div>
  )
}

export default SuperAdminPage
