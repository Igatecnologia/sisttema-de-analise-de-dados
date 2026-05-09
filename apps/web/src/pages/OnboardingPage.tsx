import {
  ApiOutlined,
  CheckCircleOutlined,
  CloudUploadOutlined,
  DatabaseOutlined,
  RocketOutlined,
  TeamOutlined,
} from '@ant-design/icons'
import { App, Avatar, Button, Card, Col, Form, Input, Radio, Row, Select, Skeleton, Space, Steps, Tag, Typography } from 'antd'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { http } from '../services/http'
import { saveOnboarding, startOnboardingImport } from '../services/onboardingService'
import { listSegments, type BusinessSegment, type SegmentInfo } from './../services/authService'
import { CsvUploadModal } from '../components/CsvUploadModal'
import type { CsvDatasetSummary } from '../services/csvDatasetsService'

type ConnectorRow = {
  id: string
  name: string
  status: 'ready' | 'coming-soon'
  description?: string
  segments?: BusinessSegment[]
}

type OnboardingFormValues = {
  segment?: BusinessSegment
  goal?: string
  companySize?: string
  brandName?: string
  logoUrl?: string
  primaryColor?: string
  connectorId?: string
  syncMode?: string
  endpoint?: string
  templates?: string[]
  emails?: string
}

type TemplateDef = { id: string; title: string; description: string }

const ALL_TEMPLATES: TemplateDef[] = [
  { id: 'executive', title: 'Gestão executiva', description: 'KPIs, faturamento, margem e alertas.' },
  { id: 'finance', title: 'Financeiro', description: 'Contas, fluxo e relatórios recorrentes.' },
  { id: 'operations', title: 'Operação', description: 'Estoque, produção e exceções.' },
  { id: 'sales', title: 'Vendas', description: 'Pipeline, conversão e ranking de clientes.' },
  { id: 'services-ops', title: 'Operação de serviços', description: 'Contratos, recorrência e cobrança.' },
  { id: 'logistics', title: 'Logística', description: 'Pedidos por filial, estoque e entregas.' },
]

const TEMPLATES_BY_SEGMENT: Record<BusinessSegment, string[]> = {
  industry: ['executive', 'finance', 'operations'],
  commerce: ['executive', 'finance', 'sales'],
  services: ['executive', 'finance', 'services-ops'],
  distribution: ['executive', 'finance', 'logistics'],
}

function templatesForSegment(segment: BusinessSegment | undefined): TemplateDef[] {
  const ids = TEMPLATES_BY_SEGMENT[segment ?? 'industry'] ?? TEMPLATES_BY_SEGMENT.industry
  const set = new Set(ids)
  return ALL_TEMPLATES.filter((t) => set.has(t.id))
}

function parseTeamEmails(value?: string): string[] {
  return (value ?? '')
    .split(/\r?\n|,/)
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)
}

export function OnboardingPage() {
  const [step, setStep] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [connectors, setConnectors] = useState<ConnectorRow[] | null>(null)
  const [segments, setSegments] = useState<SegmentInfo[]>([])
  const [csvOpen, setCsvOpen] = useState(false)
  const [uploadedCsv, setUploadedCsv] = useState<CsvDatasetSummary | null>(null)
  const [form] = Form.useForm<OnboardingFormValues>()
  const navigate = useNavigate()
  const { message } = App.useApp()
  const values = (Form.useWatch([], form) ?? {}) as OnboardingFormValues
  const currentSegment = values.segment ?? 'industry'

  useEffect(() => {
    http.get<{ connectors: ConnectorRow[] }>('/api/v1/connectors')
      .then((response) => setConnectors(response.data.connectors))
      .catch(() => setConnectors([]))
    listSegments().then(setSegments).catch(() => undefined)
  }, [])

  /** Quando o segmento muda, ajusta connector recomendado e templates default — só se usuário ainda não tocou. */
  useEffect(() => {
    if (segments.length === 0) return
    const def = segments.find((s) => s.id === currentSegment)
    if (!def) return
    const current = form.getFieldsValue(['connectorId', 'templates']) as Pick<OnboardingFormValues, 'connectorId' | 'templates'>
    const patches: Partial<OnboardingFormValues> = {}
    if (!current.connectorId) {
      patches.connectorId = def.recommendedConnectorId
    }
    if (!current.templates || current.templates.length === 0) {
      patches.templates = TEMPLATES_BY_SEGMENT[currentSegment]
    }
    if (Object.keys(patches).length > 0) {
      form.setFieldsValue(patches)
    }
  }, [currentSegment, segments, form])

  const filteredConnectors = useMemo(() => {
    if (!connectors) return null
    /** Mostra só connectors que atendem o segmento escolhido (se a info estiver disponível). */
    return connectors.filter((c) => !c.segments || c.segments.length === 0 || c.segments.includes(currentSegment))
  }, [connectors, currentSegment])

  const connectorOptions = useMemo(() => (filteredConnectors ?? []).map((connector) => ({
    value: connector.id,
    label: (
      <Space>
        <span>{connector.name}</span>
        <Tag color={connector.status === 'ready' ? 'green' : 'default'}>
          {connector.status === 'ready' ? 'Pronto' : 'Em breve'}
        </Tag>
      </Space>
    ),
    disabled: connector.status !== 'ready',
  })), [filteredConnectors])

  const selectedConnector = connectors?.find((connector) => connector.id === values.connectorId)
  const isCsvFlow = selectedConnector?.id === 'csv'
  const brandName = values.brandName?.trim() || 'IGA Gestão'
  const primaryColor = values.primaryColor?.trim() || '#1677ff'
  const visibleTemplates = templatesForSegment(currentSegment)

  async function next() {
    const fieldsByStep: Array<Array<keyof OnboardingFormValues>> = [
      ['segment', 'goal', 'companySize'],
      ['brandName'],
      ['connectorId', 'syncMode'],
      ['templates'],
      [],
    ]
    await form.validateFields(fieldsByStep[step])
    setStep((current) => Math.min(current + 1, 4))
  }

  async function finish() {
    const formValues = await form.validateFields()
    setSubmitting(true)
    try {
      await saveOnboarding({
        companyProfile: {
          segment: formValues.segment,
          goal: formValues.goal,
          companySize: formValues.companySize,
          brandName: formValues.brandName,
          logoUrl: formValues.logoUrl,
          primaryColor: formValues.primaryColor,
        },
        dataSetup: {
          connectorId: formValues.connectorId,
          connectorName: selectedConnector?.name,
          syncMode: formValues.syncMode,
          endpoint: formValues.endpoint,
          templates: formValues.templates ?? [],
          /** Se o usuário subiu um CSV inicial, registramos o id no setup pra próxima etapa pegar os dados. */
          initialCsvDatasetId: uploadedCsv?.id,
        },
        teamInvites: parseTeamEmails(formValues.emails),
      })
      await startOnboardingImport()
      const { trackEvent } = await import('../services/analytics')
      trackEvent('onboarding_completed', {
        segment: formValues.segment,
        connectorId: formValues.connectorId,
        teamInvites: parseTeamEmails(formValues.emails).length,
        templatesCount: (formValues.templates ?? []).length,
        hadCsvImport: Boolean(uploadedCsv),
      })
      navigate('/importando-dados')
    } catch {
      message.error('Não foi possível salvar o onboarding.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f6f8fb', padding: 24 }}>
      <Row gutter={[24, 24]} justify="center" align="middle" style={{ minHeight: 'calc(100vh - 48px)' }}>
        <Col xs={24} lg={14} xl={12}>
          <Card className="app-card" style={{ borderRadius: 8 }}>
            <Space direction="vertical" size={20} style={{ width: '100%' }}>
              <Space>
                <Avatar style={{ background: primaryColor }} icon={<RocketOutlined />} />
                <div>
                  <Typography.Title level={3} style={{ margin: 0 }}>Configurar workspace</Typography.Title>
                  <Typography.Text type="secondary">Prepare marca, dados e equipe para entrar em produção.</Typography.Text>
                </div>
              </Space>

              <Steps
                current={step}
                size="small"
                items={[
                  { title: 'Perfil' },
                  { title: 'Marca' },
                  { title: 'Dados' },
                  { title: 'Templates' },
                  { title: 'Equipe' },
                ]}
              />

              <Form<OnboardingFormValues>
                form={form}
                layout="vertical"
                initialValues={{
                  segment: 'industry',
                  companySize: 'small',
                  brandName: 'IGA',
                  primaryColor: '#1677ff',
                  syncMode: 'guided',
                  templates: TEMPLATES_BY_SEGMENT.industry,
                }}
              >
                {step === 0 ? (
                  <Row gutter={12}>
                    <Col xs={24} md={12}>
                      <Form.Item name="segment" label="Segmento" rules={[{ required: true }]}>
                        <Select options={[
                          { value: 'industry', label: 'Indústria' },
                          { value: 'commerce', label: 'Comércio' },
                          { value: 'services', label: 'Serviços' },
                          { value: 'distribution', label: 'Distribuição' },
                        ]} />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={12}>
                      <Form.Item name="companySize" label="Tamanho da equipe" rules={[{ required: true }]}>
                        <Select options={[
                          { value: 'small', label: 'Até 10 pessoas' },
                          { value: 'mid', label: '11 a 50 pessoas' },
                          { value: 'large', label: 'Mais de 50 pessoas' },
                        ]} />
                      </Form.Item>
                    </Col>
                    <Col span={24}>
                      <Form.Item name="goal" label="Meta principal" rules={[{ required: true, message: 'Informe a meta principal' }]}>
                        <Input maxLength={160} placeholder="Ex: acompanhar vendas, margem e estoque em tempo real" />
                      </Form.Item>
                    </Col>
                  </Row>
                ) : null}

                {step === 1 ? (
                  <Row gutter={12}>
                    <Col xs={24} md={12}>
                      <Form.Item name="brandName" label="Nome exibido" rules={[{ required: true }]}>
                        <Input maxLength={80} />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={12}>
                      <Form.Item name="primaryColor" label="Cor primária">
                        <Input maxLength={16} placeholder="#1677ff" />
                      </Form.Item>
                    </Col>
                    <Col span={24}>
                      <Form.Item name="logoUrl" label="URL do logo">
                        <Input maxLength={300} placeholder="https://..." />
                      </Form.Item>
                    </Col>
                  </Row>
                ) : null}

                {step === 2 ? (
                  <>
                    <Form.Item name="connectorId" label="Conector inicial" rules={[{ required: true, message: 'Selecione um conector' }]}>
                      {connectors ? <Select options={connectorOptions} placeholder="Escolha um conector compatível com o seu segmento" /> : <Skeleton.Input active block />}
                    </Form.Item>
                    {selectedConnector ? (
                      <Card size="small" style={{ marginBottom: 16 }}>
                        <Space>
                          <DatabaseOutlined />
                          <span>{selectedConnector.description ?? 'Conector pronto para configuração assistida.'}</span>
                        </Space>
                      </Card>
                    ) : null}
                    <Form.Item name="syncMode" label="Modo de configuração" rules={[{ required: true }]}>
                      <Radio.Group>
                        <Radio.Button value="guided">Assistido</Radio.Button>
                        <Radio.Button value="manual">Manual</Radio.Button>
                        <Radio.Button value="demo">Demo primeiro</Radio.Button>
                      </Radio.Group>
                    </Form.Item>
                    {!isCsvFlow ? (
                      <Form.Item name="endpoint" label="Endpoint inicial">
                        <Input maxLength={300} prefix={<ApiOutlined />} placeholder="/api/v1/pedidos" />
                      </Form.Item>
                    ) : null}

                    {/** Importação assistida via CSV — disponível em qualquer connector como atalho. */}
                    <Card size="small" style={{ borderRadius: 8, borderStyle: 'dashed' }}>
                      <Space direction="vertical" size={6} style={{ width: '100%' }}>
                        <Space>
                          <CloudUploadOutlined style={{ fontSize: 18, color: primaryColor }} />
                          <Typography.Text strong>Já tem dados em planilha?</Typography.Text>
                        </Space>
                        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                          Suba um CSV inicial (até 10 MB) para popular o workspace antes de conectar o ERP. Você pode trocar depois.
                        </Typography.Text>
                        {uploadedCsv ? (
                          <Space style={{ marginTop: 4 }}>
                            <Tag color="green">{uploadedCsv.filename}</Tag>
                            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                              {uploadedCsv.rowCount} linhas · {uploadedCsv.columns.length} colunas
                            </Typography.Text>
                            <Button size="small" type="link" onClick={() => setUploadedCsv(null)}>Trocar</Button>
                          </Space>
                        ) : (
                          <Button size="small" icon={<CloudUploadOutlined />} onClick={() => setCsvOpen(true)}>
                            Subir CSV agora
                          </Button>
                        )}
                      </Space>
                    </Card>
                  </>
                ) : null}

                {step === 3 ? (
                  <Form.Item name="templates" label="Pacotes iniciais" rules={[{ required: true, message: 'Escolha pelo menos um pacote' }]}>
                    <Select
                      mode="multiple"
                      options={visibleTemplates.map((template) => ({ value: template.id, label: template.title }))}
                    />
                  </Form.Item>
                ) : null}

                {step === 4 ? (
                  <Form.Item name="emails" label="Convidar equipe" extra="Um email por linha ou separados por vírgula. Convites válidos por 48h.">
                    <Input.TextArea rows={5} placeholder="maria@acme.com.br&#10;joao@acme.com.br" />
                  </Form.Item>
                ) : null}
              </Form>

              <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                <Button type="text" onClick={() => navigate('/gestao')} disabled={submitting}>
                  Pular por agora
                </Button>
                <Space>
                  {step > 0 ? <Button onClick={() => setStep((current) => current - 1)} disabled={submitting}>Voltar</Button> : null}
                  {step < 4 ? (
                    <Button type="primary" onClick={next}>Continuar</Button>
                  ) : (
                    <Button type="primary" loading={submitting} onClick={finish}>Iniciar importação</Button>
                  )}
                </Space>
              </Space>
            </Space>
          </Card>
        </Col>

        <Col xs={24} lg={8} xl={7}>
          <Card className="app-card" style={{ borderRadius: 8 }}>
            <Space direction="vertical" size={16} style={{ width: '100%' }}>
              <Space>
                <Avatar src={values.logoUrl} style={{ background: primaryColor }}>
                  {brandName.slice(0, 2).toUpperCase()}
                </Avatar>
                <div>
                  <Typography.Title level={4} style={{ margin: 0 }}>{brandName}</Typography.Title>
                  <Typography.Text type="secondary">{selectedConnector?.name ?? 'Conector pendente'}</Typography.Text>
                </div>
              </Space>
              <div style={{ height: 8, borderRadius: 999, background: primaryColor }} />
              <Space direction="vertical" style={{ width: '100%' }}>
                {visibleTemplates
                  .filter((template) => (values.templates ?? []).includes(template.id))
                  .map((template) => (
                    <Card key={template.id} size="small" style={{ borderRadius: 8 }}>
                      <Space align="start">
                        <CheckCircleOutlined style={{ color: primaryColor, marginTop: 4 }} />
                        <div>
                          <Typography.Text strong>{template.title}</Typography.Text>
                          <Typography.Paragraph type="secondary" style={{ margin: 0 }}>
                            {template.description}
                          </Typography.Paragraph>
                        </div>
                      </Space>
                    </Card>
                  ))}
              </Space>
              <Card size="small" style={{ borderRadius: 8 }}>
                <Space>
                  <TeamOutlined />
                  <span>{parseTeamEmails(values.emails).length || 1} acesso(s) planejado(s)</span>
                </Space>
              </Card>
              {uploadedCsv ? (
                <Card size="small" style={{ borderRadius: 8 }}>
                  <Space>
                    <CloudUploadOutlined style={{ color: primaryColor }} />
                    <Typography.Text>{uploadedCsv.filename}</Typography.Text>
                  </Space>
                </Card>
              ) : null}
            </Space>
          </Card>
        </Col>
      </Row>

      <CsvUploadModal
        open={csvOpen}
        onClose={() => setCsvOpen(false)}
        onUploaded={(dataset) => {
          setUploadedCsv(dataset)
          setCsvOpen(false)
          message.success('CSV importado e salvo no workspace.')
        }}
      />
    </div>
  )
}
