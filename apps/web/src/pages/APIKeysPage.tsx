import { DeleteOutlined, KeyOutlined, PlusOutlined } from '@ant-design/icons'
import { App, Button, Card, Form, Input, Modal, Select, Space, Table, Tag, Typography } from 'antd'
import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { PageHeaderCard } from '../components/PageHeaderCard'
import { queryKeys } from '../query/queryKeys'
import { createApiKey, listApiKeys, revokeApiKey, type ApiKey } from '../services/apiKeysService'

export function APIKeysPage() {
  const { modal, notification } = App.useApp()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [createdSecret, setCreatedSecret] = useState<string | null>(null)
  const [form] = Form.useForm<{ name: string; scopes: string[] }>()
  const keysQuery = useQuery({ queryKey: queryKeys.apiKeys(), queryFn: listApiKeys })
  const keys = useMemo(() => keysQuery.data ?? [], [keysQuery.data])

  const createMutation = useMutation({
    mutationFn: createApiKey,
    onSuccess: async (created) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.apiKeys() })
      setCreatedSecret(created.secret)
      notification.success({ message: 'Chave criada' })
    },
  })

  const revokeMutation = useMutation({
    mutationFn: revokeApiKey,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.apiKeys() })
      notification.success({ message: 'Chave revogada' })
    },
  })

  const activeCount = useMemo(() => keys.filter((key) => key.status === 'active').length, [keys])
  
  async function handleCreate() {
    const values = await form.validateFields()
    await createMutation.mutateAsync({ name: values.name.trim(), scopes: values.scopes })
    form.resetFields()
    setOpen(false)
  }

  function revoke(id: string) {
    modal.confirm({
      title: 'Revogar chave?',
      content: 'Integracoes usando essa chave deixarao de autenticar imediatamente.',
      okText: 'Revogar',
      okButtonProps: { danger: true },
      onOk: () => {
        return revokeMutation.mutateAsync(id)
      },
    })
  }

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <PageHeaderCard
        title="API Keys"
        subtitle={`${activeCount} chaves ativas para automacoes e integracoes externas.`}
        extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)}>Nova chave</Button>}
      />
      <Card className="app-card" variant="borderless">
        <Table<ApiKey>
          rowKey="id"
          loading={keysQuery.isLoading}
          dataSource={keys}
          pagination={{ pageSize: 10 }}
          columns={[
            { title: 'Nome', dataIndex: 'name', render: (value) => <Typography.Text strong>{value}</Typography.Text> },
            { title: 'Prefixo', dataIndex: 'prefix', render: (value) => <Typography.Text code>{value}...</Typography.Text> },
            { title: 'Escopos', dataIndex: 'scopes', render: (scopes: string[]) => <Space wrap>{scopes.map((scope) => <Tag key={scope}>{scope}</Tag>)}</Space> },
            { title: 'Criada em', dataIndex: 'createdAt', render: (value) => new Date(value).toLocaleString('pt-BR') },
            { title: 'Status', dataIndex: 'status', render: (value) => <Tag color={value === 'active' ? 'green' : 'red'}>{value === 'active' ? 'Ativa' : 'Revogada'}</Tag> },
            {
              title: '',
              render: (_, key) => (
                <Button danger size="small" icon={<DeleteOutlined />} disabled={key.status === 'revoked'} onClick={() => revoke(key.id)}>
                  Revogar
                </Button>
              ),
            },
          ]}
        />
      </Card>

      <Modal open={open} onCancel={() => setOpen(false)} onOk={handleCreate} confirmLoading={createMutation.isPending} title="Nova API key" okText="Criar">
        <Form form={form} layout="vertical" initialValues={{ scopes: ['reports:read'] }}>
          <Form.Item name="name" label="Nome" rules={[{ required: true, message: 'Informe um nome.' }]}>
            <Input prefix={<KeyOutlined />} maxLength={80} placeholder="Ex: Integracao Power BI" />
          </Form.Item>
          <Form.Item name="scopes" label="Escopos" rules={[{ required: true, message: 'Selecione ao menos um escopo.' }]}>
            <Select
              mode="multiple"
              options={[
                { value: 'reports:read', label: 'reports:read' },
                { value: 'dashboards:read', label: 'dashboards:read' },
                { value: 'datasources:read', label: 'datasources:read' },
                { value: 'webhooks:write', label: 'webhooks:write' },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal open={Boolean(createdSecret)} onCancel={() => setCreatedSecret(null)} footer={<Button type="primary" onClick={() => setCreatedSecret(null)}>Entendi</Button>} title="Copie a chave agora">
        <Typography.Paragraph>Por seguranca, esta chave nao sera exibida novamente.</Typography.Paragraph>
        <Input.TextArea value={createdSecret ?? ''} readOnly autoSize />
      </Modal>
    </Space>
  )
}
