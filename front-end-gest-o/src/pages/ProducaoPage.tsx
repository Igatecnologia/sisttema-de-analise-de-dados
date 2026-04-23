import { RangePickerBR } from '../components/DatePickerPtBR'
import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Drawer,
  Input,
  Progress,
  Row,
  Skeleton,
  Space,
  Table,
  Tabs,
  Tag,
  Tooltip,
  Typography,
} from 'antd'
import { getErrorMessage } from '../api/httpError'
import type { ColumnsType } from 'antd/es/table'
import {
  BarChartOutlined,
  ExperimentOutlined,
  EyeOutlined,
  FilterOutlined,
  NumberOutlined,
  ReloadOutlined,
} from '@ant-design/icons'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { MetricCard } from '../components/MetricCard'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { PageHeaderCard } from '../components/PageHeaderCard'
import { http } from '../services/http'
import { metricColors } from '../theme/colors'

/* ═══════════════════════════════════════════════════════
   Tipos
   ═══════════════════════════════════════════════════════ */

type Componente = {
  codprodcomp: number
  nomeprodutocomp: string
  qtdeunitaria: number
  qtdetotal: number
  undcomp: string
}

type ProduzidoRow = {
  codproduto: number
  produto: string
  qtdeproduzida: number
  unidade: string
  componentes: Componente[]
  data: string
}

type ProducaoDiariaResponse = {
  rows: ProduzidoRow[]
  truncated: boolean
  periodoReal: { de: string; ate: string }
}

async function fetchProducaoDiaria(dtDe: string, dtAte: string): Promise<ProducaoDiariaResponse> {
  const res = await http.get<ProducaoDiariaResponse>('/erp/producao-diaria', {
    params: { dt_de: dtDe.replace(/-/g, '.'), dt_ate: dtAte.replace(/-/g, '.') },
  })
  return res.data
}

/* ═══════════════════════════════════════════════════════
   Presets de período
   ═══════════════════════════════════════════════════════ */

function useRangePresets() {
  return useMemo(() => [
    { label: 'Esta semana', range: [dayjs().startOf('week'), dayjs()] as [dayjs.Dayjs, dayjs.Dayjs] },
    { label: 'Este mês', range: [dayjs().startOf('month'), dayjs()] as [dayjs.Dayjs, dayjs.Dayjs] },
    { label: 'Mês passado', range: [dayjs().subtract(1, 'month').startOf('month'), dayjs().subtract(1, 'month').endOf('month')] as [dayjs.Dayjs, dayjs.Dayjs] },
    { label: '30 dias', range: [dayjs().subtract(30, 'day'), dayjs()] as [dayjs.Dayjs, dayjs.Dayjs] },
    { label: '90 dias', range: [dayjs().subtract(90, 'day'), dayjs()] as [dayjs.Dayjs, dayjs.Dayjs] },
  ], [])
}

/* ═══════════════════════════════════════════════════════
   Drawer de detalhes
   ═══════════════════════════════════════════════════════ */

function ProduzidoDetailDrawer({ open, onClose, row }: { open: boolean; onClose: () => void; row: ProduzidoRow | null }) {
  if (!row) return null
  return (
    <Drawer title={<Space><ExperimentOutlined /> <span>{row.produto}</span></Space>} placement="right" width={540} open={open} onClose={onClose} destroyOnClose>
      <Space direction="vertical" size={20} style={{ width: '100%' }}>
        <Card size="small" style={{ background: 'var(--qc-canvas)', borderRadius: 12 }}>
          <Row gutter={[16, 12]}>
            <Col span={8}>
              <Typography.Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase' }}>Quantidade</Typography.Text>
              <Typography.Title level={3} style={{ margin: 0, color: 'var(--qc-primary)' }}>{row.qtdeproduzida.toLocaleString('pt-BR')}</Typography.Title>
              <Typography.Text type="secondary">{row.unidade}</Typography.Text>
            </Col>
            <Col span={8}>
              <Typography.Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase' }}>Código</Typography.Text>
              <Typography.Title level={3} style={{ margin: 0 }}>{row.codproduto}</Typography.Title>
            </Col>
            <Col span={8}>
              <Typography.Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase' }}>Data</Typography.Text>
              <Typography.Title level={3} style={{ margin: 0 }}>{dayjs(row.data).format('DD/MM/YYYY')}</Typography.Title>
            </Col>
          </Row>
        </Card>

        {row.componentes.length > 0 ? (
          <>
            <Typography.Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Componentes consumidos ({row.componentes.length})
            </Typography.Text>
            <Table
              rowKey="codprodcomp"
              size="small"
              pagination={false}
              dataSource={row.componentes}
              columns={[
                { title: 'Cód', dataIndex: 'codprodcomp', width: 60 },
                { title: 'Componente', dataIndex: 'nomeprodutocomp', ellipsis: true },
                { title: 'Por un', dataIndex: 'qtdeunitaria', width: 90, align: 'right' as const, render: (v: number) => v.toFixed(4) },
                { title: 'Total', dataIndex: 'qtdetotal', width: 90, align: 'right' as const, render: (v: number) => <Typography.Text strong>{v.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</Typography.Text> },
                { title: 'Und', dataIndex: 'undcomp', width: 50 },
              ]}
            />
            <Descriptions size="small" bordered>
              <Descriptions.Item label="Consumo Total">
                <Typography.Text strong style={{ color: 'var(--qc-primary)' }}>
                  {row.componentes.reduce((s, c) => s + c.qtdetotal, 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} M³
                </Typography.Text>
              </Descriptions.Item>
            </Descriptions>
          </>
        ) : (
          <Alert type="info" showIcon message="Sem componentes registrados para este produto." />
        )}
      </Space>
    </Drawer>
  )
}

/* ═══════════════════════════════════════════════════════
   Tab — O que foi Produzido
   ═══════════════════════════════════════════════════════ */

function ProducaoSgbrTab() {
  const [range, setRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>(() => [
    dayjs().startOf('month'),
    dayjs(),
  ])
  const [search, setSearch] = useState('')
  const [detailRow, setDetailRow] = useState<ProduzidoRow | null>(null)
  const presets = useRangePresets()
  const debouncedSearch = useDebouncedValue(search)
  const dtDe = range[0].format('YYYY-MM-DD')
  const dtAte = range[1].format('YYYY-MM-DD')

  const prodQ = useQuery({
    queryKey: ['producaoDiaria', dtDe, dtAte],
    queryFn: () => fetchProducaoDiaria(dtDe, dtAte),
    placeholderData: keepPreviousData,
    staleTime: 5 * 60_000,
    retry: 1,
  })

  const rows = prodQ.data?.rows ?? []
  const truncated = prodQ.data?.truncated ?? false

  const filtered = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(
      (r) => r.produto.toLowerCase().includes(q) || String(r.codproduto).includes(q) ||
        r.componentes.some((c) => c.nomeprodutocomp.toLowerCase().includes(q)),
    )
  }, [rows, debouncedSearch])

  const metrics = useMemo(() => {
    const totalItens = filtered.length
    const totalQtde = filtered.reduce((s, r) => s + r.qtdeproduzida, 0)
    const totalM3 = filtered.reduce((s, r) => s + r.componentes.reduce((cs, c) => cs + c.qtdetotal, 0), 0)
    const produtosUnicos = new Set(filtered.map((r) => r.codproduto)).size
    return { totalItens, totalQtde, totalM3, produtosUnicos }
  }, [filtered])

  const columns: ColumnsType<ProduzidoRow> = [
    { title: '', key: 'eye', width: 44, fixed: 'left', render: (_: unknown, r) => <Tooltip title="Ver detalhes"><Button type="text" size="small" icon={<EyeOutlined />} onClick={() => setDetailRow(r)} /></Tooltip> },
    { title: 'Produto', key: 'produto', fixed: 'left', ellipsis: true, render: (_: unknown, r) => <Typography.Text strong>{r.produto}</Typography.Text>, sorter: (a, b) => a.produto.localeCompare(b.produto, 'pt-BR') },
    { title: 'Data', dataIndex: 'data', key: 'data', width: 110, render: (v: string) => dayjs(v).format('DD/MM/YYYY'), sorter: (a, b) => a.data.localeCompare(b.data), defaultSortOrder: 'descend' },
    { title: 'Qtde', dataIndex: 'qtdeproduzida', key: 'qtde', width: 100, align: 'right', render: (v: number) => <Typography.Text strong>{v.toLocaleString('pt-BR')}</Typography.Text>, sorter: (a, b) => a.qtdeproduzida - b.qtdeproduzida },
    { title: 'Und', dataIndex: 'unidade', key: 'und', width: 55, align: 'center' },
    { title: 'Consumo M³', key: 'consumo', width: 110, align: 'right', render: (_: unknown, r) => { const t = r.componentes.reduce((s, c) => s + c.qtdetotal, 0); return t > 0 ? t.toLocaleString('pt-BR', { maximumFractionDigits: 2 }) : '—' }, sorter: (a, b) => a.componentes.reduce((s, c) => s + c.qtdetotal, 0) - b.componentes.reduce((s, c) => s + c.qtdetotal, 0) },
    { title: 'Bloco principal', key: 'bloco', ellipsis: true, render: (_: unknown, r) => { if (r.componentes.length === 0) return '—'; return r.componentes.reduce((best, c) => c.qtdetotal > best.qtdetotal ? c : best).nomeprodutocomp } },
  ]

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Row gutter={[12, 12]}>
        <Col xs={12} sm={6}><MetricCard title="Registros" value={String(metrics.totalItens)} accentColor={metricColors.ticket} loading={prodQ.isLoading} /></Col>
        <Col xs={12} sm={6}><MetricCard title="Unidades produzidas" value={metrics.totalQtde.toLocaleString('pt-BR')} hero accentColor={metricColors.revenue} loading={prodQ.isLoading} /></Col>
        <Col xs={12} sm={6}><MetricCard title="Consumo M³" value={metrics.totalM3.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} accentColor={metricColors.gold} loading={prodQ.isLoading} /></Col>
        <Col xs={12} sm={6}><MetricCard title="Produtos únicos" value={String(metrics.produtosUnicos)} accentColor={metricColors.clients} loading={prodQ.isLoading} /></Col>
      </Row>

      <Card className="app-card no-hover" variant="borderless" title={<Space><FilterOutlined /> Filtros</Space>}>
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Space wrap size={6}>
            {presets.map((p) => (
              <Button key={p.label} size="small" type={range[0].isSame(p.range[0], 'day') && range[1].isSame(p.range[1], 'day') ? 'primary' : 'default'} onClick={() => setRange(p.range)}>
                {p.label}
              </Button>
            ))}
          </Space>
          <div className="filter-bar">
            <div className="filter-item" style={{ flex: '1 1 240px' }}>
              <span>Buscar</span>
              <Input.Search allowClear placeholder="Produto, código ou bloco..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <div className="filter-item">
              <span>Período</span>
              <RangePickerBR value={range} onChange={(d) => { if (d?.[0] && d[1]) setRange([d[0], d[1]]) }} format="DD/MM/YYYY" allowClear={false} style={{ minWidth: 250 }} />
            </div>
          </div>
        </Space>
      </Card>

      {truncated && <Alert type="warning" showIcon message="Resultados parciais" description="Reduza o período para garantir cobertura total." />}
      {prodQ.isError && <Alert type="error" showIcon message="Erro ao carregar produção" description={getErrorMessage(prodQ.error, 'Verifique a fonte.')} />}

      <Card className="app-card no-hover quantum-table" variant="borderless" title={<Space><ExperimentOutlined /> <span>Produção ({filtered.length})</span></Space>}>
        {prodQ.isLoading ? <Skeleton active paragraph={{ rows: 10 }} /> : (
          <Table
            rowKey={(r, i) => `${r.codproduto}-${r.data}-${i}`}
            size="small"
            dataSource={filtered}
            columns={columns}
            scroll={{ x: 900 }}
            pagination={{ defaultPageSize: 50, showSizeChanger: true, showTotal: (t, [a, b]) => <Typography.Text type="secondary">{a}–{b} de {t}</Typography.Text> }}
            loading={prodQ.isPlaceholderData}
            style={{ opacity: prodQ.isPlaceholderData ? 0.6 : 1, transition: 'opacity 200ms' }}
          />
        )}
      </Card>
      <ProduzidoDetailDrawer open={!!detailRow} onClose={() => setDetailRow(null)} row={detailRow} />
    </Space>
  )
}

/* ═══════════════════════════════════════════════════════
   Tab — Consumo de Blocos (agregado dos componentes)
   ═══════════════════════════════════════════════════════ */

type ConsumoRow = {
  codprodcomp: number
  nomeprodutocomp: string
  undcomp: string
  totalConsumido: number
  produtosQueUsam: number
}

function ConsumoMPTab() {
  const [range, setRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>(() => [
    dayjs().startOf('month'),
    dayjs(),
  ])
  const [search, setSearch] = useState('')
  const presets = useRangePresets()
  const debouncedSearch = useDebouncedValue(search)
  const dtDe = range[0].format('YYYY-MM-DD')
  const dtAte = range[1].format('YYYY-MM-DD')

  const prodQ = useQuery({
    queryKey: ['producaoDiaria', dtDe, dtAte],
    queryFn: () => fetchProducaoDiaria(dtDe, dtAte),
    placeholderData: keepPreviousData,
    staleTime: 5 * 60_000,
    retry: 1,
  })

  const consumoRows = useMemo(() => {
    const rawRows = prodQ.data?.rows ?? []
    const map = new Map<number, ConsumoRow>()
    for (const r of rawRows) {
      for (const c of r.componentes) {
        const ex = map.get(c.codprodcomp)
        if (ex) { ex.totalConsumido += c.qtdetotal; ex.produtosQueUsam++ }
        else map.set(c.codprodcomp, { codprodcomp: c.codprodcomp, nomeprodutocomp: c.nomeprodutocomp, undcomp: c.undcomp, totalConsumido: c.qtdetotal, produtosQueUsam: 1 })
      }
    }
    return [...map.values()].sort((a, b) => b.totalConsumido - a.totalConsumido)
  }, [prodQ.data])

  const filtered = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase()
    if (!q) return consumoRows
    return consumoRows.filter((r) => r.nomeprodutocomp.toLowerCase().includes(q) || String(r.codprodcomp).includes(q))
  }, [consumoRows, debouncedSearch])

  const metrics = useMemo(() => {
    const totalM3 = filtered.reduce((s, r) => s + r.totalConsumido, 0)
    const totalProdutos = filtered.reduce((s, r) => s + r.produtosQueUsam, 0)
    return { totalM3, totalBlocos: filtered.length, totalProdutos }
  }, [filtered])

  const maxConsumo = filtered[0]?.totalConsumido ?? 1

  const columns: ColumnsType<ConsumoRow> = [
    { title: 'Cód', dataIndex: 'codprodcomp', key: 'cod', width: 70 },
    {
      title: 'Bloco',
      key: 'nome',
      ellipsis: true,
      render: (_: unknown, r) => <Typography.Text strong>{r.nomeprodutocomp}</Typography.Text>,
      sorter: (a, b) => a.nomeprodutocomp.localeCompare(b.nomeprodutocomp, 'pt-BR'),
    },
    { title: 'Und', dataIndex: 'undcomp', key: 'und', width: 55, align: 'center' },
    {
      title: 'Total consumido',
      key: 'total',
      width: 200,
      sorter: (a, b) => a.totalConsumido - b.totalConsumido,
      defaultSortOrder: 'descend',
      render: (_: unknown, r) => (
        <Space direction="vertical" size={2} style={{ width: '100%' }}>
          <Typography.Text strong style={{ color: 'var(--qc-primary)' }}>
            {r.totalConsumido.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}
          </Typography.Text>
          <Progress
            percent={(r.totalConsumido / maxConsumo) * 100}
            showInfo={false}
            size="small"
            strokeColor={metricColors.revenue}
          />
        </Space>
      ),
    },
    {
      title: 'Usado em',
      dataIndex: 'produtosQueUsam',
      key: 'prod',
      width: 100,
      align: 'right',
      sorter: (a, b) => a.produtosQueUsam - b.produtosQueUsam,
      render: (v: number) => <Tag>{v} produto{v > 1 ? 's' : ''}</Tag>,
    },
  ]

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Row gutter={[12, 12]}>
        <Col xs={12} sm={6}><MetricCard title="Tipos de bloco" value={String(metrics.totalBlocos)} accentColor={metricColors.clients} loading={prodQ.isLoading} /></Col>
        <Col xs={12} sm={6}><MetricCard title="Volume total (M³)" value={metrics.totalM3.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} hero accentColor={metricColors.revenue} loading={prodQ.isLoading} /></Col>
        <Col xs={12} sm={6}><MetricCard title="Usos em produtos" value={String(metrics.totalProdutos)} accentColor={metricColors.gold} loading={prodQ.isLoading} /></Col>
        <Col xs={12} sm={6}><MetricCard title="Registros de produção" value={String(prodQ.data?.rows?.length ?? 0)} accentColor={metricColors.ticket} loading={prodQ.isLoading} /></Col>
      </Row>

      <Card className="app-card no-hover" variant="borderless" title={<Space><FilterOutlined /> Filtros</Space>}>
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Space wrap size={6}>
            {presets.map((p) => (
              <Button key={p.label} size="small" type={range[0].isSame(p.range[0], 'day') && range[1].isSame(p.range[1], 'day') ? 'primary' : 'default'} onClick={() => setRange(p.range)}>
                {p.label}
              </Button>
            ))}
          </Space>
          <div className="filter-bar">
            <div className="filter-item" style={{ flex: '1 1 240px' }}>
              <span>Buscar</span>
              <Input.Search allowClear placeholder="Bloco ou código..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <div className="filter-item">
              <span>Período</span>
              <RangePickerBR value={range} onChange={(d) => { if (d?.[0] && d[1]) setRange([d[0], d[1]]) }} format="DD/MM/YYYY" allowClear={false} style={{ minWidth: 250 }} />
            </div>
          </div>
        </Space>
      </Card>

      {prodQ.isError && <Alert type="error" showIcon message="Erro ao carregar" description={getErrorMessage(prodQ.error, 'Verifique a fonte.')} />}

      <Card className="app-card no-hover quantum-table" variant="borderless" title={<Space><BarChartOutlined /> <span>Consumo de Blocos ({filtered.length})</span></Space>}
        extra={filtered.length > 0 ? <Typography.Text type="secondary" style={{ fontSize: 12 }}>Total: <Typography.Text strong style={{ color: 'var(--qc-primary)' }}>{metrics.totalM3.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} M³</Typography.Text></Typography.Text> : null}
      >
        {prodQ.isLoading ? <Skeleton active paragraph={{ rows: 8 }} /> : filtered.length === 0 ? (
          <Alert type="info" showIcon message="Nenhum consumo de bloco encontrado no período" description="Tente ampliar o intervalo de datas." />
        ) : (
          <Table
            rowKey="codprodcomp"
            size="small"
            columns={columns}
            dataSource={filtered}
            pagination={{ defaultPageSize: 50, showSizeChanger: true, showTotal: (t, [a, b]) => <Typography.Text type="secondary">{a}–{b} de {t}</Typography.Text> }}
            scroll={{ x: 600 }}
            loading={prodQ.isPlaceholderData}
            style={{ opacity: prodQ.isPlaceholderData ? 0.6 : 1, transition: 'opacity 200ms' }}
          />
        )}
      </Card>
    </Space>
  )
}

/* ═══════════════════════════════════════════════════════
   Página Principal
   ═══════════════════════════════════════════════════════ */

export function ProducaoPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = searchParams.get('tab') ?? 'producao'

  return (
    <Space direction="vertical" size={16} style={{ width: '100%', padding: '24px 24px 48px' }}>
      <PageHeaderCard title="Produção" subtitle="Produtos produzidos e consumo de blocos" />
      <Card className="app-card no-hover" variant="borderless" style={{ padding: 0 }}>
        <Tabs
          activeKey={activeTab}
          onChange={(key) => setSearchParams({ tab: key }, { replace: true })}
          type="card"
          size="large"
          items={[
            { key: 'producao', label: <span><ExperimentOutlined /> O que foi Produzido</span>, children: <ProducaoSgbrTab /> },
            { key: 'consumo', label: <span><BarChartOutlined /> Consumo de Blocos</span>, children: <ConsumoMPTab /> },
          ]}
        />
      </Card>
    </Space>
  )
}
