import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  CalendarOutlined,
  DollarOutlined,
  ReloadOutlined,
  RiseOutlined,
  ShoppingCartOutlined,
  TeamOutlined,
} from '@ant-design/icons'
import {
  Alert,
  Button,
  Card,
  Col,
  Empty,
  Row,
  Segmented,
  Select,
  Space,
  Tag,
  Typography,
} from 'antd'
import dayjs from 'dayjs'
import { RangePickerBR } from '../components/DatePickerPtBR'
import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useSortableWidgets } from '../hooks/useSortableWidgets'
import { MetricCard } from '../components/MetricCard'
import { EmptyState } from '../components/EmptyState'
import { metricColors, marginColor } from '../theme/colors'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { ChartTooltip, gridProps, xAxisProps, yAxisProps, CHART_COLORS, useChartAnimationProps } from '../components/charts/ChartDefaults'
import { ChartShell } from '../components/ChartShell'
import { PageHeaderCard } from '../components/PageHeaderCard'
import { DevErrorDetail } from '../components/DevErrorDetail'
import { ANALITICO_STALE_MS } from '../api/apiEnv'
import { hasAnySources } from '../services/dataSourceService'
import {
  getVendasAnaliticoDataSourceLabel,
  getVendasAnaliticoQuerySourceKey,
} from '../services/vendasAnaliticoSourceSelection'
import { getDashboardData } from '../services/dashboardService'
import { queryKeys } from '../query/queryKeys'
import { getErrorMessage } from '../api/httpError'
import { useRealtimeHeartbeat } from '../hooks/useRealtimeHeartbeat'
import { formatBRL, formatCompact } from '../utils/formatters'
import { DashboardSkeleton } from '../components/skeletons/DashboardSkeleton'

function formatBRLAxisShort(n: number) {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (Math.abs(n) >= 1000) return `${(n / 1000).toFixed(0)}k`
  return String(Math.round(n))
}

// ── Tooltip escuro premium ──
function DarkTooltip({ active, payload, label, isCurrency = true }: {
  active?: boolean; payload?: Array<{ name: string; value: number; color: string }>
  label?: string; isCurrency?: boolean
}) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#0F172A', borderRadius: 8, padding: '10px 14px', boxShadow: '0 4px 16px rgba(0,0,0,0.3)' }}>
      {label && <p className="typ-tooltip-label" style={{ margin: '0 0 6px' }}>{label}</p>}
      {payload.map((entry, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: entry.color, flexShrink: 0 }} />
          <span className="typ-tooltip-name">{entry.name}</span>
          <span className="typ-tooltip-value" style={{ marginLeft: 'auto' }}>
            {isCurrency ? formatBRL(entry.value) : entry.value.toLocaleString('pt-BR')}
          </span>
        </div>
      ))}
    </div>
  )
}

const PT_MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'] as const

const SGBR_PERMS_INFO_KEY = 'iga-dismiss-sgbr-permissions-info'

export function DashboardPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [sgbrInfoVisible, setSgbrInfoVisible] = useState(
    () => typeof window !== 'undefined' && localStorage.getItem(SGBR_PERMS_INFO_KEY) !== '1',
  )
  const period = (searchParams.get('p') ?? '30d') as '7d' | '30d' | '90d'
  const startDate = searchParams.get('start') ?? ''
  const endDate = searchParams.get('end') ?? ''
  const pollMs = Number(searchParams.get('pollMs') ?? 0)
  const sourceKey = getVendasAnaliticoQuerySourceKey()
  const sourceLabel = getVendasAnaliticoDataSourceLabel()
  const chartAnimation = useChartAnimationProps()
  const realtimeEnabled = pollMs > 0
  const { lastPulseAt, transport } = useRealtimeHeartbeat(realtimeEnabled, pollMs || 5_000)

  const dashboardQuery = useQuery({
    queryKey: queryKeys.dashboard({ period, pollMs: String(pollMs), start: startDate, end: endDate, sourceId: sourceKey }),
    queryFn: () => getDashboardData({ period, startDate: startDate || undefined, endDate: endDate || undefined }),
    refetchInterval: realtimeEnabled ? pollMs : false,
    staleTime: hasAnySources() ? ANALITICO_STALE_MS : 15_000,
  })

  const { widgetLayout, SortableWrap, WidgetWrapper } = useSortableWidgets(
    'dashboard',
    ['faturamento', 'ticket', 'clientes', 'margem'],
  )

  // ── Dados derivados ──
  const currentMonthPt = useMemo(() => PT_MONTHS[dayjs().month()] ?? '', [])

  const revenueFullMonths = useMemo(
    () => (dashboardQuery.data?.revenue ?? []).filter(r => r.month !== currentMonthPt),
    [dashboardQuery.data, currentMonthPt],
  )

  const derived = useMemo(() => {
    const data = dashboardQuery.data
    if (!data) return null

    const latest = data.latest
    const faturamento =
      data.kpis.find((k) => k.key === 'faturamento')?.value ?? latest.reduce((s, r) => s + r.total, 0)
    const custoTotal = latest.reduce((s, r) => s + r.custounit * r.qtde, 0)
    const margemMedia = faturamento > 0 ? ((faturamento - custoTotal) / faturamento) * 100 : 0
    const totalPedidos = latest.length
    const ticketMedio = totalPedidos > 0 ? faturamento / totalPedidos : 0
    const clientesUnicos = new Set(latest.map(r => r.cliente)).size
    const produtosUnicos = new Set(latest.map(r => r.produto)).size

    const revenueTotal = data.revenue.reduce((s, r) => s + r.value, 0)

    // Top 5 clientes
    const clienteMap = new Map<string, number>()
    latest.forEach(r => {
      const name = r.cliente?.slice(0, 30) || 'Sem nome'
      clienteMap.set(name, (clienteMap.get(name) ?? 0) + r.total)
    })
    const topClientes = Array.from(clienteMap.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5)

    // Últimas 8 vendas
    const ultimasVendas = [...latest]
      .sort((a, b) => dayjs(b.data).valueOf() - dayjs(a.data).valueOf())
      .slice(0, 8)

    // Vendas por dia da semana
    const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab']
    const dayMap = new Map<string, { qty: number; revenue: number }>()
    days.forEach(d => dayMap.set(d, { qty: 0, revenue: 0 }))
    latest.forEach(r => {
      const d = dayjs(r.data)
      const dayName = days[d.day()] ?? 'Seg'
      const cur = dayMap.get(dayName)!
      dayMap.set(dayName, { qty: cur.qty + 1, revenue: cur.revenue + r.total })
    })
    const byDayOfWeek = days.map(d => ({
      day: d,
      qty: dayMap.get(d)?.qty ?? 0,
      revenue: dayMap.get(d)?.revenue ?? 0,
    }))

    // Melhor dia de vendas
    const bestDay = byDayOfWeek.reduce((best, cur) => cur.revenue > best.revenue ? cur : best, byDayOfWeek[0])

    // Média diária de vendas
    const avgDailyRevenue = data.sales.length > 0 ? faturamento / data.sales.length : 0

    return {
      faturamento,
      custoTotal,
      margemMedia,
      totalPedidos,
      ticketMedio,
      clientesUnicos,
      produtosUnicos,
      revenueTotal,
      topClientes,
      ultimasVendas,
      byDayOfWeek,
      bestDay,
      avgDailyRevenue,
    }
  }, [dashboardQuery.data])

  const header = (
    <PageHeaderCard
      title="Dashboard Executivo"
      subtitle="Visão consolidada do desempenho comercial da empresa."
      extra={
        <Space size={8}>
          <Tag color="blue">{sourceLabel}</Tag>
          {lastPulseAt && (
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              Atualizado {dayjs(dashboardQuery.dataUpdatedAt).format('HH:mm:ss')}
            </Typography.Text>
          )}
          <Button icon={<ReloadOutlined />} onClick={() => dashboardQuery.refetch()}>
            Atualizar
          </Button>
        </Space>
      }
    />
  )

  if (dashboardQuery.isLoading || dashboardQuery.isFetching) {
    return (
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        {header}
        <Card className="app-card no-hover" variant="borderless">
          <DashboardSkeleton />
        </Card>
      </Space>
    )
  }

  if (dashboardQuery.isError) {
    return (
      <Card
        title="Dashboard"
        extra={<Button onClick={() => dashboardQuery.refetch()}>Tentar novamente</Button>}
      >
        <Alert
          type="error"
          showIcon
          message="Não foi possível carregar"
          description={
            <>
              {getErrorMessage(dashboardQuery.error, 'Falha ao carregar dados do dashboard.')}
              <DevErrorDetail error={dashboardQuery.error} />
            </>
          }
        />
      </Card>
    )
  }

  const data = dashboardQuery.data
  if (!data || !derived) return null

  if (!data.kpis.length && !data.sales.length) {
    return (
      <Card className="app-card" variant="borderless">
        <div style={{ marginBottom: 16 }}>{header}</div>
        <EmptyState
          title="Sem dados no período selecionado"
          description="Tente ampliar o intervalo de datas ou verifique se as fontes de dados estão conectadas."
          actionLabel="Verificar fontes"
          actionPath="/fontes-de-dados"
        />
      </Card>
    )
  }

  const filteredSales = data.sales

  const widgetMap = {
    faturamento: (
      <MetricCard
        hero
        title="Faturamento"
        value={formatCompact(derived.faturamento)}
        subtitle={`${derived.totalPedidos} pedidos no período`}
        accentColor={metricColors.revenue}
      />
    ),
    ticket: (
      <MetricCard
        hero
        title="Ticket Médio"
        value={formatBRL(derived.ticketMedio)}
        subtitle="Média por pedido"
        accentColor={metricColors.ticket}
      />
    ),
    clientes: (
      <MetricCard
        hero
        title="Clientes"
        value={String(derived.clientesUnicos)}
        subtitle="Clientes únicos atendidos"
        accentColor={metricColors.clients}
      />
    ),
    margem: (
      <MetricCard
        hero
        title="Margem Bruta"
        value={`${derived.margemMedia.toFixed(1)}%`}
        subtitle={`${derived.produtosUnicos} produtos vendidos`}
        accentColor={marginColor(derived.margemMedia)}
      />
    ),
  } as const

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      {header}

      {hasAnySources() && sgbrInfoVisible ? (
        <Alert
          type="info"
          showIcon
          closable
          message="Permissões neste módulo (SGBR BI)"
          description="Com o login da API SGBR, este aplicativo aplica um perfil administrativo fixo no menu e nas ações."
          onClose={() => {
            localStorage.setItem(SGBR_PERMS_INFO_KEY, '1')
            setSgbrInfoVisible(false)
          }}
        />
      ) : null}

      {/* ── Filtros compactos ── */}
      <Card className="app-card no-hover" variant="borderless">
        <div className="filter-bar">
          <div className="filter-item">
            <span>Período</span>
            <Segmented
              aria-label="Selecionar período do dashboard"
              value={period}
              onChange={(v) => {
                const next = v as typeof period
                setSearchParams((prev) => {
                  const p = new URLSearchParams(prev)
                  p.set('p', next)
                  p.delete('start')
                  p.delete('end')
                  return p
                })
              }}
              options={[
                { label: '7 dias', value: '7d' },
                { label: '30 dias', value: '30d' },
                { label: '90 dias', value: '90d' },
              ]}
            />
          </div>
          <div className="filter-item">
            <span>Datas</span>
            <RangePickerBR
              format="DD/MM/YYYY"
              value={startDate && endDate ? [dayjs(startDate), dayjs(endDate)] : undefined}
              onChange={(vals) => {
                setSearchParams((prev) => {
                  const p = new URLSearchParams(prev)
                  const [from, to] = vals ?? []
                  if (from) p.set('start', from.format('YYYY-MM-DD'))
                  else p.delete('start')
                  if (to) p.set('end', to.format('YYYY-MM-DD'))
                  else p.delete('end')
                  return p
                })
              }}
              placeholder={['Data inicial', 'Data final']}
            />
          </div>
          <div className="filter-item">
            <span>Atualização</span>
            <Space size={8}>
              <Select
                style={{ width: 160 }}
                value={String(pollMs)}
                options={[
                  { value: '0', label: 'Manual' },
                  { value: '10000', label: 'A cada 10s' },
                  { value: '30000', label: 'A cada 30s' },
                  { value: '60000', label: 'A cada 1min' },
                ]}
                onChange={(next) => {
                  setSearchParams((prev) => {
                    const p = new URLSearchParams(prev)
                    p.set('pollMs', next)
                    return p
                  })
                }}
              />
              {realtimeEnabled && (
                <Tag color="green" style={{ margin: 0 }}>{transport.toUpperCase()}</Tag>
              )}
            </Space>
          </div>
        </div>
      </Card>

      {/* ── KPIs Hero (arrastável — use o handle no canto superior esquerdo) ── */}
      <SortableWrap>
        <Row gutter={[12, 12]}>
          {widgetLayout.map((widgetId) => (
            <Col key={widgetId} xs={12} sm={6}>
              <WidgetWrapper id={widgetId}>
                {widgetMap[widgetId as keyof typeof widgetMap]}
              </WidgetWrapper>
            </Col>
          ))}
        </Row>
      </SortableWrap>

      {/* ── Gráficos principais ── */}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={14}>
          <Card variant="borderless" className="app-card no-hover" title="Vendas diárias">
            <ChartShell height={280}>
              <AreaChart data={filteredSales} margin={{ left: 0, right: 8 }}>
                <defs>
                  <linearGradient id="gradVendas" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={CHART_COLORS[0]} stopOpacity={0.2} />
                    <stop offset="95%" stopColor={CHART_COLORS[0]} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="date" {...xAxisProps} />
                <YAxis {...yAxisProps} allowDecimals={false} />
                <Tooltip content={<ChartTooltip format="integer" />} />
                <Area
                  type="monotone"
                  dataKey="value"
                  name="Quantidade"
                  stroke={CHART_COLORS[0]}
                  strokeWidth={2.5}
                  fill="url(#gradVendas)"
                  dot={false}
                  activeDot={{ r: 5, stroke: '#fff', strokeWidth: 2 }}
                  {...chartAnimation}
                />
              </AreaChart>
            </ChartShell>
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          <Card variant="borderless" className="app-card no-hover" title="Faturamento mensal">
            <ChartShell height={280}>
              <BarChart data={revenueFullMonths} margin={{ left: 0, right: 8 }}>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="month" {...xAxisProps} />
                <YAxis tickFormatter={formatBRLAxisShort} {...yAxisProps} width={50} />
                <Tooltip content={<DarkTooltip />} />
                <Bar dataKey="value" name="Faturamento" radius={[6, 6, 0, 0]}>
                  {revenueFullMonths.map((_, i) => (
                    <Cell
                      key={i}
                      fill={CHART_COLORS[0]}
                      fillOpacity={i === revenueFullMonths.length - 1 ? 1 : 0.55}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ChartShell>
          </Card>
        </Col>
      </Row>

      {/* ── Top clientes + Vendas por dia da semana ── */}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card variant="borderless" className="app-card no-hover" title="Top 5 clientes por faturamento">
            {derived.topClientes.length === 0 ? (
              <Typography.Text type="secondary">Sem dados no período</Typography.Text>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {derived.topClientes.map((cli, i) => {
                  const pct = derived.faturamento > 0 ? (cli.value / derived.faturamento) * 100 : 0
                  return (
                    <div key={cli.name} style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '10px 14px', borderRadius: 10,
                      background: 'var(--qc-canvas)', border: '1px solid var(--qc-border)',
                    }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: 8,
                        background: CHART_COLORS[i],
                        display: 'grid', placeItems: 'center',
                        color: '#fff', fontSize: 12, fontWeight: 700, flexShrink: 0,
                      }}>
                        {i + 1}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <Typography.Text ellipsis style={{ display: 'block', fontWeight: 500, fontSize: 13 }}>
                          {cli.name}
                        </Typography.Text>
                        <div style={{
                          height: 4, borderRadius: 2, marginTop: 4,
                          background: 'var(--qc-border)', overflow: 'hidden',
                        }}>
                          <div style={{
                            height: '100%', borderRadius: 2,
                            width: `${Math.min(pct, 100)}%`,
                            background: CHART_COLORS[i],
                            transition: 'width 0.6s ease',
                          }} />
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <Typography.Text strong style={{ fontVariantNumeric: 'tabular-nums', fontSize: 14 }}>
                          {formatCompact(cli.value)}
                        </Typography.Text>
                        <Typography.Text type="secondary" style={{ fontSize: 11, display: 'block' }}>
                          {pct.toFixed(1)}%
                        </Typography.Text>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card variant="borderless" className="app-card no-hover" title="Faturamento por dia da semana">
            <ChartShell height={240}>
              <ComposedChart data={derived.byDayOfWeek} margin={{ left: 0, right: 8 }}>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="day" {...xAxisProps} />
                <YAxis yAxisId="left" {...yAxisProps} allowDecimals={false} />
                <YAxis yAxisId="right" orientation="right" {...yAxisProps} tickFormatter={formatBRLAxisShort} width={50} />
                <Tooltip content={<DarkTooltip />} />
                <Legend iconSize={8} iconType="circle" wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                <Bar yAxisId="left" dataKey="qty" name="Pedidos" fill={CHART_COLORS[1]} fillOpacity={0.7} radius={[4, 4, 0, 0]} />
                <Line yAxisId="right" type="monotone" dataKey="revenue" name="Faturamento" stroke={CHART_COLORS[0]} strokeWidth={2.5} dot={{ r: 4, fill: CHART_COLORS[0] }} {...chartAnimation} />
              </ComposedChart>
            </ChartShell>
            {derived.bestDay && derived.bestDay.revenue > 0 && (
              <Typography.Text type="secondary" style={{ fontSize: 12, marginTop: 4, display: 'block' }}>
                <CalendarOutlined style={{ marginRight: 4 }} />
                Melhor dia: <strong>{derived.bestDay.day}</strong> com {formatCompact(derived.bestDay.revenue)}
              </Typography.Text>
            )}
          </Card>
        </Col>
      </Row>

      {/* ── Últimas vendas ── */}
      <Card variant="borderless" className="app-card no-hover" title="Últimas vendas">
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
          gap: 10,
        }}>
          {derived.ultimasVendas.map((venda) => (
            <div key={venda.id} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '10px 14px', borderRadius: 10,
              background: 'var(--qc-canvas)', border: '1px solid var(--qc-border)',
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                background: venda.status === 'pago'
                  ? 'rgba(16, 185, 129, 0.12)'
                  : venda.status === 'pendente'
                    ? 'rgba(245, 158, 11, 0.12)'
                    : 'rgba(244, 63, 94, 0.12)',
                display: 'grid', placeItems: 'center', flexShrink: 0,
              }}>
                {venda.status === 'pago'
                  ? <ArrowUpOutlined style={{ color: '#10B981', fontSize: 14 }} />
                  : venda.status === 'pendente'
                    ? <ShoppingCartOutlined style={{ color: '#F59E0B', fontSize: 14 }} />
                    : <ArrowDownOutlined style={{ color: '#F43F5E', fontSize: 14 }} />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <Typography.Text ellipsis style={{ display: 'block', fontWeight: 500, fontSize: 13 }}>
                  {venda.cliente}
                </Typography.Text>
                <Typography.Text ellipsis type="secondary" style={{ fontSize: 11, display: 'block', maxWidth: 200 }}>
                  {venda.produto} · {dayjs(venda.data).format('DD/MM')}
                </Typography.Text>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <Typography.Text strong style={{ fontVariantNumeric: 'tabular-nums', fontSize: 14 }}>
                  {formatBRL(venda.total)}
                </Typography.Text>
                <Typography.Text type="secondary" style={{ fontSize: 10, display: 'block' }}>
                  {venda.margem.toFixed(1)}% margem
                </Typography.Text>
              </div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 12, textAlign: 'center' }}>
          <Button type="link">
            <Link to="/dashboard/vendas-analitico">Ver todas as vendas</Link>
          </Button>
        </div>
      </Card>

      {/* ── Acesso rápido ── */}
      <Row gutter={[12, 12]}>
        <Col xs={24} sm={8}>
          <Link to="/dashboard/analises" style={{ display: 'block' }}>
            <Card className="app-card" variant="borderless" hoverable style={{ textAlign: 'center', padding: '8px 0' }}>
              <RiseOutlined style={{ fontSize: 22, color: CHART_COLORS[0], marginBottom: 4 }} />
              <Typography.Text strong style={{ display: 'block', fontSize: 13 }}>Análises BI</Typography.Text>
              <Typography.Text type="secondary" style={{ fontSize: 11 }}>Gráficos detalhados</Typography.Text>
            </Card>
          </Link>
        </Col>
        <Col xs={24} sm={8}>
          <Link to="/dashboard/vendas-analitico" style={{ display: 'block' }}>
            <Card className="app-card" variant="borderless" hoverable style={{ textAlign: 'center', padding: '8px 0' }}>
              <ShoppingCartOutlined style={{ fontSize: 22, color: CHART_COLORS[1], marginBottom: 4 }} />
              <Typography.Text strong style={{ display: 'block', fontSize: 13 }}>Vendas</Typography.Text>
              <Typography.Text type="secondary" style={{ fontSize: 11 }}>Consulta analítica</Typography.Text>
            </Card>
          </Link>
        </Col>
        <Col xs={24} sm={8}>
          <Link to="/financeiro" style={{ display: 'block' }}>
            <Card className="app-card" variant="borderless" hoverable style={{ textAlign: 'center', padding: '8px 0' }}>
              <DollarOutlined style={{ fontSize: 22, color: '#10B981', marginBottom: 4 }} />
              <Typography.Text strong style={{ display: 'block', fontSize: 13 }}>Financeiro</Typography.Text>
              <Typography.Text type="secondary" style={{ fontSize: 11 }}>Receitas e custos</Typography.Text>
            </Card>
          </Link>
        </Col>
      </Row>
    </Space>
  )
}
