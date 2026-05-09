import { Button, Card, Col, Dropdown, Input, Row, Select, Space, Table, Tag, Typography } from 'antd'
import { DownloadOutlined, FileExcelOutlined, FilePdfOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { Suspense, lazy, useMemo, useState } from 'react'
import { Skeleton } from 'antd'
import { useQuery } from '@tanstack/react-query'
import { MetricCard } from '../../components/MetricCard'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import type { VendaEspuma } from '../../types/models'
import { getVendasEspuma } from '../../services/financeReportsService'
import { queryKeys } from '../../query/queryKeys'
import { exportExcel, exportPdf, vendasEspumaCols } from '../../utils/financeExport'

const VendasProdutoChart = lazy(() =>
  import('../charts/VendasProdutoChart').then((m) => ({ default: m.VendasProdutoChart })),
)

function formatBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function VendasEspumaTab() {
  const [search, setSearch] = useState('')
  const [tipoFilter, setTipoFilter] = useState<'all' | VendaEspuma['tipo']>('all')
  const [pgtoFilter, setPgtoFilter] = useState<'all' | VendaEspuma['formaPagamento']>('all')

  const debouncedSearch = useDebouncedValue(search)
  const { data: rows = [], isLoading } = useQuery({ queryKey: queryKeys.vendasEspuma(), queryFn: getVendasEspuma })

  const filtered = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase()
    return rows
      .filter((r) => {
        const text = !q || r.cliente.toLowerCase().includes(q) || r.produto.toLowerCase().includes(q) || r.id.toLowerCase().includes(q)
        const tipo = tipoFilter === 'all' || r.tipo === tipoFilter
        const pgto = pgtoFilter === 'all' || r.formaPagamento === pgtoFilter
        return text && tipo && pgto
      })
      .sort((a, b) => dayjs(b.data).valueOf() - dayjs(a.data).valueOf())
  }, [debouncedSearch, rows, tipoFilter, pgtoFilter])

  const totals = useMemo(() => {
    const faturamento = filtered.reduce((s, r) => s + r.total, 0)
    const qtdeTotal = filtered.reduce((s, r) => s + r.qtde, 0)
    const ticketMedio = filtered.length > 0 ? faturamento / filtered.length : 0
    const vendasEspuma = filtered.filter((r) => r.tipo === 'Espuma').reduce((s, r) => s + r.total, 0)
    const vendasAglom = filtered.filter((r) => r.tipo === 'Aglomerado').reduce((s, r) => s + r.total, 0)
    return { faturamento, qtdeTotal, ticketMedio, vendasEspuma, vendasAglom }
  }, [filtered])

  const rankingProduto = useMemo(() => {
    const map = new Map<string, { produto: string; tipo: string; qtde: number; total: number }>()
    for (const r of filtered) {
      const cur = map.get(r.produto) ?? { produto: r.produto, tipo: r.tipo, qtde: 0, total: 0 }
      cur.qtde += r.qtde
      cur.total += r.total
      map.set(r.produto, cur)
    }
    return [...map.values()].sort((a, b) => b.total - a.total)
  }, [filtered])

  const chartData = useMemo(() =>
    rankingProduto.map((r) => ({ produto: r.produto, total: r.total })),
  [rankingProduto])

  const columns: ColumnsType<VendaEspuma> = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 90 },
    { title: 'Data', dataIndex: 'data', key: 'data', width: 110, render: (v: string) => dayjs(v).format('DD/MM/YYYY'), sorter: (a, b) => dayjs(a.data).valueOf() - dayjs(b.data).valueOf() },
    { title: 'Cliente', dataIndex: 'cliente', key: 'cliente', ellipsis: true },
    { title: 'Produto', dataIndex: 'produto', key: 'produto', ellipsis: true },
    { title: 'Tipo', dataIndex: 'tipo', key: 'tipo', width: 120, render: (v: string) => <Tag color={v === 'Espuma' ? 'purple' : 'cyan'}>{v}</Tag> },
    { title: 'Qtde', dataIndex: 'qtde', key: 'qtde', width: 80, align: 'right', render: (v: number) => v.toLocaleString('pt-BR') },
    { title: 'Preço Unit.', dataIndex: 'precoUnitario', key: 'precoUnitario', width: 120, align: 'right', render: (v: number) => formatBRL(v) },
    { title: 'Total', dataIndex: 'total', key: 'total', width: 130, align: 'right', render: (v: number) => <Typography.Text strong>{formatBRL(v)}</Typography.Text>, sorter: (a, b) => a.total - b.total },
    { title: 'Pagamento', dataIndex: 'formaPagamento', key: 'formaPagamento', width: 110, render: (v: string) => <Tag>{v}</Tag> },
  ]

  const rankColumns: ColumnsType<(typeof rankingProduto)[number]> = [
    { title: 'Produto', dataIndex: 'produto', key: 'produto' },
    { title: 'Tipo', dataIndex: 'tipo', key: 'tipo', width: 120, render: (v: string) => <Tag color={v === 'Espuma' ? 'purple' : 'cyan'}>{v}</Tag> },
    { title: 'Qtde Vendida', dataIndex: 'qtde', key: 'qtde', width: 120, align: 'right', render: (v: number) => v.toLocaleString('pt-BR') },
    { title: 'Faturamento', dataIndex: 'total', key: 'total', width: 140, align: 'right', render: (v: number) => <Typography.Text strong>{formatBRL(v)}</Typography.Text> },
  ]

  if (isLoading) return <Card className="app-card" variant="borderless"><Skeleton active paragraph={{ rows: 10 }} /></Card>

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}><MetricCard title="Faturamento Total" value={formatBRL(totals.faturamento)} hero /></Col>
        <Col xs={24} sm={12} lg={6}><MetricCard title="Ticket Médio" value={formatBRL(totals.ticketMedio)} /></Col>
        <Col xs={24} sm={12} lg={6}><MetricCard title="Vendas Espuma" value={formatBRL(totals.vendasEspuma)} /></Col>
        <Col xs={24} sm={12} lg={6}><MetricCard title="Vendas Aglomerado" value={formatBRL(totals.vendasAglom)} /></Col>
      </Row>

      <Card className="app-card no-hover" variant="borderless" title="Faturamento por Produto">
        <Suspense fallback={<Skeleton active paragraph={{ rows: 4 }} />}>
          <VendasProdutoChart data={chartData} />
        </Suspense>
      </Card>

      <Card className="app-card no-hover" variant="borderless" title="Filtros"
        extra={
          <Dropdown menu={{ items: [
            { key: 'excel', icon: <FileExcelOutlined />, label: 'Excel', onClick: () => exportExcel(filtered, vendasEspumaCols, 'Vendas Espuma', 'vendas_espuma') },
            { key: 'pdf', icon: <FilePdfOutlined />, label: 'PDF', onClick: () => exportPdf(filtered, vendasEspumaCols, 'Relatório — Vendas de Espuma e Aglomerados', 'vendas_espuma') },
          ] }}>
            <Button icon={<DownloadOutlined />}>Exportar</Button>
          </Dropdown>
        }
      >
        <div className="filter-bar">
          <div className="filter-item"><span>Busca</span><Input.Search allowClear placeholder="Cliente, produto ou ID" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
          <div className="filter-item"><span>Tipo</span><Select value={tipoFilter} style={{ width: 180 }} onChange={setTipoFilter} options={[{ value: 'all', label: 'Todos' }, { value: 'Espuma', label: 'Espuma' }, { value: 'Aglomerado', label: 'Aglomerado' }]} /></div>
          <div className="filter-item"><span>Forma de pagamento</span><Select value={pgtoFilter} style={{ width: 180 }} onChange={setPgtoFilter} options={[{ value: 'all', label: 'Todas' }, { value: 'Dinheiro', label: 'Dinheiro' }, { value: 'PIX', label: 'PIX' }, { value: 'Cartão', label: 'Cartão' }, { value: 'Boleto', label: 'Boleto' }, { value: 'Prazo', label: 'Prazo' }]} /></div>
        </div>
      </Card>

      <Card className="app-card quantum-table" variant="borderless" title="Ranking por Produto">
        <Table rowKey="produto" columns={rankColumns} dataSource={rankingProduto} pagination={false} size="small" aria-label="Ranking de vendas por produto" />
      </Card>

      <Card className="app-card quantum-table" variant="borderless" title="Vendas de Espuma e Aglomerados">
        <Table rowKey="id" columns={columns} dataSource={filtered} pagination={{ pageSize: 10, showSizeChanger: true }} scroll={{ x: 1100 }} aria-label="Tabela de vendas" />
      </Card>
    </Space>
  )
}
