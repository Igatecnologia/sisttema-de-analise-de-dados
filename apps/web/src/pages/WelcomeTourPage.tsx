import { CheckCircleOutlined, CompassOutlined, DatabaseOutlined, TeamOutlined } from '@ant-design/icons'
import { Button, Card, Col, Progress, Row, Space, Typography } from 'antd'
import { Link } from 'react-router-dom'
import { PageHeaderCard } from '../components/PageHeaderCard'

const steps = [
  { title: 'Configure a empresa', icon: <TeamOutlined />, path: '/configuracoes' },
  { title: 'Conecte fontes', icon: <DatabaseOutlined />, path: '/fontes-de-dados' },
  { title: 'Revise dashboards', icon: <CompassOutlined />, path: '/gestao' },
  { title: 'Convide equipe', icon: <CheckCircleOutlined />, path: '/usuarios' },
]

export function WelcomeTourPage() {
  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <PageHeaderCard title="Primeiros passos" subtitle="Checklist para tirar o tenant do estado inicial sem friccao." />
      <Card className="app-card" variant="borderless">
        <Space direction="vertical" size={18} style={{ width: '100%' }}>
          <Progress percent={25} />
          <Row gutter={[16, 16]}>
            {steps.map((step) => (
              <Col xs={24} md={12} xl={6} key={step.title}>
                <Card className="app-card" variant="borderless">
                  <Space direction="vertical" size={12}>
                    {step.icon}
                    <Typography.Title level={5} style={{ margin: 0 }}>{step.title}</Typography.Title>
                    <Button><Link to={step.path}>Abrir</Link></Button>
                  </Space>
                </Card>
              </Col>
            ))}
          </Row>
        </Space>
      </Card>
    </Space>
  )
}
