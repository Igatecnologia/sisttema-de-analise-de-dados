import { FileTextOutlined, PlayCircleOutlined } from '@ant-design/icons'
import { Button, Card, Col, Row, Space, Tag, Typography } from 'antd'
import { Link } from 'react-router-dom'
import { PageHeaderCard } from '../components/PageHeaderCard'

const templates = [
  { id: 'dre', title: 'DRE gerencial', category: 'Financeiro', cadence: 'Mensal' },
  { id: 'vendas', title: 'Performance de vendas', category: 'Comercial', cadence: 'Semanal' },
  { id: 'estoque', title: 'Ruptura e giro de estoque', category: 'Operacao', cadence: 'Diario' },
  { id: 'compras', title: 'Compras por fornecedor', category: 'Suprimentos', cadence: 'Mensal' },
  { id: 'auditoria', title: 'Auditoria de acessos', category: 'Seguranca', cadence: 'Sob demanda' },
  { id: 'executivo', title: 'Resumo executivo', category: 'Gestao', cadence: 'Semanal' },
]

export function ReportsGalleryPage() {
  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <PageHeaderCard title="Galeria de relatorios" subtitle="Modelos prontos para copiar, agendar e adaptar." />
      <Row gutter={[16, 16]}>
        {templates.map((template) => (
          <Col xs={24} md={12} xl={8} key={template.id}>
            <Card className="app-card" variant="borderless">
              <Space direction="vertical" size={14} style={{ width: '100%' }}>
                <FileTextOutlined />
                <Typography.Title level={5} style={{ margin: 0 }}>{template.title}</Typography.Title>
                <Space wrap>
                  <Tag color="blue">{template.category}</Tag>
                  <Tag>{template.cadence}</Tag>
                </Space>
                <Button type="primary" icon={<PlayCircleOutlined />}><Link to="/relatorios">Usar modelo</Link></Button>
              </Space>
            </Card>
          </Col>
        ))}
      </Row>
    </Space>
  )
}
