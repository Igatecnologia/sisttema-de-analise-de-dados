import { Button, Card, Form, Input, Modal, Popconfirm, Select, Space, Switch, Table, Tag, Typography, message } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useEffect, useState } from 'react'
import { PageHeaderCard } from '../components/PageHeaderCard'
import { http } from '../services/http'

type WebhookSubscription = {
  id: string
  name: string
  url: string
  eventTypes: string[]
  active: boolean
  signingSecretPreview: string
  updatedAt: string
}

type WebhookDelivery = {
  id: string
  subscriptionId: string
  eventType: string
  status: 'pending' | 'success' | 'failed'
  attempts: number
  statusCode: number | null
  error: string | null
  createdAt: string
}

type WebhookForm = {
  name: string
  url: string
  eventTypes: string[]
  active: boolean
}

export function WebhooksPage() {
  const [subscriptions, setSubscriptions] = useState<WebhookSubscription[]>([])
  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([])
  const [eventTypes, setEventTypes] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<WebhookSubscription | null>(null)
  const [form] = Form.useForm<WebhookForm>()

  async function load() {
    setLoading(true)
    try {
      const [subs, dels] = await Promise.all([
        http.get<{ subscriptions: WebhookSubscription[]; eventTypes: string[] }>('/api/v1/webhooks'),
        http.get<{ deliveries: WebhookDelivery[] }>('/api/v1/webhooks/deliveries/recent'),
      ])
      setSubscriptions(subs.data.subscriptions)
      setEventTypes(subs.data.eventTypes)
      setDeliveries(dels.data.deliveries)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  async function save() {
    const values = await form.validateFields()
    if (editing) {
      await http.put(`/api/v1/webhooks/${editing.id}`, values)
      message.success('Webhook atualizado')
    } else {
      await http.post('/api/v1/webhooks', values)
      message.success('Webhook criado')
    }
    setModalOpen(false)
    await load()
  }

  async function remove(id: string) {
    await http.delete(`/api/v1/webhooks/${id}`)
    message.success('Webhook removido')
    await load()
  }

  async function test(id: string) {
    await http.post(`/api/v1/webhooks/${id}/test`)
    message.success('Entrega de teste enfileirada')
    setTimeout(() => { void load() }, 800)
  }

  const subscriptionColumns: ColumnsType<WebhookSubscription> = [
    { title: 'Nome', dataIndex: 'name', key: 'name' },
    { title: 'URL', dataIndex: 'url', key: 'url', ellipsis: true },
    { title: 'Eventos', dataIndex: 'eventTypes', key: 'eventTypes', render: (items: string[]) => items.map((item) => <Tag key={item}>{item}</Tag>) },
    { title: 'Status', dataIndex: 'active', key: 'active', render: (active: boolean) => <Tag color={active ? 'green' : 'default'}>{active ? 'Ativo' : 'Inativo'}</Tag> },
    { title: 'Secret', dataIndex: 'signingSecretPreview', key: 'signingSecretPreview', render: (v: string) => <Typography.Text code>{v}</Typography.Text> },
    {
      title: 'Acoes',
      key: 'actions',
      render: (_, row) => (
        <Space>
          <Button size="small" onClick={() => void test(row.id)}>Testar</Button>
          <Button
            size="small"
            onClick={() => {
              setEditing(row)
              form.setFieldsValue({ name: row.name, url: row.url, eventTypes: row.eventTypes, active: row.active })
              setModalOpen(true)
            }}
          >
            Editar
          </Button>
          <Popconfirm title="Remover webhook?" onConfirm={() => void remove(row.id)}>
            <Button size="small" danger>Excluir</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  const deliveryColumns: ColumnsType<WebhookDelivery> = [
    { title: 'Evento', dataIndex: 'eventType', key: 'eventType' },
    { title: 'Status', dataIndex: 'status', key: 'status', render: (status: string) => <Tag color={status === 'success' ? 'green' : status === 'failed' ? 'red' : 'orange'}>{status}</Tag> },
    { title: 'Tentativas', dataIndex: 'attempts', key: 'attempts', align: 'right' },
    { title: 'HTTP', dataIndex: 'statusCode', key: 'statusCode', render: (v: number | null) => v ?? '-' },
    { title: 'Erro', dataIndex: 'error', key: 'error', ellipsis: true, render: (v: string | null) => v ?? '-' },
    { title: 'Criado em', dataIndex: 'createdAt', key: 'createdAt', render: (v: string) => new Date(v).toLocaleString('pt-BR') },
  ]

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <PageHeaderCard
        title="Webhooks"
        subtitle="Entregas enterprise para eventos do tenant com assinatura HMAC e retry exponencial."
        extra={
          <Button
            type="primary"
            onClick={() => {
              setEditing(null)
              form.resetFields()
              form.setFieldsValue({ active: true, eventTypes: ['tenant.updated'] })
              setModalOpen(true)
            }}
          >
            Novo webhook
          </Button>
        }
      />

      <Card title="Assinaturas">
        <Table rowKey="id" loading={loading} columns={subscriptionColumns} dataSource={subscriptions} pagination={false} />
      </Card>

      <Card title="Entregas recentes">
        <Table rowKey="id" loading={loading} columns={deliveryColumns} dataSource={deliveries} />
      </Card>

      <Modal
        open={modalOpen}
        title={editing ? 'Editar webhook' : 'Novo webhook'}
        okText={editing ? 'Salvar' : 'Criar'}
        cancelText="Cancelar"
        onOk={() => void save()}
        onCancel={() => setModalOpen(false)}
      >
        <Form<WebhookForm> form={form} layout="vertical">
          <Form.Item name="name" label="Nome" rules={[{ required: true }]}>
            <Input placeholder="CRM, BI externo, fila do cliente..." />
          </Form.Item>
          <Form.Item name="url" label="URL" rules={[{ required: true }, { type: 'url' }]}>
            <Input placeholder="https://cliente.com.br/webhooks/iga" />
          </Form.Item>
          <Form.Item name="eventTypes" label="Eventos" rules={[{ required: true }]}>
            <Select mode="multiple" options={eventTypes.map((value) => ({ value, label: value }))} />
          </Form.Item>
          <Form.Item name="active" label="Ativo" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default WebhooksPage
