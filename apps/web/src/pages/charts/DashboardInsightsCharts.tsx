import { Card, Col, Row, Space, Tag, Typography } from 'antd'
import {
  ArrowUpOutlined,
  ArrowDownOutlined,
  MinusOutlined,
  TrophyOutlined,
  CalendarOutlined,
  ShoppingCartOutlined,
  DollarOutlined,
  TeamOutlined,
  RiseOutlined,
  FallOutlined,
} from '@ant-design/icons'
import { ChartShell } from '../../components/ChartShell'
import dayjs from 'dayjs'
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
  Pie,
  PieChart,
  ReferenceLine,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { DashboardData } from '../../types/models'
import { gridProps, xAxisProps, yAxisProps, CHART_COLORS } from '../../components/charts/ChartDefaults'
import { formatBRL, formatCompact } from '../../utils/formatters'

const STATUS_COLORS = {
  pago: '#10B981',
  pendente: '#F59E0B',
  cancelado: '#F43F5E',
} as const

// ── Tooltip escuro reutilizável ──
function DarkTooltip({ active, payload, label, isCurrency = true }: {
  active?: boolean; payload?: Array<{ name: string; value: number; color: string }>
  label?: string; isCurrency?: boolean
}) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#0F172A', borderRadius: 8, padding: '10px 14px', boxShadow: '0 4px 16px rgba(0,0,0,0.3)' }}>
      {label && <p className="typ-tooltip-label" style={{ margin: '0 0 6px' }}>{label}</p>}
      {payload.filter(e => e.name !== 'base').map((entry, i) => (
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

// ── Bloco de informação do gráfico ──
function ChartInfo({ children }: { children: React.ReactNode }) {
  return (
    <Typography.Text type="secondary" className="typ-caption" style={{ lineHeight: 1.5, display: 'block', marginBottom: 12 }}>
      {children}
    </Typography.Text>
  )
}

// ── Mini Insight Card ──
function InsightTag({ icon, text, color }: { icon: React.ReactNode; text: string; color?: string }) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 500,
      background: color ? `${color}14` : 'var(--qc-canvas)',
      color: color ?? 'var(--qc-text-muted)',
      border: `1px solid ${color ? `${color}30` : 'var(--qc-border)'}`,
    }}>
      {icon}
      {text}
    </div>
  )
}

export function DashboardInsightsCharts({ data }: { data: DashboardData }) {
  const PT_MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

  // ── KPIs calculados ──
  const totalFaturamento = data.latest.reduce((s, r) => s + r.total, 0)
  const totalCusto = data.latest.reduce((s, r) => s + r.custounit * r.qtde, 0)
  const margemBruta = totalFaturamento > 0 ? ((totalFaturamento - totalCusto) / totalFaturamento) * 100 : 0
  const totalPedidos = data.latest.length
  const ticketMedio = totalPedidos > 0 ? totalFaturamento / totalPedidos : 0
  const clientesUnicos = new Set(data.latest.map(r => r.cliente)).size
  const produtosUnicos = new Set(data.latest.map(r => r.produto)).size
  const avgPedidosPorCliente = clientesUnicos > 0 ? totalPedidos / clientesUnicos : 0

  // ── Faturamento acumulado ──
  const revenueAccumulated = data.revenue.reduce<Array<{ month: string; value: number; accumulated: number }>>((acc, r) => {
    const prev = acc[acc.length - 1]?.accumulated ?? 0
    acc.push({ ...r, accumulated: prev + r.value })
    return acc
  }, [])

  // ── Faturamento mensal (meses cheios) ──
  const currentMonthPt = PT_MONTHS[dayjs().month()] ?? ''
  const revenueMonthly = data.revenue.filter(r => r.month !== currentMonthPt)
  const avgMonthlyRevenue = revenueMonthly.length > 0
    ? revenueMonthly.reduce((s, r) => s + r.value, 0) / revenueMonthly.length
    : 0
  const bestMonth = revenueMonthly.length > 0
    ? revenueMonthly.reduce((best, r) => r.value > best.value ? r : best, revenueMonthly[0])
    : null
  const worstMonth = revenueMonthly.length > 0
    ? revenueMonthly.reduce((worst, r) => r.value < worst.value ? r : worst, revenueMonthly[0])
    : null

  // ── Volume diário + variação ──
  const salesCombined = data.sales.map((point, idx, arr) => {
    const prev = arr[idx - 1]?.value ?? point.value
    return { ...point, variation: point.value - prev }
  })
  const avgDaily = data.sales.length > 0 ? Math.round(data.sales.reduce((s, p) => s + p.value, 0) / data.sales.length) : 0
  const maxDailyVolume = data.sales.length > 0 ? Math.max(...data.sales.map(s => s.value)) : 0
  const minDailyVolume = data.sales.length > 0 ? Math.min(...data.sales.map(s => s.value)) : 0

  // ── Top 10 clientes (para gráfico + concentração) ──
  const clienteMap = new Map<string, { total: number; custo: number; count: number }>()
  data.latest.forEach(r => {
    const name = r.cliente?.slice(0, 28) || 'Sem nome'
    const cur = clienteMap.get(name) ?? { total: 0, custo: 0, count: 0 }
    clienteMap.set(name, { total: cur.total + r.total, custo: cur.custo + r.custounit * r.qtde, count: cur.count + 1 })
  })
  const allClientes = Array.from(clienteMap.entries())
    .map(([name, v]) => ({
      name,
      value: v.total,
      count: v.count,
      margem: v.total > 0 ? ((v.total - v.custo) / v.total) * 100 : 0,
    }))
    .sort((a, b) => b.value - a.value)
  const topClientes = allClientes.slice(0, 10)
  const top5Revenue = allClientes.slice(0, 5).reduce((s, c) => s + c.value, 0)
  const concentracaoTop5 = totalFaturamento > 0 ? (top5Revenue / totalFaturamento) * 100 : 0

  // ── Vendas por dia da semana ──
  const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab']
  const dayMap = new Map<string, { qty: number; revenue: number }>()
  days.forEach(d => dayMap.set(d, { qty: 0, revenue: 0 }))
  data.latest.forEach(r => {
    const d = dayjs(r.data)
    const dayName = days[d.day()] ?? 'Seg'
    const cur = dayMap.get(dayName)!
    dayMap.set(dayName, { qty: cur.qty + 1, revenue: cur.revenue + r.total })
  })
  const byDayOfWeek = days.map(d => ({ day: d, qty: dayMap.get(d)?.qty ?? 0, revenue: dayMap.get(d)?.revenue ?? 0 }))
  const bestDay = byDayOfWeek.reduce((best, cur) => cur.revenue > best.revenue ? cur : best, byDayOfWeek[0])
  const worstDay = byDayOfWeek.reduce((worst, cur) => (cur.revenue < worst.revenue && cur.revenue > 0) ? cur : worst, byDayOfWeek.find(d => d.revenue > 0) ?? byDayOfWeek[0])

  // ── Waterfall (variação mensal) ──
  const waterfallData = data.revenue.reduce<Array<{ month: string; base: number; deltaAbs: number; delta: number; deltaPct: number }>>((acc, item, idx, arr) => {
    const prev = idx === 0 ? arr[0].value : arr[idx - 1].value
    const delta = idx === 0 ? item.value : item.value - prev
    const deltaPct = prev > 0 ? (delta / prev) * 100 : 0
    const running = acc.reduce((sum, row) => sum + row.delta, 0)
    acc.push({ month: item.month, base: Math.min(running, running + delta), deltaAbs: Math.abs(delta), delta, deltaPct })
    return acc
  }, [])

  // ── Distribuição de faixas de valor ──
  const faixas = [
    { label: 'Até R$ 500', min: 0, max: 500, count: 0, total: 0 },
    { label: 'R$ 500–2K', min: 500, max: 2000, count: 0, total: 0 },
    { label: 'R$ 2K–5K', min: 2000, max: 5000, count: 0, total: 0 },
    { label: 'R$ 5K–10K', min: 5000, max: 10000, count: 0, total: 0 },
    { label: 'Acima de R$ 10K', min: 10000, max: Infinity, count: 0, total: 0 },
  ]
  data.latest.forEach(r => {
    const faixa = faixas.find(f => r.total >= f.min && r.total < f.max)
    if (faixa) { faixa.count++; faixa.total += r.total }
  })
  const faixasData = faixas.filter(f => f.count > 0).map(f => ({
    name: f.label,
    pedidos: f.count,
    faturamento: Math.round(f.total),
  }))

  // ── Recorrência de clientes ──
  const clientesRecorrentes = allClientes.filter(c => c.count > 1).length
  const pctRecorrentes = clientesUnicos > 0 ? (clientesRecorrentes / clientesUnicos) * 100 : 0

  // ── Crescimento mês a mês ──
  const lastMonthGrowth = waterfallData.length >= 2
    ? waterfallData[waterfallData.length - 1]
    : null

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>

      {/* ── KPIs com contexto ── */}
      <Row gutter={[12, 12]}>
        {[
          {
            label: 'Faturamento total',
            value: formatCompact(totalFaturamento),
            icon: <DollarOutlined />,
            color: '#10B981',
            sub: `${totalPedidos} pedidos realizados`,
          },
          {
            label: 'Ticket médio',
            value: formatBRL(ticketMedio),
            icon: <ShoppingCartOutlined />,
            color: '#3B82F6',
            sub: `Valor médio por pedido`,
          },
          {
            label: 'Margem bruta',
            value: `${margemBruta.toFixed(1)}%`,
            icon: <RiseOutlined />,
            color: margemBruta >= 30 ? '#10B981' : margemBruta >= 15 ? '#F59E0B' : '#F43F5E',
            sub: `Lucro: ${formatCompact(totalFaturamento - totalCusto)}`,
          },
          {
            label: 'Clientes / Produtos',
            value: `${clientesUnicos} / ${produtosUnicos}`,
            icon: <TeamOutlined />,
            color: '#8B5CF6',
            sub: `${avgPedidosPorCliente.toFixed(1)} pedidos/cliente · ${pctRecorrentes.toFixed(0)}% recorrência`,
          },
        ].map((kpi) => (
          <Col xs={12} sm={6} key={kpi.label}>
            <div className="metric-card">
              <div className="metric-card__accent" style={{ background: kpi.color }} />
              <div className="metric-card__content">
                <span className="metric-card__title" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  {kpi.icon} {kpi.label}
                </span>
                <span className="metric-card__value">{kpi.value}</span>
                <Typography.Text type="secondary" style={{ fontSize: 11 }}>{kpi.sub}</Typography.Text>
              </div>
            </div>
          </Col>
        ))}
      </Row>

      {/* ── GRÁFICO 1: Faturamento acumulado ── */}
      <Card variant="borderless" className="app-card no-hover" title="Faturamento acumulado no período">
        <ChartInfo>
          Evolução mês a mês do faturamento acumulado (linha cheia) versus o valor faturado em cada mês individual (linha tracejada).
          Mostra se a empresa está acelerando ou desacelerando o ritmo de receita ao longo do tempo.
        </ChartInfo>
        <ChartShell height={280}>
          <AreaChart data={revenueAccumulated} margin={{ left: 0, right: 8 }}>
            <defs>
              <linearGradient id="gradAccum" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={CHART_COLORS[0]} stopOpacity={0.2} />
                <stop offset="95%" stopColor={CHART_COLORS[0]} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="month" {...xAxisProps} />
            <YAxis tickFormatter={v => formatCompact(v).replace('R$ ', '')} {...yAxisProps} />
            <Tooltip content={<DarkTooltip />} />
            <Legend iconSize={8} iconType="circle" wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
            <Area type="monotone" dataKey="accumulated" name="Acumulado" stroke={CHART_COLORS[0]} strokeWidth={2.5} fill="url(#gradAccum)" dot={{ fill: CHART_COLORS[0], r: 3 }} activeDot={{ r: 6, stroke: '#fff', strokeWidth: 2 }} />
            <Area type="monotone" dataKey="value" name="No mês" stroke={CHART_COLORS[5]} strokeWidth={1.5} fill="none" strokeDasharray="4 4" dot={false} />
          </AreaChart>
        </ChartShell>
      </Card>

      {/* ── GRÁFICO 2: Faturamento mensal (meses cheios) ── */}
      <Card variant="borderless" className="app-card no-hover" title="Faturamento por mês (meses completos)">
        <ChartInfo>
          Cada barra representa o total faturado em um mês completo. O mês atual (incompleto) é excluído para não distorcer a comparação.
          A linha tracejada mostra a média mensal do período — barras acima dela indicam meses acima da média.
        </ChartInfo>
        <Space wrap size={8} style={{ marginBottom: 8 }}>
          {bestMonth && <InsightTag icon={<TrophyOutlined />} text={`Melhor: ${bestMonth.month} com ${formatCompact(bestMonth.value)}`} color="#10B981" />}
          {worstMonth && revenueMonthly.length > 1 && <InsightTag icon={<FallOutlined />} text={`Menor: ${worstMonth.month} com ${formatCompact(worstMonth.value)}`} color="#F43F5E" />}
          {avgMonthlyRevenue > 0 && <InsightTag icon={<MinusOutlined />} text={`Média: ${formatCompact(avgMonthlyRevenue)}/mês`} />}
        </Space>
        <ChartShell height={280}>
          <ComposedChart data={revenueMonthly} margin={{ left: 0, right: 8 }}>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="month" {...xAxisProps} />
            <YAxis tickFormatter={v => formatCompact(v).replace('R$ ', '')} {...yAxisProps} />
            <Tooltip content={<DarkTooltip />} />
            <ReferenceLine y={avgMonthlyRevenue} stroke={CHART_COLORS[4]} strokeDasharray="6 3" label={{ value: 'Média', position: 'right', fill: '#94A3B8', fontSize: 11 }} />
            <Bar dataKey="value" name="Faturamento" radius={[6, 6, 0, 0]}>
              {revenueMonthly.map((r, i) => (
                <Cell key={i} fill={r.value >= avgMonthlyRevenue ? CHART_COLORS[1] : CHART_COLORS[0]} fillOpacity={i === revenueMonthly.length - 1 ? 1 : 0.7} />
              ))}
            </Bar>
          </ComposedChart>
        </ChartShell>
      </Card>

      {/* ── GRÁFICO 3: Volume diário de vendas ── */}
      <Card variant="borderless" className="app-card no-hover" title="Volume diário de vendas (unidades)">
        <ChartInfo>
          Quantidade de itens vendidos por dia no período selecionado. As barras mostram o volume diário e a linha mostra a variação
          em relação ao dia anterior (positiva = vendeu mais, negativa = vendeu menos). A linha tracejada horizontal marca a média diária.
        </ChartInfo>
        <Space wrap size={8} style={{ marginBottom: 8 }}>
          <InsightTag icon={<MinusOutlined />} text={`Média: ${avgDaily} un/dia`} />
          <InsightTag icon={<ArrowUpOutlined />} text={`Pico: ${maxDailyVolume} un`} color="#10B981" />
          {minDailyVolume < avgDaily && <InsightTag icon={<ArrowDownOutlined />} text={`Mínimo: ${minDailyVolume} un`} color="#F43F5E" />}
        </Space>
        <ChartShell height={280}>
          <ComposedChart data={salesCombined} margin={{ left: 0, right: 8 }}>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="date" {...xAxisProps} />
            <YAxis yAxisId="left" {...yAxisProps} allowDecimals={false} />
            <Tooltip content={<DarkTooltip isCurrency={false} />} />
            <Legend iconSize={8} iconType="circle" wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
            <ReferenceLine yAxisId="left" y={avgDaily} stroke={CHART_COLORS[4]} strokeDasharray="4 4" />
            <Bar yAxisId="left" dataKey="value" name="Quantidade" fill={CHART_COLORS[0]} fillOpacity={0.65} radius={[4, 4, 0, 0]} />
            <Line yAxisId="left" type="monotone" dataKey="variation" name="Variação vs anterior" stroke={CHART_COLORS[2]} dot={false} strokeWidth={2} />
          </ComposedChart>
        </ChartShell>
      </Card>

      {/* ── GRÁFICO 4 + 5: Top clientes + Concentração ── */}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={14}>
          <Card variant="borderless" className="app-card no-hover" title="Top 10 clientes por faturamento">
            <ChartInfo>
              Ranking dos clientes que mais geraram receita no período. Cada barra mostra o valor total faturado para o cliente.
              Quanto mais concentrada a receita em poucos clientes, maior o risco comercial.
            </ChartInfo>
            <Space wrap size={8} style={{ marginBottom: 8 }}>
              <InsightTag
                icon={<TeamOutlined />}
                text={`Top 5 = ${concentracaoTop5.toFixed(0)}% do faturamento`}
                color={concentracaoTop5 > 70 ? '#F43F5E' : concentracaoTop5 > 50 ? '#F59E0B' : '#10B981'}
              />
            </Space>
            {topClientes.length === 0 ? (
              <Typography.Text type="secondary">Sem dados no período</Typography.Text>
            ) : (
              <ChartShell height={Math.max(220, topClientes.length * 36)}>
                <BarChart data={topClientes} layout="vertical" margin={{ left: 0, right: 24 }}>
                  <CartesianGrid {...gridProps} horizontal={false} vertical />
                  <XAxis type="number" {...xAxisProps} tickFormatter={v => formatCompact(v).replace('R$ ', '')} />
                  <YAxis type="category" dataKey="name" {...yAxisProps} width={140} tick={{ fontSize: 11 }} />
                  <Tooltip content={<DarkTooltip />} />
                  <Bar dataKey="value" name="Faturamento" radius={[0, 6, 6, 0]}>
                    {topClientes.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} fillOpacity={0.85} />)}
                  </Bar>
                </BarChart>
              </ChartShell>
            )}
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          <Card variant="borderless" className="app-card no-hover" title="Distribuição por faixa de valor">
            <ChartInfo>
              Agrupa os pedidos por faixa de valor para entender o perfil das transações: se o negócio depende de muitos pedidos
              pequenos ou de poucos pedidos grandes. Cada fatia mostra quantos pedidos caem naquela faixa.
            </ChartInfo>
            {faixasData.length === 0 ? (
              <Typography.Text type="secondary">Sem dados</Typography.Text>
            ) : (
              <>
                <ChartShell height={220}>
                  <PieChart>
                    <Tooltip content={<DarkTooltip isCurrency={false} />} />
                    <Pie
                      data={faixasData}
                      dataKey="pedidos"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={85}
                      paddingAngle={3}
                      strokeWidth={0}
                    >
                      {faixasData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                    </Pie>
                  </PieChart>
                </ChartShell>
                <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 12, marginTop: 4 }}>
                  {faixasData.map((f, i) => (
                    <div key={f.name} style={{ textAlign: 'center', minWidth: 70 }}>
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: CHART_COLORS[i % CHART_COLORS.length], margin: '0 auto 3px' }} />
                      <Typography.Text style={{ fontSize: 11, display: 'block' }}>{f.name}</Typography.Text>
                      <Typography.Text strong style={{ fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>{f.pedidos}</Typography.Text>
                      <Typography.Text type="secondary" style={{ fontSize: 10, display: 'block' }}>
                        {formatCompact(f.faturamento)}
                      </Typography.Text>
                    </div>
                  ))}
                </div>
              </>
            )}
          </Card>
        </Col>
      </Row>

      {/* ── GRÁFICO 6: Vendas por dia da semana ── */}
      <Card variant="borderless" className="app-card no-hover" title="Desempenho por dia da semana">
        <ChartInfo>
          Compara o volume de pedidos (barras) e o faturamento (linha) em cada dia da semana.
          Identifica os dias mais fortes e mais fracos para otimizar operação, logística e campanhas comerciais.
        </ChartInfo>
        <Space wrap size={8} style={{ marginBottom: 8 }}>
          {bestDay && bestDay.revenue > 0 && (
            <InsightTag icon={<CalendarOutlined />} text={`Melhor dia: ${bestDay.day} (${formatCompact(bestDay.revenue)})`} color="#10B981" />
          )}
          {worstDay && worstDay.revenue > 0 && worstDay.day !== bestDay.day && (
            <InsightTag icon={<CalendarOutlined />} text={`Mais fraco: ${worstDay.day} (${formatCompact(worstDay.revenue)})`} color="#F59E0B" />
          )}
        </Space>
        <ChartShell height={260}>
          <ComposedChart data={byDayOfWeek} margin={{ left: 0, right: 8 }}>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="day" {...xAxisProps} />
            <YAxis yAxisId="left" {...yAxisProps} allowDecimals={false} />
            <YAxis yAxisId="right" orientation="right" {...yAxisProps} tickFormatter={v => formatCompact(v).replace('R$ ', '')} width={50} />
            <Tooltip content={<DarkTooltip />} />
            <Legend iconSize={8} iconType="circle" wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
            <Bar yAxisId="left" dataKey="qty" name="Qtd pedidos" fill={CHART_COLORS[1]} fillOpacity={0.7} radius={[4, 4, 0, 0]} />
            <Line yAxisId="right" type="monotone" dataKey="revenue" name="Faturamento" stroke={CHART_COLORS[0]} strokeWidth={2.5} dot={{ r: 4, fill: CHART_COLORS[0] }} />
          </ComposedChart>
        </ChartShell>
      </Card>

      {/* ── GRÁFICO 7: Waterfall — variação mensal ── */}
      <Card variant="borderless" className="app-card no-hover" title="Variação mensal do faturamento">
        <ChartInfo>
          Mostra quanto o faturamento subiu ou caiu de um mês para o outro. Barras verdes indicam crescimento
          e vermelhas indicam queda. Permite identificar rapidamente meses de aceleração ou retração.
        </ChartInfo>
        <Space size={8} style={{ marginBottom: 8 }}>
          <Tag color="green">Crescimento</Tag>
          <Tag color="red">Queda</Tag>
          {lastMonthGrowth && lastMonthGrowth.delta !== 0 && (
            <InsightTag
              icon={lastMonthGrowth.delta > 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
              text={`Último mês: ${lastMonthGrowth.delta > 0 ? '+' : ''}${lastMonthGrowth.deltaPct.toFixed(1)}%`}
              color={lastMonthGrowth.delta > 0 ? '#10B981' : '#F43F5E'}
            />
          )}
        </Space>
        <ChartShell height={280}>
          <BarChart data={waterfallData} margin={{ left: 0, right: 8 }}>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="month" {...xAxisProps} />
            <YAxis tickFormatter={v => formatCompact(v).replace('R$ ', '')} {...yAxisProps} />
            <Tooltip content={<DarkTooltip />} />
            <Bar dataKey="base" stackId="wf" fill="transparent" name="base" />
            <Bar dataKey="deltaAbs" stackId="wf" name="Variação" radius={[4, 4, 0, 0]}>
              {waterfallData.map(entry => (
                <Cell key={entry.month} fill={entry.delta >= 0 ? STATUS_COLORS.pago : STATUS_COLORS.cancelado} fillOpacity={0.85} />
              ))}
            </Bar>
          </BarChart>
        </ChartShell>
      </Card>

      {/* ── RESUMO ANALÍTICO ── */}
      <Card variant="borderless" className="app-card no-hover" title="Resumo da análise">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
          <div style={{ padding: '12px 16px', borderRadius: 10, background: 'var(--qc-canvas)', border: '1px solid var(--qc-border)' }}>
            <Typography.Text type="secondary" className="typ-label">
              Concentração de carteira
            </Typography.Text>
            <Typography.Title level={4} style={{ margin: '4px 0 2px' }}>
              {concentracaoTop5.toFixed(0)}%
            </Typography.Title>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {concentracaoTop5 > 70
                ? 'Alta concentração — diversifique a base de clientes'
                : concentracaoTop5 > 50
                  ? 'Concentração moderada — monitore os maiores'
                  : 'Carteira diversificada — bom sinal'}
            </Typography.Text>
          </div>

          <div style={{ padding: '12px 16px', borderRadius: 10, background: 'var(--qc-canvas)', border: '1px solid var(--qc-border)' }}>
            <Typography.Text type="secondary" className="typ-label">
              Margem bruta
            </Typography.Text>
            <Typography.Title level={4} style={{ margin: '4px 0 2px' }}>
              {margemBruta.toFixed(1)}%
            </Typography.Title>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {margemBruta >= 40
                ? 'Margem saudável — boa rentabilidade'
                : margemBruta >= 20
                  ? 'Margem moderada — monitore custos'
                  : 'Margem baixa — revise precificação e custos'}
            </Typography.Text>
          </div>

          <div style={{ padding: '12px 16px', borderRadius: 10, background: 'var(--qc-canvas)', border: '1px solid var(--qc-border)' }}>
            <Typography.Text type="secondary" className="typ-label">
              Sazonalidade
            </Typography.Text>
            <Typography.Title level={4} style={{ margin: '4px 0 2px' }}>
              {bestDay.day}
            </Typography.Title>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              Melhor dia da semana — {formatCompact(bestDay.revenue)} acumulados
              {worstDay && worstDay.day !== bestDay.day ? `. ${worstDay.day} é o mais fraco` : ''}
            </Typography.Text>
          </div>

          <div style={{ padding: '12px 16px', borderRadius: 10, background: 'var(--qc-canvas)', border: '1px solid var(--qc-border)' }}>
            <Typography.Text type="secondary" className="typ-label">
              Tendência
            </Typography.Text>
            <Typography.Title level={4} style={{ margin: '4px 0 2px' }}>
              {lastMonthGrowth
                ? `${lastMonthGrowth.delta > 0 ? '+' : ''}${lastMonthGrowth.deltaPct.toFixed(1)}%`
                : '—'}
            </Typography.Title>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {lastMonthGrowth
                ? lastMonthGrowth.delta > 0
                  ? 'Faturamento em crescimento no último mês completo'
                  : 'Faturamento caiu em relação ao mês anterior'
                : 'Dados insuficientes para calcular tendência'}
            </Typography.Text>
          </div>
        </div>
      </Card>
    </Space>
  )
}
