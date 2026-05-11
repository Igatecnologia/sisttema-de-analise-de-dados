import {
  PlusOutlined,
  SearchOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
} from '@ant-design/icons'
import {
  App,
  Button,
  Card,
  Drawer,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Row,
  Col,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
  Typography,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { Award, BarChart3, Users, UsersIcon } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'
import { PageHeaderCard } from '../components/PageHeaderCard'
import { MetricCard } from '../components/MetricCard'
import {
  createCustomer,
  deleteCustomer,
  getCustomerAbcSegmentation,
  listCustomers,
  updateCustomer,
  type Customer,
  type CustomerInput,
} from '../services/customersService'
import { formatBRL } from '../utils/formatters'
import { hasPermission } from '../auth/permissions'
import { useAuth } from '../auth/AuthContext'

const customersKey = (search: string, status: string) => ['customers', { search, status }] as const
const abcKey = (months: number) => ['customers', 'abc', months] as const

function formatCnpjCpf(doc: string | null): string {
  if (!doc) return '—'
  const digits = doc.replace(/\D/g, '')
  if (digits.length === 14) {
    return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
  }
  if (digits.length === 11) {
    return digits.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4')
  }
  return doc
}

const SEGMENT_COLORS: Record<'A' | 'B' | 'C', string> = {
  A: 'gold',
  B: 'blue',
  C: 'default',
}

export function ClientesPage() {
  const { session } = useAuth()
  const canWrite = hasPermission(session, 'comercial:write') || session?.user.role === 'admin'
  const [searchParams] = useSearchParams()
  const initialTab = searchParams.get('tab') ?? 'list'

  const [activeTab, setActiveTab] = useState(initialTab)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('active')
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null)
  const [drawerCustomer, setDrawerCustomer] = useState<Customer | null>(null)
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [abcMonths, setAbcMonths] = useState(12)

  const { message } = App.useApp()
  const qc = useQueryClient()

  const customersQuery = useQuery({
    queryKey: customersKey(search, statusFilter),
    queryFn: () => listCustomers({
      search: search || undefined,
      status: statusFilter === 'all' ? undefined : statusFilter,
      limit: 200,
    }),
    staleTime: 60_000,
  })

  const abcQuery = useQuery({
    queryKey: abcKey(abcMonths),
    queryFn: () => getCustomerAbcSegmentation(abcMonths),
    enabled: activeTab === 'abc',
    staleTime: 5 * 60_000,
  })

  const createMutation = useMutation({
    mutationFn: (input: CustomerInput) => createCustomer(input),
    onSuccess: () => {
      message.success('Cliente cadastrado.')
      setCreateModalOpen(false)
      void qc.invalidateQueries({ queryKey: ['customers'] })
    },
    onError: (err: Error) => message.error(err.message ?? 'Não foi possível cadastrar.'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<CustomerInput> }) => updateCustomer(id, input),
    onSuccess: () => {
      message.success('Cliente atualizado.')
      setEditingCustomer(null)
      void qc.invalidateQueries({ queryKey: ['customers'] })
    },
    onError: (err: Error) => message.error(err.message ?? 'Não foi possível salvar.'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteCustomer(id),
    onSuccess: () => {
      message.success('Cliente removido.')
      void qc.invalidateQueries({ queryKey: ['customers'] })
    },
    onError: (err: Error) => message.error(err.message ?? 'Não foi possível remover.'),
  })

  const customers = customersQuery.data?.items ?? []
  const total = customersQuery.data?.total ?? 0

  const segmentByCustomer = useMemo(() => {
    const map = new Map<string, 'A' | 'B' | 'C'>()
    for (const item of abcQuery.data?.items ?? []) {
      if (item.registeredCustomer?.id) map.set(item.registeredCustomer.id, item.segment)
    }
    return map
  }, [abcQuery.data])

  const columns: ColumnsType<Customer> = [
    {
      title: 'Nome',
      dataIndex: 'name',
      key: 'name',
      render: (v: string, record) => (
        <Space size={6}>
          <Typography.Text strong>{v}</Typography.Text>
          {segmentByCustomer.get(record.id) ? (
            <Tag color={SEGMENT_COLORS[segmentByCustomer.get(record.id)!]}>{segmentByCustomer.get(record.id)}</Tag>
          ) : null}
        </Space>
      ),
      sorter: (a, b) => a.name.localeCompare(b.name),
    },
    {
      title: 'Documento',
      dataIndex: 'document',
      key: 'document',
      render: (v: string | null) => formatCnpjCpf(v),
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
      render: (v: string | null) => v ?? '—',
    },
    {
      title: 'Telefone',
      dataIndex: 'phone',
      key: 'phone',
      render: (v: string | null) => v ?? '—',
    },
    {
      title: 'Limite de crédito',
      dataIndex: 'creditLimitCents',
      key: 'creditLimitCents',
      align: 'right',
      render: (v: number | null) => (v == null ? '—' : formatBRL(v / 100)),
      sorter: (a, b) => (a.creditLimitCents ?? 0) - (b.creditLimitCents ?? 0),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (v: 'active' | 'inactive') => (
        <Tag color={v === 'active' ? 'green' : 'default'}>{v === 'active' ? 'Ativo' : 'Inativo'}</Tag>
      ),
      filters: [
        { text: 'Ativo', value: 'active' },
        { text: 'Inativo', value: 'inactive' },
      ],
      onFilter: (val, record) => record.status === val,
    },
    {
      title: 'Ações',
      key: 'actions',
      width: 160,
      render: (_, record) => (
        <Space size={4}>
          <Button
            type="text"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => setDrawerCustomer(record)}
            aria-label="Ver detalhes"
          />
          {canWrite ? (
            <Button
              type="text"
              size="small"
              icon={<EditOutlined />}
              onClick={() => setEditingCustomer(record)}
              aria-label="Editar"
            />
          ) : null}
          {canWrite ? (
            <Popconfirm
              title="Remover este cliente?"
              description="A ação não pode ser desfeita."
              okText="Remover"
              okButtonProps={{ danger: true }}
              cancelText="Cancelar"
              onConfirm={() => deleteMutation.mutate(record.id)}
            >
              <Button type="text" size="small" danger icon={<DeleteOutlined />} aria-label="Remover" />
            </Popconfirm>
          ) : null}
        </Space>
      ),
    },
  ]

  const abcCounts = abcQuery.data?.counts

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <PageHeaderCard
        title="Clientes"
        subtitle="Cadastro próprio com segmentação A/B/C calculada por receita."
        icon={<Users size={22} />}
        breadcrumbs={[{ label: 'Início', to: '/gestao' }, { label: 'Clientes' }]}
        extra={
          canWrite ? (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalOpen(true)}>
              Novo cliente
            </Button>
          ) : undefined
        }
      />

      <Card className="app-card no-hover" variant="borderless" styles={{ body: { padding: 0 } }}>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          tabBarStyle={{ paddingInline: 16, marginBottom: 0 }}
          items={[
            {
              key: 'list',
              label: 'Cadastro',
              children: (
                <div style={{ padding: 16 }}>
                  <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 12 }} wrap>
                    <Space>
                      <Input
                        prefix={<SearchOutlined />}
                        placeholder="Buscar por nome, documento ou email"
                        allowClear
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        style={{ width: 320 }}
                      />
                      <Select
                        value={statusFilter}
                        onChange={setStatusFilter}
                        style={{ width: 140 }}
                        options={[
                          { value: 'active', label: 'Ativos' },
                          { value: 'inactive', label: 'Inativos' },
                          { value: 'all', label: 'Todos' },
                        ]}
                      />
                    </Space>
                    <Typography.Text type="secondary">
                      {total} cliente{total === 1 ? '' : 's'}
                    </Typography.Text>
                  </Space>
                  <Table<Customer>
                    rowKey="id"
                    columns={columns}
                    dataSource={customers}
                    loading={customersQuery.isLoading}
                    pagination={{ pageSize: 50, showSizeChanger: false }}
                    size="middle"
                  />
                </div>
              ),
            },
            {
              key: 'abc',
              label: (
                <span>
                  <Award size={14} style={{ verticalAlign: -2, marginRight: 4 }} /> Segmentação A/B/C
                </span>
              ),
              children: (
                <div style={{ padding: 16 }}>
                  <Space style={{ marginBottom: 16 }}>
                    <Typography.Text>Período:</Typography.Text>
                    <Select
                      value={abcMonths}
                      onChange={setAbcMonths}
                      style={{ width: 160 }}
                      options={[
                        { value: 3, label: 'Últimos 3 meses' },
                        { value: 6, label: 'Últimos 6 meses' },
                        { value: 12, label: 'Últimos 12 meses' },
                        { value: 24, label: 'Últimos 24 meses' },
                      ]}
                    />
                  </Space>
                  {abcCounts ? (
                    <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
                      <Col xs={24} sm={12} md={6}>
                        <MetricCard
                          title="Curva A (top 20% receita)"
                          value={abcCounts.A}
                          accentColor="#d4b106"
                          icon={<Award size={16} />}
                          description="Clientes que somam 20% da receita do periodo"
                        />
                      </Col>
                      <Col xs={24} sm={12} md={6}>
                        <MetricCard
                          title="Curva B (próximos 30%)"
                          value={abcCounts.B}
                          accentColor="#1d4ed8"
                          icon={<BarChart3 size={16} />}
                        />
                      </Col>
                      <Col xs={24} sm={12} md={6}>
                        <MetricCard
                          title="Curva C (cauda 50%)"
                          value={abcCounts.C}
                          accentColor="#8c8c8c"
                          icon={<UsersIcon size={16} />}
                        />
                      </Col>
                      <Col xs={24} sm={12} md={6}>
                        <MetricCard
                          title="Sem cadastro"
                          value={abcCounts.unregistered}
                          accentColor={abcCounts.unregistered > 0 ? '#fa541c' : '#94a3b8'}
                          subtitle={abcCounts.unregistered > 0 ? 'Cadastrar para enriquecer' : 'Tudo cadastrado'}
                        />
                      </Col>
                    </Row>
                  ) : null}
                  <Table
                    rowKey="customerKey"
                    loading={abcQuery.isLoading}
                    dataSource={abcQuery.data?.items ?? []}
                    pagination={{ pageSize: 50, showSizeChanger: false }}
                    size="middle"
                    columns={[
                      {
                        title: 'Cliente (vendas)',
                        dataIndex: 'customerName',
                        key: 'customerName',
                        render: (v: string) => <Typography.Text>{v}</Typography.Text>,
                      },
                      {
                        title: 'Curva',
                        dataIndex: 'segment',
                        key: 'segment',
                        width: 80,
                        render: (v: 'A' | 'B' | 'C') => <Tag color={SEGMENT_COLORS[v]}>{v}</Tag>,
                      },
                      {
                        title: 'Receita',
                        dataIndex: 'revenue',
                        key: 'revenue',
                        align: 'right',
                        render: (v: number) => formatBRL(v),
                        sorter: (a, b) => a.revenue - b.revenue,
                      },
                      {
                        title: 'Acumulado',
                        dataIndex: 'cumulativePct',
                        key: 'cumulativePct',
                        align: 'right',
                        render: (v: number) => `${(v * 100).toFixed(1)}%`,
                      },
                      {
                        title: 'Cadastro',
                        dataIndex: 'registeredCustomer',
                        key: 'registered',
                        render: (rc: { id: string; name: string } | null) =>
                          rc ? <Tag color="green">Cadastrado</Tag> : <Tag>Sem cadastro</Tag>,
                      },
                    ]}
                  />
                  <Typography.Paragraph type="secondary" style={{ marginTop: 12, fontSize: 12 }}>
                    Curva A = clientes que somam 20% da receita. Curva B = próximos 30%. Curva C = restante. Recomendação:
                    foco de relacionamento e upsell na Curva A; recuperar Curva B; revisar margem da Curva C.
                  </Typography.Paragraph>
                </div>
              ),
            },
          ]}
        />
      </Card>

      <CustomerFormModal
        open={createModalOpen}
        title="Novo cliente"
        loading={createMutation.isPending}
        onClose={() => setCreateModalOpen(false)}
        onSubmit={(values) => createMutation.mutate(values)}
      />

      <CustomerFormModal
        open={editingCustomer != null}
        title="Editar cliente"
        initial={editingCustomer ?? undefined}
        loading={updateMutation.isPending}
        onClose={() => setEditingCustomer(null)}
        onSubmit={(values) => editingCustomer && updateMutation.mutate({ id: editingCustomer.id, input: values })}
      />

      <Drawer
        open={drawerCustomer != null}
        onClose={() => setDrawerCustomer(null)}
        title={drawerCustomer?.name}
        size={520}
      >
        {drawerCustomer ? <CustomerDetail customer={drawerCustomer} /> : null}
      </Drawer>
    </Space>
  )
}

function CustomerDetail({ customer }: { customer: Customer }) {
  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <div>
        <Typography.Text type="secondary">Documento</Typography.Text>
        <div>
          <Typography.Text strong>{formatCnpjCpf(customer.document)}</Typography.Text>
        </div>
      </div>
      <div>
        <Typography.Text type="secondary">Contato</Typography.Text>
        <div>
          <Typography.Text>{customer.contactName ?? '—'}</Typography.Text>
        </div>
        <Typography.Text>{customer.email ?? ''}</Typography.Text>
        {customer.phone ? <Typography.Text> · {customer.phone}</Typography.Text> : null}
      </div>
      <div>
        <Typography.Text type="secondary">Endereço</Typography.Text>
        <div>
          {customer.address ? (
            <Typography.Text>
              {[
                [customer.address.street, customer.address.number].filter(Boolean).join(', '),
                customer.address.neighborhood,
                [customer.address.city, customer.address.state].filter(Boolean).join(' / '),
                customer.address.cep,
              ]
                .filter(Boolean)
                .join(' — ')}
            </Typography.Text>
          ) : (
            <Typography.Text>—</Typography.Text>
          )}
        </div>
      </div>
      <div>
        <Typography.Text type="secondary">Limite de crédito</Typography.Text>
        <div>
          <Typography.Text strong>
            {customer.creditLimitCents == null ? '—' : formatBRL(customer.creditLimitCents / 100)}
          </Typography.Text>
        </div>
      </div>
      {customer.notes ? (
        <div>
          <Typography.Text type="secondary">Notas</Typography.Text>
          <Typography.Paragraph>{customer.notes}</Typography.Paragraph>
        </div>
      ) : null}
      <div>
        <Link to={`/vendas-analitico?q=${encodeURIComponent(customer.name)}`}>
          Ver vendas deste cliente →
        </Link>
      </div>
    </Space>
  )
}

type FormValues = Omit<CustomerInput, 'creditLimitCents'> & {
  creditLimit?: number | null
}

function CustomerFormModal({
  open,
  title,
  initial,
  loading,
  onClose,
  onSubmit,
}: {
  open: boolean
  title: string
  initial?: Customer
  loading: boolean
  onClose: () => void
  onSubmit: (values: CustomerInput) => void
}) {
  const [form] = Form.useForm<FormValues>()

  return (
    <Modal
      open={open}
      title={title}
      onCancel={onClose}
      destroyOnHidden
      width={700}
      onOk={async () => {
        const v = await form.validateFields()
        onSubmit({
          name: v.name,
          document: v.document ?? null,
          email: v.email ?? null,
          phone: v.phone ?? null,
          contactName: v.contactName ?? null,
          address: v.address ?? null,
          creditLimitCents: v.creditLimit != null && Number.isFinite(v.creditLimit) ? Math.round(v.creditLimit * 100) : null,
          notes: v.notes ?? null,
          status: v.status ?? 'active',
        })
      }}
      okText="Salvar"
      okButtonProps={{ loading }}
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={
          initial
            ? {
                name: initial.name,
                document: initial.document ?? undefined,
                email: initial.email ?? undefined,
                phone: initial.phone ?? undefined,
                contactName: initial.contactName ?? undefined,
                address: initial.address ?? undefined,
                creditLimit: initial.creditLimitCents != null ? initial.creditLimitCents / 100 : undefined,
                notes: initial.notes ?? undefined,
                status: initial.status,
              }
            : { status: 'active' }
        }
      >
        <Row gutter={12}>
          <Col xs={24} md={16}>
            <Form.Item name="name" label="Nome / Razão social" rules={[{ required: true, min: 1, max: 160 }]}>
              <Input maxLength={160} />
            </Form.Item>
          </Col>
          <Col xs={24} md={8}>
            <Form.Item name="status" label="Status">
              <Select
                options={[
                  { value: 'active', label: 'Ativo' },
                  { value: 'inactive', label: 'Inativo' },
                ]}
              />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={12}>
          <Col xs={24} md={12}>
            <Form.Item name="document" label="CPF / CNPJ">
              <Input maxLength={40} placeholder="00.000.000/0000-00" />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item name="contactName" label="Nome do contato">
              <Input maxLength={160} />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={12}>
          <Col xs={24} md={12}>
            <Form.Item name="email" label="Email" rules={[{ type: 'email', message: 'Email inválido' }]}>
              <Input maxLength={254} />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item name="phone" label="Telefone">
              <Input maxLength={40} placeholder="(11) 99999-9999" />
            </Form.Item>
          </Col>
        </Row>
        <Form.Item name="creditLimit" label="Limite de crédito (R$)">
          <InputNumber
            style={{ width: '100%' }}
            min={0}
            decimalSeparator=","
            precision={2}
            placeholder="0,00"
          />
        </Form.Item>
        <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 4 }}>
          Endereço
        </Typography.Text>
        <Row gutter={12}>
          <Col xs={24} md={6}>
            <Form.Item name={['address', 'cep']} label="CEP">
              <Input maxLength={20} />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item name={['address', 'street']} label="Logradouro">
              <Input maxLength={160} />
            </Form.Item>
          </Col>
          <Col xs={24} md={6}>
            <Form.Item name={['address', 'number']} label="Número">
              <Input maxLength={20} />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={12}>
          <Col xs={24} md={8}>
            <Form.Item name={['address', 'neighborhood']} label="Bairro">
              <Input maxLength={120} />
            </Form.Item>
          </Col>
          <Col xs={24} md={10}>
            <Form.Item name={['address', 'city']} label="Cidade">
              <Input maxLength={120} />
            </Form.Item>
          </Col>
          <Col xs={24} md={6}>
            <Form.Item name={['address', 'state']} label="UF">
              <Input maxLength={4} />
            </Form.Item>
          </Col>
        </Row>
        <Form.Item name={['address', 'complement']} label="Complemento">
          <Input maxLength={160} />
        </Form.Item>
        <Form.Item name="notes" label="Observações">
          <Input.TextArea rows={3} maxLength={2000} />
        </Form.Item>
      </Form>
    </Modal>
  )
}
