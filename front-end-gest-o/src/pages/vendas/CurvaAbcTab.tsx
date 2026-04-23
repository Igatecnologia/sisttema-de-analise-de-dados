import { RangePickerBR } from '../../components/DatePickerPtBR'
import {
  Alert,
  Button,
  Card,
  Col,
  DatePicker,
  Empty,
  Row,
  Select,
  Skeleton,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { ReloadOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { Suspense, lazy, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ANALITICO_STALE_MS } from '../../api/apiEnv'
import type { VendaAnaliticaRow } from '../../api/schemas'
import { MetricCard } from '../../components/MetricCard'
import { DevErrorDetail } from '../../components/DevErrorDetail'
import { hasAnySources } from '../../services/dataSourceService'
import { getVendasAnaliticoQuerySourceKey } from '../../services/vendasAnaliticoSourceSelection'
import { getErrorMessage } from '../../api/httpError'
import { queryKeys } from '../../query/queryKeys'
import { getVendasAnalitico } from '../../services/vendasAnaliticoService'
import { formatBRL, formatCompact } from '../../utils/formatters'
import { nowBr } from '../../utils/dayjsBr'
import { lineReceitaRow } from '../../utils/vendasAnaliticoAggregates'

const CurvaAbcChart = lazy(() =>
  import('../charts/CurvaAbcChart').then((m) => ({ default: m.CurvaAbcChart })),
)

type AbcRow = {
  key: string
  codigo: string
  nome: string
  unidade: string
  faturamento: number
  quantidade: number
  ticketMedio: number
  participacaoPct: number
  acumuladoPct: number
  classe: 'A' | 'B' | 'C'
}

type AgrupaPor = 'produto' | 'cliente' | 'vendedor'

function classificaAbc(acumuladoPct: number): 'A' | 'B' | 'C' {
  if (acumuladoPct <= 80) return 'A'
  if (acumuladoPct <= 95) return 'B'
  return 'C'
}

const classeColors: Record<string, string> = { A: 'green', B: 'gold', C: 'red' }

function defaultRange(): { start: string; end: string } {
  const end = nowBr()
  const start = end.subtract(30, 'day')
  return { start: start.format('YYYY-MM-DD'), end: end.format('YYYY-MM-DD') }
}

function buildAbcData(rows: VendaAnaliticaRow[], agrupaPor: AgrupaPor): AbcRow[] {
  const map = new Map<string, { codigo: string; nome: string; unidade: string; faturamento: number; quantidade: number }>()

  for (const r of rows) {
    /* Ignora cancelados */
    const st = r.statuspedido.trim().toUpperCase()
    if (st === 'C' || st === 'X' || st === 'CAN') continue

    const codigo = agrupaPor === 'produto' ? String(r.codprod) : agrupaPor === 'cliente' ? String(r.codcliente) : String(r.codvendedor ?? '')
    const nome = agrupaPor === 'produto' ? r.decprod : agrupaPor === 'cliente' ? String(r.nomecliente) : (r.nomevendedor || 'Sem vendedor')
    const unidade = agrupaPor === 'produto' ? (r.und || '') : ''

    const existing = map.get(codigo)
    const linha = lineReceitaRow(r)
    if (existing) {
      existing.faturamento += linha
      existing.quantidade += r.qtdevendida
    } else {
      map.set(codigo, { codigo, nome, unidade, faturamento: linha, quantidade: r.qtdevendida })
    }
  }

  const sorted = [...map.values()].sort((a, b) => b.faturamento - a.faturamento)
  const totalGeral = sorted.reduce((s, r) => s + r.faturamento, 0)

  let acumulado = 0
  return sorted.map((item) => {
    const participacaoPct = totalGeral > 0 ? (item.faturamento / totalGeral) * 100 : 0
    acumulado += participacaoPct
    const acumuladoPct = Math.min(acumulado, 100)
    return {
      key: item.codigo,
      codigo: item.codigo,
      nome: item.nome,
      unidade: item.unidade,
      faturamento: item.faturamento,
      quantidade: item.quantidade,
      ticketMedio: item.quantidade > 0 ? item.faturamento / item.quantidade : 0,
      participacaoPct,
      acumuladoPct,
      classe: classificaAbc(acumuladoPct),
    }
  })
}

export function CurvaAbcTab() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { start: defStart, end: defEnd } = defaultRange()
  const start = searchParams.get('start') ?? defStart
  const end = searchParams.get('end') ?? defEnd

  const [agrupaPor, setAgrupaPor] = useState<AgrupaPor>('produto')

  const biConfigured = hasAnySources()
  const sourceKey = getVendasAnaliticoQuerySourceKey()

  const query = useQuery({
    queryKey: queryKeys.vendasAnalitico({ dtDe: start, dtAte: end, sourceId: sourceKey }),
    queryFn: async () => (await getVendasAnalitico({ dtDe: start, dtAte: end })).rows,
    enabled: biConfigured,
    staleTime: ANALITICO_STALE_MS,
  })

  const abcData = useMemo(() => {
    return buildAbcData(query.data ?? [], agrupaPor)
  }, [query.data, agrupaPor])

  const metrics = useMemo(() => {
    const classA = abcData.filter((r) => r.classe === 'A')
    const classB = abcData.filter((r) => r.classe === 'B')
    const classC = abcData.filter((r) => r.classe === 'C')
    const totalFat = abcData.reduce((s, r) => s + r.faturamento, 0)
    const fatA = classA.reduce((s, r) => s + r.faturamento, 0)
    const fatB = classB.reduce((s, r) => s + r.faturamento, 0)
    const fatC = classC.reduce((s, r) => s + r.faturamento, 0)
    return {
      total: abcData.length,
      totalFat,
      classA: classA.length,
      classB: classB.length,
      classC: classC.length,
      fatA,
      fatB,
      fatC,
      pctA: totalFat > 0 ? (fatA / totalFat) * 100 : 0,
      pctB: totalFat > 0 ? (fatB / totalFat) * 100 : 0,
      pctC: totalFat > 0 ? (fatC / totalFat) * 100 : 0,
    }
  }, [abcData])

  const chartData = useMemo(
    () =>
      abcData.map((r) => ({
        nome: r.nome.length > 18 ? `${r.nome.slice(0, 16)}…` : r.nome,
        faturamento: r.faturamento,
        acumuladoPct: Number(r.acumuladoPct.toFixed(1)),
        classe: r.classe,
      })),
    [abcData],
  )

  const columns: ColumnsType<AbcRow> = [
    {
      title: '#',
      key: 'rank',
      width: 50,
      align: 'center',
      render: (_v, _r, idx) => idx + 1,
    },
    {
      title: 'Classe',
      dataIndex: 'classe',
      key: 'classe',
      width: 80,
      align: 'center',
      filters: [
        { text: 'A', value: 'A' },
        { text: 'B', value: 'B' },
        { text: 'C', value: 'C' },
      ],
      onFilter: (value, record) => record.classe === value,
      render: (v: string) => (
        <Tag color={classeColors[v]} style={{ fontWeight: 700, minWidth: 28, textAlign: 'center' }}>
          {v}
        </Tag>
      ),
    },
    {
      title: 'Código',
      dataIndex: 'codigo',
      key: 'codigo',
      width: 100,
    },
    {
      title: agrupaPor === 'produto' ? 'Produto' : agrupaPor === 'cliente' ? 'Cliente' : 'Vendedor',
      dataIndex: 'nome',
      key: 'nome',
      ellipsis: true,
    },
    {
      title: 'Faturamento',
      dataIndex: 'faturamento',
      key: 'faturamento',
      width: 150,
      align: 'right',
      sorter: (a, b) => a.faturamento - b.faturamento,
      defaultSortOrder: 'descend',
      render: (v: number) => <Typography.Text strong>{formatBRL(v)}</Typography.Text>,
    },
    {
      title: 'Qtd',
      dataIndex: 'quantidade',
      key: 'quantidade',
      width: 110,
      align: 'right',
      render: (v: number, record) => {
        const formatted = v.toLocaleString('pt-BR')
        return record.unidade ? `${formatted} ${record.unidade}` : formatted
      },
    },
    {
      title: 'Ticket Médio',
      dataIndex: 'ticketMedio',
      key: 'ticketMedio',
      width: 130,
      align: 'right',
      render: (v: number) => formatBRL(v),
    },
    {
      title: '% Part.',
      dataIndex: 'participacaoPct',
      key: 'participacaoPct',
      width: 90,
      align: 'right',
      render: (v: number) => `${v.toFixed(1)}%`,
    },
    {
      title: '% Acum.',
      dataIndex: 'acumuladoPct',
      key: 'acumuladoPct',
      width: 90,
      align: 'right',
      render: (v: number) => `${v.toFixed(1)}%`,
    },
  ]

  if (!biConfigured) {
    return (
      <Alert
        type="warning"
        showIcon
        message="Nenhuma fonte de dados configurada"
        description="Acesse Fontes de Dados para configurar a conexão com a API."
      />
    )
  }

  if (query.isLoading) {
    return <Card className="app-card" variant="borderless"><Skeleton active paragraph={{ rows: 10 }} /></Card>
  }

  if (query.isError) {
    return (
      <Alert
        type="error"
        showIcon
        message="Falha ao carregar dados de vendas"
        description={<>{getErrorMessage(query.error, 'Erro.')}<DevErrorDetail error={query.error} /></>}
        action={<Button size="small" onClick={() => query.refetch()}>Tentar novamente</Button>}
      />
    )
  }

  if (abcData.length === 0) {
    return <Empty description="Nenhum dado para gerar a Curva ABC no período selecionado." />
  }

  const labelItem = agrupaPor === 'produto' ? 'produtos' : agrupaPor === 'cliente' ? 'clientes' : 'vendedores'

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      {/* ── Filtros ── */}
      <Card className="app-card no-hover" variant="borderless" title="Filtros">
        <div className="filter-bar">
          <div className="filter-item">
            <span>Agrupar por</span>
            <Select
              value={agrupaPor}
              style={{ width: 160 }}
              onChange={setAgrupaPor}
              options={[
                { value: 'produto', label: 'Produto' },
                { value: 'cliente', label: 'Cliente' },
                { value: 'vendedor', label: 'Vendedor' },
              ]}
            />
          </div>
          <div className="filter-item">
            <span>Período</span>
            <RangePickerBR
              format="DD/MM/YYYY"
              value={[dayjs(start), dayjs(end)]}
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
          </div>
          <div className="filter-item" style={{ marginLeft: 'auto' }}>
            <Button icon={<ReloadOutlined />} onClick={() => query.refetch()}>
              Atualizar
            </Button>
          </div>
        </div>
      </Card>

      {/* ── KPIs ── */}
      <Row gutter={[12, 12]}>
        <Col xs={12} sm={6}>
          <MetricCard
            title="Faturamento Total"
            value={formatCompact(metrics.totalFat)}
            accentColor="#3B82F6"
          />
        </Col>
        <Col xs={12} sm={6}>
          <MetricCard
            title={`Classe A — ${metrics.classA} ${labelItem}`}
            value={formatCompact(metrics.fatA)}
            accentColor="#10B981"
            subtitle={`${metrics.pctA.toFixed(1)}% do faturamento`}
          />
        </Col>
        <Col xs={12} sm={6}>
          <MetricCard
            title={`Classe B — ${metrics.classB} ${labelItem}`}
            value={formatCompact(metrics.fatB)}
            accentColor="#F59E0B"
            subtitle={`${metrics.pctB.toFixed(1)}% do faturamento`}
          />
        </Col>
        <Col xs={12} sm={6}>
          <MetricCard
            title={`Classe C — ${metrics.classC} ${labelItem}`}
            value={formatCompact(metrics.fatC)}
            accentColor="#F43F5E"
            subtitle={`${metrics.pctC.toFixed(1)}% do faturamento`}
          />
        </Col>
      </Row>

      {/* ── Resumo visual ── */}
      <Card className="app-card no-hover" variant="borderless">
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <Typography.Title level={5} style={{ margin: 0 }}>Distribuição ABC</Typography.Title>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {metrics.classA} {labelItem} classe A ({metrics.pctA.toFixed(0)}% fat.) · {metrics.classB} classe B ({metrics.pctB.toFixed(0)}% fat.) · {metrics.classC} classe C ({metrics.pctC.toFixed(0)}% fat.)
            </Typography.Text>
          </div>
          {/* Barra proporcional */}
          <div style={{ flex: 2, minWidth: 280 }}>
            <div style={{ display: 'flex', borderRadius: 6, overflow: 'hidden', height: 28 }}>
              {metrics.pctA > 0 && (
                <div
                  style={{ width: `${metrics.pctA}%`, background: '#10B981', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 11, fontWeight: 600 }}
                  title={`A: ${metrics.pctA.toFixed(1)}%`}
                >
                  {metrics.pctA >= 8 ? `A ${metrics.pctA.toFixed(0)}%` : ''}
                </div>
              )}
              {metrics.pctB > 0 && (
                <div
                  style={{ width: `${metrics.pctB}%`, background: '#F59E0B', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 11, fontWeight: 600 }}
                  title={`B: ${metrics.pctB.toFixed(1)}%`}
                >
                  {metrics.pctB >= 8 ? `B ${metrics.pctB.toFixed(0)}%` : ''}
                </div>
              )}
              {metrics.pctC > 0 && (
                <div
                  style={{ width: `${metrics.pctC}%`, background: '#F43F5E', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 11, fontWeight: 600 }}
                  title={`C: ${metrics.pctC.toFixed(1)}%`}
                >
                  {metrics.pctC >= 8 ? `C ${metrics.pctC.toFixed(0)}%` : ''}
                </div>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* ── Gráfico ── */}
      <Card className="app-card no-hover" variant="borderless" title="Curva ABC — Faturamento × % Acumulado">
        <Suspense fallback={<Skeleton active paragraph={{ rows: 6 }} />}>
          <CurvaAbcChart data={chartData} />
        </Suspense>
      </Card>

      {/* ── Tabela detalhada ── */}
      <Card className="app-card quantum-table no-hover" variant="borderless" title={`Ranking — ${abcData.length} ${labelItem}`}>
        <Table
          rowKey="key"
          columns={columns}
          dataSource={abcData}
          pagination={{ pageSize: 20, showSizeChanger: true, pageSizeOptions: ['10', '20', '50', '100'] }}
          scroll={{ x: 1000 }}
          size="small"
          aria-label={`Tabela Curva ABC por ${agrupaPor}`}
        />
      </Card>
    </Space>
  )
}
