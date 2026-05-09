import { Card, Progress, Space, Tag, Tooltip, Typography } from 'antd'
import { LineChartOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { getRevenueForecast, type RevenueForecastResponse } from '../services/forecastService'
import { formatBRL } from '../utils/formatters'

const CONFIDENCE_LABEL = {
  high: { label: 'Alta confiança', color: 'green' },
  medium: { label: 'Confiança média', color: 'gold' },
  low: { label: 'Baixa confiança', color: 'orange' },
} as const

/**
 * Card no Dashboard mostrando projeção de faturamento até fim do mês.
 * Filosofia: só renderiza se houver dados (zero noise quando não há
 * histórico ou fonte). Banner azul claro para diferenciar de KPIs reais
 * — é projeção, não realização.
 */
export function RevenueForecastCard({ monthlyGoal }: { monthlyGoal?: number | null } = {}) {
  const { data, isLoading } = useQuery<RevenueForecastResponse>({
    queryKey: ['forecast', 'revenue'],
    queryFn: getRevenueForecast,
    staleTime: 10 * 60_000,
    refetchOnWindowFocus: false,
  })

  if (isLoading || !data) return null
  if (!data.ok) return null

  const conf = CONFIDENCE_LABEL[data.confidence]
  const pctOfGoal =
    monthlyGoal && monthlyGoal > 0 ? Math.min((data.projectedEndOfMonth / monthlyGoal) * 100, 200) : null
  const willHitGoal = pctOfGoal != null && pctOfGoal >= 100

  return (
    <Card
      className="app-card no-hover"
      style={{
        borderLeft: '4px solid #1677ff',
        background: 'rgba(22, 119, 255, 0.04)',
      }}
      styles={{ body: { padding: 16 } }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <Space size={10} align="center">
          <LineChartOutlined style={{ fontSize: 22, color: '#1677ff' }} />
          <div>
            <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block' }}>
              Projeção fim do mês ({data.daysRemaining} dias restantes)
            </Typography.Text>
            <Typography.Title level={3} style={{ margin: 0 }}>
              {formatBRL(data.projectedEndOfMonth)}
            </Typography.Title>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              ± {formatBRL(data.projectionUpperBound - data.projectedEndOfMonth)} ·
              {' '}até hoje: {formatBRL(data.currentMonthSoFar)}
            </Typography.Text>
          </div>
        </Space>
        <Space direction="vertical" size={4} align="end">
          <Tooltip
            title={`Coeficiente de variação dos últimos ${data.daysWithData} dias com vendas. Quanto menor a dispersão, maior a confiança.`}
          >
            <Tag color={conf.color}>{conf.label}</Tag>
          </Tooltip>
          {pctOfGoal != null ? (
            <Tag color={willHitGoal ? 'green' : 'red'}>
              {willHitGoal ? '↑' : '↓'} {pctOfGoal.toFixed(0)}% da meta
            </Tag>
          ) : null}
        </Space>
      </div>
      {pctOfGoal != null ? (
        <Progress
          percent={Math.min(pctOfGoal, 100)}
          status={willHitGoal ? 'success' : 'active'}
          showInfo={false}
          style={{ marginTop: 12, marginBottom: 0 }}
        />
      ) : null}
      <Typography.Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 8 }}>
        Baseado em média móvel de 90 dias. Não considera sazonalidade — IGA-IA fará projeção avançada quando disponível.
      </Typography.Text>
    </Card>
  )
}
