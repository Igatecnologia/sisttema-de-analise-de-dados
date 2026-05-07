import { RangePickerBR } from '../../components/DatePickerPtBR'
import { Alert, Card, Col, Row, Skeleton, Space, Tag, Typography } from 'antd'
import { useMemo, useState } from 'react'
import dayjs from 'dayjs'
import { useQuery } from '@tanstack/react-query'
import {
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  Tooltip,
  XAxis,
  YAxis,
  Bar,
} from 'recharts'
import { ANALITICO_STALE_MS } from '../../api/apiEnv'
import { queryKeys } from '../../query/queryKeys'
import { getFinanceOverview } from '../../services/financeService'
import { hasAnySources } from '../../services/dataSourceService'
import { getVendasAnaliticoQuerySourceKey } from '../../services/vendasAnaliticoSourceSelection'
import { ChartShell } from '../../components/ChartShell'
import {
  CHART_COLORS,
  ChartTooltip,
  gridProps,
  xAxisProps,
  yAxisProps,
} from '../../components/charts/ChartDefaults'
import { MetricCard } from '../../components/MetricCard'
import { currentMonthRange } from '../../utils/vendasAnaliticoAggregates'

function formatBRL(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function SuperavitDeficitTab() {
  const defaultRange = useMemo(() => currentMonthRange(), [])
  const [range, setRange] = useState<[string, string]>([defaultRange.dtDe, defaultRange.dtAte])
  const sourceKey = getVendasAnaliticoQuerySourceKey()

  const overviewQuery = useQuery({
    queryKey: queryKeys.finance({ dtDe: range[0], dtAte: range[1], sourceId: sourceKey }),
    queryFn: () => getFinanceOverview({ dtDe: range[0], dtAte: range[1] }),
    enabled: hasAnySources(),
    staleTime: ANALITICO_STALE_MS,
  })

  if (overviewQuery.isLoading) {
    return (
      <Card className="app-card" variant="borderless">
        <Skeleton active paragraph={{ rows: 8 }} />
      </Card>
    )
  }

  if (overviewQuery.isError) {
    return (
      <Alert
        type="error"
        showIcon
        message="Falha ao carregar superávit/déficit"
        description="Não foi possível carregar os dados financeiros para este período."
      />
    )
  }

  const data = overviewQuery.data
  const receita = data?.receita ?? 0
  const custos = data?.custos ?? 0
  const resultado = data?.lucro ?? receita - custos
  const margem = data?.margemPct ?? (receita > 0 ? (resultado / receita) * 100 : 0)
  const status = resultado >= 0 ? 'superavit' : 'deficit'

  const monthlyRows = (data?.monthlyFlow ?? []).map((row) => {
    const monthReceita = row.receita ?? 0
    const monthCustos = row.custos ?? 0
    const monthResultado = monthReceita - monthCustos
    return {
      month: row.month,
      receita: monthReceita,
      custos: monthCustos,
      resultado: monthResultado,
      status: monthResultado >= 0 ? 'Superávit' : 'Déficit',
    }
  })

  const qtdMesesComDeficit = monthlyRows.filter((row) => row.resultado < 0).length
  const qtdMesesComSuperavit = monthlyRows.filter((row) => row.resultado >= 0).length

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Card className="app-card no-hover" variant="borderless" title="Período">
        <RangePickerBR
          format="DD/MM/YYYY"
          value={[dayjs(range[0]), dayjs(range[1])]}
          onChange={(values) => {
            if (!values?.[0] || !values?.[1]) return
            setRange([values[0].format('YYYY-MM-DD'), values[1].format('YYYY-MM-DD')])
          }}
        />
      </Card>

      <Row gutter={[12, 12]}>
        <Col xs={24} md={12}>
          <MetricCard
            hero
            title={status === 'superavit' ? 'Superávit do período' : 'Déficit do período'}
            value={formatBRL(resultado)}
            accentColor={status === 'superavit' ? '#10B981' : '#F43F5E'}
          />
        </Col>
        <Col xs={12} md={4}>
          <MetricCard title="Receita" value={formatBRL(receita)} accentColor="#3B82F6" />
        </Col>
        <Col xs={12} md={4}>
          <MetricCard title="Custos" value={formatBRL(custos)} accentColor="#F59E0B" />
        </Col>
        <Col xs={24} md={4}>
          <MetricCard
            title="Margem"
            value={`${margem.toFixed(1)}%`}
            accentColor={status === 'superavit' ? '#10B981' : '#F43F5E'}
          />
        </Col>
      </Row>

      <Alert
        type={status === 'superavit' ? 'success' : 'warning'}
        showIcon
        message={
          status === 'superavit'
            ? 'Resultado positivo no período selecionado'
            : 'Atenção: resultado negativo no período selecionado'
        }
        description={
          status === 'superavit'
            ? `Houve superávit em ${qtdMesesComSuperavit} de ${monthlyRows.length || 0} meses analisados.`
            : `Foram identificados ${qtdMesesComDeficit} meses com déficit no período.`
        }
      />

      <Card className="app-card no-hover" variant="borderless" title="Tendência mensal de resultado">
        <ChartShell height={300}>
          <ComposedChart data={monthlyRows}>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="month" {...xAxisProps} />
            <YAxis
              {...yAxisProps}
              tickFormatter={(value: number) =>
                value.toLocaleString('pt-BR', { maximumFractionDigits: 0 })
              }
            />
            <Tooltip content={<ChartTooltip format="currency" />} />
            <Legend iconType="circle" />
            <Bar
              dataKey="receita"
              name="Receita"
              fill={CHART_COLORS[1]}
              fillOpacity={0.32}
              radius={[4, 4, 0, 0]}
            />
            <Bar
              dataKey="custos"
              name="Custos"
              fill={CHART_COLORS[4]}
              fillOpacity={0.32}
              radius={[4, 4, 0, 0]}
            />
            <Line
              type="monotone"
              dataKey="resultado"
              name="Resultado"
              stroke={CHART_COLORS[0]}
              strokeWidth={2.5}
              dot={{ r: 3 }}
            />
          </ComposedChart>
        </ChartShell>
      </Card>

      <Card className="app-card no-hover" variant="borderless" title="Resultado por mês">
        <Space direction="vertical" size={8} style={{ width: '100%' }}>
          {monthlyRows.length ? (
            monthlyRows.map((row) => (
              <div key={row.month} className="finance-deficit-row">
                <div>
                  <Typography.Text strong>{row.month}</Typography.Text>
                  <div className="finance-deficit-row__sub">
                    Receita {formatBRL(row.receita)} · Custos {formatBRL(row.custos)}
                  </div>
                </div>
                <Space>
                  <Tag color={row.status === 'Superávit' ? 'green' : 'red'}>{row.status}</Tag>
                  <Typography.Text
                    strong
                    style={{ color: row.resultado >= 0 ? '#10B981' : '#F43F5E' }}
                  >
                    {formatBRL(row.resultado)}
                  </Typography.Text>
                </Space>
              </div>
            ))
          ) : (
            <Typography.Text type="secondary">
              Sem dados mensais para o período selecionado.
            </Typography.Text>
          )}
        </Space>
      </Card>
    </Space>
  )
}
