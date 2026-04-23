import { RangePickerBR } from '../components/DatePickerPtBR'
import {
  Alert,
  Button,
  Card,
  Col,
  DatePicker,
  Input,
  Row,
  Select,
  Skeleton,
  Space,
  Tag,
  Tabs,
  Typography,
} from 'antd'
import {
  CreditCardOutlined,
  CrownFilled,
  DollarOutlined,
  FundOutlined,
  RiseOutlined,
} from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { Suspense, lazy, useEffect, useMemo, useState } from 'react'
import { ANALITICO_STALE_MS } from '../api/apiEnv'
import { hasAnySources } from '../services/dataSourceService'
import {
  getVendasAnaliticoDataSourceLabel,
  getVendasAnaliticoQuerySourceKey,
} from '../services/vendasAnaliticoSourceSelection'
import { PageHeaderCard } from '../components/PageHeaderCard'

import { MetricCard } from '../components/MetricCard'
import { getFinanceOverview } from '../services/financeService'
import { queryKeys } from '../query/queryKeys'
import type { FinanceEntry } from '../types/models'
import { pctDelta, shiftRange } from '../utils/dateRange'
import { currentMonthRange } from '../utils/vendasAnaliticoAggregates'
import { usePersistedSearchParams } from '../navigation/usePersistedSearchParams'
import {
  getPersistedFilterState,
  resetPersistedFilterState,
  savePersistedFilterState,
} from '../navigation/uxPreferences'
import { useAuth } from '../auth/AuthContext'
import { FinanceiroSkeleton } from '../components/skeletons/FinanceiroSkeleton'

const FinanceFlowChart = lazy(() =>
  import('./charts/FinanceFlowChart').then((m) => ({ default: m.FinanceFlowChart })),
)

/* ── Lazy-load das abas de relatórios ── */
const SuperavitDeficitTab = lazy(() =>
  import('./finance/SuperavitDeficitTab').then((m) => ({ default: m.SuperavitDeficitTab })),
)
const ContasPagarTab = lazy(() =>
  import('./finance/ContasPagarTab').then((m) => ({ default: m.ContasPagarTab })),
)

function formatBRL(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

const tabFallback = <Skeleton active paragraph={{ rows: 8 }} style={{ padding: 24 }} />

function VisaoGeralTab() {
  const { session } = useAuth()
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<'all' | FinanceEntry['category']>('all')
  const [flowType, setFlowType] = useState<'all' | 'inflow' | 'outflow'>('all')
  const [range, setRange] = useState<[string, string] | null>(null)

  const defaultFinanceRange = useMemo(() => currentMonthRange(), [])
  const financeFilterStorageKey = 'finance.visao-geral.filters'

  useEffect(() => {
    const persisted = getPersistedFilterState(
      session,
      financeFilterStorageKey,
      1000 * 60 * 60 * 24 * 7,
    )
    if (!persisted) return
    try {
      const parsed = JSON.parse(persisted) as {
        search?: string
        category?: 'all' | FinanceEntry['category']
        flowType?: 'all' | 'inflow' | 'outflow'
        range?: [string, string] | null
      }
      if (typeof parsed.search === 'string') setSearch(parsed.search)
      if (parsed.category) setCategory(parsed.category)
      if (parsed.flowType) setFlowType(parsed.flowType)
      if (Array.isArray(parsed.range) && parsed.range.length === 2) setRange(parsed.range)
    } catch {
      // Ignora payload inválido e segue com filtros padrão.
    }
  }, [session])

  useEffect(() => {
    savePersistedFilterState(
      session,
      financeFilterStorageKey,
      JSON.stringify({ search, category, flowType, range }),
    )
  }, [category, flowType, range, search, session])
  const sourceKey = getVendasAnaliticoQuerySourceKey()
  const effectiveFinanceRange: [string, string] = range ?? [
    defaultFinanceRange.dtDe,
    defaultFinanceRange.dtAte,
  ]

  const financeQuery = useQuery({
    queryKey: hasAnySources()
      ? queryKeys.finance({ dtDe: effectiveFinanceRange[0], dtAte: effectiveFinanceRange[1], sourceId: sourceKey })
      : queryKeys.finance(),
    queryFn: () =>
      hasAnySources()
        ? getFinanceOverview({ dtDe: effectiveFinanceRange[0], dtAte: effectiveFinanceRange[1] })
        : getFinanceOverview(),
    staleTime: hasAnySources() ? ANALITICO_STALE_MS : undefined,
  })

  const data = financeQuery.data
  const entries = useMemo(() => data?.entries ?? [], [data?.entries])

  const filteredEntries = useMemo(() => {
    const query = search.trim().toLowerCase()
    const [start, end] = range ?? ['', '']
    return entries
      .filter((e) => {
        const textMatch =
          !query || e.id.toLowerCase().includes(query) || e.description.toLowerCase().includes(query)
        if (hasAnySources()) {
          return textMatch
        }
        const catMatch = category === 'all' || e.category === category
        const flowMatch =
          flowType === 'all' || (flowType === 'inflow' ? e.amount >= 0 : e.amount < 0)
        const dateMatch =
          (!start || dayjs(e.date).isSame(start, 'day') || dayjs(e.date).isAfter(start, 'day')) &&
          (!end || dayjs(e.date).isSame(end, 'day') || dayjs(e.date).isBefore(end, 'day'))
        return textMatch && catMatch && flowMatch && dateMatch
      })
      .slice()
      .sort((a, b) => dayjs(b.date).valueOf() - dayjs(a.date).valueOf())
  }, [entries, search, category, flowType, range])

  /** Com SGBR, período já veio na API; busca refiltra linhas — KPIs acompanham o subconjunto (inclui 0 resultados). */
  const kpiFromFilter = hasAnySources() && search.trim().length > 0

  const kpiReceita = useMemo(() => {
    if (!kpiFromFilter) return null
    return filteredEntries.filter((e) => e.amount >= 0).reduce((s, e) => s + e.amount, 0)
  }, [kpiFromFilter, filteredEntries])

  const kpiCustos = useMemo(() => {
    if (!kpiFromFilter) return null
    return filteredEntries.reduce((s, e) => s + (e.linhaCusto ?? 0), 0)
  }, [kpiFromFilter, filteredEntries])

  const kpiLucro =
    kpiReceita != null && kpiCustos != null ? kpiReceita - kpiCustos : null
  const kpiMargemPct =
    kpiReceita != null && kpiCustos != null && kpiLucro != null
      ? kpiReceita > 0
        ? (kpiLucro / kpiReceita) * 100
        : 0
      : null

  const summary = useMemo(() => {
    const receitas = filteredEntries
      .filter((x) => x.amount >= 0)
      .reduce((acc, x) => acc + x.amount, 0)
    const despesas = Math.abs(
      filteredEntries.filter((x) => x.amount < 0).reduce((acc, x) => acc + x.amount, 0),
    )
    const impostos = Math.abs(
      filteredEntries
        .filter((x) => x.category === 'Imposto')
        .reduce((acc, x) => acc + x.amount, 0),
    )
    const fixos = Math.abs(
      filteredEntries
        .filter((x) => x.category === 'Custo Fixo')
        .reduce((acc, x) => acc + x.amount, 0),
    )
    const variaveis = Math.abs(
      filteredEntries
        .filter((x) => x.category === 'Custo Variável')
        .reduce((acc, x) => acc + x.amount, 0),
    )
    const saldo = receitas - despesas
    const margem = receitas > 0 ? (saldo / receitas) * 100 : 0
    const ticketMedioReceita = filteredEntries.filter((x) => x.amount >= 0).length
      ? receitas / filteredEntries.filter((x) => x.amount >= 0).length
      : 0
    return { receitas, despesas, saldo, margem, ticketMedioReceita, impostos, fixos, variaveis }
  }, [filteredEntries])
  const previousSummary = useMemo(() => {
    if (hasAnySources()) return null
    const shifted = shiftRange(range?.[0], range?.[1])
    if (!shifted) return null
    const prev = entries.filter((e) => {
      const d = dayjs(e.date)
      return (
        d.isSame(shifted.prevStart, 'day') ||
        d.isSame(shifted.prevEnd, 'day') ||
        (d.isAfter(shifted.prevStart, 'day') && d.isBefore(shifted.prevEnd, 'day'))
      )
    })
    const receitas = prev.filter((x) => x.amount >= 0).reduce((acc, x) => acc + x.amount, 0)
    const despesas = Math.abs(prev.filter((x) => x.amount < 0).reduce((acc, x) => acc + x.amount, 0))
    const saldo = receitas - despesas
    const margem = receitas > 0 ? (saldo / receitas) * 100 : 0
    return { receitas, despesas, saldo, margem }
  }, [entries, range])

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      {(financeQuery.isLoading || financeQuery.isFetching) && (
        <Card className="app-card no-hover" variant="borderless">
          <FinanceiroSkeleton />
        </Card>
      )}

      {hasAnySources() && data?.analiticoFetchMeta?.truncated ? (
        <Alert
          type="warning"
          showIcon
          banner
          message={
            <Typography.Text strong>
              Dados do analítico podem estar incompletos — {data.analiticoFetchMeta.rowCount} linhas em{' '}
              {data.analiticoFetchMeta.pagesFetched} página(s)
            </Typography.Text>
          }
          description={
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              O proxy truncou o retorno. Confira <code>PROXY_DATA_AUTO_PAGINATE</code> e{' '}
              <code>PROXY_DATA_MAX_AUTO_PAGES</code> no backend — sem todas as páginas, a receita fica
              abaixo do relatório oficial.
            </Typography.Text>
          }
          style={{ borderRadius: 12 }}
        />
      ) : null}

      <Card className="app-card no-hover" variant="borderless" title="Filtros">
        <div className="filter-bar">
          <div className="filter-item">
            <span>Buscar</span>
            <Input.Search
              allowClear
              placeholder="Descrição ou ID"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {!hasAnySources() ? (
            <>
              <div className="filter-item">
                <span>Categoria</span>
                <Select
                  value={category}
                  style={{ width: 200 }}
                  onChange={setCategory}
                  options={[
                    { value: 'all', label: 'Todas' },
                    { value: 'Receita', label: 'Receita' },
                    { value: 'Custo Fixo', label: 'Custo Fixo' },
                    { value: 'Custo Variável', label: 'Custo Variável' },
                    { value: 'Imposto', label: 'Imposto' },
                  ]}
                />
              </div>
              <div className="filter-item">
                <span>Fluxo</span>
                <Select
                  value={flowType}
                  style={{ width: 190 }}
                  onChange={setFlowType}
                  options={[
                    { value: 'all', label: 'Entradas e saídas' },
                    { value: 'inflow', label: 'Somente entradas' },
                    { value: 'outflow', label: 'Somente saídas' },
                  ]}
                />
              </div>
            </>
          ) : null}
          <div className="filter-item">
            <span>Período</span>
            <RangePickerBR
              format="DD/MM/YYYY"
              placeholder={['Data inicial', 'Data final']}
              value={[dayjs(effectiveFinanceRange[0]), dayjs(effectiveFinanceRange[1])]}
              onChange={(vals) => {
                if (!vals || !vals[0] || !vals[1]) {
                  setRange(null)
                  return
                }
                setRange([vals[0].format('YYYY-MM-DD'), vals[1].format('YYYY-MM-DD')])
              }}
            />
          </div>
          <div className="filter-item">
            <span>&nbsp;</span>
            <Button
              onClick={() => {
                setSearch('')
                setCategory('all')
                setFlowType('all')
                setRange(null)
                resetPersistedFilterState(session, financeFilterStorageKey)
              }}
            >
              Limpar filtros salvos
            </Button>
          </div>
        </div>
        {hasAnySources() && (
          <Typography.Paragraph type="secondary" style={{ marginTop: 12, marginBottom: 0, maxWidth: 720 }}>
            A <strong>receita</strong> usa, por pedido/DAV identificado nos dados, o maior valor entre a soma das
            linhas e o campo <code>totalprodutos</code> (total do pedido no SGBr), para se aproximar do total líquido
            do relatório. Ainda assim, o filtro <code>dt_de</code>/<code>dt_ate</code> do BI pode usar outra data
            que a &quot;data do pedido&quot; do PDF. Para comparar com a listagem oficial, prefira a fonte{' '}
            <code>vendas/analitico</code> e o mesmo critério de data no SGBr.
          </Typography.Paragraph>
        )}
      </Card>

      {/* ── Linha 1: Hero — Receita + Lucro destacados ── */}
      <Row gutter={[16, 16]}>
        <Col xs={24} md={12}>
          <MetricCard
            hero
            title="Receita"
            value={formatBRL(kpiReceita ?? data?.receita ?? summary.receitas)}
            accentColor="#10B981"
            previousValue={previousSummary ? formatBRL(previousSummary.receitas) : undefined}
            deltaPct={previousSummary ? pctDelta(summary.receitas, previousSummary.receitas) : undefined}
          />
        </Col>
        <Col xs={24} md={12}>
          <MetricCard
            hero
            title="Lucro bruto"
            value={formatBRL(kpiLucro ?? data?.lucro ?? summary.saldo)}
            accentColor={(kpiLucro ?? data?.lucro ?? summary.saldo) >= 0 ? '#10B981' : '#F43F5E'}
            previousValue={previousSummary ? formatBRL(previousSummary.saldo) : undefined}
            deltaPct={previousSummary ? pctDelta(summary.saldo, previousSummary.saldo) : undefined}
          />
        </Col>
      </Row>

      {/* ── Linha 2: Secundários — Custos, Margem, Ticket ── */}
      <Row gutter={[12, 12]}>
        <Col xs={24} sm={8}>
          <MetricCard
            title="Custos"
            value={formatBRL(kpiCustos ?? data?.custos ?? summary.despesas)}
            accentColor="#F43F5E"
            previousValue={previousSummary ? formatBRL(previousSummary.despesas) : undefined}
            deltaPct={previousSummary ? pctDelta(summary.despesas, previousSummary.despesas) : undefined}
          />
        </Col>
        <Col xs={12} sm={8}>
          <MetricCard
            title="Margem"
            value={`${(kpiMargemPct ?? data?.margemPct ?? summary.margem).toFixed(1)}%`}
            accentColor="#3B82F6"
            previousValue={previousSummary ? `${previousSummary.margem.toFixed(1)}%` : undefined}
            deltaPct={previousSummary ? summary.margem - previousSummary.margem : undefined}
          />
        </Col>
        <Col xs={12} sm={8}>
          <MetricCard
            title={hasAnySources() ? 'Ticket médio (por linha)' : 'Ticket medio'}
            description={
              hasAnySources()
                ? 'Receita ÷ linhas analíticas. Para ticket por pedido, agregue pedidos no SGBr.'
                : undefined
            }
            accentColor="#8B5CF6"
            value={formatBRL(
              (() => {
                const n = kpiFromFilter ? filteredEntries.length : (data?.linhasCount ?? 0)
                const rec = kpiReceita ?? data?.receita ?? 0
                return n > 0 ? rec / n : 0
              })(),
            )}
          />
        </Col>
      </Row>

      {/* ── Linha 3: Meta-informações compactas ── */}
      {data?.linhasCount != null && (
        <Card className="app-card no-hover" variant="borderless" style={{ padding: 0 }}>
          <Row gutter={[16, 12]} style={{ padding: '4px 8px' }}>
            <Col xs={12} sm={8}>
              <div style={{ padding: '8px 8px' }}>
                <Typography.Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {hasAnySources() ? 'Linhas analíticas' : 'Registros'}
                </Typography.Text>
                <div style={{ fontSize: 20, fontWeight: 700, marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>
                  {kpiFromFilter ? filteredEntries.length : data.linhasCount}
                </div>
              </div>
            </Col>
            <Col xs={12} sm={8}>
              <div style={{ padding: '8px 8px' }}>
                <Typography.Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {hasAnySources() ? 'Custo médio / linha' : 'Custo médio'}
                </Typography.Text>
                <div style={{ fontSize: 20, fontWeight: 700, marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>
                  {formatBRL(
                    (() => {
                      const n = kpiFromFilter ? filteredEntries.length : (data?.linhasCount ?? 0)
                      const c = kpiCustos ?? data?.custos ?? 0
                      return n > 0 ? c / n : 0
                    })(),
                  )}
                </div>
              </div>
            </Col>
            <Col xs={24} sm={8}>
              <div style={{ padding: '8px 8px' }}>
                <Typography.Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Período
                </Typography.Text>
                <div style={{ fontSize: 14, fontWeight: 600, marginTop: 2 }}>
                  {dayjs(effectiveFinanceRange[0]).format('DD/MM/YYYY')}
                  <Typography.Text type="secondary" style={{ margin: '0 6px' }}>→</Typography.Text>
                  {dayjs(effectiveFinanceRange[1]).format('DD/MM/YYYY')}
                </div>
              </div>
            </Col>
          </Row>
        </Card>
      )}

      {/* ── Fluxo mensal ── */}
      <Card
        className="app-card no-hover"
        variant="borderless"
        title={
          <div>
            <div>Fluxo mensal</div>
            <Typography.Text type="secondary" style={{ fontSize: 12, fontWeight: 400 }}>
              Receita, custos e lucro agrupados por mês do período selecionado
            </Typography.Text>
          </div>
        }
      >
        <Suspense fallback={<Skeleton active paragraph={{ rows: 6 }} />}>
          <FinanceFlowChart data={data?.monthlyFlow ?? []} />
        </Suspense>
      </Card>

    </Space>
  )
}

export function FinancePage() {
  const { searchParams, setSearchParams, resetPersistedState } = usePersistedSearchParams({
    storageKey: 'finance.tabs',
    ttlMs: 1000 * 60 * 60 * 24 * 14,
  })
  const activeTab = searchParams.get('tab') ?? 'visao-geral'
  const sourceLabel = getVendasAnaliticoDataSourceLabel()

  const handleTabChange = (key: string) => {
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev)
      p.set('tab', key)
      return p
    }, { replace: true })
  }

  const tabItems = [
    {
      key: 'visao-geral',
      label: (
        <span className="finance-tab-title finance-tab-title--geral">
          <FundOutlined /> Visão Geral
        </span>
      ),
      premium: false,
      children: (
        <Suspense fallback={tabFallback}>
          <VisaoGeralTab />
        </Suspense>
      ),
    },
    {
      /** Antes: "Conciliação" — pediram pra trocar pelo conceito Superávit/Déficit
       *  (resultado positivo/negativo do período = receitas - despesas). */
      key: 'superavit-deficit',
      label: (
        <span className="finance-tab-title finance-tab-title--deficit">
          <RiseOutlined /> Superávit / Déficit
        </span>
      ),
      premium: false,
      children: (
        <Suspense fallback={tabFallback}>
          <SuperavitDeficitTab />
        </Suspense>
      ),
    },
    {
      /** Antes: "Contas a Pagar" — pediram pra renomear pra "Contas Pagas" e
       *  destacar como tab premium (ícone de coroa + acento dourado). */
      key: 'contas-pagas',
      label: (
        <span className="finance-tab-title finance-tab-title--premium">
          <CreditCardOutlined /> Contas Pagas
        </span>
      ),
      premium: true,
      children: (
        <Suspense fallback={tabFallback}>
          <ContasPagarTab />
        </Suspense>
      ),
    },
  ]

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <PageHeaderCard
        title="Financeiro"
        subtitle="Controle financeiro completo: visão geral, superávit/déficit, contas pagas e a receber."
        extra={<Tag color="blue">{sourceLabel}</Tag>}
      />

      <Card className="app-card no-hover" variant="borderless" style={{ padding: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '12px 12px 0 12px' }}>
          <Button size="small" onClick={resetPersistedState}>Resetar aba salva</Button>
        </div>
        <Tabs
          className="finance-tabs"
          activeKey={activeTab}
          onChange={handleTabChange}
          type="card"
          size="large"
          items={tabItems.map(({ premium, label, ...item }) => ({
            ...item,
            label: (
              <span style={premium ? { fontWeight: 600 } : undefined}>
                {label}
                {premium ? (
                  <CrownFilled style={{ marginLeft: 6, color: '#D4A017', fontSize: 12 }} aria-label="Premium" />
                ) : null}
              </span>
            ),
          }))}
        />
      </Card>
    </Space>
  )
}
