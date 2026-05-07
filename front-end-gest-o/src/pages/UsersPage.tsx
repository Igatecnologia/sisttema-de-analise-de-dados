import { RangePickerBR } from '../components/DatePickerPtBR'
import {
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  ReloadOutlined,
} from '@ant-design/icons'
import {
  Alert,
  App,
  Button,
  Card,
  Checkbox,
  Col,
  Empty,
  Form,
  Input,
  Modal,
  Popconfirm,
  Row,
  Select,
  Skeleton,
  Space,
  Switch,
  Tag,
  Typography,
} from 'antd'
import dayjs from 'dayjs'
import { useMemo, useState } from 'react'
import { PageHeaderCard } from '../components/PageHeaderCard'

import { MetricCard } from '../components/MetricCard'
import { VirtualTable, type VirtualColumn } from '../components/VirtualTable'
import { useAuth } from '../auth/AuthContext'
import {
  defaultPermissionsForRole,
  hasPermission,
  PERMISSION_GROUPS,
  type Permission,
} from '../auth/permissions'
import type { User, UserRole } from '../types/models'
import { createUser, deleteUser, listUsers, updateUser } from '../services/usersService'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '../query/queryKeys'
import { DevErrorDetail } from '../components/DevErrorDetail'
import { getErrorMessage } from '../api/httpError'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { pctDelta, shiftRange } from '../utils/dateRange'

type UserForm = {
  name: string
  email: string
  role: UserRole
  status: User['status']
  password?: string
  /** Se true, envia `permissionList` ao servidor; se false, usa só o perfil (update envia null para limpar). */
  customizePermissions: boolean
  permissionList: Permission[]
}

function roleTag(role: UserRole) {
  if (role === 'admin') return <Tag color="red">Administrador</Tag>
  if (role === 'manager') return <Tag color="blue">Gerente</Tag>
  return <Tag>Visualizador</Tag>
}

function statusTag(status: User['status']) {
  return status === 'active' ? <Tag color="green">Ativo</Tag> : <Tag>Inativo</Tag>
}

export function UsersPage() {
  const { notification } = App.useApp()
  const { session } = useAuth()
  const canWrite = hasPermission(session, 'users:write')
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search, 300)
  const [roleFilter, setRoleFilter] = useState<UserRole | 'all'>('all')
  const [statusFilter, setStatusFilter] = useState<User['status'] | 'all'>('all')
  const [createdRange, setCreatedRange] = useState<[string, string] | null>(null)
  const queryClient = useQueryClient()

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<User | null>(null)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm<UserForm>()

  const usersQuery = useQuery({
    queryKey: queryKeys.users({ q: debouncedSearch, role: roleFilter, status: statusFilter }),
    queryFn: listUsers,
    staleTime: 30_000,
  })

  const createMutation = useMutation({
    mutationFn: createUser,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['users'] })
    },
  })
  const updateMutation = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Parameters<typeof updateUser>[1] }) =>
      updateUser(id, patch),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['users'] })
    },
  })
  const deleteMutation = useMutation({
    mutationFn: deleteUser,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['users'] })
    },
  })

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (usersQuery.data ?? []).filter((u) => {
      const matchQ =
        !q ||
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.id.toLowerCase().includes(q)
      const matchRole = roleFilter === 'all' || u.role === roleFilter
      const matchStatus = statusFilter === 'all' || u.status === statusFilter
      const [start, end] = createdRange ?? ['', '']
      const matchDate =
        (!start || dayjs(u.createdAt).isSame(start, 'day') || dayjs(u.createdAt).isAfter(start, 'day')) &&
        (!end || dayjs(u.createdAt).isSame(end, 'day') || dayjs(u.createdAt).isBefore(end, 'day'))
      return matchQ && matchRole && matchStatus && matchDate
    })
  }, [search, roleFilter, statusFilter, usersQuery.data, createdRange])

  const usersSummary = useMemo(() => {
    const total = filtered.length
    const active = filtered.filter((u) => u.status === 'active').length
    const admins = filtered.filter((u) => u.role === 'admin').length
    const recent30d = filtered.filter((u) => dayjs().diff(dayjs(u.createdAt), 'day') <= 30).length
    return { total, active, admins, recent30d }
  }, [filtered])
  const previousUsersSummary = useMemo(() => {
    const shifted = shiftRange(createdRange?.[0], createdRange?.[1])
    if (!shifted) return null
    const q = search.trim().toLowerCase()
    const prev = (usersQuery.data ?? []).filter((u) => {
      const matchQ =
        !q ||
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.id.toLowerCase().includes(q)
      const matchRole = roleFilter === 'all' || u.role === roleFilter
      const matchStatus = statusFilter === 'all' || u.status === statusFilter
      const d = dayjs(u.createdAt)
      const matchDate =
        d.isSame(shifted.prevStart, 'day') ||
        d.isSame(shifted.prevEnd, 'day') ||
        (d.isAfter(shifted.prevStart, 'day') && d.isBefore(shifted.prevEnd, 'day'))
      return matchQ && matchRole && matchStatus && matchDate
    })
    return {
      total: prev.length,
      active: prev.filter((u) => u.status === 'active').length,
      admins: prev.filter((u) => u.role === 'admin').length,
      recent30d: prev.filter((u) => dayjs().diff(dayjs(u.createdAt), 'day') <= 30).length,
    }
  }, [createdRange, roleFilter, search, statusFilter, usersQuery.data])

  const columns: VirtualColumn<User>[] = useMemo(
    () => [
      {
        key: 'name',
        title: 'Nome',
        render: (u) => u.name,
      },
      { key: 'email', title: 'E-mail', render: (u) => u.email },
      { key: 'role', title: 'Perfil', width: 120, render: (u) => roleTag(u.role) },
      {
        key: 'access',
        title: 'Acesso',
        width: 130,
        render: (u) =>
          u.permissions != null && u.permissions.length > 0 ? (
            <Tag color="purple">Personalizado</Tag>
          ) : (
            <Tag>Padrão do perfil</Tag>
          ),
      },
      {
        key: 'status',
        title: 'Status',
        width: 120,
        render: (u) => statusTag(u.status),
      },
      {
        key: 'createdAt',
        title: 'Criado em',
        width: 120,
        render: (u) => dayjs(u.createdAt).format('DD/MM/YYYY'),
      },
      {
        key: 'actions',
        title: '',
        width: 140,
        render: (record) => (
          <Space>
            <Button
              size="small"
              icon={<EditOutlined />}
              disabled={!canWrite}
              onClick={() => {
                setEditing(record)
                const hasCustom = record.permissions != null && record.permissions.length > 0
                form.setFieldsValue({
                  name: record.name,
                  email: record.email,
                  role: record.role,
                  status: record.status,
                  customizePermissions: hasCustom,
                  permissionList: hasCustom
                    ? (record.permissions as Permission[])
                    : defaultPermissionsForRole(record.role),
                })
                setModalOpen(true)
              }}
            />
            <Popconfirm
              title="Excluir usuário?"
              description="Essa ação não pode ser desfeita."
              okText="Excluir"
              okButtonProps={{ danger: true }}
              cancelText="Cancelar"
              disabled={!canWrite}
              onConfirm={async () => {
                try {
                  await deleteMutation.mutateAsync(record.id)
                  notification.success({ title: 'Usuário excluído' })
                } catch (e) {
                  const message = getErrorMessage(e, 'Erro inesperado.')
                  notification.error({ title: 'Usuários', description: message })
                }
              }}
            >
              <Button size="small" danger icon={<DeleteOutlined />} disabled={!canWrite} />
            </Popconfirm>
          </Space>
        ),
      },
    ],
    [form, canWrite, deleteMutation, notification],
  )

  const headerExtra = (
    <Space>
      <Button icon={<ReloadOutlined />} onClick={() => usersQuery.refetch()}>
        Atualizar
      </Button>
      <Button
        type="primary"
        icon={<PlusOutlined />}
        disabled={!canWrite}
        onClick={() => {
          setEditing(null)
          form.resetFields()
          form.setFieldsValue({
            role: 'viewer',
            status: 'active',
            customizePermissions: false,
            permissionList: defaultPermissionsForRole('viewer'),
          })
          setModalOpen(true)
        }}
      >
        Novo usuário
      </Button>
    </Space>
  )

  return (
    <Space orientation="vertical" size={16} style={{ width: '100%' }}>
      <PageHeaderCard
        title="Funcionários"
        subtitle="Gerencie os funcionários que acessam o sistema."
        extra={headerExtra}
      />

      <Card className="app-card" variant="borderless">
        <Row gutter={[12, 12]} align="middle">
          <Col xs={24} md={10}>
            <Input.Search
              allowClear
              placeholder="Buscar por nome, e-mail ou ID"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </Col>
          <Col xs={24} md={7}>
            <Select
              style={{ width: '100%' }}
              value={roleFilter}
              onChange={setRoleFilter}
              options={[
                { value: 'all', label: 'Todos os perfis' },
                { value: 'admin', label: 'Administrador' },
                { value: 'manager', label: 'Gerente' },
                { value: 'viewer', label: 'Visualizador' },
              ]}
            />
          </Col>
          <Col xs={24} md={7}>
            <Select
              style={{ width: '100%' }}
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { value: 'all', label: 'Todos os status' },
                { value: 'active', label: 'Ativo' },
                { value: 'inactive', label: 'Inativo' },
              ]}
            />
          </Col>
          <Col xs={24} md={7}>
            <RangePickerBR
              style={{ width: '100%' }}
              format="DD/MM/YYYY"
              placeholder={['Data inicial', 'Data final']}
              onChange={(vals) => {
                if (!vals || !vals[0] || !vals[1]) {
                  setCreatedRange(null)
                  return
                }
                setCreatedRange([vals[0].format('YYYY-MM-DD'), vals[1].format('YYYY-MM-DD')])
              }}
            />
          </Col>
        </Row>
      </Card>

      <Row gutter={[12, 12]}>
        <Col xs={24} sm={12} lg={6}>
          <MetricCard
            title="Total usuários"
            value={usersSummary.total}
            previousValue={previousUsersSummary?.total}
            deltaPct={
              previousUsersSummary ? pctDelta(usersSummary.total, previousUsersSummary.total) : undefined
            }
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <MetricCard
            title="Ativos"
            value={usersSummary.active}
            previousValue={previousUsersSummary?.active}
            deltaPct={
              previousUsersSummary
                ? pctDelta(usersSummary.active, previousUsersSummary.active)
                : undefined
            }
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <MetricCard
            title="Admins"
            value={usersSummary.admins}
            previousValue={previousUsersSummary?.admins}
            deltaPct={
              previousUsersSummary
                ? pctDelta(usersSummary.admins, previousUsersSummary.admins)
                : undefined
            }
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <MetricCard
            title="Novos em 30 dias"
            value={usersSummary.recent30d}
            previousValue={previousUsersSummary?.recent30d}
            deltaPct={
              previousUsersSummary
                ? pctDelta(usersSummary.recent30d, previousUsersSummary.recent30d)
                : undefined
            }
          />
        </Col>
      </Row>

      {(usersQuery.isLoading || usersQuery.isFetching) && (
        <Card>
          <Skeleton active paragraph={{ rows: 6 }} />
        </Card>
      )}

      {usersQuery.isError && (
        <Card extra={<Button onClick={() => usersQuery.refetch()}>Tentar novamente</Button>}>
          <Alert
            type="error"
            showIcon
            title="Não foi possível carregar"
            description={
              <>
                {getErrorMessage(usersQuery.error, 'Falha ao carregar usuários.')}
                <DevErrorDetail error={usersQuery.error} />
              </>
            }
          />
        </Card>
      )}

      {!usersQuery.isLoading && !filtered.length && (
        <Card>
          <div style={{ padding: 32 }}>
            <Empty
              description="Nenhum usuário cadastrado."
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          </div>
        </Card>
      )}

      {!!filtered.length && (
        <Card className="app-card quantum-table" variant="borderless" title="Lista de usuários">
          {filtered.length > 100 ? (
            <VirtualTable
              rows={filtered}
              rowKey={(u) => u.id}
              columns={columns}
              height={520}
            />
          ) : (
            <VirtualTable
              rows={filtered}
              rowKey={(u) => u.id}
              columns={columns}
              height={Math.min(520, 56 + filtered.length * 46)}
            />
          )}
        </Card>
      )}

      <Modal
        open={modalOpen}
        title={editing ? 'Editar usuário' : 'Novo usuário'}
        width={640}
        okText={editing ? 'Salvar' : 'Criar'}
        cancelText="Cancelar"
        confirmLoading={saving}
        onCancel={() => setModalOpen(false)}
        onOk={async () => {
          try {
            const values = await form.validateFields()
            setSaving(true)
            if (editing) {
              const { password, customizePermissions, permissionList, ...rest } = values
              const patch: Parameters<typeof updateUser>[1] = { ...rest }
              if (password) patch.password = password
              if (customizePermissions && permissionList?.length) {
                patch.permissions = permissionList
              } else {
                patch.permissions = null
              }
              await updateMutation.mutateAsync({ id: editing.id, patch })
              notification.success({ title: 'Usuário atualizado' })
            } else {
              const { customizePermissions, permissionList, ...createValues } = values
              await createMutation.mutateAsync({
                ...createValues,
                password: createValues.password!,
                ...(customizePermissions && permissionList?.length
                  ? { permissions: permissionList }
                  : {}),
              })
              notification.success({ title: 'Usuário criado' })
            }
            setModalOpen(false)
          } catch (e) {
            if (e && typeof e === 'object' && 'errorFields' in e) return
            const message = getErrorMessage(e, 'Erro inesperado.')
            notification.error({ title: 'Usuários', description: message })
          } finally {
            setSaving(false)
          }
        }}
      >
        <Form<UserForm> form={form} layout="vertical">
          <Form.Item
            label="Nome"
            name="name"
            rules={[{ required: true, message: 'Informe o nome.' }]}
          >
            <Input placeholder="Ex: Ana Silva" />
          </Form.Item>
          <Form.Item
            label="E-mail"
            name="email"
            rules={[
              { required: true, message: 'Informe o e-mail.' },
              { type: 'email', message: 'E-mail inválido.' },
            ]}
          >
            <Input placeholder="ex: ana@empresa.com" />
          </Form.Item>
          <Form.Item
            label={editing ? 'Redefinir senha (opcional)' : 'Senha'}
            name="password"
            normalize={(v) => (typeof v === 'string' && v.trim() ? v.trim() : undefined)}
            rules={
              editing
                ? []
                : [{ required: true, message: 'Informe a senha.' }]
            }
          >
            <Input.Password placeholder={editing ? 'Deixe em branco para manter' : 'Defina uma senha'} />
          </Form.Item>
          <Row gutter={12}>
            <Col xs={24} md={12}>
              <Form.Item
                label="Perfil"
                name="role"
                rules={[{ required: true, message: 'Selecione o perfil.' }]}
              >
                <Select
                  options={[
                    { value: 'admin', label: 'Admin' },
                    { value: 'manager', label: 'Manager' },
                    { value: 'viewer', label: 'Viewer' },
                  ]}
                  onChange={(r: UserRole) => {
                    if (form.getFieldValue('customizePermissions')) {
                      form.setFieldValue('permissionList', defaultPermissionsForRole(r))
                    }
                  }}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                label="Status"
                name="status"
                rules={[{ required: true, message: 'Selecione o status.' }]}
              >
                <Select
                  options={[
                    { value: 'active', label: 'Ativo' },
                    { value: 'inactive', label: 'Inativo' },
                  ]}
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            label="Permissões de acesso"
            extra={
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                Por padrão, o sistema usa o pacote do perfil (Admin / Gerente / Visualizador). Ative para
                escolher exatamente o que este usuário pode ver e fazer.
              </Typography.Text>
            }
          >
            <Space orientation="vertical" size={8} style={{ width: '100%' }}>
              <Form.Item name="customizePermissions" valuePropName="checked" noStyle>
                <Switch
                  checkedChildren="Lista personalizada"
                  unCheckedChildren="Padrão do perfil"
                  onChange={(checked) => {
                    if (checked) {
                      const role = form.getFieldValue('role') as UserRole
                      form.setFieldValue('permissionList', defaultPermissionsForRole(role))
                    }
                  }}
                />
              </Form.Item>
              <Form.Item noStyle shouldUpdate={(a, b) => a.customizePermissions !== b.customizePermissions}>
                {() =>
                  form.getFieldValue('customizePermissions') ? (
                    <Form.Item
                      name="permissionList"
                      rules={[
                        {
                          validator: (_, value: Permission[] | undefined) => {
                            if (value?.length) return Promise.resolve()
                            return Promise.reject(new Error('Selecione ao menos uma permissão.'))
                          },
                        },
                      ]}
                    >
                      <Checkbox.Group style={{ width: '100%' }}>
                        <Space orientation="vertical" size={12} style={{ width: '100%' }}>
                          {PERMISSION_GROUPS.map((g) => (
                            <div key={g.title}>
                              <Typography.Text strong style={{ display: 'block', marginBottom: 8 }}>
                                {g.title}
                              </Typography.Text>
                              <Row gutter={[8, 8]}>
                                {g.items.map((item) => (
                                  <Col xs={24} sm={12} key={item.value}>
                                    <Checkbox value={item.value}>{item.label}</Checkbox>
                                  </Col>
                                ))}
                              </Row>
                            </div>
                          ))}
                        </Space>
                      </Checkbox.Group>
                    </Form.Item>
                  ) : null
                }
              </Form.Item>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  )
}

