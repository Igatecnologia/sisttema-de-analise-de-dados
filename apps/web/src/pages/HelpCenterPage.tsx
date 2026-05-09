import { BookOutlined, CustomerServiceOutlined, SearchOutlined } from '@ant-design/icons'
import { Button, Card, Col, Empty, Input, Row, Skeleton, Space, Tag, Typography } from 'antd'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeaderCard } from '../components/PageHeaderCard'
import { listHelpArticles } from '../services/helpService'

export function HelpCenterPage() {
  const [q, setQ] = useState('')
  const articlesQuery = useQuery({
    queryKey: ['helpArticles', q],
    queryFn: () => listHelpArticles(q),
    staleTime: 10 * 60_000,
  })
  const articles = articlesQuery.data ?? []

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <PageHeaderCard
        title="Central de ajuda"
        subtitle="Guias praticos para operacao, integracoes e administracao do SaaS."
        extra={<Button icon={<CustomerServiceOutlined />}><Link to="/suporte/fale-conosco">Falar com suporte</Link></Button>}
      />
      <Card className="app-card" variant="borderless">
        <Input size="large" prefix={<SearchOutlined />} allowClear placeholder="Buscar artigo, area ou recurso" value={q} onChange={(event) => setQ(event.target.value)} />
      </Card>
      {articlesQuery.isLoading ? <Card className="app-card" variant="borderless"><Skeleton active /></Card> : null}
      {!articlesQuery.isLoading && articles.length === 0 ? <Empty description="Nenhum artigo encontrado" /> : null}
      <Row gutter={[16, 16]}>
        {articles.map((article) => (
          <Col xs={24} md={12} xl={8} key={article.id}>
            <Card className="app-card" variant="borderless">
              <Space direction="vertical" size={12}>
                <BookOutlined />
                <Typography.Title level={5} style={{ margin: 0 }}>{article.title}</Typography.Title>
                <Space>
                  <Tag color="blue">{article.category}</Tag>
                  <Typography.Text type="secondary">{article.minutes} min</Typography.Text>
                </Space>
                <Button type="link" style={{ padding: 0 }}>Abrir artigo</Button>
              </Space>
            </Card>
          </Col>
        ))}
      </Row>
    </Space>
  )
}
