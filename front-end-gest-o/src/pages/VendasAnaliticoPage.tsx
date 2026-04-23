import { RangePickerBR } from '../components/DatePickerPtBR'
import {
  DollarOutlined,
  EyeOutlined,
  InfoCircleOutlined,
  PercentageOutlined,
  PieChartOutlined,
  ShoppingCartOutlined,
  TeamOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons'
import {
  Alert,
  Button,
  Card,
  Col,
  DatePicker,
  Empty,
  Input,
  Row,
  Select,
  Skeleton,
  Space,
  Tabs,
  Tag,
  Tooltip,
  Typography,
} from 'antd'
import dayjs from 'dayjs'
import { Suspense, lazy, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { DevErrorDetail } from '../components/DevErrorDetail'
import { VendaAnaliticoDetailDrawer } from '../components/VendaAnaliticoDetailDrawer'
import { ANALITICO_STALE_MS } from '../api/apiEnv'
import { hasAnySources } from '../services/dataSourceService'
import {
  getVendasAnaliticoDataSourceLabel,
  getVendasAnaliticoQuerySourceKey,
} from '../services/vendasAnaliticoSourceSelection'
import { getErrorMessage } from '../api/httpError'
import type { VendaAnaliticaRow } from '../api/schemas'
import { PageHeaderCard } from '../components/PageHeaderCard'
import { queryKeys } from '../query/queryKeys'
import { getVendasAnalitico } from '../services/vendasAnaliticoService'
import { nowBr } from '../utils/dayjsBr'
import { formatBRL, formatCompact } from '../utils/formatters'
import { metricColors, marginColor } from '../theme/colors'
import { receitaPedidoGrupo } from '../utils/vendasAnaliticoAggregates'
import { usePersistedSearchParams } from '../navigation/usePersistedSearchParams'
import { VendasAnaliticoSkeleton } from '../components/skeletons/VendasAnaliticoSkeleton'

const CurvaAbcTab = lazy(() =>
  import('./vendas/CurvaAbcTab').then((m) => ({ default: m.CurvaAbcTab })),
)

function statusTag(code: string) {
  const c = code.trim().toUpperCase()
  if (c === 'F' || c === 'FE' || c === 'PG') return <Tag color="success">Faturado</Tag>
  if (c === 'C' || c === 'X' || c === 'CAN') return <Tag color="error">Cancelado</Tag>
  if (c === 'P' || c === 'A' || c === 'AB') return <Tag color="warning">Pendente</Tag>
  return <Tag>{code}</Tag>
}

function statusGroup(code: string): 'faturado' | 'pendente' | 'cancelado' {
  const c = code.trim().toUpperCase()
  if (c === 'F' || c === 'FE' || c === 'PG') return 'faturado'
  if (c === 'C' || c === 'X' || c === 'CAN') return 'cancelado'
  return 'pendente'
}

/** Pedido agrupado — um ou mais produtos vendidos ao mesmo cliente na mesma data */
type PedidoAgrupado = {
  key: string
  cliente: string
  codcliente: string | number
  cepcliente: string
  vendedor: string
  data: string
  datafec: string
  status: string
  itens: VendaAnaliticaRow[]
  totalPedido: number
  totalCusto: number
  totalQtd: number
  undPrincipal: string
  margem: number
  qtdProdutos: number
}

function defaultRange(): { start: string; end: string } {
  const end = nowBr()
  const start = end.subtract(30, 'day')
  return { start: start.format('YYYY-MM-DD'), end: end.format('YYYY-MM-DD') }
}

function PedidosContent() {
  const { searchParams, setSearchParams, resetPersistedState } = usePersistedSearchParams({
    storageKey: 'vendas.pedidos.filters',
    ttlMs: 1000 * 60 * 60 * 24 * 7,
  })
  const { start: defStart, end: defEnd } = defaultRange()
  const start = searchParams.get('start') ?? defStart
  const end = searchParams.get('end') ?? defEnd
  const q = (searchParams.get('q') ?? '').trim().toLowerCase()
  const statusFilter = searchParams.get('status') ?? 'all'

  const biConfigured = hasAnySources()
  const sourceKey = getVendasAnaliticoQuerySourceKey()
  const [detailPedido, setDetailPedido] = useState<PedidoAgrupado | null>(null)
  const [page, setPage] = useState(1)
  const pageSize = 100

  const query = useQuery({
    queryKey: queryKeys.vendasAnalitico({ dtDe: start, dtAte: end, sourceId: sourceKey }),
    queryFn: async () => (await getVendasAnalitico({ dtDe: start, dtAte: end })).rows,
    enabled: biConfigured,
    staleTime: ANALITICO_STALE_MS,
  })

  // Agrupa linhas em pedidos (mesmo cliente + datafec + data lançamento + status)
  const pedidos = useMemo(() => {
    const rows = query.data ?? []
    const map = new Map<string, VendaAnaliticaRow[]>()
    for (const r of rows) {
      const raw = r as VendaAnaliticaRow & Record<string, unknown>
      const pedidoId =
        raw.dav ??
        raw.codpedido ??
        raw.numero_dav ??
        raw.numerodav ??
        raw.pedido ??
        null
      const key = pedidoId
        ? `pedido:${String(pedidoId)}`
        : `${r.codcliente}|${r.datafec}|${r.data}|${r.statuspedido}`
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(r)
    }
    const result: PedidoAgrupado[] = []
    for (const [key, itens] of map) {
      const first = itens[0]
      const totalPedido = receitaPedidoGrupo(itens)
      const totalCusto = itens.reduce((s, r) => s + r.precocustoitem * r.qtdevendida, 0)
      const totalQtd = itens.reduce((s, r) => s + r.qtdevendida, 0)
      /* Unidade mais frequente no pedido */
      const undCount = new Map<string, number>()
      for (const it of itens) {
        if (it.und) undCount.set(it.und, (undCount.get(it.und) ?? 0) + 1)
      }
      let undPrincipal = ''
      let maxCount = 0
      for (const [u, c] of undCount) {
        if (c > maxCount) { undPrincipal = u; maxCount = c }
      }

      result.push({
        key,
        cliente: String(first.nomecliente),
        codcliente: first.codcliente,
        cepcliente: first.cepcliente ?? '',
        vendedor: first.nomevendedor ?? '',
        data: first.data,
        datafec: first.datafec,
        status: first.statuspedido,
        itens,
        totalPedido,
        totalCusto,
        totalQtd,
        undPrincipal,
        margem: totalPedido > 0 ? ((totalPedido - totalCusto) / totalPedido) * 100 : 0,
        qtdProdutos: itens.length,
      })
    }
    return result.sort((a, b) => dayjs(b.data).valueOf() - dayjs(a.data).valueOf())
  }, [query.data])

  // Filtros
  const filtered = useMemo(() => {
    return pedidos.filter((p) => {
      if (q) {
        const haystack = `${p.cliente} ${p.codcliente} ${p.itens.map(i => `${i.decprod} ${i.codprod}`).join(' ')}`.toLowerCase()
        if (!haystack.includes(q)) return false
      }
      if (statusFilter !== 'all' && statusGroup(p.status) !== statusFilter) return false
      return true
    })
  }, [pedidos, q, statusFilter])

  const paged = useMemo(() => {
    const startIdx = (page - 1) * pageSize
    return filtered.slice(startIdx, startIdx + pageSize)
  }, [filtered, page])

  // KPIs
  const metrics = useMemo(() => {
    const totalVendas = filtered.reduce((s, p) => s + p.totalPedido, 0)
    const totalCusto = filtered.reduce((s, p) => s + p.totalCusto, 0)
    const totalQtd = filtered.reduce((s, p) => s + p.totalQtd, 0)
    const margemBruta = totalVendas > 0 ? ((totalVendas - totalCusto) / totalVendas) * 100 : 0
    const ticketMedio = filtered.length > 0 ? totalVendas / filtered.length : 0
    const clientesUnicos = new Set(filtered.map(p => String(p.codcliente))).size
    const totalProdutos = filtered.reduce((s, p) => s + p.qtdProdutos, 0)
    return { totalVendas, totalCusto, totalQtd, margemBruta, ticketMedio, clientesUnicos, totalProdutos, pedidos: filtered.length }
  }, [filtered])

  if (!biConfigured) {
    return (
      <Alert type="warning" showIcon message="Nenhuma fonte de dados configurada" description="Acesse Fontes de Dados para configurar a conexão com a API." />
    )
  }

  if (query.isLoading) {
    return (
      <Card className="app-card no-hover" variant="borderless">
        <VendasAnaliticoSkeleton />
      </Card>
    )
  }

  if (query.isError) {
    return (
      <Alert type="error" showIcon message="Falha ao carregar vendas"
        description={<>{getErrorMessage(query.error, 'Erro.')}<DevErrorDetail error={query.error} /></>}
        action={<Button size="small" onClick={() => query.refetch()}>Tentar novamente</Button>}
      />
    )
  }

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>

      {/* ── Filtros ── */}
      <Card className="app-card no-hover" variant="borderless">
        <div className="filter-bar">
          <div className="filter-item" style={{ flex: '1 1 280px' }}>
            <span>Buscar</span>
            <Input.Search
              allowClear
              placeholder="Cliente, produto ou código..."
              value={searchParams.get('q') ?? ''}
              onChange={(e) => {
                setPage(1)
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
            <span>Período</span>
            <RangePickerBR
              format="DD/MM/YYYY"
              value={[dayjs(start), dayjs(end)]}
              onChange={(vals) => {
                setPage(1)
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
          <div className="filter-item">
            <span>Status</span>
            <Select
              style={{ width: 150 }}
              value={statusFilter}
              onChange={(v) => {
                setPage(1)
                setSearchParams((prev) => {
                  const p = new URLSearchParams(prev)
                  if (v === 'all') p.delete('status')
                  else p.set('status', v)
                  return p
                })
              }}
              options={[
                { value: 'all', label: 'Todos' },
                { value: 'faturado', label: 'Faturado' },
                { value: 'pendente', label: 'Pendente' },
                { value: 'cancelado', label: 'Cancelado' },
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
          {
            title: 'Faturamento',
            value: formatCompact(metrics.totalVendas),
            icon: <DollarOutlined />,
            color: metricColors.revenue,
            sub: `${metrics.pedidos} pedidos`,
            /** Ajuda a explicar divergências com o PDF "Listagem de pedido de venda", que agrupa por data do pedido. */
            tooltip: 'Soma por pedido (DAV) usando `totalprodutos` quando disponível. O filtro de datas é aplicado pelo SGBR — tipicamente por data de fechamento (`datafec`). Por isso pode divergir do PDF, que agrupa por data do pedido. Todas as linhas entram na soma (sem filtro de status).',
          },
          { title: 'Margem bruta', value: `${metrics.margemBruta.toFixed(1)}%`, icon: <PercentageOutlined />, color: marginColor(metrics.margemBruta), sub: `Custo: ${formatCompact(metrics.totalCusto)}` },
          { title: 'Ticket médio', value: formatBRL(metrics.ticketMedio), icon: <ShoppingCartOutlined />, color: metricColors.ticket, sub: `${metrics.totalQtd.toLocaleString('pt-BR')} un vendidas` },
          { title: 'Clientes', value: String(metrics.clientesUnicos), icon: <TeamOutlined />, color: metricColors.clients, sub: `${metrics.totalProdutos} linhas de produto` },
        ].map((kpi) => (
          <Col xs={12} sm={6} key={kpi.title}>
            <div className="metric-card">
              <div className="metric-card__accent" style={{ background: kpi.color }} />
              <div className="metric-card__content">
                <span className="metric-card__title" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  {kpi.icon} {kpi.title}
                  {kpi.tooltip && (
                    <Tooltip title={kpi.tooltip} placement="top">
                      <InfoCircleOutlined style={{ fontSize: 11, color: 'var(--qc-text-secondary, #888)', cursor: 'help' }} />
                    </Tooltip>
                  )}
                </span>
                <span className="metric-card__value">{kpi.value}</span>
                <Typography.Text type="secondary" style={{ fontSize: 11 }}>{kpi.sub}</Typography.Text>
              </div>
            </div>
          </Col>
        ))}
      </Row>

      {/* ── Tabela de pedidos ── */}
      <Card className="app-card no-hover quantum-table" variant="borderless" title={`Pedidos (${metrics.pedidos})`}>
        {filtered.length === 0 ? (
          <Empty description="Nenhum pedido encontrado." />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--qc-border)', textAlign: 'left' }}>
                  {['Data', 'Vendedor', 'Cliente', 'Produtos', 'Qtd total', 'Total R$', 'Margem', 'Status', ''].map((h, i) => (
                    <th key={h || i} className="typ-thead" style={{
                      padding: '10px 12px',
                      textAlign: ['Qtd total', 'Total R$', 'Margem'].includes(h) ? 'right' : h === 'Status' ? 'center' : 'left',
                      width: h === '' ? 44 : undefined,
                    }}>
                      {h === 'Data' ? (
                        <Tooltip title="Data do lançamento do pedido. Quando há fechamento, exibimos também 'Fec: dd/mm/aa' — é o campo (datafec) que o SGBR usa para filtrar o período.">
                          <span style={{ borderBottom: '1px dashed var(--qc-border)', cursor: 'help' }}>{h}</span>
                        </Tooltip>
                      ) : (
                        h
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paged.map((pedido) => (
                  <tr key={pedido.key}
                    style={{ borderBottom: '1px solid var(--qc-border)', cursor: 'pointer', transition: 'background 120ms' }}
                    onClick={() => setDetailPedido(pedido)}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--qc-primary-light)' }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                  >
                    <td style={{ padding: '10px 12px', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                      <div>{dayjs(pedido.data).format('DD/MM/YY')}</div>
                      {pedido.datafec && (
                        <Typography.Text type="secondary" style={{ fontSize: 10 }}>
                          Fec: {dayjs(pedido.datafec).format('DD/MM/YY')}
                        </Typography.Text>
                      )}
                    </td>
                    <td style={{ padding: '10px 12px', maxWidth: 140 }}>
                      <Typography.Text ellipsis style={{ display: 'block', fontSize: 12 }}>
                        {pedido.vendedor || '—'}
                      </Typography.Text>
                    </td>
                    <td style={{ padding: '10px 12px', maxWidth: 220 }}>
                      <Typography.Text ellipsis style={{ display: 'block', fontWeight: 500, fontSize: 13 }}>
                        {pedido.cliente}
                      </Typography.Text>
                      <Typography.Text type="secondary" style={{ fontSize: 10 }}>
                        Cód: {pedido.codcliente}
                      </Typography.Text>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {pedido.itens.slice(0, 2).map((item, i) => (
                          <Typography.Text key={i} ellipsis type="secondary" style={{ fontSize: 11, maxWidth: 200, display: 'block' }}>
                            {item.decprod}
                          </Typography.Text>
                        ))}
                        {pedido.itens.length > 2 && (
                          <Typography.Text type="secondary" style={{ fontSize: 10, fontWeight: 600 }}>
                            +{pedido.itens.length - 2} mais
                          </Typography.Text>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                      {pedido.totalQtd.toLocaleString('pt-BR')}{pedido.undPrincipal ? ` ${pedido.undPrincipal}` : ''}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                      {formatBRL(pedido.totalPedido)}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                      <Tag color={pedido.margem >= 30 ? 'green' : pedido.margem >= 15 ? 'gold' : 'red'} style={{ margin: 0, fontSize: 11, fontVariantNumeric: 'tabular-nums' }}>
                        {pedido.margem.toFixed(1)}%
                      </Tag>
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                      {statusTag(pedido.status)}
                    </td>
                    <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                      <Button type="text" size="small" icon={<EyeOutlined />} onClick={(e) => { e.stopPropagation(); setDetailPedido(pedido) }} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {filtered.length > pageSize && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              Página {page} de {Math.ceil(filtered.length / pageSize)} · {filtered.length} pedidos
            </Typography.Text>
            <Space>
              <Button disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Anterior</Button>
              <Button
                disabled={page >= Math.ceil(filtered.length / pageSize)}
                onClick={() => setPage((p) => Math.min(Math.ceil(filtered.length / pageSize), p + 1))}
              >
                Próxima
              </Button>
            </Space>
          </div>
        )}
      </Card>

      <VendaAnaliticoDetailDrawer
        open={detailPedido != null}
        pedido={detailPedido}
        onClose={() => setDetailPedido(null)}
      />
    </Space>
  )
}

/* ═══════════════════════════════════════════════════════
   Página principal — Vendas (com abas)
   ═══════════════════════════════════════════════════════ */

const tabFallback = <Skeleton active paragraph={{ rows: 8 }} style={{ padding: 24 }} />

export function VendasAnaliticoPage() {
  const { searchParams, setSearchParams } = usePersistedSearchParams({
    storageKey: 'vendas.tabs',
    ttlMs: 1000 * 60 * 60 * 24 * 14,
  })
  const activeTab = searchParams.get('view') ?? 'pedidos'
  const sourceLabel = getVendasAnaliticoDataSourceLabel()

  const handleTabChange = (key: string) => {
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev)
      if (key === 'pedidos') p.delete('view')
      else p.set('view', key)
      return p
    }, { replace: true })
  }

  const tabItems = [
    {
      key: 'pedidos',
      label: (
        <span>
          <UnorderedListOutlined /> Pedidos
        </span>
      ),
      children: <PedidosContent />,
    },
    {
      key: 'curva-abc',
      label: (
        <span>
          <PieChartOutlined /> Curva ABC
        </span>
      ),
      children: (
        <Suspense fallback={tabFallback}>
          <CurvaAbcTab />
        </Suspense>
      ),
    },
  ]

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <PageHeaderCard
        title="Vendas"
        subtitle="Análise de vendas: pedidos, faturamento e curva ABC."
        extra={<Tag color="blue">{sourceLabel}</Tag>}
      />

      <Card className="app-card no-hover" variant="borderless" style={{ padding: 0 }}>
        <Tabs
          activeKey={activeTab}
          onChange={handleTabChange}
          type="card"
          size="large"
          items={tabItems}
        />
      </Card>
    </Space>
  )
}
