import { RangePickerBR } from '../components/DatePickerPtBR'
import { Alert, Card, Col, Empty, Input, Row, Select, Skeleton, Space, Table, Tag, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { PageHeaderCard } from '../components/PageHeaderCard'
import { DatePresetRange } from '../components/DatePresetRange'
import { ANALITICO_STALE_MS } from '../api/apiEnv'
import { hasAnySources } from '../services/dataSourceService'
import {
  getVendasAnaliticoDataSourceLabel,
  getVendasAnaliticoQuerySourceKey,
} from '../services/vendasAnaliticoSourceSelection'
import { getDashboardData } from '../services/dashboardService'
import { queryKeys } from '../query/queryKeys'
import type { DashboardData } from '../types/models'

type LatestRow = DashboardData['latest'][number]

function formatBRL(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function statusTag(status: LatestRow['status']) {
  if (status === 'pago') return <Tag color="green">Pago</Tag>
  if (status === 'pendente') return <Tag color="gold">Pendente</Tag>
  return <Tag color="red">Cancelado</Tag>
}

export function DashboardDataPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const period = (searchParams.get('p') ?? '30d') as '7d' | '30d' | '90d'
  const q = searchParams.get('q') ?? ''
  const groupBy = (searchParams.get('g') ?? 'none') as 'none' | 'status' | 'month'
  const start = searchParams.get('start') ?? ''
  const end = searchParams.get('end') ?? ''
  const sourceKey = getVendasAnaliticoQuerySourceKey()
  const sourceLabel = getVendasAnaliticoDataSourceLabel()
  const [statusFilter, setStatusFilter] = useState<'all' | LatestRow['status']>('all')

  const dashboardQuery = useQuery({
    queryKey: queryKeys.dashboard({ period, sourceId: sourceKey }),
    queryFn: () => getDashboardData({ period }),
    staleTime: hasAnySources() ? ANALITICO_STALE_MS : undefined,
  })

  const rows = useMemo(() => {
    const data = dashboardQuery.data?.latest ?? []
    const query = q.trim().toLowerCase()
    const base = data.filter((row) => {
      const matchQ =
        !query ||
        row.id.toLowerCase().includes(query) ||
        row.cliente.toLowerCase().includes(query)
      const matchStatus = statusFilter === 'all' || row.status === statusFilter
      const matchDate =
        (!start || dayjs(row.data).isSame(start, 'day') || dayjs(row.data).isAfter(start, 'day')) &&
        (!end || dayjs(row.data).isSame(end, 'day') || dayjs(row.data).isBefore(end, 'day'))
      return matchQ && matchStatus && matchDate
    })

    if (groupBy === 'none') return base
    return base.slice().sort((a, b) => {
      if (groupBy === 'status') return a.status.localeCompare(b.status)
      return dayjs(a.data).format('YYYY-MM').localeCompare(dayjs(b.data).format('YYYY-MM'))
    })
  }, [dashboardQuery.data?.latest, groupBy, q, statusFilter, start, end])

  const totals = useMemo(() => {
    const total = rows.reduce((acc, row) => acc + row.total, 0)
    const byStatus = {
      pago: rows.filter((x) => x.status === 'pago').length,
      pendente: rows.filter((x) => x.status === 'pendente').length,
      cancelado: rows.filter((x) => x.status === 'cancelado').length,
    }
    return { total, byStatus }
  }, [rows])

  const columns: ColumnsType<LatestRow> = [
    { title: 'Pedido', dataIndex: 'id', key: 'id', sorter: (a, b) => a.id.localeCompare(b.id) },
    { title: 'Cliente', dataIndex: 'cliente', key: 'cliente', sorter: (a, b) => a.cliente.localeCompare(b.cliente) },
    { title: 'Status', dataIndex: 'status', key: 'status', render: (s) => statusTag(s), sorter: (a, b) => a.status.localeCompare(b.status) },
    { title: 'Total', dataIndex: 'total', key: 'total', align: 'right', render: (v) => formatBRL(v), sorter: (a, b) => a.total - b.total },
    { title: 'Taxa (12%)', key: 'fee', align: 'right', render: (_, row) => formatBRL(row.total * 0.12), sorter: (a, b) => a.total * 0.12 - b.total * 0.12 },
    { title: 'Data', dataIndex: 'data', key: 'data', render: (v) => dayjs(v).format('DD/MM/YYYY'), sorter: (a, b) => dayjs(a.data).valueOf() - dayjs(b.data).valueOf() },
  ]

  return (
    <Space orientation="vertical" size={16} style={{ width: '100%' }}>
      <PageHeaderCard
        title="Dados detalhados"
        subtitle={
          hasAnySources()
            ? 'Resumo de linhas de venda (últimos lançamentos) derivado da API SGBR. Detalhe linha a linha: Vendas analítico.'
            : 'Tabela operacional com ordenação, filtros e totais consolidados.'
        }
        extra={<Tag color="blue">{sourceLabel}</Tag>}
      />

      <Card className="app-card" variant="borderless">
        <Row gutter={[12, 12]}>
          <Col xs={24} md={10}>
            <Input.Search
              aria-label="Buscar pedido ou cliente"
              allowClear
              placeholder="Buscar pedido ou cliente"
              value={q}
              onChange={(e) => {
                const next = e.target.value
                setSearchParams((prev) => {
                  const p = new URLSearchParams(prev)
                  if (next) p.set('q', next)
                  else p.delete('q')
                  return p
                })
              }}
            />
          </Col>
          <Col xs={24} md={7}>
            <Select
              aria-label="Filtrar por status"
              style={{ width: '100%' }}
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { value: 'all', label: 'Todos os status' },
                { value: 'pago', label: 'Pago' },
                { value: 'pendente', label: 'Pendente' },
                { value: 'cancelado', label: 'Cancelado' },
              ]}
            />
          </Col>
          <Col xs={24} md={7}>
            <Select
              aria-label="Agrupar tabela"
              style={{ width: '100%' }}
              value={groupBy}
              onChange={(next) => {
                setSearchParams((prev) => {
                  const p = new URLSearchParams(prev)
                  if (next === 'none') p.delete('g')
                  else p.set('g', next)
                  return p
                })
              }}
              options={[
                { value: 'none', label: 'Sem agrupamento' },
                { value: 'status', label: 'Agrupar por status' },
                { value: 'month', label: 'Agrupar por mês' },
              ]}
            />
          </Col>
          <Col xs={24} md={7}>
            <RangePickerBR
              style={{ width: '100%' }}
              format="DD/MM/YYYY"
              placeholder={['Data inicial', 'Data final']}
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
          </Col>
          <Col xs={24} md={24}>
            <DatePresetRange
              storageKey="date-preset:dashboard-data"
              onApply={(from, to) => {
                setSearchParams((prev) => {
                  const p = new URLSearchParams(prev)
                  p.set('start', from)
                  p.set('end', to)
                  return p
                })
              }}
            />
          </Col>
        </Row>
      </Card>

      {dashboardQuery.isLoading ? (
        <Card className="app-card" variant="borderless">
          <Skeleton active paragraph={{ rows: 8 }} />
        </Card>
      ) : dashboardQuery.isError ? (
        <Alert
          type="error"
          showIcon
          message="Nao foi possivel carregar os dados"
          description="Verifique sua conexao e tente novamente."
          action={<button onClick={() => dashboardQuery.refetch()}>Tentar novamente</button>}
        />
      ) : !rows.length ? (
        <Card className="app-card" variant="borderless">
          <Empty description="Nenhum registro encontrado para os filtros aplicados" />
        </Card>
      ) : (
        <Card className="app-card quantum-table" variant="borderless" title="Pedidos">
          <Space wrap style={{ marginBottom: 12 }}>
            <Tag color="blue">Total: {formatBRL(totals.total)}</Tag>
            <Tag color="green">Pagos: {totals.byStatus.pago}</Tag>
            <Tag color="gold">Pendentes: {totals.byStatus.pendente}</Tag>
            <Tag color="red">Cancelados: {totals.byStatus.cancelado}</Tag>
          </Space>
          <Table
            aria-label="Tabela de pedidos detalhados"
            rowKey="id"
            columns={columns}
            dataSource={rows}
            pagination={{ pageSize: 10, showSizeChanger: false }}
          />
        </Card>
      )}

      <Typography.Text type="secondary">
        Essa tela foi criada para visualização operacional limpa, separada das análises avançadas.
      </Typography.Text>
    </Space>
  )
}
