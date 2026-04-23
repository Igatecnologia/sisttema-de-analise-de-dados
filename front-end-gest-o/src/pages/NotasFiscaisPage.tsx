import {
  Alert,
  Card,
  Col,
  Empty,
  Input,
  Row,
  Skeleton,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
  Button,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { FileTextOutlined, ReloadOutlined } from '@ant-design/icons'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { useMemo, useState } from 'react'
import { MetricCard } from '../components/MetricCard'
import { PageHeaderCard } from '../components/PageHeaderCard'
import { RangePickerBR } from '../components/DatePickerPtBR'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { getFaturamentos, getDefaultFaturamentoDateRange } from '../services/erpService'
import { queryKeys } from '../query/queryKeys'
import { getErrorMessage } from '../api/httpError'
import { formatBRL } from '../utils/formatters'
import { metricColors } from '../theme/colors'
import type { Faturamento } from '../types/models'

export function NotasFiscaisPage() {
  const [range, setRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>(() => [
    dayjs().subtract(30, 'day'),
    dayjs(),
  ])
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search)
  const dtDe = range[0].format('YYYY-MM-DD')
  const dtAte = range[1].format('YYYY-MM-DD')
  const periodoLabel = `${range[0].format('DD/MM/YYYY')} — ${range[1].format('DD/MM/YYYY')}`

  const nfQ = useQuery({
    queryKey: queryKeys.faturamentos({ dtDe, dtAte }),
    queryFn: () => getFaturamentos({ dtDe, dtAte }),
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
    const emitidas = filtered.filter((r) => r.status === 'Emitida').length
    const canceladas = filtered.filter((r) => r.status === 'Cancelada').length
    return { totalNF, count, emitidas, canceladas }
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
      sorter: (a, b) => a.numeroNF.localeCompare(b.numeroNF),
    },
    {
      title: 'Data',
      dataIndex: 'data',
      key: 'data',
      width: 110,
      render: (v: string) => dayjs(v).format('DD/MM/YYYY'),
      sorter: (a, b) => a.data.localeCompare(b.data),
      defaultSortOrder: 'descend',
    },
    {
      title: 'Valor',
      dataIndex: 'valorTotal',
      key: 'total',
      width: 140,
      align: 'right',
      render: (v: number) => (
        <Typography.Text strong style={{ color: 'var(--qc-primary)' }}>
          {formatBRL(v)}
        </Typography.Text>
      ),
      sorter: (a, b) => a.valorTotal - b.valorTotal,
    },
    {
      title: 'Tipo',
      dataIndex: 'tipoDocumento',
      key: 'tipo',
      width: 90,
      render: (v: string) => <Tag>{v}</Tag>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 110,
      render: (v: string) => (
        <Tag color={v === 'Emitida' ? 'green' : v === 'Cancelada' ? 'red' : 'default'}>{v}</Tag>
      ),
      filters: [
        { text: 'Emitida', value: 'Emitida' },
        { text: 'Cancelada', value: 'Cancelada' },
      ],
      onFilter: (val, r) => r.status === val,
    },
  ]

  const presets = useMemo(() => [
    { label: 'Este mês', range: [dayjs().startOf('month'), dayjs()] as [dayjs.Dayjs, dayjs.Dayjs] },
    { label: 'Mês passado', range: [dayjs().subtract(1, 'month').startOf('month'), dayjs().subtract(1, 'month').endOf('month')] as [dayjs.Dayjs, dayjs.Dayjs] },
    { label: '30 dias', range: [dayjs().subtract(30, 'day'), dayjs()] as [dayjs.Dayjs, dayjs.Dayjs] },
    { label: '90 dias', range: [dayjs().subtract(90, 'day'), dayjs()] as [dayjs.Dayjs, dayjs.Dayjs] },
    { label: 'Este ano', range: [dayjs().startOf('year'), dayjs()] as [dayjs.Dayjs, dayjs.Dayjs] },
  ], [])

  return (
    <Space direction="vertical" size={16} style={{ width: '100%', padding: '24px 24px 48px' }}>
      <PageHeaderCard
        title="Notas Fiscais"
        subtitle={`Período: ${periodoLabel}`}
        extra={
          <Tooltip title="Atualizar">
            <Button icon={<ReloadOutlined spin={nfQ.isFetching} />} onClick={() => nfQ.refetch()} />
          </Tooltip>
        }
      />

      <Row gutter={[12, 12]}>
        <Col xs={12} sm={6}>
          <MetricCard
            title="Total NF"
            value={formatBRL(metrics.totalNF)}
            hero
            accentColor={metricColors.revenue}
            loading={nfQ.isLoading}
          />
        </Col>
        <Col xs={12} sm={6}>
          <MetricCard
            title="Notas emitidas"
            value={String(metrics.count)}
            accentColor={metricColors.ticket}
            loading={nfQ.isLoading}
          />
        </Col>
        <Col xs={12} sm={6}>
          <MetricCard
            title="Emitidas"
            value={String(metrics.emitidas)}
            accentColor={metricColors.quantity}
            loading={nfQ.isLoading}
          />
        </Col>
        <Col xs={12} sm={6}>
          <MetricCard
            title="Canceladas"
            value={String(metrics.canceladas)}
            accentColor={metricColors.cost}
            loading={nfQ.isLoading}
          />
        </Col>
      </Row>

      <Card className="app-card no-hover" variant="borderless" title={<Space><FileTextOutlined /> Filtros</Space>}>
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
              <Input.Search allowClear placeholder="Número NF ou cliente..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <div className="filter-item">
              <span>Período</span>
              <RangePickerBR value={range} onChange={(d) => { if (d?.[0] && d[1]) setRange([d[0], d[1]]) }} format="DD/MM/YYYY" allowClear={false} style={{ minWidth: 250 }} />
            </div>
          </div>
        </Space>
      </Card>

      {nfQ.isError && (
        <Alert type="error" showIcon message="Erro ao carregar notas fiscais" description={getErrorMessage(nfQ.error, 'Verifique a fonte de dados.')} />
      )}

      <Card
        className="app-card no-hover quantum-table"
        variant="borderless"
        title={<Space><FileTextOutlined /> <span>Notas Fiscais ({filtered.length})</span></Space>}
        extra={
          filtered.length > 0 ? (
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              Total: <Typography.Text strong style={{ color: 'var(--qc-primary)' }}>{formatBRL(metrics.totalNF)}</Typography.Text>
            </Typography.Text>
          ) : null
        }
      >
        {nfQ.isLoading ? (
          <Skeleton active paragraph={{ rows: 10 }} />
        ) : rows.length === 0 ? (
          <Empty description="Nenhuma nota fiscal encontrada. Verifique se há uma fonte de notas fiscais cadastrada em Fontes de Dados." />
        ) : (
          <Table
            rowKey="id"
            size="small"
            columns={columns}
            dataSource={filtered}
            pagination={{ defaultPageSize: 50, showSizeChanger: true, showTotal: (t, [a, b]) => <Typography.Text type="secondary">{a}–{b} de {t}</Typography.Text> }}
            scroll={{ x: 700 }}
            loading={nfQ.isPlaceholderData}
            style={{ opacity: nfQ.isPlaceholderData ? 0.6 : 1, transition: 'opacity 200ms' }}
            summary={() =>
              filtered.length > 0 ? (
                <Table.Summary fixed>
                  <Table.Summary.Row>
                    <Table.Summary.Cell index={0} align="right"><Typography.Text strong>Total:</Typography.Text></Table.Summary.Cell>
                    <Table.Summary.Cell index={1} />
                    <Table.Summary.Cell index={2} align="right">
                      <Typography.Text strong style={{ color: 'var(--qc-primary)' }}>{formatBRL(metrics.totalNF)}</Typography.Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={3} />
                    <Table.Summary.Cell index={4} />
                  </Table.Summary.Row>
                </Table.Summary>
              ) : undefined
            }
          />
        )}
      </Card>
    </Space>
  )
}
