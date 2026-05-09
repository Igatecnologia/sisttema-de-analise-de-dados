import { Button, Card, Col, Empty, Input, Modal, Row, Skeleton, Space, Table, Tag, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeaderCard } from '../components/PageHeaderCard'
import { http } from '../services/http'

type ConnectorRow = {
  id: string
  name: string
  labels: { product: string; productPlural: string; stock: string; sales: string; production: string; rawMaterial: string; finishedProduct: string }
  cspConnectSrc: string[]
  areas: string[]
  warmTargets: { label: string; area: string }[]
  status: 'ready' | 'coming-soon'
  schemaUrl: string
}

type ConnectorSchemaEndpoint = {
  area: string
  method: 'GET'
  path: string
  description: string
  requiredFields: string[]
  optionalFields: string[]
}

type ConnectorSchema = {
  id: string
  name: string
  status: 'ready' | 'coming-soon'
  description: string
  authMethods: string[]
  responseShape: {
    preferred: string
    accepted: string[]
    pagination: string[]
  }
  endpoints: ConnectorSchemaEndpoint[]
}

export function ConnectorsMarketplacePage() {
  const [connectors, setConnectors] = useState<ConnectorRow[] | null>(null)
  const [search, setSearch] = useState('')
  const [schema, setSchema] = useState<ConnectorSchema | null>(null)
  const [schemaLoading, setSchemaLoading] = useState(false)

  useEffect(() => {
    http.get<{ connectors: ConnectorRow[] }>('/api/v1/connectors')
      .then((r) => setConnectors(r.data.connectors))
      .catch(() => setConnectors([]))
  }, [])

  const filtered = useMemo(() => {
    if (!connectors) return []
    const term = search.trim().toLowerCase()
    if (!term) return connectors
    return connectors.filter((c) =>
      c.name.toLowerCase().includes(term) || c.id.includes(term),
    )
  }, [connectors, search])

  async function openSchema(connector: ConnectorRow) {
    setSchemaLoading(true)
    try {
      const { data } = await http.get<ConnectorSchema>(connector.schemaUrl)
      setSchema(data)
    } finally {
      setSchemaLoading(false)
    }
  }

  const schemaColumns: ColumnsType<ConnectorSchemaEndpoint> = [
    { title: 'Area', dataIndex: 'area', key: 'area', width: 110 },
    { title: 'Metodo', dataIndex: 'method', key: 'method', width: 90, render: (v) => <Tag color="blue">{v}</Tag> },
    { title: 'Path', dataIndex: 'path', key: 'path', render: (v) => <Typography.Text code>{v}</Typography.Text> },
    { title: 'Campos obrigatorios', dataIndex: 'requiredFields', key: 'requiredFields', render: (v: string[]) => v.join(', ') },
  ]

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <PageHeaderCard
        title="Marketplace de integracoes"
        subtitle="Conecte seu ERP ou suba dados via CSV. Adicione um datasource em Configuracoes -> Datasources."
      />

      <Input.Search
        allowClear
        placeholder="Buscar connector (Bling, Tiny, Omie, CSV...)"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        size="large"
      />

      {!connectors ? (
        <Skeleton active />
      ) : filtered.length === 0 ? (
        <Empty description="Nenhum connector encontrado" />
      ) : (
        <Row gutter={[16, 16]}>
          {filtered.map((c) => (
            <Col key={c.id} xs={24} sm={12} md={8}>
              <Card
                title={
                  <Space>
                    <span>{c.name}</span>
                    {c.status === 'coming-soon' ? <Tag color="default">EM BREVE</Tag> : <Tag color="green">PRONTO</Tag>}
                  </Space>
                }
                extra={c.id === 'sgbr-espuma' ? <Tag color="blue">RECOMENDADO</Tag> : null}
              >
                <Space direction="vertical" size={8} style={{ width: '100%' }}>
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    Areas suportadas: {c.areas.join(', ') || '—'}
                  </Typography.Text>
                  {c.cspConnectSrc.length > 0 ? (
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      Hosts permitidos: {c.cspConnectSrc.join(', ')}
                    </Typography.Text>
                  ) : null}
                  {c.warmTargets.length > 0 ? (
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      Aquece cache: {c.warmTargets.map((t) => t.label).join(', ')}
                    </Typography.Text>
                  ) : null}
                  {c.status === 'ready' ? (
                    <Space>
                      <Link to={`/datasources?connector=${encodeURIComponent(c.id)}`}>Configurar</Link>
                      <Button size="small" onClick={() => void openSchema(c)}>Ver schema</Button>
                    </Space>
                  ) : (
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      Solicite acesso antecipado: <a href="mailto:contato@igagestao.com.br">contato@igagestao.com.br</a>
                    </Typography.Text>
                  )}
                </Space>
              </Card>
            </Col>
          ))}
        </Row>
      )}

      <Modal
        open={!!schema || schemaLoading}
        title={schema ? `Schema: ${schema.name}` : 'Carregando schema'}
        onCancel={() => setSchema(null)}
        footer={null}
        width={920}
      >
        {schema ? (
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <Typography.Paragraph type="secondary" style={{ margin: 0 }}>
              {schema.description}
            </Typography.Paragraph>
            <Space wrap>
              <Tag color="green">Resposta: {schema.responseShape.preferred}</Tag>
              {schema.authMethods.map((method) => <Tag key={method}>{method}</Tag>)}
            </Space>
            <Table
              rowKey={(row) => row.area}
              size="small"
              pagination={false}
              columns={schemaColumns}
              dataSource={schema.endpoints}
            />
          </Space>
        ) : (
          <Skeleton active />
        )}
      </Modal>
    </div>
  )
}

export default ConnectorsMarketplacePage
