import {
  ApiOutlined,
  DatabaseOutlined,
  DownloadOutlined,
  ReloadOutlined,
  SaveOutlined,
  TeamOutlined,
} from '@ant-design/icons'
import {
  Alert,
  App,
  Button,
  Card,
  Col,
  Form,
  Input,
  Row,
  Skeleton,
  Space,
  Statistic,
  Tag,
  Typography,
} from 'antd'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { useEffect, useMemo } from 'react'
import { PageHeaderCard } from '../components/PageHeaderCard'
import { DevErrorDetail } from '../components/DevErrorDetail'
import { getErrorMessage } from '../api/httpError'
import { queryKeys } from '../query/queryKeys'
import { useAuth } from '../auth/AuthContext'
import { hasPermission } from '../auth/permissions'
import { useTenantRefresh } from '../tenant/TenantContext'
import { listUsers } from '../services/usersService'
import {
  getTenantSettings,
  updateTenantSettings,
  type TenantSettingsUpdate,
} from '../services/tenantSettingsService'
import { getBillingStatus } from '../services/billingService'
import { UsageBar } from '../components/UsageBar'

type SettingsForm = {
  name: string
  subtitle: string
  logoUrl?: string
  primaryColor?: string
}

function normalizeOptionalUrl(value?: string): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function normalizeOptionalColor(value?: string): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

export function SettingsPage() {
  const { notification } = App.useApp()
  const { session } = useAuth()
  const canEditCompany = session?.user.role === 'admin'
  const canViewUsers = hasPermission(session, 'users:view')
  const canViewDatasources = hasPermission(session, 'datasources:view')
  const refreshTenant = useTenantRefresh()
  const queryClient = useQueryClient()
  const [form] = Form.useForm<SettingsForm>()

  const settingsQuery = useQuery({
    queryKey: queryKeys.tenantSettings(),
    queryFn: getTenantSettings,
    staleTime: 60_000,
  })

  const usersQuery = useQuery({
    queryKey: queryKeys.users({ q: '', role: 'all', status: 'all' }),
    queryFn: listUsers,
    enabled: canViewUsers,
    staleTime: 30_000,
  })

  const billingQuery = useQuery({
    queryKey: ['billingStatus'],
    queryFn: getBillingStatus,
    staleTime: 60_000,
  })

  useEffect(() => {
    if (!settingsQuery.data) return
    form.setFieldsValue({
      name: settingsQuery.data.name,
      subtitle: settingsQuery.data.subtitle,
      logoUrl: settingsQuery.data.logoUrl ?? undefined,
      primaryColor: settingsQuery.data.primaryColor ?? undefined,
    })
  }, [form, settingsQuery.data])

  const saveMutation = useMutation({
    mutationFn: updateTenantSettings,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.tenantSettings() })
      await refreshTenant()
      notification.success({ title: 'Configurações salvas' })
    },
  })

  const teamSummary = useMemo(() => {
    const users = usersQuery.data ?? []
    return {
      total: users.length,
      admins: users.filter((user) => user.role === 'admin').length,
      active: users.filter((user) => user.status === 'active').length,
    }
  }, [usersQuery.data])

  async function handleSave() {
    try {
      const values = await form.validateFields()
      const payload: TenantSettingsUpdate = {
        name: values.name.trim(),
        subtitle: values.subtitle.trim(),
        logoUrl: normalizeOptionalUrl(values.logoUrl),
        primaryColor: normalizeOptionalColor(values.primaryColor),
      }
      await saveMutation.mutateAsync(payload)
    } catch (error) {
      if (error && typeof error === 'object' && 'errorFields' in error) return
      notification.error({
        title: 'Configurações',
        description: getErrorMessage(error, 'Não foi possível salvar as configurações.'),
      })
    }
  }

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <PageHeaderCard
        title="Configurações"
        subtitle="Perfil da empresa, equipe e integrações do tenant atual."
        extra={
          <Space wrap>
            <Button icon={<ReloadOutlined />} onClick={() => settingsQuery.refetch()}>
              Atualizar
            </Button>
            <Button
              type="primary"
              icon={<SaveOutlined />}
              disabled={!canEditCompany}
              loading={saveMutation.isPending}
              onClick={handleSave}
            >
              Salvar
            </Button>
          </Space>
        }
      />

      {settingsQuery.isLoading ? (
        <Card className="app-card" variant="borderless">
          <Skeleton active paragraph={{ rows: 8 }} />
        </Card>
      ) : null}

      {settingsQuery.isError ? (
        <Card className="app-card" variant="borderless">
          <Alert
            type="error"
            showIcon
            message="Não foi possível carregar as configurações"
            description={
              <>
                {getErrorMessage(settingsQuery.error, 'Falha ao carregar o perfil da empresa.')}
                <DevErrorDetail error={settingsQuery.error} />
              </>
            }
            action={<Button onClick={() => settingsQuery.refetch()}>Tentar novamente</Button>}
          />
        </Card>
      ) : null}

      {settingsQuery.data ? (
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={14}>
            <Card className="app-card" variant="borderless" title="Empresa">
              {!canEditCompany ? (
                <Alert
                  type="info"
                  showIcon
                  style={{ marginBottom: 16 }}
                  message="Somente administradores podem alterar o perfil da empresa."
                />
              ) : null}
              <Form<SettingsForm> form={form} layout="vertical" disabled={!canEditCompany}>
                <Form.Item
                  label="Nome da empresa"
                  name="name"
                  rules={[{ required: true, message: 'Informe o nome da empresa.' }]}
                >
                  <Input maxLength={160} placeholder="Ex: IGA Gestão" />
                </Form.Item>
                <Form.Item
                  label="Subtítulo"
                  name="subtitle"
                  rules={[{ required: true, message: 'Informe o subtítulo.' }]}
                >
                  <Input maxLength={160} placeholder="Ex: Gestão e Análise de Dados" />
                </Form.Item>
                <Row gutter={12}>
                  <Col xs={24} md={16}>
                    <Form.Item
                      label="URL do logo"
                      name="logoUrl"
                      rules={[{ type: 'url', message: 'Informe uma URL válida.' }]}
                    >
                      <Input placeholder="https://..." />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={8}>
                    <Form.Item
                      label="Cor primária"
                      name="primaryColor"
                      rules={[
                        {
                          pattern: /^#[0-9a-fA-F]{3,8}$/,
                          message: 'Use uma cor hex, ex: #1677ff.',
                        },
                      ]}
                    >
                      <Input placeholder="#1677ff" />
                    </Form.Item>
                  </Col>
                </Row>
              </Form>
              <Space wrap size={8}>
                <Tag>{settingsQuery.data.slug}</Tag>
                <Tag color={settingsQuery.data.status === 'active' ? 'green' : 'default'}>
                  {settingsQuery.data.status === 'active' ? 'Ativo' : 'Inativo'}
                </Tag>
                <Tag color={settingsQuery.data.plan === 'pro' ? 'blue' : 'default'}>
                  Plano {settingsQuery.data.plan}
                </Tag>
              </Space>
            </Card>
          </Col>

          <Col xs={24} lg={10}>
            <Space direction="vertical" size={16} style={{ width: '100%' }}>
              <Card className="app-card" variant="borderless" title="Equipe">
                <Row gutter={[12, 12]}>
                  <Col span={8}>
                    <Statistic title="Usuários" value={teamSummary.total} loading={usersQuery.isLoading} />
                  </Col>
                  <Col span={8}>
                    <Statistic title="Ativos" value={teamSummary.active} loading={usersQuery.isLoading} />
                  </Col>
                  <Col span={8}>
                    <Statistic title="Admins" value={teamSummary.admins} loading={usersQuery.isLoading} />
                  </Col>
                </Row>
                <Button
                  style={{ marginTop: 16 }}
                  icon={<TeamOutlined />}
                  disabled={!canViewUsers}
                >
                  {canViewUsers ? <Link to="/usuarios">Gerenciar equipe</Link> : 'Gerenciar equipe'}
                </Button>
              </Card>

              <Card className="app-card" variant="borderless" title="Integrações">
                <Space direction="vertical" size={12} style={{ width: '100%' }}>
                  <Typography.Text type="secondary">
                    Conector ativo: {settingsQuery.data.connectorId}
                  </Typography.Text>
                  <Space wrap>
                    <Button icon={<DatabaseOutlined />} disabled={!canViewDatasources}>
                      {canViewDatasources ? <Link to="/fontes-de-dados">Fontes de dados</Link> : 'Fontes de dados'}
                    </Button>
                    <Button icon={<ApiOutlined />}>
                      <Link to="/connectors">Marketplace</Link>
                    </Button>
                  </Space>
                </Space>
              </Card>

              <Card className="app-card" variant="borderless" title="Uso do plano">
                <Space direction="vertical" size={12} style={{ width: '100%' }}>
                  <UsageBar label="Usuários" used={billingQuery.data?.usage?.users ?? teamSummary.total} limit={billingQuery.data?.limits?.users} />
                  <UsageBar label="Fontes de dados" used={billingQuery.data?.usage?.datasources ?? 0} limit={billingQuery.data?.limits?.datasources} />
                  <UsageBar label="Copiloto neste mês" used={billingQuery.data?.usage?.copilotMessagesMonthly ?? 0} limit={billingQuery.data?.limits?.copilotMessagesMonthly} />
                </Space>
              </Card>

              {canEditCompany ? (
                <Card className="app-card" variant="borderless" title="Backup e exportação">
                  <Space direction="vertical" size={12} style={{ width: '100%' }}>
                    <Typography.Text type="secondary">
                      Baixe um JSON com tudo do tenant — usuários, fontes, configurações, audit. Útil para backup ou portabilidade.
                    </Typography.Text>
                    <Button
                      icon={<DownloadOutlined />}
                      onClick={async () => {
                        const tenantId = settingsQuery.data?.id
                        if (!tenantId) return
                        try {
                          const response = await fetch(`/api/v1/tenants/${tenantId}/export`, {
                            credentials: 'include',
                          })
                          if (!response.ok) throw new Error(String(response.status))
                          const blob = await response.blob()
                          const url = URL.createObjectURL(blob)
                          const a = document.createElement('a')
                          a.href = url
                          a.download = `iga-tenant-${tenantId}-${Date.now()}.json`
                          document.body.appendChild(a)
                          a.click()
                          document.body.removeChild(a)
                          URL.revokeObjectURL(url)
                          notification.success({ message: 'Export concluído' })
                        } catch {
                          notification.error({ message: 'Falha ao exportar' })
                        }
                      }}
                    >
                      Exportar dados do tenant
                    </Button>
                  </Space>
                </Card>
              ) : null}
            </Space>
          </Col>
        </Row>
      ) : null}
    </Space>
  )
}
