import { RangePickerBR } from '../components/DatePickerPtBR'
import {
  Alert,
  Button,
  Card,
  Col,
  DatePicker,
  Empty,
  Input,
  Row,
  Skeleton,
  Space,
  Table,
  Tabs,
  Tag,
  Typography,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  ShoppingCartOutlined,
  FileTextOutlined,
} from '@ant-design/icons'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { PageHeaderCard } from '../components/PageHeaderCard'
import { MetricCard } from '../components/MetricCard'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { getVendasSgbr, getFaturamentos, getDefaultFaturamentoDateRange } from '../services/erpService'
import { hasAnySources, getNotasFiscaisDataSource } from '../services/dataSourceService'
import { queryKeys } from '../query/queryKeys'
import { getErrorMessage } from '../api/httpError'
import type { VendaSgbr } from '../api/schemas'
import type { Faturamento } from '../types/models'

function formatBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

const statusLabel: Record<string, string> = {
  F: 'Faturado',
  P: 'Pendente',
  C: 'Cancelado',
  A: 'Aberto',
}
const statusColor: Record<string, string> = {
  F: 'green',
  P: 'default',
  C: 'red',
  A: 'blue',
}

/* ══════════════════════════════════════════════════
   Tab 1 — Vendas (dados reais SGBR)
   ══════════════════════════════════════════════════ */

function VendasSgbrTab() {
  const [range, setRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>(() => [
    dayjs().subtract(30, 'day'),
    dayjs(),
  ])
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search)
  const dtDe = range[0].format('YYYY-MM-DD')
  const dtAte = range[1].format('YYYY-MM-DD')
  const periodoLabel = `${range[0].format('DD/MM/YYYY')} a ${range[1].format('DD/MM/YYYY')}`

  const vendasQ = useQuery({
    queryKey: ['vendasSgbr', dtDe, dtAte],
    queryFn: () => getVendasSgbr({ dtDe, dtAte }),
    placeholderData: keepPreviousData,
    staleTime: 5 * 60_000,
    retry: 1,
  })

  const rows = vendasQ.data ?? []
  const isPlaceholder = vendasQ.isPlaceholderData

  const filtered = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(
      (r) =>
        r.produto.toLowerCase().includes(q) ||
        r.cliente.toLowerCase().includes(q) ||
        r.vendedor.toLowerCase().includes(q) ||
        String(r.codProduto).includes(q),
    )
  }, [rows, debouncedSearch])

  const metrics = useMemo(() => {
    const totalVendas = filtered.reduce((s, r) => s + r.total, 0)
    const totalQtde = filtered.reduce((s, r) => s + r.qtde, 0)
    const totalItens = filtered.length
    const clientes = new Set(filtered.map((r) => r.codCliente)).size
    const lucroEstimado = filtered.reduce((s, r) => s + (r.total - r.custoProduto * r.qtde), 0)
    return { totalVendas, totalQtde, totalItens, clientes, lucroEstimado }
  }, [filtered])

  const columns: ColumnsType<VendaSgbr> = [
    {
      title: 'Produto',
      key: 'produto',
      fixed: 'left',
      ellipsis: true,
      render: (_: unknown, r) => (
        <Space direction="vertical" size={0}>
          <Typography.Text strong>{r.produto}</Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {r.cliente}
          </Typography.Text>
        </Space>
      ),
      sorter: (a, b) => a.produto.localeCompare(b.produto, 'pt-BR'),
    },
    {
      title: 'Data',
      dataIndex: 'data',
      key: 'data',
      width: 110,
      render: (v: string) => {
        const d = dayjs(v)
        return d.isValid() ? d.format('DD/MM/YYYY') : v
      },
      sorter: (a, b) => a.data.localeCompare(b.data),
    },
    {
      title: 'Qtde',
      dataIndex: 'qtde',
      key: 'qtde',
      width: 90,
      align: 'right',
      render: (v: number) => v.toLocaleString('pt-BR'),
      sorter: (a, b) => a.qtde - b.qtde,
    },
    { title: 'Und', dataIndex: 'unidade', key: 'und', width: 60, align: 'center' },
    {
      title: 'Valor Unit.',
      dataIndex: 'valorUnit',
      key: 'valorUnit',
      width: 110,
      align: 'right',
      render: (v: number) => formatBRL(v),
    },
    {
      title: 'Total',
      dataIndex: 'total',
      key: 'total',
      width: 130,
      align: 'right',
      render: (v: number) => <Typography.Text strong>{formatBRL(v)}</Typography.Text>,
      sorter: (a, b) => a.total - b.total,
      defaultSortOrder: 'descend',
    },
    {
      title: 'Vendedor',
      dataIndex: 'vendedor',
      key: 'vendedor',
      width: 150,
      ellipsis: true,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (v: string) => <Tag color={statusColor[v] ?? 'default'}>{statusLabel[v] ?? v}</Tag>,
    },
  ]

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <MetricCard title="Faturamento" value={formatBRL(metrics.totalVendas)} hero />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <MetricCard title="Itens vendidos" value={metrics.totalQtde.toLocaleString('pt-BR')} />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <MetricCard title="Clientes" value={String(metrics.clientes)} />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <MetricCard title="Lucro estimado" value={formatBRL(metrics.lucroEstimado)} />
        </Col>
      </Row>

      <Card className="app-card no-hover" variant="borderless" title="Filtros">
        <div className="filter-bar">
          <div className="filter-item">
            <span>Busca</span>
            <Input.Search allowClear placeholder="Produto, cliente ou vendedor" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="filter-item">
            <span>Per\u00EDodo</span>
            <RangePickerBR
              value={range}
              onChange={(d) => { if (d?.[0] && d[1]) setRange([d[0], d[1]]) }}
              format="DD/MM/YYYY"
              allowClear={false}
            />
          </div>
          <div className="filter-item" style={{ paddingTop: 22 }}>
            <Button onClick={() => void vendasQ.refetch()} loading={vendasQ.isFetching}>Atualizar</Button>
          </div>
        </div>
      </Card>

      {vendasQ.isError ? (
        <Alert type="error" showIcon message="Erro ao carregar vendas" description={getErrorMessage(vendasQ.error, 'Verifique as fontes de dados.')} />
      ) : null}

      <Card
        className="app-card quantum-table"
        variant="borderless"
        title={`Vendas de ${periodoLabel} \u2014 ${filtered.length} registros${isPlaceholder ? ' (carregando\u2026)' : ''}`}
        style={isPlaceholder ? { opacity: 0.6 } : undefined}
      >
        {vendasQ.isLoading ? (
          <Skeleton active paragraph={{ rows: 10 }} />
        ) : filtered.length === 0 ? (
          <Empty description="Nenhuma venda encontrada no per\u00EDodo." />
        ) : (
          <Table
            rowKey={(_, i) => String(i)}
            columns={columns}
            dataSource={filtered}
            pagination={{ pageSize: 20, showSizeChanger: true }}
            scroll={{ x: 900 }}
            aria-label="Vendas SGBR"
          />
        )}
      </Card>
    </Space>
  )
}

/* ══════════════════════════════════════════════════
   Tab 2 — Notas Fiscais (se fonte configurada)
   ══════════════════════════════════════════════════ */

function NotasFiscaisTab() {
  const defaultRange = useMemo(() => getDefaultFaturamentoDateRange(), [])
  const [range, setRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>(() => [
    dayjs().subtract(30, 'day'),
    dayjs(),
  ])
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search)
  const dtDe = range[0].format('YYYY-MM-DD')
  const dtAte = range[1].format('YYYY-MM-DD')
  const nfSource = getNotasFiscaisDataSource()
  const hasNf = hasAnySources() && Boolean(nfSource)
  const periodoLabel = `${range[0].format('DD/MM/YYYY')} a ${range[1].format('DD/MM/YYYY')}`

  const nfQ = useQuery({
    queryKey: queryKeys.faturamentos({ dtDe, dtAte, sourceId: nfSource?.id }),
    queryFn: () => getFaturamentos({ dtDe, dtAte }),
    enabled: hasNf,
    placeholderData: keepPreviousData,
    staleTime: 5 * 60_000,
  })

  const rows = nfQ.data ?? []

  const filtered = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(
      (r) =>
        r.cliente.toLowerCase().includes(q) ||
        r.numeroNF.toLowerCase().includes(q) ||
        r.id.toLowerCase().includes(q),
    )
  }, [rows, debouncedSearch])

  const metrics = useMemo(() => {
    const totalNF = filtered.reduce((s, r) => s + r.valorTotal, 0)
    const count = filtered.length
    return { totalNF, count }
  }, [filtered])

  const columns: ColumnsType<Faturamento> = [
    {
      title: 'NF / Cliente',
      key: 'nf',
      fixed: 'left',
      ellipsis: true,
      render: (_: unknown, r) => (
        <Space direction="vertical" size={0}>
          <Typography.Text strong>NF {r.numeroNF}</Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>{r.cliente}</Typography.Text>
        </Space>
      ),
    },
    {
      title: 'Data',
      dataIndex: 'data',
      key: 'data',
      width: 110,
      render: (v: string) => dayjs(v).format('DD/MM/YYYY'),
      sorter: (a, b) => a.data.localeCompare(b.data),
    },
    {
      title: 'Valor',
      dataIndex: 'valorTotal',
      key: 'total',
      width: 140,
      align: 'right',
      render: (v: number) => <Typography.Text strong>{formatBRL(v)}</Typography.Text>,
      sorter: (a, b) => a.valorTotal - b.valorTotal,
      defaultSortOrder: 'descend',
    },
    {
      title: 'Tipo',
      dataIndex: 'tipoDocumento',
      key: 'tipo',
      width: 80,
      render: (v: string) => <Tag>{v}</Tag>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (v: string) => <Tag color={v === 'Emitida' ? 'green' : v === 'Cancelada' ? 'red' : 'default'}>{v}</Tag>,
    },
  ]

  if (!hasNf) {
    return <Alert type="info" showIcon message="Configure uma fonte de notas fiscais em Fontes de Dados para ver os dados reais." />
  }

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12}><MetricCard title="Total NF" value={formatBRL(metrics.totalNF)} hero /></Col>
        <Col xs={24} sm={12}><MetricCard title="Notas emitidas" value={String(metrics.count)} /></Col>
      </Row>

      <Card className="app-card no-hover" variant="borderless" title="Filtros">
        <div className="filter-bar">
          <div className="filter-item">
            <span>Busca</span>
            <Input.Search allowClear placeholder="NF ou cliente" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="filter-item">
            <span>Per\u00EDodo</span>
            <RangePickerBR value={range} onChange={(d) => { if (d?.[0] && d[1]) setRange([d[0], d[1]]) }} format="DD/MM/YYYY" allowClear={false} />
          </div>
        </div>
      </Card>

      {nfQ.isError ? (
        <Alert type="error" showIcon message="Erro ao carregar notas fiscais" description={getErrorMessage(nfQ.error, 'Verifique a fonte.')} />
      ) : null}

      <Card className="app-card quantum-table" variant="borderless" title={`Notas Fiscais de ${periodoLabel} \u2014 ${filtered.length} registros`}>
        {nfQ.isLoading ? (
          <Skeleton active paragraph={{ rows: 8 }} />
        ) : filtered.length === 0 ? (
          <Empty description="Nenhuma nota fiscal encontrada." />
        ) : (
          <Table rowKey="id" columns={columns} dataSource={filtered} pagination={{ pageSize: 20, showSizeChanger: true }} scroll={{ x: 700 }} />
        )}
      </Card>
    </Space>
  )
}

/* ══════════════════════════════════════════════════
   P\u00E1gina Comercial
   ══════════════════════════════════════════════════ */

export function ComercialPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = searchParams.get('tab') ?? 'vendas'

  const tabItems = [
    {
      key: 'vendas',
      label: <span><ShoppingCartOutlined /> Vendas</span>,
      children: <VendasSgbrTab />,
    },
    {
      key: 'notas-fiscais',
      label: <span><FileTextOutlined /> Notas Fiscais</span>,
      children: <NotasFiscaisTab />,
    },
  ]

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <PageHeaderCard
        title="Comercial"
        subtitle="Vendas realizadas e notas fiscais emitidas no per\u00EDodo."
      />
      <Card className="app-card no-hover" variant="borderless" style={{ padding: 0 }}>
        <Tabs
          activeKey={activeTab}
          onChange={(key) => setSearchParams({ tab: key }, { replace: true })}
          type="card"
          size="large"
          items={tabItems}
        />
      </Card>
    </Space>
  )
}
