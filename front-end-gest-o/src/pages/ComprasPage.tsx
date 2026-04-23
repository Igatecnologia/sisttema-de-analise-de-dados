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
  Select,
  Skeleton,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  DollarOutlined,
  EyeOutlined,
  FilterOutlined,
  NumberOutlined,
  PercentageOutlined,
  ReloadOutlined,
  ShoppingCartOutlined,
  TeamOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { useMemo, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { MetricCard } from '../components/MetricCard'
import { PageHeaderCard } from '../components/PageHeaderCard'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { http } from '../services/http'
import { metricColors } from '../theme/colors'

import { RangePickerBR } from '../components/DatePickerPtBR'

/* ═══════════════════════════════════════════════════════
   Tipos & fetch
   ═══════════════════════════════════════════════════════ */

type CompraRow = Record<string, unknown>
type ComprasResponse = { rows: CompraRow[]; truncated: boolean; periodoReal: { de: string; ate: string } }

async function fetchCompras(dtDe: string, dtAte: string): Promise<ComprasResponse> {
  const res = await http.get<ComprasResponse | CompraRow[]>('/erp/compras-materia-prima', {
    params: { dt_de: dtDe.replace(/-/g, '.'), dt_ate: dtAte.replace(/-/g, '.') },
  })
  if (Array.isArray(res.data)) return { rows: res.data, truncated: false, periodoReal: { de: dtDe, ate: dtAte } }
  return res.data
}

/* ═══════════════════════════════════════════════════════
   Helpers — campos dinâmicos
   ═══════════════════════════════════════════════════════ */

function pick(row: CompraRow, keys: string[]): unknown {
  for (const k of keys) if (row[k] != null && row[k] !== '') return row[k]
  const lower = new Map(Object.keys(row).map((k) => [k.toLowerCase(), k]))
  for (const k of keys) { const r = lower.get(k.toLowerCase()); if (r && row[r] != null && row[r] !== '') return row[r] }
  return undefined
}
function txt(row: CompraRow, keys: string[]): string { const v = pick(row, keys); return v != null ? String(v) : '' }
function num(row: CompraRow, keys: string[]): number {
  const v = pick(row, keys)
  if (typeof v === 'number') return v
  if (typeof v === 'string') { const n = Number(v.replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.')); return Number.isFinite(n) ? n : 0 }
  return 0
}
function dt(row: CompraRow, keys: string[]): string {
  const v = txt(row, keys); if (!v) return ''
  // ISO: 2026-02-12T17:27:51.489Z → 2026-02-12
  if (v.includes('T')) return v.slice(0, 10)
  const m = /^(\d{4})[.-](\d{2})[.-](\d{2})/.exec(v); if (m) return `${m[1]}-${m[2]}-${m[3]}`
  const m2 = /^(\d{2})[/.](\d{2})[/.](\d{4})/.exec(v); if (m2) return `${m2[3]}-${m2[2]}-${m2[1]}`
  return v.slice(0, 10)
}

const F = {
  data: ['dataemissao', 'data', 'datafec', 'data_compra', 'dt_compra', 'emissao', 'data_emissao', 'dt_emissao', 'datarecebimento'],
  forn: ['fornecedor', 'nome_fornecedor', 'nomefornecedor', 'razao_social', 'razaosocial', 'cliente'],
  mat:  ['produto', 'material', 'nome_produto', 'nomeproduto', 'descricao', 'nome_material'],
  qtd:  ['qtde', 'qtdecompra', 'quantidade', 'qtd', 'qt', 'qtde_compra', 'qtdevolume'],
  und:  ['unidade', 'und', 'un', 'unid'],
  vlu:  ['valorUnit', 'valorunitario', 'custoUnitario', 'custo_unitario', 'valor_unit', 'preco_unit', 'vlrunit', 'vlunit'],
  tot:  ['valortotal', 'valortotalnota', 'valortotalproduto', 'valorentrada', 'total', 'valor_total', 'custoTotal', 'custo_total', 'vl_total', 'vlrtotal', 'totalliquido'],
  nf:   ['numeronota', 'notaFiscal', 'nota_fiscal', 'nf', 'numnota', 'num_nota', 'numero_nf', 'nfe'],
  st:   ['status', 'situacao', 'sit', 'confirmada'],
  cls:  ['naturezaoperacao', 'classificacao', 'classificação', 'tipo', 'categoria', 'grupo', 'class', 'tipooperacao', 'cfop'],
}

function hasF(row: CompraRow | undefined, keys: string[]) {
  if (!row) return false
  return keys.some((k) => { if (row[k] != null) return true; const l = new Map(Object.keys(row).map((x) => [x.toLowerCase(), x])); return l.has(k.toLowerCase()) })
}
function rk(row: CompraRow, idx: number) { return txt(row, ['id', 'cod', 'codigo', 'numnota', 'num_nota']) || String(idx) }
function money(v: number) { return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }

function statusColor(s: string) {
  const l = s.toLowerCase()
  if (l.includes('recebido') || l.includes('pago') || l.includes('concluido') || l.includes('finalizado')) return 'green'
  if (l.includes('cancelado')) return 'red'
  if (l.includes('pendente') || l.includes('aberto') || l.includes('aguardando')) return 'orange'
  return 'default'
}

/* ═══════════════════════════════════════════════════════
   Drawer premium
   ═══════════════════════════════════════════════════════ */

/** Campos curados para exibir no drawer — organizados por seção. */
const DRAWER_SECTIONS = [
  {
    title: 'Produto',
    fields: [
      { label: 'Produto', keys: ['produto', 'descricao', 'nome_produto', 'material'] },
      { label: 'Código', keys: ['codproduto', 'codprodutoassociacao', 'referenciaId', 'codigobarra'] },
      { label: 'NCM', keys: ['ncm'] },
      { label: 'CFOP', keys: ['cfop', 'cfopconvertido'] },
      { label: 'Unidade', keys: ['unidade', 'und'] },
    ],
  },
  {
    title: 'Valores',
    fields: [
      { label: 'Quantidade', keys: ['qtde', 'qtdecompra', 'quantidade'], fmt: 'qty' as const },
      { label: 'Valor Unitário', keys: ['valorUnit', 'valorunitario', 'custoUnitario'], fmt: 'money' as const },
      { label: 'Valor Total', keys: ['valortotal', 'valortotalnota', 'valortotalproduto', 'valorentrada'], fmt: 'money' as const },
      { label: 'Desconto', keys: ['valordesconto', 'valordesconto_1', 'percdesconto'], fmt: 'money' as const },
      { label: 'Frete', keys: ['valorfrete', 'valorfrete_1'], fmt: 'money' as const },
    ],
  },
  {
    title: 'Fornecedor',
    fields: [
      { label: 'Fornecedor', keys: ['fornecedor', 'razao_social'] },
      { label: 'CNPJ', keys: ['cnpj'] },
      { label: 'Cidade/UF', keys: ['cidade'], extra: ['uf'] },
      { label: 'Telefone', keys: ['telefone'] },
    ],
  },
  {
    title: 'Nota Fiscal',
    fields: [
      { label: 'Número NF', keys: ['numeronota', 'notacompra'] },
      { label: 'Série', keys: ['serie'] },
      { label: 'Operação', keys: ['naturezaoperacao'] },
      { label: 'Chave NFe', keys: ['chaveacessodanfe'] },
      { label: 'Data Emissão', keys: ['dataemissao'], fmt: 'date' as const },
      { label: 'Data Recebimento', keys: ['datarecebimento', 'datarecebimento_1'], fmt: 'date' as const },
    ],
  },
  {
    title: 'Impostos',
    fields: [
      { label: 'ICMS', keys: ['valoricms', 'valoricms_1'], fmt: 'money' as const },
      { label: 'Base ICMS', keys: ['basecalcicms', 'basecalcicms_1'], fmt: 'money' as const },
      { label: 'PIS', keys: ['totalpis', 'valorpis'], fmt: 'money' as const },
      { label: 'COFINS', keys: ['totalcofins', 'valorcofins'], fmt: 'money' as const },
      { label: 'IPI', keys: ['valortotalipi', 'valoripi'], fmt: 'money' as const },
      { label: 'ICMS ST', keys: ['valoricmssubstituicao', 'valoricmsst'], fmt: 'money' as const },
    ],
  },
  {
    title: 'Logística',
    fields: [
      { label: 'Peso Bruto', keys: ['pesobrutonota'], fmt: 'qty' as const },
      { label: 'Peso Líquido', keys: ['pesoliquidonota'], fmt: 'qty' as const },
      { label: 'Volumes', keys: ['qtdevolume'] },
      { label: 'Tipo Frete', keys: ['tipo', 'modofrete'] },
      { label: 'Transportadora', keys: ['transportadora'] },
    ],
  },
] as const

function CompraDetailDrawer({ open, onClose, row }: { open: boolean; onClose: () => void; row: CompraRow | null }) {
  if (!row) return null
  const total = num(row, F.tot)
  const qtd = num(row, F.qtd)
  const vlrUnit = num(row, F.vlu)
  const confirmada = pick(row, ['confirmada'])

  function getVal(keys: readonly string[], fmt?: 'money' | 'qty' | 'date', extraKeys?: readonly string[]): string | null {
    const v = pick(row!, keys as string[])
    if (v == null || v === '' || v === 0) return null
    if (fmt === 'money') return `R$ ${money(typeof v === 'number' ? v : Number(v) || 0)}`
    if (fmt === 'qty') return (typeof v === 'number' ? v : Number(v) || 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 })
    if (fmt === 'date') { const d = String(v); return d.includes('T') ? dayjs(d).format('DD/MM/YYYY') : d.length === 10 ? dayjs(d).format('DD/MM/YYYY') : d }
    let result = String(v)
    if (extraKeys) {
      const extra = pick(row!, extraKeys as string[])
      if (extra) result += ` / ${extra}`
    }
    return result
  }

  return (
    <Drawer
      title={<Space><ShoppingCartOutlined /> <span>{txt(row, F.forn) || 'Compra'}</span></Space>}
      placement="right"
      width={560}
      open={open}
      onClose={onClose}
      destroyOnClose
    >
      <Space direction="vertical" size={20} style={{ width: '100%' }}>
        {/* ── Hero ── */}
        <Card size="small" style={{ background: 'var(--qc-canvas)', borderRadius: 12 }}>
          <Row gutter={[16, 12]}>
            <Col span={8}>
              <Typography.Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase' }}>Valor Total</Typography.Text>
              <Typography.Title level={3} style={{ margin: 0, color: 'var(--qc-primary)' }}>R$ {money(total)}</Typography.Title>
            </Col>
            <Col span={8}>
              <Typography.Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase' }}>Quantidade</Typography.Text>
              <Typography.Title level={3} style={{ margin: 0 }}>{qtd.toLocaleString('pt-BR')}</Typography.Title>
              <Typography.Text type="secondary">{txt(row, F.und)}</Typography.Text>
            </Col>
            <Col span={8}>
              <Typography.Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase' }}>Vlr. Unitário</Typography.Text>
              <Typography.Title level={3} style={{ margin: 0 }}>R$ {money(vlrUnit)}</Typography.Title>
            </Col>
          </Row>
          {confirmada != null && (
            <div style={{ marginTop: 8 }}>
              <Tag color={confirmada === 1 || confirmada === '1' || confirmada === 'SIM' ? 'green' : 'orange'}>
                {confirmada === 1 || confirmada === '1' || confirmada === 'SIM' ? 'Confirmada' : 'Pendente'}
              </Tag>
            </div>
          )}
        </Card>

        {/* ── Seções curadas ── */}
        {DRAWER_SECTIONS.map((section) => {
          const items = section.fields
            .map((f) => ({ label: f.label, value: getVal(f.keys, f.fmt, 'extra' in f ? f.extra : undefined) }))
            .filter((item) => item.value != null)
          if (items.length === 0) return null
          return (
            <div key={section.title}>
              <Typography.Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6, display: 'block' }}>
                {section.title}
              </Typography.Text>
              <Descriptions size="small" column={2} bordered>
                {items.map((item) => (
                  <Descriptions.Item key={item.label} label={item.label} span={item.value!.length > 35 ? 2 : 1}>
                    {item.value}
                  </Descriptions.Item>
                ))}
              </Descriptions>
            </div>
          )
        })}
      </Space>
    </Drawer>
  )
}

/* ═══════════════════════════════════════════════════════
   Top fornecedores card
   ═══════════════════════════════════════════════════════ */

function TopFornecedoresCard({ rows, loading }: { rows: CompraRow[]; loading: boolean }) {
  const top = useMemo(() => {
    const map = new Map<string, number>()
    for (const r of rows) {
      const f = txt(r, F.forn)
      if (!f) continue
      map.set(f, (map.get(f) ?? 0) + num(r, F.tot))
    }
    const sorted = Array.from(map.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5)
    const max = sorted[0]?.[1] ?? 1
    return sorted.map(([name, value]) => ({ name, value, pct: (value / max) * 100 }))
  }, [rows])

  return (
    <Card className="app-card no-hover" variant="borderless" title={<Space><TeamOutlined /> Top Fornecedores</Space>} style={{ height: '100%' }}>
      {loading ? <Skeleton active paragraph={{ rows: 5 }} /> : top.length === 0 ? (
        <Typography.Text type="secondary">Sem dados</Typography.Text>
      ) : (
        <Space direction="vertical" size={10} style={{ width: '100%' }}>
          {top.map((f, i) => (
            <div key={f.name}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                <Typography.Text ellipsis style={{ maxWidth: '60%', fontSize: 13 }}>
                  <Typography.Text strong style={{ marginRight: 6, color: 'var(--qc-text-muted)', fontSize: 11 }}>{i + 1}.</Typography.Text>
                  {f.name}
                </Typography.Text>
                <Typography.Text strong style={{ fontSize: 13 }}>R$ {money(f.value)}</Typography.Text>
              </div>
              <Progress percent={f.pct} showInfo={false} strokeColor={[metricColors.cost, metricColors.clients, metricColors.ticket, metricColors.revenue, metricColors.gold][i] ?? metricColors.ticket} size="small" />
            </div>
          ))}
        </Space>
      )}
    </Card>
  )
}

/* ═══════════════════════════════════════════════════════
   Presets de período
   ═══════════════════════════════════════════════════════ */

function useRangePresets() {
  return useMemo(() => [
    { label: 'Hoje', range: [dayjs(), dayjs()] as [dayjs.Dayjs, dayjs.Dayjs] },
    { label: 'Esta semana', range: [dayjs().startOf('week'), dayjs()] as [dayjs.Dayjs, dayjs.Dayjs] },
    { label: 'Este mês', range: [dayjs().startOf('month'), dayjs()] as [dayjs.Dayjs, dayjs.Dayjs] },
    { label: 'Mês passado', range: [dayjs().subtract(1, 'month').startOf('month'), dayjs().subtract(1, 'month').endOf('month')] as [dayjs.Dayjs, dayjs.Dayjs] },
    { label: '30 dias', range: [dayjs().subtract(30, 'day'), dayjs()] as [dayjs.Dayjs, dayjs.Dayjs] },
    { label: '90 dias', range: [dayjs().subtract(90, 'day'), dayjs()] as [dayjs.Dayjs, dayjs.Dayjs] },
    { label: 'Este ano', range: [dayjs().startOf('year'), dayjs()] as [dayjs.Dayjs, dayjs.Dayjs] },
  ], [])
}

/* ═══════════════════════════════════════════════════════
   Página principal
   ═══════════════════════════════════════════════════════ */

export function ComprasPage() {
  const [range, setRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>(() => [dayjs().startOf('month'), dayjs()])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [detailRow, setDetailRow] = useState<CompraRow | null>(null)

  const presets = useRangePresets()
  const debouncedSearch = useDebouncedValue(search)
  const dtDe = range[0].format('YYYY-MM-DD')
  const dtAte = range[1].format('YYYY-MM-DD')

  const comprasQ = useQuery({
    queryKey: ['comprasMateriaPrima', dtDe, dtAte],
    queryFn: () => fetchCompras(dtDe, dtAte),
    placeholderData: keepPreviousData,
    staleTime: 5 * 60_000,
    retry: 1,
  })

  const rows = comprasQ.data?.rows ?? []
  const truncated = comprasQ.data?.truncated ?? false
  const isPlaceholder = comprasQ.isPlaceholderData
  const sampleRow = rows[0] as CompraRow | undefined

  const statusOptions = useMemo(() => {
    const set = new Set<string>()
    for (const r of rows) { const s = txt(r, F.st); if (s) set.add(s) }
    return [{ value: 'all', label: 'Todos' }, ...Array.from(set).sort().map((s) => ({ value: s, label: s }))]
  }, [rows])

  const filtered = useMemo(() => {
    let result = rows
    if (statusFilter !== 'all') result = result.filter((r) => txt(r, F.st).toLowerCase() === statusFilter.toLowerCase())
    const q = debouncedSearch.trim().toLowerCase()
    if (q) result = result.filter((r) => Object.values(r).some((v) => String(v ?? '').toLowerCase().includes(q)))
    return result
  }, [rows, debouncedSearch, statusFilter])

  const metrics = useMemo(() => {
    const total = filtered.length
    const valorTotal = filtered.reduce((s, r) => s + num(r, F.tot), 0)
    const qtdTotal = filtered.reduce((s, r) => s + num(r, F.qtd), 0)
    const fornecedores = new Set(filtered.map((r) => txt(r, F.forn).toLowerCase()).filter(Boolean)).size
    const materiais = new Set(filtered.map((r) => txt(r, F.mat).toLowerCase()).filter(Boolean)).size
    const ticketMedio = total > 0 ? valorTotal / total : 0

    // Breakdown por status
    const byStatus = new Map<string, { count: number; value: number }>()
    for (const r of filtered) {
      const s = txt(r, F.st) || 'Sem status'
      const cur = byStatus.get(s) ?? { count: 0, value: 0 }
      cur.count++; cur.value += num(r, F.tot)
      byStatus.set(s, cur)
    }

    return { total, valorTotal, qtdTotal, fornecedores, materiais, ticketMedio, byStatus }
  }, [filtered])

  const handleRangeChange = useCallback((vals: [dayjs.Dayjs | null, dayjs.Dayjs | null] | null) => {
    if (!vals || !vals[0] || !vals[1]) return
    setRange([vals[0], vals[1]])
  }, [])

  /* ── Colunas ── */
  const columns: ColumnsType<CompraRow> = useMemo(() => {
    const cols: ColumnsType<CompraRow> = [
      { title: '', key: 'eye', width: 44, fixed: 'left', render: (_: unknown, r) => <Tooltip title="Ver detalhes"><Button type="text" size="small" icon={<EyeOutlined />} onClick={() => setDetailRow(r)} /></Tooltip> },
      { title: 'Data', key: 'data', width: 108, render: (_: unknown, r) => { const d = dt(r, F.data); return d ? dayjs(d).format('DD/MM/YYYY') : '—' }, sorter: (a, b) => dt(a, F.data).localeCompare(dt(b, F.data)), defaultSortOrder: 'descend' },
      { title: 'Fornecedor', key: 'forn', ellipsis: true, render: (_: unknown, r) => <Typography.Text strong>{txt(r, F.forn) || '—'}</Typography.Text>, sorter: (a, b) => txt(a, F.forn).localeCompare(txt(b, F.forn), 'pt-BR') },
      { title: 'Material', key: 'mat', ellipsis: true, render: (_: unknown, r) => txt(r, F.mat) || '—', sorter: (a, b) => txt(a, F.mat).localeCompare(txt(b, F.mat), 'pt-BR') },
      { title: 'Qtde', key: 'qtd', width: 95, align: 'right', render: (_: unknown, r) => { const v = num(r, F.qtd); return v ? v.toLocaleString('pt-BR', { maximumFractionDigits: 2 }) : '—' }, sorter: (a, b) => num(a, F.qtd) - num(b, F.qtd) },
    ]
    if (hasF(sampleRow, F.und)) cols.push({ title: 'Und', key: 'und', width: 55, align: 'center', render: (_: unknown, r) => txt(r, F.und) || '—' })
    cols.push(
      { title: 'Vlr Unit.', key: 'vlu', width: 110, align: 'right', render: (_: unknown, r) => { const v = num(r, F.vlu); return v ? `R$ ${money(v)}` : '—' }, sorter: (a, b) => num(a, F.vlu) - num(b, F.vlu) },
      { title: 'Total', key: 'total', width: 130, align: 'right', render: (_: unknown, r) => { const v = num(r, F.tot); return v ? <Typography.Text strong style={{ color: 'var(--qc-primary)' }}>R$ {money(v)}</Typography.Text> : '—' }, sorter: (a, b) => num(a, F.tot) - num(b, F.tot) },
    )
    if (hasF(sampleRow, F.nf)) cols.push({ title: 'NF', key: 'nf', width: 100, render: (_: unknown, r) => txt(r, F.nf) || '—' })
    if (hasF(sampleRow, F.st)) cols.push({ title: 'Status', key: 'st', width: 110, render: (_: unknown, r) => { const s = txt(r, F.st); return s ? <Tag color={statusColor(s)}>{s}</Tag> : '—' }, filters: statusOptions.filter((o) => o.value !== 'all').map((o) => ({ text: o.label, value: o.value })), onFilter: (v, r) => txt(r, F.st).toLowerCase() === String(v).toLowerCase() })
    return cols
  }, [sampleRow, statusOptions])

  const periodoLabel = `${range[0].format('DD/MM/YYYY')} — ${range[1].format('DD/MM/YYYY')}`

  return (
    <Space direction="vertical" size={16} style={{ width: '100%', padding: '24px 24px 48px' }}>

      {/* ── Header ── */}
      <PageHeaderCard
        title="Compras de Matéria-Prima"
        subtitle={`Período: ${periodoLabel}`}
        extra={
          <Tooltip title="Atualizar dados">
            <Button icon={<ReloadOutlined spin={comprasQ.isFetching && !isPlaceholder} />} onClick={() => comprasQ.refetch()} />
          </Tooltip>
        }
      />

      {/* ── KPIs — Linha 1 ── */}
      <Row gutter={[12, 12]}>
        {([
          { title: 'Total de Compras', value: `R$ ${money(metrics.valorTotal)}`, color: metricColors.cost, sub: `${metrics.total} registros`, icon: <DollarOutlined />, hero: true, tip: 'Soma de todos os custos no período selecionado' },
          { title: 'Ticket Médio', value: `R$ ${money(metrics.ticketMedio)}`, color: metricColors.ticket, sub: `por compra`, icon: <ShoppingCartOutlined />, tip: 'Valor médio por registro de compra' },
          { title: 'Quantidade Total', value: metrics.qtdTotal.toLocaleString('pt-BR', { maximumFractionDigits: 0 }), color: metricColors.quantity, sub: `itens comprados`, icon: <NumberOutlined /> },
          { title: 'Fornecedores', value: String(metrics.fornecedores), color: metricColors.clients, sub: `${metrics.materiais} materiais`, icon: <TeamOutlined /> },
        ] as const).map((kpi) => (
          <Col xs={12} sm={6} key={kpi.title}>
            <Tooltip title={kpi.tip ?? ''}>
              <div className={`metric-card${kpi.hero ? ' metric-card--hero' : ''}`}>
                <div className="metric-card__accent" style={{ background: kpi.color }} />
                <div className="metric-card__content">
                  <span className="metric-card__title" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    {kpi.icon} {kpi.title}
                  </span>
                  <span className={`metric-card__value${kpi.hero ? ' metric-card__value--hero' : ''}`}>
                    {comprasQ.isLoading ? '—' : kpi.value}
                  </span>
                  <span className="metric-card__prev">{kpi.sub}</span>
                </div>
              </div>
            </Tooltip>
          </Col>
        ))}
      </Row>

      {/* ── Filtros + Top Fornecedores ── */}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={16}>
          <Card className="app-card no-hover" variant="borderless" title={<Space><FilterOutlined /> Filtros</Space>} style={{ height: '100%' }}>
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
                  <Input.Search placeholder="Fornecedor, material, NF..." allowClear value={search} onChange={(e) => setSearch(e.target.value)} />
                </div>
                <div className="filter-item">
                  <span>Período</span>
                  <RangePickerBR format="DD/MM/YYYY" placeholder={['Início', 'Fim']} value={[range[0], range[1]]} onChange={handleRangeChange} allowClear={false} popupClassName="iga-picker-popup" style={{ minWidth: 250 }} />
                </div>
                {statusOptions.length > 2 && (
                  <div className="filter-item">
                    <span>Status</span>
                    <Select value={statusFilter} onChange={setStatusFilter} options={statusOptions} style={{ minWidth: 150 }} />
                  </div>
                )}
              </div>

              {/* Breakdown por status inline */}
              {metrics.byStatus.size > 1 && (
                <Space wrap size={8} style={{ marginTop: 4 }}>
                  {Array.from(metrics.byStatus.entries()).map(([st, info]) => (
                    <Tag key={st} color={statusColor(st)} style={{ cursor: 'pointer' }} onClick={() => setStatusFilter(statusFilter === st ? 'all' : st)}>
                      {st}: {info.count} — R$ {money(info.value)}
                    </Tag>
                  ))}
                </Space>
              )}
            </Space>
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <TopFornecedoresCard rows={filtered} loading={comprasQ.isLoading} />
        </Col>
      </Row>

      {/* ── Alerta truncamento ── */}
      {truncated && (
        <Alert type="warning" showIcon message="Resultados parciais" description="O volume de dados excede o limite de paginação. Reduza o período para garantir cobertura total." />
      )}

      {/* ── Tabela ── */}
      <Card
        className="app-card no-hover quantum-table"
        variant="borderless"
        title={<Space><ShoppingCartOutlined /> <span>Compras ({filtered.length.toLocaleString('pt-BR')})</span></Space>}
        extra={
          filtered.length > 0 ? (
            <Space size={16}>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                Total: <Typography.Text strong style={{ color: 'var(--qc-primary)' }}>R$ {money(metrics.valorTotal)}</Typography.Text>
              </Typography.Text>
            </Space>
          ) : null
        }
      >
        {comprasQ.isLoading ? (
          <Skeleton active paragraph={{ rows: 12 }} />
        ) : comprasQ.isError ? (
          <Alert type="error" showIcon message="Erro ao carregar compras" description={<span>Verifique se há uma fonte com <code>/sgbrbi/compras</code> em <Link to="/fontes-de-dados">Fontes de dados</Link>.</span>} />
        ) : rows.length === 0 ? (
          <Alert type="info" showIcon message="Nenhuma compra encontrada no período" description="Tente ampliar o intervalo de datas ou verifique as fontes de dados." />
        ) : (
          <Table
            rowKey={(r, i) => rk(r, i ?? 0)}
            size="small"
            dataSource={filtered}
            columns={columns}
            scroll={{ x: 1000 }}
            pagination={{
              showSizeChanger: true,
              defaultPageSize: 50,
              pageSizeOptions: ['25', '50', '100', '200'],
              showTotal: (t, [a, b]) => <Typography.Text type="secondary">{a}–{b} de {t.toLocaleString('pt-BR')}</Typography.Text>,
            }}
            loading={isPlaceholder}
            style={{ opacity: isPlaceholder ? 0.6 : 1, transition: 'opacity 200ms' }}
            summary={() =>
              filtered.length > 0 ? (
                <Table.Summary fixed>
                  <Table.Summary.Row>
                    <Table.Summary.Cell index={0} colSpan={columns.length - (hasF(sampleRow, F.st) ? 2 : 1)} align="right">
                      <Typography.Text strong style={{ fontSize: 13 }}>Total do período:</Typography.Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={1} align="right">
                      <Typography.Text strong style={{ fontSize: 14, color: 'var(--qc-primary)' }}>
                        R$ {money(metrics.valorTotal)}
                      </Typography.Text>
                    </Table.Summary.Cell>
                    {hasF(sampleRow, F.st) && <Table.Summary.Cell index={2} />}
                  </Table.Summary.Row>
                </Table.Summary>
              ) : undefined
            }
          />
        )}
      </Card>

      <CompraDetailDrawer open={!!detailRow} onClose={() => setDetailRow(null)} row={detailRow} />
    </Space>
  )
}
