import { CheckOutlined } from '@ant-design/icons'
import { Button, Card, Col, Progress, Radio, Row, Space, Tag, Typography } from 'antd'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeaderCard } from '../components/PageHeaderCard'

const plans = {
  starter: { label: 'Starter', price: 'R$ 149', fit: 58, features: ['Dashboards essenciais', '3 usuarios', '1 fonte de dados'] },
  pro: { label: 'Pro', price: 'R$ 399', fit: 91, features: ['Dashboards completos', '20 usuarios', 'Fontes ilimitadas', 'Alertas'] },
  enterprise: { label: 'Enterprise', price: 'Sob consulta', fit: 86, features: ['SSO', 'SLA dedicado', 'Ambientes separados', 'Suporte prioritario'] },
}

export function PlanComparisonWizardPage() {
  const [team, setTeam] = useState('medium')
  const [integrations, setIntegrations] = useState('many')
  const recommended = useMemo(() => {
    if (team === 'large') return 'enterprise'
    if (integrations === 'many') return 'pro'
    return 'starter'
  }, [team, integrations])

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <PageHeaderCard title="Recomendador de plano" subtitle="Sugestao baseada em tamanho da equipe e uso esperado." />
      <Card className="app-card" variant="borderless">
        <Row gutter={[24, 24]}>
          <Col xs={24} lg={8}>
            <Space direction="vertical" size={20} style={{ width: '100%' }}>
              <div>
                <Typography.Text strong>Tamanho da equipe</Typography.Text>
                <Radio.Group value={team} onChange={(event) => setTeam(event.target.value)} style={{ display: 'grid', marginTop: 8 }}>
                  <Radio value="small">Ate 3 usuarios</Radio>
                  <Radio value="medium">4 a 20 usuarios</Radio>
                  <Radio value="large">Mais de 20 usuarios</Radio>
                </Radio.Group>
              </div>
              <div>
                <Typography.Text strong>Integracoes</Typography.Text>
                <Radio.Group value={integrations} onChange={(event) => setIntegrations(event.target.value)} style={{ display: 'grid', marginTop: 8 }}>
                  <Radio value="one">Uma fonte</Radio>
                  <Radio value="many">Multiplas fontes</Radio>
                </Radio.Group>
              </div>
            </Space>
          </Col>
          <Col xs={24} lg={16}>
            <Row gutter={[16, 16]}>
              {Object.entries(plans).map(([id, plan]) => (
                <Col xs={24} md={8} key={id}>
                  <Card className="app-card" variant="borderless">
                    <Space direction="vertical" size={12}>
                      <Space>
                        <Typography.Title level={5} style={{ margin: 0 }}>{plan.label}</Typography.Title>
                        {recommended === id ? <Tag color="green">Recomendado</Tag> : null}
                      </Space>
                      <Typography.Title level={4} style={{ margin: 0 }}>{plan.price}</Typography.Title>
                      <Progress percent={recommended === id ? plan.fit : Math.max(40, plan.fit - 20)} size="small" />
                      {plan.features.map((feature) => (
                        <Typography.Text key={feature}><CheckOutlined /> {feature}</Typography.Text>
                      ))}
                      <Button type={recommended === id ? 'primary' : 'default'}><Link to="/planos">Ver plano</Link></Button>
                    </Space>
                  </Card>
                </Col>
              ))}
            </Row>
          </Col>
        </Row>
      </Card>
    </Space>
  )
}
