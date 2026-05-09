import { useState } from 'react'
import { App, Alert, Button, Card, Input, Modal, Space, Table, Tabs, Tag, Typography } from 'antd'
import { CheckCircleOutlined, CloseCircleOutlined, RocketOutlined } from '@ant-design/icons'
import { http } from '../services/http'

type BulkResult = {
  created: Array<{ index: number; id: string; name: string }>
  failed: Array<{ index: number; name?: string; reason: string }>
  total: number
}

/**
 * Templates de empresas conhecidas — clique único cria N fontes.
 * Servidor/credenciais ficam vazios ou com placeholder; usuário preenche
 * UMA vez e o template aplica em todas as fontes do conjunto.
 */
type BulkTemplate = {
  id: string
  name: string
  description: string
  /** Quantas fontes esse template cria. */
  count: number
  /** Função que recebe URL/login/senha e devolve o array pronto pro POST. */
  build: (params: { apiUrl: string; apiLogin: string; apiPassword: string }) => Record<string, unknown>[]
}

const TEMPLATES: BulkTemplate[] = [
  {
    id: 'sgbr-tiete',
    name: 'SGBR BI — pacote completo',
    description: '6 fontes: Vendas, NF, Contas Pagas, Produção, Estoque, Compras. Auth JWT com SHA-256. Apenas a fonte de Vendas vira "auth source".',
    count: 6,
    build: ({ apiUrl, apiLogin, apiPassword }) => {
      const baseDs = {
        type: 'sgbr_bi',
        apiUrl,
        authMethod: 'jwt',
        apiLogin,
        apiPassword,
        loginEndpoint: '/sgbrbi/usuario/login',
        loginFieldUser: 'login',
        loginFieldPassword: 'senha',
        passwordMode: 'sha256',
      }
      return [
        { ...baseDs, name: 'Vendas - SGBR', dataEndpoint: '/sgbrbi/vendas/analitico', isAuthSource: true, erpEndpoints: ['vendas'] },
        { ...baseDs, name: 'Notas Fiscais - SGBR', dataEndpoint: '/sgbrbi/vendanfe/analitico', isAuthSource: false, erpEndpoints: ['notasfiscais'] },
        { ...baseDs, name: 'Contas Pagas - SGBR', dataEndpoint: '/sgbrbi/contas/pagas', isAuthSource: false, erpEndpoints: ['contas'] },
        { ...baseDs, name: 'Produção - SGBR', dataEndpoint: '/sgbrbi/produzido', isAuthSource: false, erpEndpoints: ['produzido'] },
        { ...baseDs, name: 'Estoque - SGBR', dataEndpoint: '/sgbrbi/estoque', isAuthSource: false, erpEndpoints: ['estoque'] },
        { ...baseDs, name: 'Compras - SGBR', dataEndpoint: '/sgbrbi/compras', isAuthSource: false, erpEndpoints: ['compras'] },
      ]
    },
  },
  {
    id: 'iga-custom-api',
    name: 'API própria IGA — pacote completo',
    description: '6 fontes apontando para a API REST IGA padronizada (criada pela equipe quando o ERP do cliente não tem API oficial).',
    count: 6,
    build: ({ apiUrl, apiLogin, apiPassword }) => {
      const baseDs = {
        type: 'custom',
        apiUrl,
        authMethod: 'bearer_token',
        authCredentials: apiLogin && apiPassword ? `${apiLogin}:${apiPassword}` : '',
      }
      return [
        { ...baseDs, name: 'Vendas - IGA Custom', dataEndpoint: '/iga/v1/vendas', erpEndpoints: ['vendas'] },
        { ...baseDs, name: 'Compras - IGA Custom', dataEndpoint: '/iga/v1/compras', erpEndpoints: ['compras'] },
        { ...baseDs, name: 'Estoque - IGA Custom', dataEndpoint: '/iga/v1/estoque', erpEndpoints: ['estoque'] },
        { ...baseDs, name: 'Produção - IGA Custom', dataEndpoint: '/iga/v1/produzido', erpEndpoints: ['produzido'] },
        { ...baseDs, name: 'Contas a Pagar - IGA Custom', dataEndpoint: '/iga/v1/contas-pagar', erpEndpoints: ['contas'] },
        { ...baseDs, name: 'Contas a Receber - IGA Custom', dataEndpoint: '/iga/v1/contas-receber', erpEndpoints: ['recebiveis'] },
      ]
    },
  },
]

const JSON_EXAMPLE = JSON.stringify(
  [
    {
      name: 'Vendas SGBR',
      type: 'sgbr_bi',
      apiUrl: 'http://108.181.223.103:3007',
      authMethod: 'jwt',
      apiLogin: 'iga',
      apiPassword: '123456',
      loginEndpoint: '/sgbrbi/usuario/login',
      dataEndpoint: '/sgbrbi/vendas/analitico',
      passwordMode: 'sha256',
      isAuthSource: true,
    },
  ],
  null,
  2,
)

type Props = {
  open: boolean
  onClose: () => void
  onCompleted?: () => void
}

export function BulkImportDataSourcesModal({ open, onClose, onCompleted }: Props) {
  const { message: msg } = App.useApp()
  const [activeTab, setActiveTab] = useState<'template' | 'json'>('template')
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null)
  const [apiUrl, setApiUrl] = useState('')
  const [apiLogin, setApiLogin] = useState('')
  const [apiPassword, setApiPassword] = useState('')
  const [jsonText, setJsonText] = useState(JSON_EXAMPLE)
  const [result, setResult] = useState<BulkResult | null>(null)
  const [submitting, setSubmitting] = useState(false)

  function reset() {
    setSelectedTemplate(null)
    setApiUrl('')
    setApiLogin('')
    setApiPassword('')
    setJsonText(JSON_EXAMPLE)
    setResult(null)
    setSubmitting(false)
  }

  async function submit(items: Record<string, unknown>[]) {
    if (items.length === 0) {
      msg.warning('Nenhuma fonte para importar.')
      return
    }
    setSubmitting(true)
    setResult(null)
    try {
      const { data } = await http.post<BulkResult>('/api/v1/datasources/bulk', { items })
      setResult(data)
      if (data.failed.length === 0) {
        msg.success(`${data.created.length} fonte${data.created.length === 1 ? '' : 's'} criada${data.created.length === 1 ? '' : 's'}.`)
      } else if (data.created.length > 0) {
        msg.warning(`${data.created.length} criadas, ${data.failed.length} falharam.`)
      } else {
        msg.error(`Nenhuma fonte criada. ${data.failed.length} falhas.`)
      }
      onCompleted?.()
    } catch (err) {
      msg.error((err as Error).message ?? 'Falha ao importar.')
    } finally {
      setSubmitting(false)
    }
  }

  function handleTemplateSubmit() {
    const tpl = TEMPLATES.find((t) => t.id === selectedTemplate)
    if (!tpl) return msg.warning('Selecione um template.')
    if (!apiUrl.trim()) return msg.warning('URL do servidor obrigatória.')
    const items = tpl.build({ apiUrl: apiUrl.trim(), apiLogin: apiLogin.trim(), apiPassword: apiPassword.trim() })
    void submit(items)
  }

  function handleJsonSubmit() {
    let parsed: unknown
    try {
      parsed = JSON.parse(jsonText)
    } catch {
      return msg.error('JSON inválido. Cole um array de objetos.')
    }
    if (!Array.isArray(parsed)) return msg.error('JSON precisa ser um array.')
    void submit(parsed as Record<string, unknown>[])
  }

  return (
    <Modal
      open={open}
      onCancel={() => {
        reset()
        onClose()
      }}
      title={
        <Space>
          <RocketOutlined />
          <span>Importar fontes em lote</span>
        </Space>
      }
      width={760}
      footer={null}
    >
      {result ? (
        <ResultView
          result={result}
          onReset={() => reset()}
          onClose={() => {
            reset()
            onClose()
          }}
        />
      ) : (
        <Tabs
          activeKey={activeTab}
          onChange={(k) => setActiveTab(k as 'template' | 'json')}
          items={[
            {
              key: 'template',
              label: 'Templates prontos',
              children: (
                <Space direction="vertical" size={16} style={{ width: '100%' }}>
                  <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
                    Selecione o template, preencha URL/login/senha UMA vez, e o sistema cria todas as fontes daquele conjunto com a configuração correta.
                  </Typography.Paragraph>

                  <Space direction="vertical" size={8} style={{ width: '100%' }}>
                    {TEMPLATES.map((tpl) => (
                      <Card
                        key={tpl.id}
                        size="small"
                        hoverable
                        onClick={() => setSelectedTemplate(tpl.id)}
                        style={{
                          borderColor: selectedTemplate === tpl.id ? '#1677ff' : undefined,
                          borderWidth: selectedTemplate === tpl.id ? 2 : 1,
                          cursor: 'pointer',
                        }}
                      >
                        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                          <div>
                            <Typography.Text strong>{tpl.name}</Typography.Text>
                            <Typography.Paragraph type="secondary" style={{ fontSize: 12, margin: 0 }}>
                              {tpl.description}
                            </Typography.Paragraph>
                          </div>
                          <Tag color="blue">{tpl.count} fontes</Tag>
                        </Space>
                      </Card>
                    ))}
                  </Space>

                  {selectedTemplate ? (
                    <>
                      <Input
                        placeholder="URL do servidor (ex.: http://108.181.223.103:3007)"
                        value={apiUrl}
                        onChange={(e) => setApiUrl(e.target.value)}
                      />
                      <Input
                        placeholder="Usuário da API"
                        value={apiLogin}
                        onChange={(e) => setApiLogin(e.target.value)}
                      />
                      <Input.Password
                        placeholder="Senha da API"
                        value={apiPassword}
                        onChange={(e) => setApiPassword(e.target.value)}
                      />
                      <Button
                        type="primary"
                        size="large"
                        block
                        loading={submitting}
                        onClick={handleTemplateSubmit}
                      >
                        Criar {TEMPLATES.find((t) => t.id === selectedTemplate)?.count} fontes
                      </Button>
                    </>
                  ) : null}
                </Space>
              ),
            },
            {
              key: 'json',
              label: 'JSON livre',
              children: (
                <Space direction="vertical" size={12} style={{ width: '100%' }}>
                  <Typography.Paragraph type="secondary" style={{ marginBottom: 0, fontSize: 13 }}>
                    Cole um array JSON com as fontes a criar. Campos aceitos: name, type, apiUrl,
                    authMethod, authCredentials (ou apiLogin+apiPassword), loginEndpoint, dataEndpoint,
                    passwordMode (plain/sha256), isAuthSource, erpEndpoints. Máximo 50 por chamada.
                  </Typography.Paragraph>
                  <Input.TextArea
                    rows={14}
                    style={{ fontFamily: 'monospace', fontSize: 12 }}
                    value={jsonText}
                    onChange={(e) => setJsonText(e.target.value)}
                  />
                  <Button type="primary" size="large" block loading={submitting} onClick={handleJsonSubmit}>
                    Importar
                  </Button>
                </Space>
              ),
            },
          ]}
        />
      )}
    </Modal>
  )
}

function ResultView({ result, onReset, onClose }: { result: BulkResult; onReset: () => void; onClose: () => void }) {
  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      {result.failed.length === 0 ? (
        <Alert
          type="success"
          showIcon
          message={`${result.created.length} fonte${result.created.length === 1 ? '' : 's'} criada${result.created.length === 1 ? '' : 's'} com sucesso`}
        />
      ) : (
        <Alert
          type="warning"
          showIcon
          message={`${result.created.length} de ${result.total} fontes criadas`}
          description={`${result.failed.length} falharam — veja detalhes abaixo.`}
        />
      )}

      {result.created.length > 0 ? (
        <Card size="small" title="Criadas">
          <Table
            rowKey="id"
            size="small"
            pagination={false}
            dataSource={result.created}
            columns={[
              { title: '✓', width: 40, render: () => <CheckCircleOutlined style={{ color: '#52c41a' }} /> },
              { title: 'Nome', dataIndex: 'name' },
              { title: 'ID', dataIndex: 'id', render: (v: string) => <Typography.Text code style={{ fontSize: 11 }}>{v}</Typography.Text> },
            ]}
          />
        </Card>
      ) : null}

      {result.failed.length > 0 ? (
        <Card size="small" title="Falhas" style={{ borderColor: '#ff4d4f' }}>
          <Table
            rowKey={(r) => `fail-${r.index}`}
            size="small"
            pagination={false}
            dataSource={result.failed}
            columns={[
              { title: '', width: 40, render: () => <CloseCircleOutlined style={{ color: '#cf1322' }} /> },
              { title: 'Nome', dataIndex: 'name', render: (v: string | undefined) => v ?? <Typography.Text type="secondary">(sem nome)</Typography.Text> },
              { title: 'Motivo', dataIndex: 'reason' },
            ]}
          />
        </Card>
      ) : null}

      <Space style={{ justifyContent: 'flex-end', width: '100%' }}>
        <Button onClick={onReset}>Importar mais</Button>
        <Button type="primary" onClick={onClose}>
          Fechar
        </Button>
      </Space>
    </Space>
  )
}
