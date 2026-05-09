import { Card, Space, Tag, Typography, Button } from 'antd'
import { AlertOutlined, ArrowRightOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { getAlertasOperacionais } from '../services/erpService'
import { queryKeys } from '../query/queryKeys'
import type { AlertaOperacional } from '../types/models'

/** Mapeia tipo de alerta operacional para label PT-BR. Espelha AlertasPage. */
const TIPO_LABELS: Record<AlertaOperacional['tipo'], string> = {
  margem_baixa: 'Margem baixa',
  estoque_critico: 'Estoque crítico',
  vazamento_lucro: 'Vazamento de lucro',
  producao_atrasada: 'Produção atrasada',
  inadimplencia: 'Inadimplência',
}

const SEVERIDADE_COLOR: Record<AlertaOperacional['severidade'], string> = {
  alta: '#cf1322',
  media: '#d48806',
  baixa: '#1677ff',
}

const SEVERIDADE_BG: Record<AlertaOperacional['severidade'], string> = {
  alta: 'rgba(207, 19, 34, 0.08)',
  media: 'rgba(212, 136, 6, 0.08)',
  baixa: 'rgba(22, 119, 255, 0.08)',
}

/**
 * Card de alertas críticos no topo do Dashboard. Filosofia "zero noise":
 * - Se há 0 alertas abertos → não renderiza nada (não polui dashboard limpo)
 * - Se há alertas → mostra contagem por severidade + top 5 mais críticos
 *   com link direto para /alertas
 *
 * Critério: alertas NÃO LIDOS de qualquer severidade. Ordenado por
 * severidade desc (alta → baixa), depois por data desc (mais novo primeiro).
 */
export function CriticalAlertsCard() {
  const { data: alerts, isLoading } = useQuery({
    queryKey: queryKeys.alertasOperacionais(),
    queryFn: getAlertasOperacionais,
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  })

  if (isLoading) return null

  const open = (alerts ?? []).filter((a) => !a.lido)
  if (open.length === 0) return null

  /** Contagem por severidade — mostrada em chips no header do card. */
  const counts = open.reduce(
    (acc, a) => {
      acc[a.severidade] = (acc[a.severidade] ?? 0) + 1
      return acc
    },
    { alta: 0, media: 0, baixa: 0 } as Record<AlertaOperacional['severidade'], number>,
  )

  const severityWeight: Record<AlertaOperacional['severidade'], number> = { alta: 0, media: 1, baixa: 2 }
  const topAlerts = [...open]
    .sort((a, b) => {
      const sevDiff = severityWeight[a.severidade] - severityWeight[b.severidade]
      if (sevDiff !== 0) return sevDiff
      return b.data.localeCompare(a.data)
    })
    .slice(0, 5)

  const hasHigh = counts.alta > 0
  const headerColor = hasHigh ? SEVERIDADE_COLOR.alta : SEVERIDADE_COLOR.media
  const headerBg = hasHigh ? SEVERIDADE_BG.alta : SEVERIDADE_BG.media

  return (
    <Card
      className="app-card no-hover"
      style={{
        borderColor: headerColor,
        borderLeftWidth: 4,
        background: headerBg,
      }}
      styles={{ body: { padding: 16 } }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <Space size={10} align="center">
          <AlertOutlined style={{ fontSize: 22, color: headerColor }} />
          <Typography.Title level={5} style={{ margin: 0 }}>
            {open.length} {open.length === 1 ? 'alerta aberto' : 'alertas abertos'}
          </Typography.Title>
          <Space size={4}>
            {counts.alta > 0 ? <Tag color="error">{counts.alta} alta</Tag> : null}
            {counts.media > 0 ? <Tag color="warning">{counts.media} média</Tag> : null}
            {counts.baixa > 0 ? <Tag color="processing">{counts.baixa} baixa</Tag> : null}
          </Space>
        </Space>
        <Link to="/alertas">
          <Button type="link" size="small">
            Ver todos <ArrowRightOutlined />
          </Button>
        </Link>
      </div>

      <Space direction="vertical" size={6} style={{ width: '100%', marginTop: 12 }}>
        {topAlerts.map((alert) => (
          <div
            key={alert.id}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
              padding: '8px 12px',
              borderRadius: 6,
              background: 'var(--app-card-bg, rgba(255,255,255,0.6))',
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: SEVERIDADE_COLOR[alert.severidade],
                marginTop: 7,
                flexShrink: 0,
              }}
              aria-label={`severidade ${alert.severidade}`}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
                <Typography.Text strong style={{ fontSize: 13 }}>
                  {alert.titulo}
                </Typography.Text>
                <Tag style={{ margin: 0, fontSize: 11 }}>{TIPO_LABELS[alert.tipo] ?? alert.tipo}</Tag>
                <Typography.Text type="secondary" style={{ fontSize: 11, marginLeft: 'auto' }}>
                  {alert.data}
                </Typography.Text>
              </div>
              {alert.descricao ? (
                <Typography.Paragraph
                  type="secondary"
                  style={{ fontSize: 12, margin: '2px 0 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                  ellipsis={{ rows: 1 }}
                >
                  {alert.descricao}
                </Typography.Paragraph>
              ) : null}
            </div>
          </div>
        ))}
      </Space>
    </Card>
  )
}
