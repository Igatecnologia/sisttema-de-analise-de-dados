import { Card, Col, Row, Space, Tag, Typography } from 'antd'
import { appDesignTokens } from '../theme/tokens'
import { useAppTheme } from '../theme/ThemeContext'
import { PageHeaderCard } from '../components/PageHeaderCard'

function ColorSwatch({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ width: 26, height: 26, borderRadius: 8, border: '1px solid var(--qc-border)', background: value }} />
      <div>
        <Typography.Text style={{ display: 'block', fontWeight: 600 }}>{label}</Typography.Text>
        <Typography.Text type="secondary">{value}</Typography.Text>
      </div>
    </div>
  )
}

export function DesignTokensPage() {
  const { mode } = useAppTheme()
  const colors = appDesignTokens.themes[mode]
  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <PageHeaderCard
        title="Design Tokens"
        subtitle="Base visual do sistema IGA (cores, tipografia, espaçamento e radius)."
        extra={<Tag color="blue">{mode.toUpperCase()}</Tag>}
      />

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card className="app-card" title="Paleta semântica" variant="borderless">
            <Space direction="vertical" size={12} style={{ width: '100%' }}>
              {Object.entries(colors).map(([key, value]) => (
                <ColorSwatch key={key} label={key} value={value} />
              ))}
            </Space>
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card className="app-card" title="Escalas" variant="borderless">
            <Space direction="vertical" size={10}>
              <Typography.Text strong>Tipografia</Typography.Text>
              {Object.entries(appDesignTokens.scale.typography).map(([key, value]) => (
                <Typography.Text key={key}>{key}: {value}px</Typography.Text>
              ))}
              <Typography.Text strong style={{ marginTop: 8 }}>Espaçamento</Typography.Text>
              {Object.entries(appDesignTokens.scale.spacing).map(([key, value]) => (
                <Typography.Text key={key}>{key}: {value}px</Typography.Text>
              ))}
              <Typography.Text strong style={{ marginTop: 8 }}>Radius</Typography.Text>
              {Object.entries(appDesignTokens.scale.radius).map(([key, value]) => (
                <Typography.Text key={key}>{key}: {value}px</Typography.Text>
              ))}
            </Space>
          </Card>
        </Col>
      </Row>
    </Space>
  )
}
