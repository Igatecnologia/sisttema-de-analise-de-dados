import { Button, Card, Col, Dropdown, Empty, Input, Row, Select, Space, Table, Tag, Tooltip, Typography } from 'antd'
import { DownloadOutlined, EyeOutlined, FileExcelOutlined, FilePdfOutlined, WarningOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { Suspense, lazy, useMemo, useState } from 'react'
import { Skeleton } from 'antd'
import { useQuery } from '@tanstack/react-query'
import { MetricCard } from '../../components/MetricCard'
import { EstoqueDetailDrawer } from '../../components/EstoqueDetailDrawer'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import type { EstoqueEspuma } from '../../types/models'
import { getEstoqueEspuma } from '../../services/financeReportsService'
import { queryKeys } from '../../query/queryKeys'
import { exportExcel, exportPdf, estoqueEspumaCols } from '../../utils/financeExport'

const EstoqueStatusChart = lazy(() =>
  import('../charts/EstoqueStatusChart').then((m) => ({ default: m.EstoqueStatusChart })),
)

function formatBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function detTxt(row: EstoqueEspuma, key: string): string {
  const v = row.detalhes?.[key]
  if (v == null) return ''
  return String(v).trim()
}

function fmtDate(v: unknown): string {
  if (!v || typeof v !== 'string') return '—'
  const d = dayjs(v)
  return d.isValid() ? d.format('DD/MM/YYYY') : '—'
}

function qtdeTag(v: number): JSX.Element {
  if (v < 0) return <Typography.Text type="danger" strong>{v.toLocaleString('pt-BR')}</Typography.Text>
  if (v === 0) return <Typography.Text type="warning">0</Typography.Text>
  return <Typography.Text>{v.toLocaleString('pt-BR')}</Typography.Text>
}

const statusColor: Record<EstoqueEspuma['status'], string> = { Normal: 'green', Baixo: 'orange', 'Crítico': 'red' }

export function EstoqueEspumaTab() {
  const [search, setSearch] = useState('')
  const [tipoFilter, setTipoFilter] = useState<'all' | EstoqueEspuma['tipo']>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | EstoqueEspuma['status']>('all')
  const [detailRow, setDetailRow] = useState<EstoqueEspuma | null>(null)

  const debouncedSearch = useDebouncedValue(search)
  const { data: rows = [], isLoading } = useQuery({ queryKey: queryKeys.estoqueEspuma(), queryFn: getEstoqueEspuma })

  const filtered = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase()
    return rows.filter((r) => {
      const text = !q || r.produto.toLowerCase().includes(q) || r.id.toLowerCase().includes(q)
      const tipo = tipoFilter === 'all' || r.tipo === tipoFilter
      const st = statusFilter === 'all' || r.status === statusFilter
      return text && tipo && st
    })
  }, [debouncedSearch, rows, tipoFilter, statusFilter])

  const totals = useMemo(() => {
    const custoTotal = filtered.reduce((s, r) => s + r.custoTotal, 0)
    const itensTotal = filtered.length
    const comEstoque = filtered.filter((r) => r.qtdeAtual > 0).length
    const semEstoque = filtered.filter((r) => r.qtdeAtual <= 0).length
    const espuma = filtered.filter((r) => r.tipo === 'Espuma').length
    const aglom = filtered.filter((r) => r.tipo === 'Aglomerado').length
    const criticos = filtered.filter((r) => r.status === 'Crítico').length
    const baixos = filtered.filter((r) => r.status === 'Baixo').length
    const normais = filtered.filter((r) => r.status === 'Normal').length
    return { custoTotal, itensTotal, comEstoque, semEstoque, espuma, aglom, criticos, baixos, normais }
  }, [filtered])

  const chartData = useMemo(() => [
    { status: 'Normal', count: totals.normais },
    { status: 'Baixo', count: totals.baixos },
    { status: 'Crítico', count: totals.criticos },
  ], [totals])

  const columns: ColumnsType<EstoqueEspuma> = [
    {
      title: '',
      key: 'actions',
      width: 48,
      fixed: 'left',
      render: (_: unknown, record) => (
        <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => setDetailRow(record)} />
      ),
    },
    {
      title: 'Produto',
      key: 'produto',
      fixed: 'left',
      ellipsis: true,
      render: (_: unknown, r) => {
        const grupo = detTxt(r, 'grupo')
        return (
          <Space direction="vertical" size={0}>
            <Typography.Text strong>{r.produto}</Typography.Text>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {[r.tipo, grupo].filter(Boolean).join(' · ') || `Cód ${r.id}`}
            </Typography.Text>
          </Space>
        )
      },
      sorter: (a, b) => a.produto.localeCompare(b.produto, 'pt-BR'),
    },
    {
      title: 'Tipo',
      dataIndex: 'tipo',
      key: 'tipo',
      width: 110,
      render: (v: string) => <Tag color={v === 'Espuma' ? 'purple' : 'cyan'}>{v}</Tag>,
      filters: [{ text: 'Espuma', value: 'Espuma' }, { text: 'Aglomerado', value: 'Aglomerado' }],
      onFilter: (v, r) => r.tipo === v,
    },
    {
      title: 'Und',
      dataIndex: 'unidade',
      key: 'unidade',
      width: 60,
      align: 'center',
    },
    {
      title: 'Estoque',
      dataIndex: 'qtdeAtual',
      key: 'qtdeAtual',
      width: 110,
      align: 'right',
      render: (v: number) => {
        const node = qtdeTag(v)
        if (v <= 0) {
          return (
            <Space size={4}>
              <Tooltip title="Sem estoque"><WarningOutlined style={{ color: '#faad14' }} /></Tooltip>
              {node}
            </Space>
          )
        }
        return node
      },
      sorter: (a, b) => a.qtdeAtual - b.qtdeAtual,
    },
    {
      title: 'Custo Unit.',
      dataIndex: 'custoUnitario',
      key: 'custoUnitario',
      width: 120,
      align: 'right',
      render: (v: number) => formatBRL(v),
    },
    {
      title: 'Custo Total',
      dataIndex: 'custoTotal',
      key: 'custoTotal',
      width: 130,
      align: 'right',
      render: (v: number) => <Typography.Text strong>{formatBRL(v)}</Typography.Text>,
      sorter: (a, b) => a.custoTotal - b.custoTotal,
    },
    {
      title: 'Última Compra',
      key: 'ultimaCompra',
      width: 120,
      render: (_: unknown, r) => fmtDate(r.detalhes?.['dataultimacompra']),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      sorter: (a, b) => {
        const w: Record<EstoqueEspuma['status'], number> = { 'Crítico': 0, Baixo: 1, Normal: 2 }
        return w[a.status] - w[b.status]
      },
      render: (v: EstoqueEspuma['status']) => <Tag color={statusColor[v]}>{v}</Tag>,
    },
  ]

  if (isLoading) return <Card className="app-card" variant="borderless"><Skeleton active paragraph={{ rows: 10 }} /></Card>

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}><MetricCard title="Valor em estoque" value={formatBRL(totals.custoTotal)} hero /></Col>
        <Col xs={24} sm={12} lg={6}><MetricCard title="Total de itens" value={String(totals.itensTotal)} /></Col>
        <Col xs={24} sm={12} lg={6}><MetricCard title="Com estoque" value={String(totals.comEstoque)} /></Col>
        <Col xs={24} sm={12} lg={6}><MetricCard title="Sem estoque / Negativos" value={String(totals.semEstoque)} /></Col>
      </Row>

      <Card className="app-card no-hover" variant="borderless" title="Distribuição por status">
        <Suspense fallback={<Skeleton active paragraph={{ rows: 4 }} />}>
          <EstoqueStatusChart data={chartData} label="Produto base por status" />
        </Suspense>
      </Card>

      <Card className="app-card no-hover" variant="borderless" title="Filtros"
        extra={
          <Dropdown menu={{ items: [
            { key: 'excel', icon: <FileExcelOutlined />, label: 'Excel', onClick: () => exportExcel(filtered, estoqueEspumaCols, 'Produto Base', 'estoque_base') },
            { key: 'pdf', icon: <FilePdfOutlined />, label: 'PDF', onClick: () => exportPdf(filtered, estoqueEspumaCols, 'Relatório — Estoque Produto Base', 'estoque_base') },
          ] }}>
            <Button icon={<DownloadOutlined />}>Exportar</Button>
          </Dropdown>
        }
      >
        <div className="filter-bar">
          <div className="filter-item"><span>Busca</span><Input.Search allowClear placeholder="Nome do produto ou código" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
          <div className="filter-item"><span>Tipo</span><Select value={tipoFilter} style={{ width: 180 }} onChange={setTipoFilter} options={[{ value: 'all', label: 'Todos' }, { value: 'Espuma', label: 'Espuma' }, { value: 'Aglomerado', label: 'Aglomerado' }]} /></div>
          <div className="filter-item"><span>Status</span><Select value={statusFilter} style={{ width: 180 }} onChange={setStatusFilter} options={[{ value: 'all', label: 'Todos' }, { value: 'Normal', label: 'Normal' }, { value: 'Baixo', label: 'Baixo' }, { value: 'Crítico', label: 'Crítico' }]} /></div>
        </div>
      </Card>

      <Card className="app-card quantum-table" variant="borderless" title={`Produto Base — ${filtered.length} itens`}>
        {filtered.length === 0 ? (
          <Empty description="Nenhum item encontrado." />
        ) : (
          <Table
            rowKey="id"
            columns={columns}
            dataSource={filtered}
            pagination={{ pageSize: 15, showSizeChanger: true }}
            scroll={{ x: 950 }}
            aria-label="Estoque de produto base"
          />
        )}
      </Card>

      <EstoqueDetailDrawer
        open={detailRow != null}
        onClose={() => setDetailRow(null)}
        title={detailRow ? detailRow.produto : 'Detalhes'}
        detalhes={detailRow?.detalhes as Record<string, unknown> | undefined}
      />
    </Space>
  )
}
