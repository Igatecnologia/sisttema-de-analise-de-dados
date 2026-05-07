import { RangePickerBR } from '../components/DatePickerPtBR'
import {
  Alert,
  Button,
  Card,
  Col,
  Empty,
  Progress,
  Row,
  Skeleton,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd'
import { getErrorMessage } from '../api/httpError'
import type { ColumnsType } from 'antd/es/table'
import { InfoCircleOutlined, ReloadOutlined, WarningOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import dayjs, { type Dayjs } from 'dayjs'
import { MetricCard } from '../components/MetricCard'
import { useSortableWidgets } from '../hooks/useSortableWidgets'
import { queryKeys } from '../query/queryKeys'
import {
  getLotesProducao,
  getPedidos,
  getOrdensProducao,
  getFaturamentos,
  getDefaultFaturamentoDateRange,
  getCustoRealProdutos,
  getMovimentosEstoque,
} from '../services/erpService'
import { getNotasFiscaisDataSource } from '../services/dataSourceService'
import { getProduzidoSgbr, hasProduzidoSgbrSourceConfigured } from '../services/produzidoService'
import type {
  CustoRealProduto,
  MovimentoEstoque,
} from '../types/models'

/* ── Helpers ── */

function formatBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function margemColor(pct: number): string {
  if (pct < 30) return '#f5222d'
  if (pct < 40) return '#fa8c16'
  return '#52c41a'
}

// severityColor kept for future use
// function severityColor(s: 'alta' | 'media' | 'baixa') {
//   if (s === 'alta') return 'red'
//   if (s === 'media') return 'orange'
//   return 'blue'
// }

function statusColor(s: string) {
  switch (s) {
    case 'Concluído': return 'green'
    case 'Faturado': return 'cyan'
    case 'Em Produção': return 'processing'
    case 'Pendente': return 'default'
    case 'Cancelado': return 'red'
    case 'Emitida': return 'green'
    default: return 'default'
  }
}

/* ── Tipagem auxiliar ── */

type DensidadeRow = {
  densidade: string
  lotes: number
  volumeM3: number
  custoTotal: number
  custoPorM3: number
}

type ClienteRow = {
  cliente: string
  pedidos: number
  valorTotal: number
  volumeM3: number
}

type EstoqueRow = {
  key: string
  nivel: string
  item: string
  saldo: number
  unidade: string
}

type ConciliacaoRow = {
  key: string
  pedidoId: string
  cliente: string
  valorPedido: number
  statusPedido: string
  opId: string
  statusOp: string
  nf: string
  valorFaturado: number
  statusFat: string
}

/* ══════════════════════════════════════════════ */

export function DashboardOperacionalPage() {
  const nfSource = getNotasFiscaisDataSource()
  const defaultFatRange = useMemo(() => getDefaultFaturamentoDateRange(), [])
  const [fatRange, setFatRange] = useState(defaultFatRange)
  const rangeValue = useMemo<[Dayjs, Dayjs]>(() => [dayjs(fatRange.dtDe), dayjs(fatRange.dtAte)], [fatRange])
  const { widgetLayout, SortableWrap, WidgetWrapper } = useSortableWidgets(
    'operacional',
    ['faturamento', 'produzidoSgbr', 'producao', 'custo', 'pedidosAberto', 'opsAndamento', 'margem'],
  )

  const produzidoEnabled = hasProduzidoSgbrSourceConfigured()

  const onRangeChange = (next: null | [Dayjs | null, Dayjs | null]) => {
    if (!next?.[0] || !next?.[1]) return
    setFatRange({
      dtDe: next[0].format('YYYY-MM-DD'),
      dtAte: next[1].format('YYYY-MM-DD'),
    })
  }

  /* ── Queries ── */

  const lotesQ = useQuery({
    queryKey: queryKeys.lotesProducao(),
    queryFn: getLotesProducao,
    staleTime: 1000 * 60 * 10,
  })

  const pedidosQ = useQuery({
    queryKey: queryKeys.pedidos(),
    queryFn: getPedidos,
    staleTime: 1000 * 60 * 10,
  })

  const ordensQ = useQuery({
    queryKey: queryKeys.ordensProducao(),
    queryFn: getOrdensProducao,
    staleTime: 1000 * 60 * 10,
  })

  const fatQ = useQuery({
    queryKey: nfSource
      ? queryKeys.faturamentos({ ...fatRange, sourceId: nfSource.id })
      : queryKeys.faturamentos(),
    queryFn: () => getFaturamentos(nfSource ? fatRange : undefined),
    staleTime: 1000 * 60 * 10,
  })

  const custoQ = useQuery({
    queryKey: queryKeys.custoRealProdutos(),
    queryFn: getCustoRealProdutos,
    staleTime: 1000 * 60 * 10,
  })

  const movQ = useQuery({
    queryKey: queryKeys.movimentosEstoque(),
    queryFn: getMovimentosEstoque,
    staleTime: 1000 * 60 * 10,
  })

  const produzidoQ = useQuery({
    queryKey: ['produzidoSgbr', 'operacional', fatRange.dtDe, fatRange.dtAte] as const,
    queryFn: () => getProduzidoSgbr(fatRange),
    enabled: produzidoEnabled,
    staleTime: 1000 * 60 * 10,
  })

  const coreQueries = [lotesQ, pedidosQ, ordensQ, fatQ, custoQ, movQ] as const

  // Não bloqueia a tela pelo "Produzido (SGBR)" para evitar sensação de
  // dashboard travado quando esse endpoint está lento/instável.
  const loading = coreQueries.some((q) => q.isLoading)

  const allCoreFailed = coreQueries.every((q) => q.isError)
  const firstError =
    lotesQ.error ?? pedidosQ.error ?? ordensQ.error ?? fatQ.error ??
    custoQ.error ?? movQ.error

  const partialErrors: string[] = []
  if (lotesQ.isError) partialErrors.push('lotes de produção')
  if (pedidosQ.isError) partialErrors.push('pedidos')
  if (ordensQ.isError) partialErrors.push('ordens de produção')
  if (fatQ.isError) partialErrors.push('faturamento')
  if (custoQ.isError) partialErrors.push('custo real')
  if (movQ.isError) partialErrors.push('movimentos de estoque')
  if (produzidoEnabled && produzidoQ.isError) partialErrors.push('produzido (SGBR)')
  const refetchAll = () => {
    void lotesQ.refetch()
    void pedidosQ.refetch()
    void ordensQ.refetch()
    void fatQ.refetch()
    void custoQ.refetch()
    void movQ.refetch()
    if (produzidoEnabled) void produzidoQ.refetch()
  }

  const produzidoRegCount = useMemo(() => {
    if (!produzidoQ.data) return 0
    return produzidoQ.data.meta.rowCount ?? produzidoQ.data.rows.length
  }, [produzidoQ.data])

  const lotes = useMemo(() => lotesQ.data ?? [], [lotesQ.data])
  const pedidos = useMemo(() => pedidosQ.data ?? [], [pedidosQ.data])
  const ordens = useMemo(() => ordensQ.data ?? [], [ordensQ.data])
  const faturamentos = useMemo(() => fatQ.data ?? [], [fatQ.data])
  const custoReal = useMemo(() => custoQ.data ?? [], [custoQ.data])
  const movimentos = useMemo(() => movQ.data ?? [], [movQ.data])
  const hasLotesData = lotes.length > 0
  const hasPedidosData = pedidos.length > 0
  const hasOrdensData = ordens.length > 0
  const hasFaturamentoData = faturamentos.length > 0
  const hasCustoData = custoReal.length > 0
  const hasMovimentosData = movimentos.length > 0
  const hasProduzidoData = produzidoEnabled && produzidoRegCount > 0

  /* ── KPIs ── */

  const lotesConcluidos = useMemo(
    () => lotes.filter((l) => l.status === 'Concluído'),
    [lotes],
  )

  const producaoM3 = useMemo(
    () => lotesConcluidos.reduce((s, l) => s + l.volumeTotalM3, 0),
    [lotesConcluidos],
  )

  const custoMedioM3 = useMemo(() => {
    if (!lotesConcluidos.length) return 0
    const totalCusto = lotesConcluidos.reduce((s, l) => s + l.custoTotalLote, 0)
    return producaoM3 > 0 ? totalCusto / producaoM3 : 0
  }, [lotesConcluidos, producaoM3])

  const faturamentoTotal = useMemo(
    () =>
      faturamentos
        .filter((f) => f.status === 'Emitida')
        .reduce((s, f) => s + f.valorTotal, 0),
    [faturamentos],
  )

  const pedidosEmAberto = useMemo(
    () => pedidos.filter((p) => p.status !== 'Faturado' && p.status !== 'Cancelado').length,
    [pedidos],
  )

  const opsEmAndamento = useMemo(
    () => ordens.filter((o) => o.status === 'Em Produção').length,
    [ordens],
  )

  const margemMedia = useMemo(() => {
    if (!custoReal.length) return 0
    return custoReal.reduce((s, c) => s + c.margemRealPct, 0) / custoReal.length
  }, [custoReal])

  /* ── Produção por Densidade ── */

  const densidadeRows = useMemo<DensidadeRow[]>(() => {
    const map = new Map<string, { lotes: number; vol: number; custo: number }>()
    for (const l of lotesConcluidos) {
      const curr = map.get(l.densidade) ?? { lotes: 0, vol: 0, custo: 0 }
      curr.lotes += 1
      curr.vol += l.volumeTotalM3
      curr.custo += l.custoTotalLote
      map.set(l.densidade, curr)
    }
    return Array.from(map.entries())
      .map(([d, v]) => ({
        densidade: d,
        lotes: v.lotes,
        volumeM3: v.vol,
        custoTotal: v.custo,
        custoPorM3: v.vol > 0 ? v.custo / v.vol : 0,
      }))
      .sort((a, b) => b.volumeM3 - a.volumeM3)
  }, [lotesConcluidos])

  /* ── Top 5 Produtos por Margem (piores primeiro) ── */

  const top5Margem = useMemo(
    () => [...custoReal].sort((a, b) => a.margemRealPct - b.margemRealPct).slice(0, 5),
    [custoReal],
  )

  /* ── Vendas por Cliente ── */

  const clienteRows = useMemo<ClienteRow[]>(() => {
    const map = new Map<string, { pedidos: number; valor: number; vol: number }>()
    for (const p of pedidos) {
      const curr = map.get(p.cliente) ?? { pedidos: 0, valor: 0, vol: 0 }
      curr.pedidos += 1
      curr.valor += p.totalValor
      curr.vol += p.totalM3
      map.set(p.cliente, curr)
    }
    return Array.from(map.entries())
      .map(([c, v]) => ({
        cliente: c,
        pedidos: v.pedidos,
        valorTotal: v.valor,
        volumeM3: v.vol,
      }))
      .sort((a, b) => b.valorTotal - a.valorTotal)
      .slice(0, 5)
  }, [pedidos])

  /* ── Estoque Resumido ── */

  const estoqueRows = useMemo<EstoqueRow[]>(() => {
    const latest = new Map<string, MovimentoEstoque>()
    for (const m of movimentos) {
      const key = `${m.nivelEstoque}::${m.item}`
      const curr = latest.get(key)
      if (!curr || m.id > curr.id) latest.set(key, m)
    }
    return Array.from(latest.values()).map((m) => ({
      key: m.id,
      nivel: m.nivelEstoque,
      item: m.item,
      saldo: m.saldoAtual,
      unidade: m.unidade,
    }))
  }, [movimentos])

  /* ── Conciliação Pedido × Produzido × Faturado ── */

  const conciliacaoRows = useMemo<ConciliacaoRow[]>(() => {
    return pedidos.map((p) => {
      const op = ordens.find((o) => o.pedidoIds.includes(p.id))
      const fat = faturamentos.find((f) => f.pedidoId === p.id)
      return {
        key: p.id,
        pedidoId: p.id,
        cliente: p.cliente,
        valorPedido: p.totalValor,
        statusPedido: p.status,
        opId: op?.id ?? '—',
        statusOp: op?.status ?? '—',
        nf: fat?.numeroNF || '—',
        valorFaturado: fat?.valorTotal ?? 0,
        statusFat: fat?.status ?? '—',
      }
    })
  }, [pedidos, ordens, faturamentos])

  /* ── Colunas das tabelas ── */

  const densidadeCols: ColumnsType<DensidadeRow> = [
    { title: 'Densidade', dataIndex: 'densidade', key: 'densidade' },
    { title: 'Lotes', dataIndex: 'lotes', key: 'lotes', align: 'center' },
    {
      title: 'Volume m³',
      dataIndex: 'volumeM3',
      key: 'volumeM3',
      align: 'right',
      render: (v: number) => v.toFixed(2),
    },
    {
      title: 'Custo Total',
      dataIndex: 'custoTotal',
      key: 'custoTotal',
      align: 'right',
      render: (v: number) => formatBRL(v),
    },
    {
      title: 'Custo/m³',
      dataIndex: 'custoPorM3',
      key: 'custoPorM3',
      align: 'right',
      render: (v: number) => formatBRL(v),
    },
  ]

  const margemCols: ColumnsType<CustoRealProduto> = [
    {
      title: 'Produto',
      dataIndex: 'produto',
      key: 'produto',
      render: (v: string, r) =>
        r.margemRealPct < 30 ? (
          <Space size={4}>
            <WarningOutlined style={{ color: '#f5222d' }} />
            {v}
          </Space>
        ) : (
          v
        ),
    },
    {
      title: 'Custo Real',
      dataIndex: 'custoRealTotal',
      key: 'custoReal',
      align: 'right',
      render: (v: number) => formatBRL(v),
    },
    {
      title: 'Preço',
      dataIndex: 'precoVenda',
      key: 'preco',
      align: 'right',
      render: (v: number) => formatBRL(v),
    },
    {
      title: 'Margem Real',
      dataIndex: 'margemRealPct',
      key: 'margem',
      align: 'center',
      width: 160,
      render: (v: number) => (
        <Space size={8}>
          <Progress
            percent={v}
            size="small"
            strokeColor={margemColor(v)}
            showInfo={false}
            style={{ width: 60 }}
          />
          <span style={{ color: margemColor(v), fontWeight: 600 }}>{v.toFixed(1)}%</span>
        </Space>
      ),
    },
  ]

  const clienteCols: ColumnsType<ClienteRow> = [
    { title: 'Cliente', dataIndex: 'cliente', key: 'cliente' },
    { title: 'Pedidos', dataIndex: 'pedidos', key: 'pedidos', align: 'center' },
    {
      title: 'Valor Total',
      dataIndex: 'valorTotal',
      key: 'valor',
      align: 'right',
      render: (v: number) => formatBRL(v),
    },
    {
      title: 'Volume m³',
      dataIndex: 'volumeM3',
      key: 'vol',
      align: 'right',
      render: (v: number) => v.toFixed(2),
    },
  ]

  const estoqueCols: ColumnsType<EstoqueRow> = [
    { title: 'Nível', dataIndex: 'nivel', key: 'nivel' },
    { title: 'Item', dataIndex: 'item', key: 'item' },
    {
      title: 'Saldo Atual',
      dataIndex: 'saldo',
      key: 'saldo',
      align: 'right',
      render: (v: number, r) => {
        if (r.nivel === 'Produto Base' && v < 5) {
          return <Tag color="red">{v.toFixed(2)}</Tag>
        }
        return v.toFixed(2)
      },
    },
    { title: 'Unidade', dataIndex: 'unidade', key: 'unidade', align: 'center' },
  ]

  const emptyTable = (
    <Empty
      image={Empty.PRESENTED_IMAGE_SIMPLE}
      description="Sem dados no período ou cadastros ainda vazios."
    />
  )

  const conciliacaoCols: ColumnsType<ConciliacaoRow> = [
    { title: 'Pedido', dataIndex: 'pedidoId', key: 'ped' },
    { title: 'Cliente', dataIndex: 'cliente', key: 'cli' },
    {
      title: 'Valor Pedido',
      dataIndex: 'valorPedido',
      key: 'vp',
      align: 'right',
      render: (v: number) => formatBRL(v),
    },
    {
      title: 'Status Pedido',
      dataIndex: 'statusPedido',
      key: 'sp',
      align: 'center',
      render: (v: string) => <Tag color={statusColor(v)}>{v}</Tag>,
    },
    { title: 'OP', dataIndex: 'opId', key: 'op', align: 'center' },
    {
      title: 'Status OP',
      dataIndex: 'statusOp',
      key: 'sop',
      align: 'center',
      render: (v: string) => (v === '—' ? '—' : <Tag color={statusColor(v)}>{v}</Tag>),
    },
    { title: 'NF', dataIndex: 'nf', key: 'nf', align: 'center' },
    {
      title: 'Valor Faturado',
      dataIndex: 'valorFaturado',
      key: 'vf',
      align: 'right',
      render: (v: number) => (v ? formatBRL(v) : '—'),
    },
    {
      title: 'Status Fat.',
      dataIndex: 'statusFat',
      key: 'sf',
      align: 'center',
      render: (v: string) => (v === '—' ? '—' : <Tag color={statusColor(v)}>{v}</Tag>),
    },
  ]

  /* ── Render ── */

  if (loading) {
    return (
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <Row gutter={[16, 16]}>
          {[1, 2, 3, 4, 5, 6, 7].map((k) => (
            <Col key={k} xs={24} sm={12} lg={8} xl={4}>
              <Card>
                <Skeleton active paragraph={{ rows: 1 }} />
              </Card>
            </Col>
          ))}
        </Row>
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={12}>
            <Card><Skeleton active paragraph={{ rows: 5 }} /></Card>
          </Col>
          <Col xs={24} lg={12}>
            <Card><Skeleton active paragraph={{ rows: 5 }} /></Card>
          </Col>
        </Row>
        <Card><Skeleton active paragraph={{ rows: 6 }} /></Card>
      </Space>
    )
  }

  if (allCoreFailed) {
    return (
      <Alert
        type="error"
        showIcon
        message="Não foi possível carregar o dashboard operacional"
        description={getErrorMessage(firstError, 'Tente novamente em instantes.')}
        action={
          <Button size="small" onClick={refetchAll}>
            Tentar novamente
          </Button>
        }
      />
    )
  }

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Card className="app-card" variant="borderless">
        <Space align="start" style={{ width: '100%', justifyContent: 'space-between' }} wrap>
          <Space direction="vertical" size={4}>
            <Typography.Title level={3} style={{ margin: 0 }}>
              Dashboard Operacional
            </Typography.Title>
            <Typography.Paragraph type="secondary" style={{ marginBottom: 0, maxWidth: 720 }}>
              Produção, pedidos, faturamento, estoque e conciliação em um só lugar.
              {nfSource ? (
                <>
                  {' '}
                  Faturamento NF: período {fatRange.dtDe} — {fatRange.dtAte}.
                </>
              ) : (
                <>
                  {' '}
                  <InfoCircleOutlined /> Faturamento usa dados locais até cadastrar fonte de notas fiscais.
                </>
              )}
            </Typography.Paragraph>
            <Space size="middle" wrap style={{ marginTop: 4 }}>
              <Link to="/fontes-de-dados">Fontes de dados</Link>
              <Typography.Text type="secondary">·</Typography.Text>
              <Link to="/producao">Produção</Link>
              <Typography.Text type="secondary">·</Typography.Text>
              <Link to="/comercial">Comercial</Link>
            </Space>
            <Space size={8} wrap>
              <Typography.Text type="secondary">Período (Faturamento/Produzido):</Typography.Text>
              <RangePickerBR
                value={rangeValue}
                format="DD/MM/YYYY"
                allowClear={false}
                onChange={(dates) => onRangeChange(dates as [Dayjs | null, Dayjs | null] | null)}
              />
            </Space>
          </Space>
          <Button type="primary" icon={<ReloadOutlined />} onClick={refetchAll}>
            Atualizar
          </Button>
        </Space>
      </Card>

      {partialErrors.length > 0 && (
        <Alert
          type="warning"
          showIcon
          message="Alguns blocos não carregaram"
          description={`Não foi possível obter: ${partialErrors.join(', ')}. O restante do painel está disponível.`}
          action={
            <Button size="small" onClick={refetchAll}>
              Tentar novamente
            </Button>
          }
        />
      )}

      {(() => {
        const hiddenModules: string[] = []
        if (!hasLotesData) hiddenModules.push('produção por lotes')
        if (!hasPedidosData) hiddenModules.push('pedidos')
        if (!hasOrdensData) hiddenModules.push('ordens de produção')
        if (!hasCustoData) hiddenModules.push('custos reais')
        if (!hasMovimentosData) hiddenModules.push('estoque por movimentos')
        if (!hasProduzidoData) hiddenModules.push('produzido SGBR')
        if (hiddenModules.length === 0) return null
        return (
          <Alert
            type="info"
            showIcon
            message="Blocos ocultados automaticamente"
            description={`Sem dados reais/integracão ativa para: ${hiddenModules.join(', ')}.`}
          />
        )
      })()}

      {/* ── Row 2: KPIs Principais (arrastável — use o handle no canto superior esquerdo) ── */}
      {(() => {
        const produzidoWidget = !produzidoEnabled ? (
          <MetricCard
            title="Produzido (SGBR)"
            value="—"
            description="Cadastre uma fonte com endpoint /sgbrbi/produzido em Fontes de dados para ver registros do BI."
          />
        ) : produzidoQ.isError ? (
          <MetricCard
            title="Produzido (SGBR)"
            value="Erro"
            description={getErrorMessage(produzidoQ.error, 'Falha ao consultar o relatório Produzido.')}
          />
        ) : (
          <MetricCard
            title="Produzido (SGBR)"
            value={`${produzidoRegCount} reg.`}
            loading={produzidoQ.isLoading}
            subtitle={`${fatRange.dtDe} → ${fatRange.dtAte}`}
            description={
              produzidoQ.data?.meta.truncated
                ? 'Retorno pode estar parcial por limite de paginação no proxy.'
                : undefined
            }
          />
        )

        const widgetMap: Record<string, ReactNode> = {
          producao: <MetricCard title="Produção m³/mês" value={`${producaoM3.toFixed(2)} m³`} />,
          custo: <MetricCard title="Custo Médio/m³" value={formatBRL(custoMedioM3)} />,
          faturamento: <MetricCard title="Faturamento (NF)" value={formatBRL(faturamentoTotal)} />,
          pedidosAberto: <MetricCard title="Pedidos em Aberto" value={pedidosEmAberto} />,
          opsAndamento: <MetricCard title="OPs em Andamento" value={opsEmAndamento} />,
          margem: <MetricCard title="Margem Média Real" value={`${margemMedia.toFixed(1)}%`} />,
          produzidoSgbr: produzidoWidget,
        }
        const widgetEnabled: Record<string, boolean> = {
          producao: hasLotesData,
          custo: hasLotesData,
          faturamento: hasFaturamentoData || nfSource != null,
          pedidosAberto: hasPedidosData,
          opsAndamento: hasOrdensData,
          margem: hasCustoData,
          produzidoSgbr: produzidoEnabled,
        }
        const visibleWidgetLayout = widgetLayout.filter((id) => widgetEnabled[id] && widgetMap[id])
        return (
          <SortableWrap>
            <Row gutter={[16, 16]}>
              {visibleWidgetLayout.map((id) => (
                <Col key={id} xs={24} sm={12} lg={8} xl={4}>
                  <WidgetWrapper id={id}>{widgetMap[id]}</WidgetWrapper>
                </Col>
              ))}
            </Row>
          </SortableWrap>
        )
      })()}

      {/* ── Row 3: Produção por Densidade + Top 5 Margem ── */}
      {(hasLotesData || hasCustoData) && (
        <Row gutter={[16, 16]}>
          {hasLotesData && (
            <Col xs={24} lg={12}>
              <Card className="app-card" variant="borderless" title="Produção por Densidade">
                <Table<DensidadeRow>
                  dataSource={densidadeRows}
                  columns={densidadeCols}
                  rowKey="densidade"
                  pagination={false}
                  size="small"
                  locale={{ emptyText: emptyTable }}
                />
              </Card>
            </Col>
          )}
          {hasCustoData && (
            <Col xs={24} lg={12}>
              <Card className="app-card" variant="borderless" title="Top 5 Produtos por Margem (piores)">
                <Table<CustoRealProduto>
                  dataSource={top5Margem}
                  columns={margemCols}
                  rowKey="fichaTecnicaId"
                  pagination={false}
                  size="small"
                  locale={{ emptyText: emptyTable }}
                />
              </Card>
            </Col>
          )}
        </Row>
      )}

      {/* ── Row 4: Vendas por Cliente + Estoque Resumido ── */}
      {(hasPedidosData || hasMovimentosData) && (
        <Row gutter={[16, 16]}>
          {hasPedidosData && (
            <Col xs={24} lg={12}>
              <Card className="app-card" variant="borderless" title="Vendas por Cliente">
                <Table<ClienteRow>
                  dataSource={clienteRows}
                  columns={clienteCols}
                  rowKey="cliente"
                  pagination={false}
                  size="small"
                  locale={{ emptyText: emptyTable }}
                />
              </Card>
            </Col>
          )}
          {hasMovimentosData && (
            <Col xs={24} lg={12}>
              <Card className="app-card" variant="borderless" title="Estoque Resumido">
                <Table<EstoqueRow>
                  dataSource={estoqueRows}
                  columns={estoqueCols}
                  rowKey="key"
                  pagination={false}
                  size="small"
                  locale={{ emptyText: emptyTable }}
                />
              </Card>
            </Col>
          )}
        </Row>
      )}

      {/* ── Row 5: Conciliação ── */}
      {hasPedidosData && hasFaturamentoData && (
        <Card
          className="app-card"
          variant="borderless"
          title="Conciliação Pedido × Produzido × Faturado"
        >
          <Table<ConciliacaoRow>
            dataSource={conciliacaoRows}
            columns={conciliacaoCols}
            rowKey="key"
            pagination={false}
            size="small"
            scroll={{ x: 1000 }}
            locale={{ emptyText: emptyTable }}
          />
        </Card>
      )}
    </Space>
  )
}
