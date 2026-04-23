import { RangePickerBR } from '../components/DatePickerPtBR'
import {
  DownloadOutlined,
  FileExcelOutlined,
  FilePdfOutlined,
  ReloadOutlined,
  DollarOutlined,
  PercentageOutlined,
  ShoppingCartOutlined,
  TeamOutlined,
} from '@ant-design/icons'
import {
  Alert,
  Button,
  Card,
  Col,
  DatePicker,
  Dropdown,
  Empty,
  Input,
  Row,
  Select,
  Skeleton,
  Space,
  Tag,
  Typography,
} from 'antd'
import dayjs from 'dayjs'
import { useQuery } from '@tanstack/react-query'
import { useMemo, useRef } from 'react'
import { Bar, CartesianGrid, ComposedChart, Legend, Line, Tooltip, XAxis, YAxis } from 'recharts'
import { gridProps, xAxisProps, yAxisProps, CHART_COLORS } from '../components/charts/ChartDefaults'
import { ChartShell } from '../components/ChartShell'
import { ANALITICO_STALE_MS } from '../api/apiEnv'
import { hasAnySources } from '../services/dataSourceService'
import {
  getVendasAnaliticoDataSourceLabel,
  getVendasAnaliticoQuerySourceKey,
} from '../services/vendasAnaliticoSourceSelection'
import { PageHeaderCard } from '../components/PageHeaderCard'
import { useAuth } from '../auth/AuthContext'
import { hasPermission } from '../auth/permissions'
import { getErrorMessage } from '../api/httpError'
import { DevErrorDetail } from '../components/DevErrorDetail'
import { queryKeys } from '../query/queryKeys'
import { getVendasAnalitico } from '../services/vendasAnaliticoService'
import { nowBr, parseVendaDate } from '../utils/dayjsBr'
import { lineReceitaRow, sumReceitaAjustePedido } from '../utils/vendasAnaliticoAggregates'
import { formatBRL, formatCompact } from '../utils/formatters'
import { useTenant } from '../tenant/TenantContext'
import { usePersistedSearchParams } from '../navigation/usePersistedSearchParams'

const PT_MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

function sanitizeCsvCell(value: unknown): string {
  const raw = String(value ?? '')
  const escaped = raw.replace(/"/g, '""')
  return /^[=+\-@]/.test(escaped) ? `'${escaped}'` : escaped
}

function downloadCsv(headers: string[], rows: Array<Array<unknown>>, fileName: string) {
  const csvRows = [
    headers.map((h) => `"${sanitizeCsvCell(h)}"`).join(';'),
    ...rows.map((row) => row.map((cell) => `"${sanitizeCsvCell(cell)}"`).join(';')),
  ]
  const csv = `\uFEFF${csvRows.join('\n')}`
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  URL.revokeObjectURL(url)
}

async function toDataUrl(url: string): Promise<string | null> {
  if (!url) return null
  if (url.startsWith('data:image/')) return url
  try {
    const response = await fetch(url, { mode: 'cors' })
    if (!response.ok) return null
    const blob = await response.blob()
    return await new Promise((resolve) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(typeof reader.result === 'string' ? reader.result : null)
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

function getImageFormatFromDataUrl(dataUrl: string): 'PNG' | 'JPEG' {
  const mime = dataUrl.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,/)?.[1]?.toLowerCase()
  if (mime === 'image/jpeg' || mime === 'image/jpg') return 'JPEG'
  return 'PNG'
}

function defaultRange() {
  const end = nowBr()
  const start = end.subtract(90, 'day')
  return { start: start.format('YYYY-MM-DD'), end: end.format('YYYY-MM-DD') }
}

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

export function ReportsPage() {
  const { session } = useAuth()
  const tenant = useTenant()
  const canExport = hasPermission(session, 'reports:export')
  const { searchParams, setSearchParams, resetPersistedState } = usePersistedSearchParams({
    storageKey: 'reports.filters',
    ttlMs: 1000 * 60 * 60 * 24 * 7,
  })
  const chartRef = useRef<HTMLDivElement | null>(null)

  const { start: defStart, end: defEnd } = defaultRange()
  const start = searchParams.get('start') ?? defStart
  const end = searchParams.get('end') ?? defEnd
  const q = (searchParams.get('q') ?? '').trim().toLowerCase()
  const view = searchParams.get('view') ?? 'geral'

  const biConfigured = hasAnySources()
  const sourceKey = getVendasAnaliticoQuerySourceKey()
  const sourceLabel = getVendasAnaliticoDataSourceLabel()

  const query = useQuery({
    queryKey: queryKeys.vendasAnalitico({ dtDe: start, dtAte: end, sourceId: sourceKey }),
    queryFn: async () => (await getVendasAnalitico({ dtDe: start, dtAte: end })).rows,
    enabled: biConfigured,
    staleTime: ANALITICO_STALE_MS,
  })

  // ── Dados derivados ──
  const report = useMemo(() => {
    const rows = query.data ?? []
    if (!rows.length) return null

    const totalFaturamento = sumReceitaAjustePedido(rows)
    const totalCusto = rows.reduce((s, r) => s + r.precocustoitem * r.qtdevendida, 0)
    const totalQtd = rows.reduce((s, r) => s + r.qtdevendida, 0)
    const margem = totalFaturamento > 0 ? ((totalFaturamento - totalCusto) / totalFaturamento) * 100 : 0
    const clientesUnicos = new Set(rows.map(r => String(r.codcliente))).size
    const produtosUnicos = new Set(rows.map(r => String(r.codprod))).size
    const ticketMedio = rows.length > 0 ? totalFaturamento / rows.length : 0

    // Por produto
    const byProd = new Map<string, { nome: string; total: number; qtd: number; custo: number }>()
    for (const r of rows) {
      const key = String(r.codprod)
      const cur = byProd.get(key) ?? { nome: r.decprod, total: 0, qtd: 0, custo: 0 }
      cur.total += lineReceitaRow(r)
      cur.qtd += r.qtdevendida
      cur.custo += r.precocustoitem * r.qtdevendida
      byProd.set(key, cur)
    }
    const topProdutos = [...byProd.values()].sort((a, b) => b.total - a.total).slice(0, 10)
      .map(p => ({ ...p, margem: p.total > 0 ? ((p.total - p.custo) / p.total) * 100 : 0 }))

    // Por cliente
    const byCli = new Map<string, { nome: string; total: number; count: number; custo: number }>()
    for (const r of rows) {
      const key = String(r.codcliente)
      const cur = byCli.get(key) ?? { nome: r.nomecliente, total: 0, count: 0, custo: 0 }
      cur.total += lineReceitaRow(r)
      cur.count++
      cur.custo += r.precocustoitem * r.qtdevendida
      byCli.set(key, cur)
    }
    const topClientes = [...byCli.values()].sort((a, b) => b.total - a.total).slice(0, 10)
      .map(c => ({ ...c, margem: c.total > 0 ? ((c.total - c.custo) / c.total) * 100 : 0 }))

    // Por mês
    const byMonth = new Map<string, { receita: number; custo: number; count: number }>()
    for (const r of rows) {
      const d = parseVendaDate(r.data)
      const key = `${d.year()}-${String(d.month() + 1).padStart(2, '0')}`
      const cur = byMonth.get(key) ?? { receita: 0, custo: 0, count: 0 }
      cur.receita += lineReceitaRow(r)
      cur.custo += r.precocustoitem * r.qtdevendida
      cur.count++
      byMonth.set(key, cur)
    }
    const monthly = [...byMonth.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([ym, v]) => {
      const mi = Number(ym.split('-')[1]) - 1
      return {
        month: PT_MONTHS[mi] ?? ym,
        receita: Math.round(v.receita),
        custo: Math.round(v.custo),
        lucro: Math.round(v.receita - v.custo),
        margem: v.receita > 0 ? ((v.receita - v.custo) / v.receita) * 100 : 0,
        pedidos: v.count,
      }
    })

    return {
      totalFaturamento, totalCusto, totalQtd, margem, clientesUnicos, produtosUnicos, ticketMedio,
      topProdutos, topClientes, monthly, linhas: rows.length,
    }
  }, [query.data])

  // Filtro de busca nos rankings
  const filteredProdutos = useMemo(() => {
    if (!report || !q) return report?.topProdutos ?? []
    return (report.topProdutos ?? []).filter(p => p.nome.toLowerCase().includes(q))
  }, [report, q])

  const filteredClientes = useMemo(() => {
    if (!report || !q) return report?.topClientes ?? []
    return (report.topClientes ?? []).filter(c => c.nome.toLowerCase().includes(q))
  }, [report, q])

  // ── Exportação ──
  const basename = `relatorio_${start}_${end}_${dayjs().format('HHmm')}`

  function exportExcel() {
    if (!report) return
    const resumo = [
      { Indicador: 'Faturamento', Valor: report.totalFaturamento },
      { Indicador: 'Custo total', Valor: report.totalCusto },
      { Indicador: 'Lucro bruto', Valor: report.totalFaturamento - report.totalCusto },
      { Indicador: 'Margem bruta %', Valor: report.margem },
      { Indicador: 'Ticket médio', Valor: report.ticketMedio },
      { Indicador: 'Clientes únicos', Valor: report.clientesUnicos },
      { Indicador: 'Produtos únicos', Valor: report.produtosUnicos },
      { Indicador: 'Linhas de venda', Valor: report.linhas },
    ]
    const csvRows: Array<Array<unknown>> = [
      ['RESUMO'],
      ['Indicador', 'Valor'],
      ...resumo.map((item) => [item.Indicador, item.Valor]),
      [],
      ['TOP PRODUTOS'],
      ['Produto', 'Faturamento', 'Quantidade', 'Custo', 'Margem %'],
      ...report.topProdutos.map((p) => [p.nome, p.total, p.qtd, p.custo, Math.round(p.margem * 10) / 10]),
      [],
      ['TOP CLIENTES'],
      ['Cliente', 'Faturamento', 'Pedidos', 'Custo', 'Margem %'],
      ...report.topClientes.map((c) => [c.nome, c.total, c.count, c.custo, Math.round(c.margem * 10) / 10]),
      [],
      ['MENSAL'],
      ['Mês', 'Receita', 'Custo', 'Lucro', 'Margem %', 'Pedidos'],
      ...report.monthly.map((m) => [m.month, m.receita, m.custo, m.lucro, Math.round(m.margem * 10) / 10, m.pedidos]),
    ]
    downloadCsv(['Relatório de Vendas'], csvRows, `${basename}.csv`)
  }

  function exportPdf() {
    if (!report) return
    void (async () => {
      const [{ jsPDF }, autoTableModule] = await Promise.all([
        import('jspdf'),
        import('jspdf-autotable'),
      ])
      const autoTable = autoTableModule.default
      const doc = new jsPDF({ orientation: 'landscape' })
      const pageW = doc.internal.pageSize.getWidth()
      const logoDataUrl = await toDataUrl(tenant.logoUrl)

      // Header
      doc.setFillColor(10, 18, 32)
      doc.rect(0, 0, pageW, 36, 'F')
      doc.setFillColor(26, 122, 181)
      doc.rect(0, 33, pageW, 3, 'F')

      const logoX = 14
      const logoY = 7
      const logoSize = 16
      let companyNameX = 14
      let logoDrawn = false
      if (logoDataUrl) {
        try {
          const format = getImageFormatFromDataUrl(logoDataUrl)
          doc.addImage(logoDataUrl, format, logoX, logoY, logoSize, logoSize)
          logoDrawn = true
          companyNameX = 34
        } catch {
          logoDrawn = false
        }
      }
      if (!logoDrawn && tenant.logoUrl) {
        doc.setFillColor(26, 122, 181)
        doc.roundedRect(logoX, logoY, logoSize, logoSize, 3, 3, 'F')
        doc.setTextColor(248, 250, 252)
        doc.setFontSize(9)
        doc.setFont('helvetica', 'bold')
        const initials = (tenant.companyName || 'IGA').slice(0, 3).toUpperCase()
        doc.text(initials, logoX + logoSize / 2, logoY + 10, { align: 'center' })
        companyNameX = 34
      }
      doc.setTextColor(248, 250, 252)
      doc.setFontSize(14)
      doc.setFont('helvetica', 'bold')
      doc.text(tenant.companyName || 'IGA Gestão', companyNameX, 13)
      doc.setFontSize(17)
      doc.text('Relatório Executivo de Vendas', 14, 24)
      doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')
      doc.text(`${dayjs(start).format('DD/MM/YYYY')} a ${dayjs(end).format('DD/MM/YYYY')}`, 14, 30)
      doc.text(`Gerado em ${dayjs().format('DD/MM/YYYY [às] HH:mm')}`, pageW - 14, 30, { align: 'right' })

      // KPIs
      const kpiY = 42
      const kpiW = (pageW - 28 - 30) / 4
      const kpis = [
        { label: 'FATURAMENTO', value: formatBRL(report.totalFaturamento) },
        { label: 'MARGEM BRUTA', value: `${report.margem.toFixed(1)}%` },
        { label: 'TICKET MÉDIO', value: formatBRL(report.ticketMedio) },
        { label: 'CLIENTES', value: String(report.clientesUnicos) },
      ]
      doc.setTextColor(15, 23, 42)
      kpis.forEach((kpi, i) => {
        const x = 14 + i * (kpiW + 10)
        doc.setFillColor(241, 245, 249)
        doc.roundedRect(x, kpiY - 4, kpiW, 16, 3, 3, 'F')
        doc.setFontSize(7)
        doc.setTextColor(100, 116, 139)
        doc.text(kpi.label, x + 6, kpiY + 2)
        doc.setFontSize(11)
        doc.setTextColor(15, 23, 42)
        doc.setFont('helvetica', 'bold')
        doc.text(kpi.value, x + 6, kpiY + 9)
        doc.setFont('helvetica', 'normal')
      })

      // Top Produtos
      doc.setDrawColor(226, 232, 240)
      doc.line(14, kpiY + 16, pageW - 14, kpiY + 16)
      autoTable(doc, {
        startY: kpiY + 20,
        head: [['Produto', 'Faturamento', 'Qtd', 'Custo', 'Margem']],
        body: report.topProdutos.map(p => [
          p.nome.slice(0, 50), formatBRL(p.total), p.qtd.toLocaleString('pt-BR'), formatBRL(p.custo), `${p.margem.toFixed(1)}%`,
        ]),
        styles: { fontSize: 8, cellPadding: 4 },
        headStyles: { fillColor: [30, 41, 59], textColor: [248, 250, 252], fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [248, 250, 252] },
      })

      // Rodapé
      const pageCount = doc.getNumberOfPages()
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i)
        const pageH = doc.internal.pageSize.getHeight()
        doc.setDrawColor(226, 232, 240)
        doc.line(14, pageH - 9, pageW - 14, pageH - 9)
        doc.setFontSize(7)
        doc.setTextColor(148, 163, 184)
        doc.text(`${tenant.companyName || 'IGA Gestão'} — Documento confidencial`, 14, pageH - 6)
        doc.text(`Página ${i} de ${pageCount}`, pageW - 14, pageH - 6, { align: 'right' })
      }

      doc.save(`${basename}.pdf`)
    })()
  }

  // ── Render ──
  if (!biConfigured) {
    return (
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <PageHeaderCard title="Relatórios" subtitle="Configure uma fonte de dados." />
        <Alert type="warning" showIcon message="Nenhuma fonte de dados configurada" />
      </Space>
    )
  }

  if (query.isLoading) {
    return (
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <PageHeaderCard title="Relatórios" subtitle="Carregando..." />
        <Card className="app-card" variant="borderless"><Skeleton active paragraph={{ rows: 10 }} /></Card>
      </Space>
    )
  }

  if (query.isError) {
    return (
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <PageHeaderCard title="Relatórios" subtitle="Erro" />
        <Alert type="error" showIcon message="Falha ao carregar"
          description={<>{getErrorMessage(query.error, 'Erro.')}<DevErrorDetail error={query.error} /></>}
        />
      </Space>
    )
  }

  if (!report) {
    return (
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <PageHeaderCard title="Relatórios" subtitle="Sem dados no período." />
        <Card className="app-card" variant="borderless"><Empty description="Nenhum dado de venda no período selecionado." /></Card>
      </Space>
    )
  }

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <PageHeaderCard
        title="Relatórios"
        subtitle="Consolidação de vendas, produtos e clientes com exportação em Excel e PDF."
        extra={
          <Space>
            <Tag color="blue" style={{ marginInlineEnd: 4 }}>{sourceLabel}</Tag>
            <Button icon={<ReloadOutlined />} onClick={() => query.refetch()}>Atualizar</Button>
            <Dropdown disabled={!canExport} menu={{ items: [
              { key: 'xlsx', icon: <FileExcelOutlined />, label: 'Exportar Excel', onClick: exportExcel },
              { key: 'pdf', icon: <FilePdfOutlined />, label: 'Exportar PDF', onClick: exportPdf },
            ] }}>
              <Button icon={<DownloadOutlined />}>Exportar</Button>
            </Dropdown>
          </Space>
        }
      />

      {/* ── Filtros ── */}
      <Card className="app-card no-hover" variant="borderless">
        <div className="filter-bar">
          <div className="filter-item">
            <span>Período</span>
            <RangePickerBR
              format="DD/MM/YYYY"
              value={[dayjs(start), dayjs(end)]}
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
            />
          </div>
          <div className="filter-item" style={{ flex: '1 1 250px' }}>
            <span>Buscar produto ou cliente</span>
            <Input.Search
              allowClear
              placeholder="Nome do produto ou cliente..."
              value={searchParams.get('q') ?? ''}
              onChange={(e) => {
                setSearchParams((prev) => {
                  const p = new URLSearchParams(prev)
                  if (e.target.value.trim()) p.set('q', e.target.value)
                  else p.delete('q')
                  return p
                })
              }}
            />
          </div>
          <div className="filter-item">
            <span>Visualização</span>
            <Select
              style={{ width: 170 }}
              value={view}
              onChange={(v) => {
                setSearchParams((prev) => {
                  const p = new URLSearchParams(prev)
                  p.set('view', v)
                  return p
                })
              }}
              options={[
                { value: 'geral', label: 'Visão geral' },
                { value: 'produtos', label: 'Por produto' },
                { value: 'clientes', label: 'Por cliente' },
              ]}
            />
          </div>
          <div className="filter-item">
            <span>&nbsp;</span>
            <Button onClick={resetPersistedState}>Limpar filtros salvos</Button>
          </div>
        </div>
      </Card>

      {/* ── KPIs ── */}
      <Row gutter={[12, 12]}>
        {[
          { title: 'Faturamento', value: formatCompact(report.totalFaturamento), icon: <DollarOutlined />, color: '#10B981', sub: `${report.linhas} linhas de venda` },
          { title: 'Margem bruta', value: `${report.margem.toFixed(1)}%`, icon: <PercentageOutlined />, color: report.margem >= 30 ? '#10B981' : report.margem >= 15 ? '#F59E0B' : '#F43F5E', sub: `Lucro: ${formatCompact(report.totalFaturamento - report.totalCusto)}` },
          { title: 'Ticket médio', value: formatBRL(report.ticketMedio), icon: <ShoppingCartOutlined />, color: '#3B82F6', sub: `${report.totalQtd.toLocaleString('pt-BR')} un vendidas` },
          { title: 'Clientes / Produtos', value: `${report.clientesUnicos} / ${report.produtosUnicos}`, icon: <TeamOutlined />, color: '#8B5CF6', sub: `No período selecionado` },
        ].map((kpi) => (
          <Col xs={12} sm={6} key={kpi.title}>
            <div className="metric-card">
              <div className="metric-card__accent" style={{ background: kpi.color }} />
              <div className="metric-card__content">
                <span className="metric-card__title" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>{kpi.icon} {kpi.title}</span>
                <span className="metric-card__value">{kpi.value}</span>
                <Typography.Text type="secondary" style={{ fontSize: 11 }}>{kpi.sub}</Typography.Text>
              </div>
            </div>
          </Col>
        ))}
      </Row>

      {/* ── Gráfico mensal ── */}
      <Card className="app-card no-hover" variant="borderless" title="Faturamento mensal (receita × custo)">
        <ChartShell height={280}>
          <ComposedChart data={report.monthly} margin={{ left: 0, right: 8 }}>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="month" {...xAxisProps} />
            <YAxis tickFormatter={v => formatCompact(v).replace('R$ ', '')} {...yAxisProps} />
            <Tooltip content={<DarkTooltip />} />
            <Legend iconSize={8} iconType="circle" wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
            <Bar dataKey="receita" name="Receita" fill={CHART_COLORS[1]} fillOpacity={0.7} radius={[4, 4, 0, 0]} />
            <Bar dataKey="custo" name="Custo" fill={CHART_COLORS[4]} fillOpacity={0.5} radius={[4, 4, 0, 0]} />
            <Line type="monotone" dataKey="lucro" name="Lucro" stroke={CHART_COLORS[0]} strokeWidth={2.5} dot={{ r: 4, fill: CHART_COLORS[0] }} />
          </ComposedChart>
        </ChartShell>
      </Card>

      {/* ── Rankings ── */}
      <div ref={chartRef}>
        {(view === 'geral' || view === 'produtos') && (
          <Card className="app-card no-hover" variant="borderless" title={`Top ${filteredProdutos.length} produtos por faturamento`} style={{ marginBottom: 16 }}>
            {filteredProdutos.length === 0 ? (
              <Empty description="Nenhum produto encontrado." />
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--qc-border)' }}>
                      {['#', 'Produto', 'Faturamento', 'Qtd', 'Custo', 'Lucro', 'Margem'].map(h => (
                        <th key={h} className="typ-thead" style={{
                          textAlign: ['Faturamento', 'Qtd', 'Custo', 'Lucro', 'Margem'].includes(h) ? 'right' : 'left',
                          width: h === '#' ? 40 : undefined,
                        }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProdutos.map((p, i) => (
                      <tr key={p.nome} style={{ borderBottom: '1px solid var(--qc-border)' }}>
                        <td style={{ padding: '8px 12px', fontWeight: 700, color: 'var(--qc-text-muted)' }}>{i + 1}</td>
                        <td style={{ padding: '8px 12px', fontWeight: 500, maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {p.nome}
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{formatBRL(p.total)}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{p.qtd.toLocaleString('pt-BR')}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--qc-text-muted)' }}>{formatBRL(p.custo)}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: p.total - p.custo >= 0 ? '#10B981' : '#F43F5E', fontWeight: 600 }}>{formatBRL(p.total - p.custo)}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                          <Tag color={p.margem >= 30 ? 'green' : p.margem >= 15 ? 'gold' : 'red'} style={{ margin: 0, fontSize: 11, fontVariantNumeric: 'tabular-nums' }}>
                            {p.margem.toFixed(1)}%
                          </Tag>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        )}

        {(view === 'geral' || view === 'clientes') && (
          <Card className="app-card no-hover" variant="borderless" title={`Top ${filteredClientes.length} clientes por faturamento`}>
            {filteredClientes.length === 0 ? (
              <Empty description="Nenhum cliente encontrado." />
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--qc-border)' }}>
                      {['#', 'Cliente', 'Faturamento', 'Pedidos', 'Custo', 'Lucro', 'Margem'].map(h => (
                        <th key={h} className="typ-thead" style={{
                          textAlign: ['Faturamento', 'Pedidos', 'Custo', 'Lucro', 'Margem'].includes(h) ? 'right' : 'left',
                          width: h === '#' ? 40 : undefined,
                        }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredClientes.map((c, i) => (
                      <tr key={c.nome} style={{ borderBottom: '1px solid var(--qc-border)' }}>
                        <td style={{ padding: '8px 12px', fontWeight: 700, color: 'var(--qc-text-muted)' }}>{i + 1}</td>
                        <td style={{ padding: '8px 12px', fontWeight: 500, maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {c.nome}
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{formatBRL(c.total)}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{c.count}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--qc-text-muted)' }}>{formatBRL(c.custo)}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: c.total - c.custo >= 0 ? '#10B981' : '#F43F5E', fontWeight: 600 }}>{formatBRL(c.total - c.custo)}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                          <Tag color={c.margem >= 30 ? 'green' : c.margem >= 15 ? 'gold' : 'red'} style={{ margin: 0, fontSize: 11, fontVariantNumeric: 'tabular-nums' }}>
                            {c.margem.toFixed(1)}%
                          </Tag>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        )}
      </div>
    </Space>
  )
}
