import { useEffect, useState, useCallback, type CSSProperties, type ReactNode } from 'react'
import {
  Alert,
  App,
  AutoComplete,
  Badge,
  Button,
  Card,
  Col,
  Collapse,
  Drawer,
  Dropdown,
  Empty,
  Form,
  Input,
  Row,
  Select,
  Space,
  Spin,
  Switch,
  Table,
  Tag,
  Tooltip,
  Typography,
} from 'antd'
import {
  ApiOutlined,
  BulbOutlined,
  CheckCircleFilled,
  ClockCircleOutlined,
  CloseCircleFilled,
  CloudServerOutlined,
  DatabaseOutlined,
  DeleteOutlined,
  EditOutlined,
  KeyOutlined,
  LinkOutlined,
  LoadingOutlined,
  MoreOutlined,
  PlusOutlined,
  ReloadOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import {
  listDataSources,
  listDataSourcesFromApi,
  createDataSource,
  updateDataSource,
  deleteDataSource,
  testDataSourceConnection,
  testDataSourceDraft,
  type DataSource,
  type DataSourceCreatePayload,
  type DataSourceTestResult,
} from '../services/dataSourceService'
import { DataSourceStatus } from '../components/DataSourceStatus'
import { ERP_STANDARD_FIELDS, ERP_ENDPOINT_OPTIONS } from '../api/erpStandardFields'
import { diagnoseFields, type DiagnosticResult, type FieldAnalysis } from '../utils/dataSourceDiagnostic'

const TYPE_OPTIONS = [
  { value: 'rest_api', label: 'Conexao direta' },
  { value: 'sgbr_bi', label: 'SGBR BI (IGA)' },
  { value: 'database_view', label: 'Banco de dados' },
  { value: 'custom', label: 'Personalizado' },
]

const AUTH_OPTIONS = [
  { value: 'none', label: 'Nenhuma' },
  { value: 'bearer_token', label: 'Token de acesso' },
  { value: 'api_key', label: 'Chave de acesso' },
  { value: 'basic_auth', label: 'Usuario e senha' },
]

const PASSWORD_OPTIONS = [
  { value: 'plain', label: 'Texto normal' },
  { value: 'sha256', label: 'SHA-256' },
  { value: 'md5', label: 'MD5' },
]

const TRANSFORM_OPTIONS = [
  { value: 'none', label: 'Nenhuma' },
  { value: 'trim', label: 'Limpar espacos' },
  { value: 'number', label: 'Numero' },
  { value: 'date_iso', label: 'Data' },
  { value: 'uppercase', label: 'Maiusculas' },
  { value: 'lowercase', label: 'Minusculas' },
]

const sectionShell: CSSProperties = {
  borderRadius: 12,
  padding: '18px 20px',
  marginBottom: 16,
  border: '1px solid var(--qc-border, rgba(255,255,255,0.08))',
  background: 'var(--ant-color-fill-quaternary, rgba(0,0,0,0.02))',
}

function FormSection({
  icon,
  title,
  subtitle,
  children,
}: {
  icon: ReactNode
  title: string
  subtitle?: string
  children: ReactNode
}) {
  return (
    <div style={sectionShell}>
      <Space align="start" size={12} style={{ marginBottom: 16 }}>
        <span style={{ fontSize: 22, opacity: 0.85, lineHeight: 1 }}>{icon}</span>
        <div>
          <Typography.Text strong style={{ fontSize: 15, display: 'block' }}>
            {title}
          </Typography.Text>
          {subtitle && (
            <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 2 }}>
              {subtitle}
            </Typography.Text>
          )}
        </div>
      </Space>
      {children}
    </div>
  )
}

type DataSourceStats = {
  /** Para exibição: total na API se informado, senão linhas só na 1ª resposta do teste. */
  recordCount: number | null
  /** Linhas contadas na primeira resposta JSON (pode ser só a 1ª página). */
  firstPageCount: number | null
  apiReportedTotal: number | null
  latencyMs: number | null
  lastRefresh: string | null
  refreshing: boolean
  error: string | null
}

export function DataSourceConfigPage() {
  const [dataSources, setDataSources] = useState<DataSource[]>([])
  const [loading, setLoading] = useState(true)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [testResult, setTestResult] = useState<DataSourceTestResult | null>(null)
  const [diagnostic, setDiagnostic] = useState<DiagnosticResult | null>(null)
  const [testing, setTesting] = useState(false)
  const [stats, setStats] = useState<Record<string, DataSourceStats>>({})
  const [form] = Form.useForm()
  const { notification, modal } = App.useApp()

  const load = async () => {
    setLoading(true)
    try {
      setDataSources(await listDataSourcesFromApi())
    } catch {
      notification.warning({
        message: 'Sem conexão com o servidor',
        description: 'Mostrando última cópia local. Testes podem falhar até a API responder — confira VITE_API_BASE_URL e o backend.',
      })
      setDataSources(await listDataSources())
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [])

  const refreshStats = useCallback(async (dsId: string) => {
    setStats((prev) => ({
      ...prev,
      [dsId]: {
        ...prev[dsId],
        refreshing: true,
        error: null,
        recordCount: prev[dsId]?.recordCount ?? null,
        firstPageCount: prev[dsId]?.firstPageCount ?? null,
        apiReportedTotal: prev[dsId]?.apiReportedTotal ?? null,
        latencyMs: prev[dsId]?.latencyMs ?? null,
        lastRefresh: prev[dsId]?.lastRefresh ?? null,
      },
    }))
    try {
      const result = await testDataSourceConnection(dsId)
      const countMatch = result.message.match(/^(\d+)\s+registro/)
      const firstPage = countMatch ? parseInt(countMatch[1], 10) : 0
      const apiTotal = typeof result.apiReportedTotal === 'number' ? result.apiReportedTotal : undefined
      const displayCount = result.success ? (apiTotal ?? firstPage) : null
      setStats((prev) => ({
        ...prev,
        [dsId]: {
          recordCount: displayCount,
          firstPageCount: result.success ? firstPage : null,
          apiReportedTotal: result.success && apiTotal != null ? apiTotal : null,
          latencyMs: result.latencyMs,
          lastRefresh: new Date().toISOString(),
          refreshing: false,
          error: result.success ? null : result.message,
        },
      }))
      load()
    } catch (err) {
      setStats((prev) => ({
        ...prev,
        [dsId]: {
          recordCount: null,
          firstPageCount: null,
          apiReportedTotal: null,
          latencyMs: null,
          lastRefresh: new Date().toISOString(),
          refreshing: false,
          error: err instanceof Error ? err.message : 'Erro',
        },
      }))
    }
  }, [])

  // Buscar stats ao carregar a pagina
  useEffect(() => {
    if (dataSources.length > 0 && Object.keys(stats).length === 0) {
      dataSources.forEach((ds) => refreshStats(ds.id))
    }
  }, [dataSources, stats, refreshStats])

  const openDrawer = (ds?: DataSource) => {
    setTestResult(null)
    setDiagnostic(null)
    if (ds) {
      setEditingId(ds.id)
      form.setFieldsValue({
        name: ds.name, type: ds.type, apiUrl: ds.apiUrl,
        dataEndpoint: ds.dataEndpoint ?? '',
        authMethod: ds.authMethod, authCredentials: '',
        apiLogin: ds.apiLogin ?? '',
        apiPassword: '',
        isAuthSource: ds.isAuthSource ?? false,
        loginEndpoint: ds.loginEndpoint ?? '',
        loginFieldUser: ds.loginFieldUser ?? 'login',
        loginFieldPassword: ds.loginFieldPassword ?? 'senha',
        passwordMode: ds.passwordMode ?? 'plain',
        erpEndpoints: ds.erpEndpoints,
        fieldMappings: ds.fieldMappings,
      })
    } else {
      setEditingId(null)
      form.resetFields()
    }
    setDrawerOpen(true)
  }

  const handleTest = async () => {
    setTesting(true)
    setTestResult(null)
    setDiagnostic(null)
    try {
      let result: DataSourceTestResult
      if (editingId) {
        result = await testDataSourceConnection(editingId)
      } else {
        const v = form.getFieldsValue()
        result = await testDataSourceDraft({
          name: v.name ?? 'Teste', type: v.type ?? 'rest_api',
          apiUrl: v.apiUrl, authMethod: v.authMethod ?? 'none',
          authCredentials: v.authCredentials || undefined,
          apiLogin: v.apiLogin || undefined,
          apiPassword: v.apiPassword || undefined,
          dataEndpoint: v.dataEndpoint || undefined,
          loginEndpoint: v.loginEndpoint || undefined,
          isAuthSource: v.isAuthSource ?? false,
          passwordMode: v.passwordMode || 'plain',
          loginFieldUser: v.loginFieldUser || 'login',
          loginFieldPassword: v.loginFieldPassword || 'senha',
          erpEndpoints: [], fieldMappings: [],
        })
      }

      setTestResult(result)

      const fields = result.sampleFields ?? []
      if (fields.length > 0) {
        const diag = diagnoseFields(
          fields,
          (result as Record<string, unknown>).fieldTypes as Record<string, string> | undefined,
          (result as Record<string, unknown>).sampleRows as Record<string, unknown>[] | undefined,
        )
        setDiagnostic(diag)
        if ((form.getFieldValue('erpEndpoints') ?? []).length === 0 && diag.suggestedEndpoints.length > 0)
          form.setFieldValue('erpEndpoints', diag.suggestedEndpoints)
        if ((form.getFieldValue('fieldMappings') ?? []).length === 0 && diag.suggestedMappings.length > 0)
          form.setFieldValue('fieldMappings', diag.suggestedMappings)
      }
    } catch (err) {
      setTestResult({ success: false, latencyMs: 0, message: err instanceof Error ? err.message : 'Falha.' })
    } finally {
      setTesting(false)
    }
  }

  const handleSave = async () => {
    try {
      const v = await form.validateFields()
      setSaving(true)
      const cleanedMappings = (v.fieldMappings ?? []).filter((m: { standardField?: string; sourceField?: string }) => m.standardField && m.sourceField)
      const payload: DataSourceCreatePayload = {
        name: v.name, type: v.type, apiUrl: v.apiUrl,
        authMethod: v.authMethod,
        authCredentials: v.authCredentials || undefined,
        apiLogin: v.apiLogin || undefined,
        apiPassword: v.apiPassword || undefined,
        erpEndpoints: v.erpEndpoints ?? [],
        fieldMappings: cleanedMappings,
        isAuthSource: v.isAuthSource ?? false,
        loginEndpoint: v.loginEndpoint || undefined,
        dataEndpoint: v.dataEndpoint || undefined,
        passwordMode: v.passwordMode || 'plain',
        loginFieldUser: v.loginFieldUser || 'login',
        loginFieldPassword: v.loginFieldPassword || 'senha',
      }
      let savedId: string
      if (editingId) {
        const updated = await updateDataSource(editingId, payload)
        savedId = updated.id
        notification.success({ message: 'Atualizado' })
      } else {
        const created = await createDataSource(payload)
        savedId = created.id
        notification.success({ message: 'Conexao criada' })
      }

      /**
       * Auto-fill: se o usuário salvou sem mapeamentos/áreas, a gente roda o teste e o
       * diagnose aqui mesmo e persiste as sugestões em silêncio. Evita que a fonte fique
       * "conectada mas sem dados" (o bug clássico em que as telas ficam vazias).
       */
      const needsAutofill = cleanedMappings.length === 0 && (v.erpEndpoints ?? []).length === 0
      if (needsAutofill) {
        try {
          const test = await testDataSourceConnection(savedId)
          const fields = test.sampleFields ?? []
          if (fields.length > 0) {
            const diag = diagnoseFields(
              fields,
              (test as Record<string, unknown>).fieldTypes as Record<string, string> | undefined,
              (test as Record<string, unknown>).sampleRows as Record<string, unknown>[] | undefined,
            )
            if (diag.suggestedMappings.length > 0 || diag.suggestedEndpoints.length > 0) {
              await updateDataSource(savedId, {
                fieldMappings: diag.suggestedMappings,
                erpEndpoints: diag.suggestedEndpoints,
              })
              notification.info({
                message: 'Sugestões aplicadas automaticamente',
                description: `${diag.suggestedMappings.length} mapeamento(s) e ${diag.suggestedEndpoints.length} área(s) identificadas na API.`,
              })
            }
          }
        } catch {
          /** Silencioso: se o teste falhar (ex.: API fora), deixa o usuário aplicar manualmente pelo menu. */
        }
      }

      setDrawerOpen(false)
      load()
    } catch (err) {
      if (err instanceof Error) notification.error({ message: 'Erro', description: err.message })
    } finally { setSaving(false) }
  }

  const handleDelete = (ds: DataSource) => {
    modal.confirm({
      title: `Excluir "${ds.name}"?`, okText: 'Excluir', okButtonProps: { danger: true },
      onOk: async () => { await deleteDataSource(ds.id); notification.success({ message: 'Removida' }); load() },
    })
  }

  /**
   * Dispara Testar + diagnose + update em uma única ação. Resolve o caso em que o usuário
   * testou a conexão mas fechou o drawer sem salvar — o JSON ficava com
   * `fieldMappings: []` / `erpEndpoints: []` e as telas não renderizavam nada.
   */
  const applySuggestions = useCallback(async (record: DataSource) => {
    const hasExisting = (record.fieldMappings?.length ?? 0) > 0 || (record.erpEndpoints?.length ?? 0) > 0

    const doApply = async () => {
      try {
        const result = await testDataSourceConnection(record.id)
        if (!result.success) {
          notification.error({
            message: 'Falha no teste',
            description: result.message || 'Não foi possível buscar amostra de dados.',
          })
          return
        }
        const fields = result.sampleFields ?? []
        if (fields.length === 0) {
          notification.warning({
            message: 'Sem dados para analisar',
            description: 'A API respondeu sem linhas — verifique o "Caminho dos dados" e o período configurado.',
          })
          return
        }
        const diag = diagnoseFields(
          fields,
          (result as Record<string, unknown>).fieldTypes as Record<string, string> | undefined,
          (result as Record<string, unknown>).sampleRows as Record<string, unknown>[] | undefined,
        )
        if (diag.suggestedMappings.length === 0 && diag.suggestedEndpoints.length === 0) {
          notification.warning({
            message: 'Sem sugestões automáticas',
            description: 'Os campos detectados não bateram com nenhuma área conhecida. Configure manualmente pelo Editar.',
          })
          return
        }
        await updateDataSource(record.id, {
          fieldMappings: diag.suggestedMappings,
          erpEndpoints: diag.suggestedEndpoints,
        })
        notification.success({
          message: 'Sugestões aplicadas',
          description: `${diag.suggestedMappings.length} mapeamento(s) e ${diag.suggestedEndpoints.length} área(s) salvos.`,
        })
        await load()
        refreshStats(record.id)
      } catch (err) {
        notification.error({
          message: 'Erro ao aplicar sugestões',
          description: err instanceof Error ? err.message : 'Erro desconhecido.',
        })
      }
    }

    if (hasExisting) {
      modal.confirm({
        title: `Reaplicar sugestões em "${record.name}"?`,
        content: 'Os mapeamentos e áreas atuais serão substituídos pelos detectados na nova amostra da API.',
        okText: 'Substituir',
        cancelText: 'Cancelar',
        onOk: doApply,
      })
    } else {
      await doApply()
    }
  }, [notification, modal, refreshStats])

  const sampleFieldOptions = (testResult?.sampleFields ?? []).map((f) => ({ value: f }))
  const selectedEndpoints: string[] = Form.useWatch('erpEndpoints', form) ?? []
  const standardFieldOptions = selectedEndpoints
    .flatMap((ep) => ERP_STANDARD_FIELDS[ep]?.fields ?? [])
    .filter((v, i, arr) => arr.indexOf(v) === i)
    .map((f) => ({ value: f, label: f }))

  const columns: ColumnsType<DataSource> = [
    { title: 'Nome', dataIndex: 'name' },
    { title: 'Tipo', dataIndex: 'type', width: 130, render: (t: string) => <Tag>{TYPE_OPTIONS.find((o) => o.value === t)?.label ?? t}</Tag> },
    { title: 'Status', width: 140, render: (_: unknown, r: DataSource) => <DataSourceStatus status={r.status} lastCheckedAt={r.lastCheckedAt} lastError={r.lastError} /> },
    {
      title: 'Registros', width: 120,
      render: (_: unknown, r: DataSource) => {
        const s = stats[r.id]
        if (!s || s.refreshing) return <LoadingOutlined />
        if (s.error) {
          return (
            <Tooltip title={s.error}>
              <Tag color="red" style={{ cursor: s.error ? 'help' : undefined }}>Erro</Tag>
            </Tooltip>
          )
        }
        const tip = [
          s.apiReportedTotal != null && s.firstPageCount != null && s.apiReportedTotal > s.firstPageCount
            ? `Total informado pela API: ${s.apiReportedTotal.toLocaleString('pt-BR')}. Nesta 1ª resposta: ${s.firstPageCount.toLocaleString('pt-BR')} linha(s).`
            : 'Contagem do teste na 1ª resposta JSON (se a API paginar, o painel de dados pode carregar mais via proxy).',
          s.latencyMs ? `Latência: ${s.latencyMs} ms` : '',
        ].filter(Boolean).join(' ')
        return (
          <Tooltip title={tip}>
            <Tag color="blue" style={{ fontWeight: 600 }}>{s.recordCount?.toLocaleString('pt-BR') ?? 0}</Tag>
          </Tooltip>
        )
      },
    },
    {
      title: 'Ultima consulta', width: 150,
      render: (_: unknown, r: DataSource) => {
        const s = stats[r.id]
        if (!s?.lastRefresh) return '—'
        const d = new Date(s.lastRefresh)
        return (
          <Tooltip title={d.toLocaleString('pt-BR')}>
            <Space size={4}>
              <ClockCircleOutlined style={{ fontSize: 11, color: '#999' }} />
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </Typography.Text>
            </Space>
          </Tooltip>
        )
      },
    },
    { title: 'Login', width: 60, dataIndex: 'isAuthSource', render: (v: boolean) => v ? <Badge status="success" text="Sim" /> : '—' },
    {
      title: '', width: 80,
      render: (_: unknown, record: DataSource) => (
        <Space size={4}>
          <Tooltip title="Atualizar registros">
            <Button
              type="text"
              size="small"
              icon={<ReloadOutlined spin={stats[record.id]?.refreshing} />}
              disabled={stats[record.id]?.refreshing}
              onClick={() => refreshStats(record.id)}
            />
          </Tooltip>
          <Dropdown trigger={['click']} menu={{ items: [
            { key: 'edit', icon: <EditOutlined />, label: 'Editar', onClick: () => openDrawer(record) },
            { key: 'test', icon: <ThunderboltOutlined />, label: 'Testar', onClick: async () => { setEditingId(record.id); const r = await testDataSourceConnection(record.id); notification[r.success ? 'success' : 'error']({ message: r.success ? 'Conectado' : 'Falha', description: r.message }); load() } },
            { key: 'autofill', icon: <BulbOutlined />, label: 'Aplicar sugestões automáticas', onClick: () => applySuggestions(record) },
            { type: 'divider' },
            { key: 'del', icon: <DeleteOutlined />, label: 'Excluir', danger: true, onClick: () => handleDelete(record) },
          ] }}>
            <Button type="text" size="small" icon={<MoreOutlined />} />
          </Dropdown>
        </Space>
      ),
    },
  ]

  const connectedN = dataSources.filter((d) => d.status === 'connected').length
  /** Soma amostras já obtidas (fonte em refresh mantém o último valor em stats). */
  const totalRows = dataSources.reduce((sum, d) => sum + (stats[d.id]?.recordCount ?? 0), 0)
  /** Média só entre testes concluídos com latência válida (não inclui linhas ainda em refresh). */
  const latenciesDone = dataSources
    .map((d) => stats[d.id])
    .filter((s): s is DataSourceStats => Boolean(s && !s.refreshing && s.latencyMs != null && s.latencyMs >= 0))
    .map((s) => s.latencyMs!)
  const avgMs = latenciesDone.length
    ? Math.round(latenciesDone.reduce((a, b) => a + b, 0) / latenciesDone.length)
    : null
  /** Nenhuma fonte terminou o primeiro teste ainda (só aí mostramos spin no agregado). */
  const statsPendingBootstrap = dataSources.length > 0
    && dataSources.every((d) => {
      const s = stats[d.id]
      return !s || (s.refreshing && s.recordCount == null && s.latencyMs == null && !s.error)
    })
  const refreshingAny = dataSources.some((d) => stats[d.id]?.refreshing)

  return (
    <div style={{ maxWidth: 1040, margin: '0 auto', padding: '8px 0 32px' }}>
      <Space direction="vertical" size={20} style={{ width: '100%' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            flexWrap: 'wrap',
            gap: 16,
            padding: '20px 24px',
            borderRadius: 16,
            border: '1px solid var(--qc-border, rgba(255,255,255,0.08))',
            background: 'linear-gradient(135deg, var(--ant-color-fill-quaternary, rgba(0,0,0,0.03)) 0%, transparent 55%)',
          }}
        >
          <div>
            <Typography.Title level={4} style={{ margin: 0, fontWeight: 600, letterSpacing: '-0.02em' }}>
              <ApiOutlined style={{ marginRight: 10, opacity: 0.9 }} />
              Fontes de dados
            </Typography.Title>
            <Typography.Text type="secondary" style={{ fontSize: 13, marginTop: 6, display: 'block', maxWidth: 520 }}>
              Conecte o BI ou ERP ao painel. Credenciais ficam no servidor.
            </Typography.Text>
          </div>
          <Button type="primary" size="large" icon={<PlusOutlined />} onClick={() => openDrawer()}>
            Nova conexão
          </Button>
        </div>

        {dataSources.length > 0 && (
          <Card size="small" variant="borderless" style={{ borderRadius: 12, border: '1px solid var(--qc-border, rgba(255,255,255,0.08))' }}>
            <Space size={28} wrap split={<Typography.Text type="secondary">|</Typography.Text>}>
              <Tooltip title="Quantas fontes passaram no último teste de conexão (cada uma é independente).">
                <Space size={8}>
                  <Typography.Text type="secondary">Teste OK</Typography.Text>
                  <Typography.Text strong style={{ fontSize: 16, color: 'var(--qc-success, #52c41a)' }}>
                    {connectedN}/{dataSources.length}
                  </Typography.Text>
                </Space>
              </Tooltip>
              <Space size={8}>
                <Typography.Text type="secondary">Registros (amostra)</Typography.Text>
                {statsPendingBootstrap ? (
                  <Spin size="small" />
                ) : (
                  <Typography.Text strong style={{ fontSize: 16 }}>
                    {totalRows.toLocaleString('pt-BR')}
                    {refreshingAny && (
                      <Typography.Text type="secondary" style={{ fontSize: 12, marginLeft: 6 }}>
                        atualizando…
                      </Typography.Text>
                    )}
                  </Typography.Text>
                )}
              </Space>
              <Space size={8}>
                <Typography.Text type="secondary">Latência média</Typography.Text>
                {statsPendingBootstrap ? (
                  <Spin size="small" />
                ) : avgMs != null ? (
                  <Typography.Text strong style={{ fontSize: 16 }}>{avgMs.toLocaleString('pt-BR')} ms</Typography.Text>
                ) : (
                  <Typography.Text type="secondary">—</Typography.Text>
                )}
              </Space>
            </Space>
          </Card>
        )}

        <Card
          size="small"
          styles={{ body: { padding: dataSources.length === 0 && !loading ? 32 : 0 } }}
          style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid var(--qc-border, rgba(255,255,255,0.08))' }}
        >
          {dataSources.length === 0 && !loading ? (
            <Empty description="Nenhuma fonte configurada" image={Empty.PRESENTED_IMAGE_SIMPLE}>
              <Button type="primary" size="large" icon={<PlusOutlined />} onClick={() => openDrawer()}>
                Adicionar conexão
              </Button>
            </Empty>
          ) : (
            <Table
              dataSource={dataSources}
              columns={columns}
              rowKey="id"
              loading={loading}
              size="middle"
              pagination={false}
              className="quantum-table"
            />
          )}
        </Card>
      </Space>

      <Drawer
        title={
          <Space direction="vertical" size={0}>
            <Typography.Text strong style={{ fontSize: 16 }}>
              {editingId ? 'Editar fonte' : 'Nova fonte'}
            </Typography.Text>
            {editingId && (
              <Typography.Text type="secondary" style={{ fontSize: 12, fontWeight: 400 }}>
                {dataSources.find((d) => d.id === editingId)?.name}
              </Typography.Text>
            )}
          </Space>
        }
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false)
          setTestResult(null)
          setDiagnostic(null)
        }}
        width={640}
        styles={{ footer: { borderTop: '1px solid var(--qc-border, rgba(255,255,255,0.08))' } }}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={() => setDrawerOpen(false)}>Cancelar</Button>
            <Button type="primary" loading={saving} onClick={handleSave}>
              Salvar
            </Button>
          </div>
        }
      >
        <Form
          form={form}
          layout="vertical"
          preserve
          requiredMark="optional"
          initialValues={{
            type: 'rest_api', authMethod: 'none', isAuthSource: false,
            passwordMode: 'plain', loginFieldUser: 'login', loginFieldPassword: 'senha',
            erpEndpoints: [], fieldMappings: [],
          }}
        >
          <FormSection icon={<CloudServerOutlined />} title="Servidor e rotas" subtitle="URL base e caminhos exatamente como no manual da API.">
            <Form.Item label="Nome" name="name" rules={[{ required: true, message: 'Informe um nome' }]}>
              <Input placeholder="Ex.: Vendas · Produção" />
            </Form.Item>
            <Row gutter={16}>
              <Col xs={24} sm={12}>
                <Form.Item label="Tipo" name="type">
                  <Select options={TYPE_OPTIONS} />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12}>
                <Form.Item label="Autenticação HTTP" name="authMethod">
                  <Select options={AUTH_OPTIONS} />
                </Form.Item>
              </Col>
            </Row>
            <Form.Item
              label="URL base"
              name="apiUrl"
              rules={[{ required: true }, { type: 'url', message: 'URL inválida' }]}
            >
              <Input prefix={<LinkOutlined style={{ opacity: 0.45 }} />} placeholder="https://servidor:porta" />
            </Form.Item>
            <Form.Item label="Endpoint de dados" name="dataEndpoint">
              <Input
                prefix={<LinkOutlined style={{ opacity: 0.45 }} />}
                placeholder="/sgbrbi/vendas/analitico, …/produzido, …/vendanfe/analitico"
              />
            </Form.Item>

            <Form.Item noStyle shouldUpdate={(p, c) => p.authMethod !== c.authMethod}>
              {({ getFieldValue }) => {
                const m = getFieldValue('authMethod')
                if (m === 'none') return null
                return (
                  <Form.Item
                    label={m === 'bearer_token' ? 'Bearer token' : m === 'api_key' ? 'Chave' : 'Basic (user:senha)'}
                    name="authCredentials"
                  >
                    <Input.Password placeholder={editingId ? 'Vazio mantém o atual' : 'Obrigatório'} />
                  </Form.Item>
                )
              }}
            </Form.Item>
          </FormSection>

          <FormSection icon={<KeyOutlined />} title="Login no app e JWT" subtitle="Usuários do painel e token para consultas automáticas.">
            <Form.Item name="isAuthSource" valuePropName="checked" label="Permitir login do app por esta fonte">
              <Switch checkedChildren="Sim" unCheckedChildren="Não" />
            </Form.Item>

            <Form.Item noStyle shouldUpdate={(prev, cur) => prev.type !== cur.type}>
              {({ getFieldValue }) => {
                const t = getFieldValue('type') as string | undefined
                const showApiJwt = t === 'sgbr_bi' || t === 'rest_api' || t === 'custom'
                if (!showApiJwt) return null
                return (
                  <>
                    <Form.Item label="Endpoint de login" name="loginEndpoint">
                      <Input placeholder="/sgbrbi/usuario/login" />
                    </Form.Item>
                    <Row gutter={16}>
                      <Col xs={24} sm={12}>
                        <Form.Item label="Usuário da API" name="apiLogin">
                          <Input placeholder="usuário" autoComplete="username" />
                        </Form.Item>
                      </Col>
                      <Col xs={24} sm={12}>
                        <Form.Item
                          label="Senha da API"
                          name="apiPassword"
                          extra={
                            editingId && dataSources.find((d) => d.id === editingId)?.hasApiPassword
                              ? 'Senha já salva — preencha só para alterar.'
                              : undefined
                          }
                        >
                          <Input.Password placeholder="••••••••" autoComplete="current-password" />
                        </Form.Item>
                      </Col>
                    </Row>
                    <Collapse
                      bordered={false}
                      size="small"
                      style={{ background: 'transparent' }}
                      items={[
                        {
                          key: 'json',
                          label: <Typography.Text type="secondary">Nomes dos campos no JSON do login</Typography.Text>,
                          children: (
                            <Row gutter={12}>
                              <Col xs={24} sm={8}>
                                <Form.Item label="Campo usuário" name="loginFieldUser">
                                  <Select options={[
                                    { value: 'login', label: 'login' },
                                    { value: 'username', label: 'username' },
                                    { value: 'user', label: 'user' },
                                    { value: 'email', label: 'email' },
                                    { value: 'usuario', label: 'usuario' },
                                    { value: 'cpf', label: 'cpf' },
                                  ]} />
                                </Form.Item>
                              </Col>
                              <Col xs={24} sm={8}>
                                <Form.Item label="Campo senha" name="loginFieldPassword">
                                  <Select options={[
                                    { value: 'senha', label: 'senha' },
                                    { value: 'password', label: 'password' },
                                    { value: 'pass', label: 'pass' },
                                    { value: 'pwd', label: 'pwd' },
                                    { value: 'secret', label: 'secret' },
                                  ]} />
                                </Form.Item>
                              </Col>
                              <Col xs={24} sm={8}>
                                <Form.Item label="Hash da senha" name="passwordMode">
                                  <Select options={PASSWORD_OPTIONS} />
                                </Form.Item>
                              </Col>
                            </Row>
                          ),
                        },
                      ]}
                    />
                  </>
                )
              }}
            </Form.Item>
          </FormSection>

          <FormSection icon={<ThunderboltOutlined />} title="Teste de conexão" subtitle="Valida login e leitura do endpoint.">
            <Button
              type="primary"
              icon={testing ? <LoadingOutlined /> : <ThunderboltOutlined />}
              loading={testing}
              onClick={handleTest}
              block
              size="large"
            >
              Executar teste
            </Button>

            {testResult && (
              <div style={{ marginTop: 16 }}>
                <Alert
                  type={testResult.success ? 'success' : 'error'}
                  showIcon
                  icon={testResult.success ? <CheckCircleFilled /> : <CloseCircleFilled />}
                  message={testResult.success ? 'Conectado' : 'Falha no teste'}
                  description={testResult.message}
                />

                {!testResult.success && (testResult.message.includes('401') || testResult.message.includes('403')) && (
                  <Alert type="warning" showIcon message="Verifique credenciais acima" style={{ marginTop: 8 }} />
                )}

                {testResult.success && (!testResult.sampleFields || testResult.sampleFields.length === 0) && (
                  <Alert type="warning" showIcon message="Sem linhas no período — confira o endpoint e as datas" style={{ marginTop: 8 }} />
                )}

                {(diagnostic?.apiSummary || (diagnostic && diagnostic.fieldAnalysis.length > 0)) && (
                  <Collapse
                    style={{ marginTop: 12 }}
                    items={[
                      {
                        key: 'd',
                        label: 'Detalhes do retorno da API',
                        children: (
                          <>
                            {diagnostic?.apiSummary && (
                              <Typography.Paragraph type="secondary" style={{ marginBottom: 12, fontSize: 13 }}>
                                {diagnostic.apiSummary}
                              </Typography.Paragraph>
                            )}
                            {diagnostic && diagnostic.recognized.length > 0 && (
                              <div style={{ marginBottom: 12 }}>
                                {diagnostic.recognized.map((r) => (
                                  <div key={r.area} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--qc-border)' }}>
                                    <Typography.Text>{r.label}</Typography.Text>
                                    <Tag color={r.confidence === 'alta' ? 'green' : r.confidence === 'media' ? 'orange' : 'default'}>
                                      {r.confidence === 'alta' ? 'Alta' : r.confidence === 'media' ? 'Média' : 'Baixa'}
                                    </Tag>
                                  </div>
                                ))}
                              </div>
                            )}
                            {diagnostic && diagnostic.fieldAnalysis.length > 0 && (
                              <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                                <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                                  <thead>
                                    <tr style={{ borderBottom: '1px solid var(--qc-border)', textAlign: 'left' }}>
                                      <th style={{ padding: 6, color: 'var(--qc-text-muted)' }}>Campo</th>
                                      <th style={{ padding: 6, color: 'var(--qc-text-muted)' }}>Tipo</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {diagnostic.fieldAnalysis.map((f: FieldAnalysis) => (
                                      <tr key={f.name} style={{ borderBottom: '1px solid var(--qc-border)' }}>
                                        <td style={{ padding: 6, fontFamily: 'monospace' }}>{f.name}</td>
                                        <td style={{ padding: 6 }}><Tag style={{ fontSize: 10 }}>{f.type}</Tag></td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                            {diagnostic && diagnostic.unknownFields.length > 0 && (
                              <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 8 }}>
                                Outros campos: {diagnostic.unknownFields.slice(0, 12).join(', ')}
                                {diagnostic.unknownFields.length > 12 ? '…' : ''}
                              </Typography.Text>
                            )}
                          </>
                        ),
                      },
                    ]}
                  />
                )}
              </div>
            )}
          </FormSection>

          <Collapse
            bordered={false}
            style={{ background: 'transparent' }}
            items={[
              {
                key: 'erp',
                label: (
                  <Space>
                    <DatabaseOutlined />
                    <span>Integração com telas (opcional)</span>
                  </Space>
                ),
                children: (
                  <>
                    <Form.Item label="Módulos alimentados" name="erpEndpoints">
                      <Select mode="multiple" options={ERP_ENDPOINT_OPTIONS} placeholder="Selecione" />
                    </Form.Item>
                    <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
                      Mapeamento campo do painel → campo da API
                    </Typography.Text>
                    <Form.List name="fieldMappings">
                      {(fields, { add, remove }) => (
                        <>
                          {fields.map(({ key, name, ...rest }) => (
                            <Row key={key} gutter={8} align="middle" style={{ marginBottom: 8 }}>
                              <Col span={8}>
                                <Form.Item {...rest} name={[name, 'standardField']} style={{ marginBottom: 0 }}>
                                  <Select placeholder="Painel" showSearch options={standardFieldOptions} size="small" />
                                </Form.Item>
                              </Col>
                              <Col span={1} style={{ textAlign: 'center' }}>→</Col>
                              <Col span={7}>
                                <Form.Item {...rest} name={[name, 'sourceField']} style={{ marginBottom: 0 }}>
                                  <AutoComplete placeholder="API" options={sampleFieldOptions} size="small" />
                                </Form.Item>
                              </Col>
                              <Col span={6}>
                                <Form.Item {...rest} name={[name, 'transform']} initialValue="none" style={{ marginBottom: 0 }}>
                                  <Select options={TRANSFORM_OPTIONS} size="small" />
                                </Form.Item>
                              </Col>
                              <Col span={2}>
                                <Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => remove(name)} />
                              </Col>
                            </Row>
                          ))}
                          <Button type="dashed" size="small" onClick={() => add({ standardField: '', sourceField: '', transform: 'none' })} block icon={<PlusOutlined />}>
                            Linha de mapeamento
                          </Button>
                        </>
                      )}
                    </Form.List>
                  </>
                ),
              },
            ]}
          />
        </Form>
      </Drawer>
    </div>
  )
}
