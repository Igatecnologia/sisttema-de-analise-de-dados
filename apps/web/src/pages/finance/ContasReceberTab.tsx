import { Alert, Button, Card, Col, Dropdown, Input, Row, Select, Space, Table, Tag, Typography } from 'antd'
import { DownloadOutlined, FileExcelOutlined, FilePdfOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { Suspense, lazy, useMemo, useState } from 'react'
import { Skeleton } from 'antd'
import { useQuery } from '@tanstack/react-query'
import { MetricCard } from '../../components/MetricCard'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import type { ContaReceber } from '../../types/models'
import { getContasReceber } from '../../services/financeReportsService'
import { queryKeys } from '../../query/queryKeys'
import { exportExcel, exportPdf, contasReceberCols } from '../../utils/financeExport'

const ContasStatusChart = lazy(() =>
  import('../charts/ContasStatusChart').then((m) => ({ default: m.ContasStatusChart })),
)

function formatBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

const statusColor: Record<ContaReceber['status'], string> = { Recebido: 'green', 'A vencer': 'blue', Vencido: 'red' }

export function ContasReceberTab() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | ContaReceber['status']>('all')

  const debouncedSearch = useDebouncedValue(search)
  const { data: rows = [], isLoading, isError, error, refetch } = useQuery({ queryKey: queryKeys.contasReceber(), queryFn: getContasReceber })

  const filtered = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase()
    return rows
      .filter((r) => {
        const text = !q || r.cliente.toLowerCase().includes(q) || r.descricao.toLowerCase().includes(q) || r.id.toLowerCase().includes(q)
        const st = statusFilter === 'all' || r.status === statusFilter
        return text && st
      })
      .sort((a, b) => dayjs(a.dataVencimento).valueOf() - dayjs(b.dataVencimento).valueOf())
  }, [debouncedSearch, rows, statusFilter])

  const totals = useMemo(() => {
    const total = filtered.reduce((s, r) => s + r.valor, 0)
    const recebido = filtered.filter((r) => r.status === 'Recebido').reduce((s, r) => s + r.valor, 0)
    const aVencer = filtered.filter((r) => r.status === 'A vencer').reduce((s, r) => s + r.valor, 0)
    const vencido = filtered.filter((r) => r.status === 'Vencido').reduce((s, r) => s + r.valor, 0)
    return { total, recebido, aVencer, vencido }
  }, [filtered])

  const chartData = useMemo(() => [
    { status: 'Recebido', valor: totals.recebido },
    { status: 'A vencer', valor: totals.aVencer },
    { status: 'Vencido', valor: totals.vencido },
  ].filter((d) => d.valor > 0), [totals])

  const columns: ColumnsType<ContaReceber> = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 90 },
    { title: 'Cliente', dataIndex: 'cliente', key: 'cliente', ellipsis: true },
    { title: 'Descrição', dataIndex: 'descricao', key: 'descricao', ellipsis: true },
    { title: 'Valor', dataIndex: 'valor', key: 'valor', align: 'right', width: 130, render: (v: number) => <Typography.Text strong>{formatBRL(v)}</Typography.Text>, sorter: (a, b) => a.valor - b.valor },
    { title: 'Emissão', dataIndex: 'dataEmissao', key: 'dataEmissao', width: 120, render: (v: string) => dayjs(v).format('DD/MM/YYYY') },
    { title: 'Vencimento', dataIndex: 'dataVencimento', key: 'dataVencimento', width: 120, render: (v: string) => dayjs(v).format('DD/MM/YYYY'), sorter: (a, b) => dayjs(a.dataVencimento).valueOf() - dayjs(b.dataVencimento).valueOf() },
    { title: 'Recebimento', dataIndex: 'dataRecebimento', key: 'dataRecebimento', width: 130, render: (v: string | null) => (v ? dayjs(v).format('DD/MM/YYYY') : '—') },
    { title: 'Status', dataIndex: 'status', key: 'status', width: 110, render: (v: ContaReceber['status']) => <Tag color={statusColor[v]}>{v}</Tag> },
  ]

  if (isLoading) return <Card className="app-card" variant="borderless"><Skeleton active paragraph={{ rows: 10 }} /></Card>

  if (isError) {
    return (
      <Alert
        type="error"
        showIcon
        message="Não foi possível carregar contas a receber"
        description={error instanceof Error ? error.message : 'Tente novamente em instantes.'}
        action={<Button size="small" onClick={() => refetch()}>Tentar de novo</Button>}
      />
    )
  }

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}><MetricCard title="Total a Receber" value={formatBRL(totals.total)} hero /></Col>
        <Col xs={24} sm={12} lg={6}><MetricCard title="Recebido" value={formatBRL(totals.recebido)} /></Col>
        <Col xs={24} sm={12} lg={6}><MetricCard title="A Vencer" value={formatBRL(totals.aVencer)} /></Col>
        <Col xs={24} sm={12} lg={6}><MetricCard title="Vencido" value={formatBRL(totals.vencido)} /></Col>
      </Row>

      <Card className="app-card no-hover" variant="borderless" title="Distribuição por Status">
        <Suspense fallback={<Skeleton active paragraph={{ rows: 4 }} />}>
          <ContasStatusChart data={chartData} label="Contas a receber por status" />
        </Suspense>
      </Card>

      <Card className="app-card no-hover" variant="borderless" title="Filtros"
        extra={
          <Dropdown menu={{ items: [
            { key: 'excel', icon: <FileExcelOutlined />, label: 'Excel', onClick: () => exportExcel(filtered, contasReceberCols, 'Contas a Receber', 'contas_receber') },
            { key: 'pdf', icon: <FilePdfOutlined />, label: 'PDF', onClick: () => exportPdf(filtered, contasReceberCols, 'Relatório — Contas a Receber', 'contas_receber') },
          ] }}>
            <Button icon={<DownloadOutlined />}>Exportar</Button>
          </Dropdown>
        }
      >
        <div className="filter-bar">
          <div className="filter-item"><span>Busca</span><Input.Search allowClear placeholder="Cliente, descrição ou ID" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
          <div className="filter-item"><span>Status</span><Select value={statusFilter} style={{ width: 180 }} onChange={setStatusFilter} options={[{ value: 'all', label: 'Todos' }, { value: 'Recebido', label: 'Recebido' }, { value: 'A vencer', label: 'A vencer' }, { value: 'Vencido', label: 'Vencido' }]} /></div>
        </div>
      </Card>

      <Card className="app-card quantum-table" variant="borderless" title="Contas a Receber">
        <Table rowKey="id" columns={columns} dataSource={filtered} pagination={{ pageSize: 10, showSizeChanger: true }} scroll={{ x: 900 }} aria-label="Tabela de contas a receber" />
      </Card>
    </Space>
  )
}
