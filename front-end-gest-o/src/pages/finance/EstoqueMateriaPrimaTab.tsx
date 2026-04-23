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
import type { EstoqueMateriaPrima } from '../../types/models'
import { getEstoqueMateriaPrima } from '../../services/financeReportsService'
import { queryKeys } from '../../query/queryKeys'
import { exportExcel, exportPdf, estoqueMateriaPrimaCols } from '../../utils/financeExport'

const EstoqueStatusChart = lazy(() =>
  import('../charts/EstoqueStatusChart').then((m) => ({ default: m.EstoqueStatusChart })),
)

function formatBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function det(row: EstoqueMateriaPrima, key: string): unknown {
  return row.detalhes?.[key] ?? null
}

function detTxt(row: EstoqueMateriaPrima, key: string): string {
  const v = det(row, key)
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

const statusColor: Record<EstoqueMateriaPrima['status'], string> = { Normal: 'green', Baixo: 'orange', 'Crítico': 'red' }

export function EstoqueMateriaPrimaTab() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | EstoqueMateriaPrima['status']>('all')
  const [detailRow, setDetailRow] = useState<EstoqueMateriaPrima | null>(null)

  const debouncedSearch = useDebouncedValue(search)
  const { data: rows = [], isLoading } = useQuery({ queryKey: queryKeys.estoqueMateriaPrima(), queryFn: getEstoqueMateriaPrima })

  const filtered = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase()
    return rows.filter((r) => {
      const text =
        !q ||
        r.material.toLowerCase().includes(q) ||
        r.id.toLowerCase().includes(q) ||
        detTxt(r, 'obs').toLowerCase().includes(q) ||
        detTxt(r, 'grupo').toLowerCase().includes(q)
      const st = statusFilter === 'all' || r.status === statusFilter
      return text && st
    })
  }, [debouncedSearch, rows, statusFilter])

  const totals = useMemo(() => {
    const custoTotal = filtered.reduce((s, r) => s + r.custoTotal, 0)
    const itensTotal = filtered.length
    const comEstoque = filtered.filter((r) => r.qtdeAtual > 0).length
    const semEstoque = filtered.filter((r) => r.qtdeAtual <= 0).length
    const criticos = filtered.filter((r) => r.status === 'Crítico').length
    const baixos = filtered.filter((r) => r.status === 'Baixo').length
    const normais = filtered.filter((r) => r.status === 'Normal').length
    return { custoTotal, itensTotal, comEstoque, semEstoque, criticos, baixos, normais }
  }, [filtered])

  const chartData = useMemo(() => [
    { status: 'Normal', count: totals.normais },
    { status: 'Baixo', count: totals.baixos },
    { status: 'Crítico', count: totals.criticos },
  ], [totals])

  const columns: ColumnsType<EstoqueMateriaPrima> = [
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
      title: 'Material / Insumo',
      key: 'material',
      fixed: 'left',
      ellipsis: true,
      render: (_: unknown, r) => {
        const obs = detTxt(r, 'obs')
        const grupo = detTxt(r, 'grupo')
        return (
          <Space direction="vertical" size={0}>
            <Typography.Text strong>{r.material}</Typography.Text>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {[grupo, obs].filter(Boolean).join(' · ') || `Cód ${r.id}`}
            </Typography.Text>
          </Space>
        )
      },
      sorter: (a, b) => a.material.localeCompare(b.material, 'pt-BR'),
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
      render: (v: number, r) => {
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
      render: (_: unknown, r) => fmtDate(det(r, 'dataultimacompra')),
      sorter: (a, b) => {
        const da = detTxt(a, 'dataultimacompra') || '0'
        const db = detTxt(b, 'dataultimacompra') || '0'
        return da.localeCompare(db)
      },
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      sorter: (a, b) => {
        const w: Record<EstoqueMateriaPrima['status'], number> = { 'Crítico': 0, Baixo: 1, Normal: 2 }
        return w[a.status] - w[b.status]
      },
      render: (v: EstoqueMateriaPrima['status']) => <Tag color={statusColor[v]}>{v}</Tag>,
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
          <EstoqueStatusChart data={chartData} label="Matéria-prima e insumos por status" />
        </Suspense>
      </Card>

      <Card className="app-card no-hover" variant="borderless" title="Filtros"
        extra={
          <Dropdown menu={{ items: [
            { key: 'excel', icon: <FileExcelOutlined />, label: 'Excel', onClick: () => exportExcel(filtered, estoqueMateriaPrimaCols, 'Matéria Prima', 'estoque_mp') },
            { key: 'pdf', icon: <FilePdfOutlined />, label: 'PDF', onClick: () => exportPdf(filtered, estoqueMateriaPrimaCols, 'Relatório — Estoque de Matéria-Prima', 'estoque_mp') },
          ] }}>
            <Button icon={<DownloadOutlined />}>Exportar</Button>
          </Dropdown>
        }
      >
        <div className="filter-bar">
          <div className="filter-item"><span>Busca</span><Input.Search allowClear placeholder="Nome, grupo ou observação" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
          <div className="filter-item"><span>Status</span><Select value={statusFilter} style={{ width: 180 }} onChange={setStatusFilter} options={[{ value: 'all', label: 'Todos' }, { value: 'Normal', label: 'Normal' }, { value: 'Baixo', label: 'Baixo' }, { value: 'Crítico', label: 'Crítico' }]} /></div>
        </div>
      </Card>

      <Card className="app-card quantum-table" variant="borderless" title={`Matéria-Prima e Insumos — ${filtered.length} itens`}>
        {filtered.length === 0 ? (
          <Empty description="Nenhum item encontrado." />
        ) : (
          <Table
            rowKey="id"
            columns={columns}
            dataSource={filtered}
            pagination={{ pageSize: 15, showSizeChanger: true }}
            scroll={{ x: 900 }}
            aria-label="Estoque de matéria-prima"
          />
        )}
      </Card>

      <EstoqueDetailDrawer
        open={detailRow != null}
        onClose={() => setDetailRow(null)}
        title={detailRow ? detailRow.material : 'Detalhes'}
        detalhes={detailRow?.detalhes as Record<string, unknown> | undefined}
      />
    </Space>
  )
}
