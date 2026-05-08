import { Alert, Button, Card, Col, Descriptions, Form, Input, Modal, Popconfirm, Row, Select, Skeleton, Space, Statistic, Table, Tag, message } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useEffect, useState } from 'react'
import { PageHeaderCard } from '../components/PageHeaderCard'
import { http } from '../services/http'
import type { AuthSession } from '../auth/authStorage'
import { setStoredSession } from '../auth/authStorage'

type TenantRow = {
  id: string
  slug: string
  name: string
  plan: string
  status: string
  trialEndsAt: string | null
  createdAt: string
  userCount: number
  datasourceCount: number
  subscriptionStatus: string
  mrrBrlCents: number
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
  churnRatePct: number
}

type TenantForm = {
  slug?: string
  name: string
  subtitle?: string
  plan: 'trial' | 'starter' | 'pro' | 'enterprise'
  status: 'active' | 'inactive'
  connectorId?: string
}

export function SuperAdminPage() {
  const [tenants, setTenants] = useState<TenantsResponse | null>(null)
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [forbidden, setForbidden] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<TenantRow | null>(null)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm<TenantForm>()

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

  async function impersonateTenant(id: string) {
    try {
      const { data } = await http.post<AuthSession>(`/api/v1/super-admin/tenants/${id}/impersonate`)
      setStoredSession(data)
      window.location.assign('/')
    } catch {
      message.error('Falha ao iniciar impersonation')
    }
  }

  async function saveTenant() {
    try {
      const values = await form.validateFields()
      setSaving(true)
      const payload = {
        ...values,
        subtitle: values.subtitle?.trim() || 'Gestao e Analise de Dados',
        connectorId: values.connectorId?.trim() || 'sgbr-espuma',
      }
      if (editing) {
        await http.put(`/api/v1/super-admin/tenants/${editing.id}`, payload)
        message.success('Tenant atualizado')
      } else {
        await http.post('/api/v1/super-admin/tenants', payload)
        message.success('Tenant criado')
      }
      setModalOpen(false)
      void refresh()
    } catch (err) {
      if (err && typeof err === 'object' && 'errorFields' in err) return
      message.error('Falha ao salvar tenant')
    } finally {
      setSaving(false)
    }
  }

  async function removeTenant(id: string) {
    try {
      await http.delete(`/api/v1/super-admin/tenants/${id}`)
      message.success('Tenant excluido')
      void refresh()
    } catch {
      message.error('Falha ao excluir tenant')
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
    { title: 'Fontes', dataIndex: 'datasourceCount', key: 'datasourceCount', align: 'right' },
    {
      title: 'MRR',
      dataIndex: 'mrrBrlCents',
      key: 'mrrBrlCents',
      align: 'right',
      render: (v: number) => (v / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
    },
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
        <Space>
          {record.status === 'suspended' ? (
            <Popconfirm title="Reativar este tenant?" onConfirm={() => activateTenant(record.id)}>
              <Button size="small" type="link">Ativar</Button>
            </Popconfirm>
          ) : (
            <>
              <Button size="small" type="link" onClick={() => impersonateTenant(record.id)}>Entrar</Button>
              <Button
                size="small"
                type="link"
                onClick={() => {
                  setEditing(record)
                  form.setFieldsValue({
                    slug: record.slug,
                    name: record.name,
                    subtitle: 'Gestao e Analise de Dados',
                    plan: record.plan as TenantForm['plan'],
                    status: record.status === 'inactive' ? 'inactive' : 'active',
                    connectorId: 'sgbr-espuma',
                  })
                  setModalOpen(true)
                }}
              >
                Editar
              </Button>
              <Popconfirm title="Suspender este tenant? Acesso bloqueado imediatamente." onConfirm={() => suspendTenant(record.id)}>
                <Button size="small" type="link" danger>Suspender</Button>
              </Popconfirm>
              {record.id !== 'default' ? (
                <Popconfirm title="Excluir tenant?" description="Use apenas para ambientes de teste." onConfirm={() => removeTenant(record.id)}>
                  <Button size="small" type="link" danger>Excluir</Button>
                </Popconfirm>
              ) : null}
            </>
          )}
        </Space>,
    },
  ]

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <PageHeaderCard
        title="Super Admin"
        subtitle="Painel cross-tenant — uso restrito."
        extra={
          <Button
            type="primary"
            onClick={() => {
              setEditing(null)
              form.resetFields()
              form.setFieldsValue({ plan: 'trial', status: 'active', connectorId: 'sgbr-espuma' })
              setModalOpen(true)
            }}
          >
            Novo tenant
          </Button>
        }
      />

      {loading ? <Skeleton active /> : metrics ? (
        <Row gutter={[16, 16]}>
          <Col xs={12} md={6}><Card><Statistic title="MRR" value={metrics.mrrBrlFormatted} /></Card></Col>
          <Col xs={12} md={6}><Card><Statistic title="Ativos" value={metrics.activeSubscriptions} /></Card></Col>
          <Col xs={12} md={6}><Card><Statistic title="Em trial" value={metrics.trialingTenants} /></Card></Col>
          <Col xs={12} md={6}><Card><Statistic title="Churn" value={metrics.churnRatePct} suffix="%" /></Card></Col>
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

      <Modal
        open={modalOpen}
        title={editing ? 'Editar tenant' : 'Novo tenant'}
        okText={editing ? 'Salvar' : 'Criar'}
        cancelText="Cancelar"
        confirmLoading={saving}
        onCancel={() => setModalOpen(false)}
        onOk={saveTenant}
      >
        <Form<TenantForm> form={form} layout="vertical">
          <Form.Item label="Slug" name="slug" rules={[{ required: !editing, message: 'Informe o slug.' }]}>
            <Input disabled={!!editing} placeholder="acme-industria" />
          </Form.Item>
          <Form.Item label="Nome" name="name" rules={[{ required: true, message: 'Informe o nome.' }]}>
            <Input placeholder="Acme Industria" />
          </Form.Item>
          <Form.Item label="Subtitulo" name="subtitle">
            <Input placeholder="Gestao e Analise de Dados" />
          </Form.Item>
          <Space style={{ width: '100%' }} size={12}>
            <Form.Item label="Plano" name="plan" style={{ flex: 1 }} rules={[{ required: true }]}>
              <Select
                options={[
                  { value: 'trial', label: 'Trial' },
                  { value: 'starter', label: 'Starter' },
                  { value: 'pro', label: 'Pro' },
                  { value: 'enterprise', label: 'Enterprise' },
                ]}
              />
            </Form.Item>
            <Form.Item label="Status" name="status" style={{ flex: 1 }} rules={[{ required: true }]}>
              <Select options={[{ value: 'active', label: 'Ativo' }, { value: 'inactive', label: 'Inativo' }]} />
            </Form.Item>
          </Space>
          <Form.Item label="Connector" name="connectorId">
            <Input placeholder="sgbr-espuma" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default SuperAdminPage
