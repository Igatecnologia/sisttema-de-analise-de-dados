import { RangePickerBR } from '../components/DatePickerPtBR'
import { Alert, Card, DatePicker, Segmented, Skeleton, Space, Tag } from 'antd'
import dayjs from 'dayjs'
import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Suspense, lazy } from 'react'
import { PageHeaderCard } from '../components/PageHeaderCard'
import { ANALITICO_STALE_MS } from '../api/apiEnv'
import { hasAnySources } from '../services/dataSourceService'
import {
  getVendasAnaliticoDataSourceLabel,
  getVendasAnaliticoQuerySourceKey,
} from '../services/vendasAnaliticoSourceSelection'
import { getDashboardData } from '../services/dashboardService'
import { queryKeys } from '../query/queryKeys'
import { getErrorMessage } from '../api/httpError'

const DashboardInsightsCharts = lazy(() =>
  import('./charts/DashboardInsightsCharts').then((m) => ({
    default: m.DashboardInsightsCharts,
  })),
)

export function DashboardInsightsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const period = (searchParams.get('p') ?? '90d') as '7d' | '30d' | '90d'
  const startDate = searchParams.get('start') ?? ''
  const endDate = searchParams.get('end') ?? ''
  const sourceKey = getVendasAnaliticoQuerySourceKey()
  const sourceLabel = getVendasAnaliticoDataSourceLabel()

  const dashboardQuery = useQuery({
    queryKey: queryKeys.dashboard({ period, start: startDate, end: endDate, sourceId: sourceKey }),
    queryFn: () => getDashboardData({ period, startDate: startDate || undefined, endDate: endDate || undefined }),
    staleTime: hasAnySources() ? ANALITICO_STALE_MS : undefined,
  })

  const filteredData = useMemo(() => {
    const base = dashboardQuery.data
    if (!base) return null
    if (!startDate && !endDate) return base
    const latest = base.latest.filter((r) => {
      const matchStart = !startDate || dayjs(r.data).isSame(startDate, 'day') || dayjs(r.data).isAfter(startDate, 'day')
      const matchEnd = !endDate || dayjs(r.data).isSame(endDate, 'day') || dayjs(r.data).isBefore(endDate, 'day')
      return matchStart && matchEnd
    })
    return { ...base, latest }
  }, [dashboardQuery.data, startDate, endDate])

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <PageHeaderCard
        title="Análises BI"
        subtitle="Inteligência comercial com gráficos analíticos baseados em dados reais de vendas. Selecione o período para explorar tendências, concentração de clientes e sazonalidade."
        extra={<Tag color="blue">{sourceLabel}</Tag>}
      />

      <Card className="app-card no-hover" variant="borderless">
        <div className="filter-bar">
          <div className="filter-item">
            <span>Período</span>
            <Segmented
              value={period}
              options={[
                { label: '7 dias', value: '7d' },
                { label: '30 dias', value: '30d' },
                { label: '90 dias', value: '90d' },
              ]}
              onChange={(v) => {
                setSearchParams((prev) => {
                  const p = new URLSearchParams(prev)
                  p.set('p', String(v))
                  p.delete('start')
                  p.delete('end')
                  return p
                })
              }}
            />
          </div>
          <div className="filter-item">
            <span>Intervalo personalizado</span>
            <RangePickerBR
              format="DD/MM/YYYY"
              placeholder={['Data inicial', 'Data final']}
              value={startDate && endDate ? [dayjs(startDate), dayjs(endDate)] : undefined}
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
          {filteredData && (
            <div className="filter-item" style={{ alignSelf: 'flex-end' }}>
              <Tag color="blue">{filteredData.latest.length} registros analisados</Tag>
            </div>
          )}
        </div>
      </Card>

      {dashboardQuery.isLoading && (
        <Card className="app-card" variant="borderless">
          <Skeleton active paragraph={{ rows: 12 }} />
        </Card>
      )}

      {dashboardQuery.isError && (
        <Alert
          type="error"
          showIcon
          message="Não foi possível carregar os dados"
          description={getErrorMessage(dashboardQuery.error, 'Erro ao buscar dados para análise.')}
        />
      )}

      {filteredData && (
        <Suspense
          fallback={
            <Card className="app-card" variant="borderless">
              <Skeleton active paragraph={{ rows: 10 }} />
            </Card>
          }
        >
          <DashboardInsightsCharts data={filteredData} />
        </Suspense>
      )}
    </Space>
  )
}
