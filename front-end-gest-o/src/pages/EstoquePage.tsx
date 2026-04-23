import { Card, Skeleton, Space, Tabs } from 'antd'
import { InboxOutlined, BuildOutlined, AppstoreOutlined } from '@ant-design/icons'
import { Suspense, lazy } from 'react'
import { useSearchParams } from 'react-router-dom'
import { PageHeaderCard } from '../components/PageHeaderCard'

const EstoqueMateriaPrimaTab = lazy(() =>
  import('./finance/EstoqueMateriaPrimaTab').then((m) => ({ default: m.EstoqueMateriaPrimaTab })),
)
const EstoqueEspumaTab = lazy(() =>
  import('./finance/EstoqueEspumaTab').then((m) => ({ default: m.EstoqueEspumaTab })),
)
const EstoqueProdutoFinalTab = lazy(() =>
  import('./finance/EstoqueProdutoFinalTab').then((m) => ({ default: m.EstoqueProdutoFinalTab })),
)

const tabFallback = <Skeleton active paragraph={{ rows: 8 }} style={{ padding: 24 }} />

export function EstoquePage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = searchParams.get('tab') ?? 'materia-prima'

  const handleTabChange = (key: string) => {
    setSearchParams({ tab: key }, { replace: true })
  }

  const tabItems = [
    {
      key: 'materia-prima',
      label: (
        <span>
          <InboxOutlined /> Matéria Prima
        </span>
      ),
      children: (
        <Suspense fallback={tabFallback}>
          <EstoqueMateriaPrimaTab />
        </Suspense>
      ),
    },
    {
      key: 'produto-base',
      label: (
        <span>
          <BuildOutlined /> Produto Base
        </span>
      ),
      children: (
        <Suspense fallback={tabFallback}>
          <EstoqueEspumaTab />
        </Suspense>
      ),
    },
    {
      key: 'produto-final',
      label: (
        <span>
          <AppstoreOutlined /> Produto Final
        </span>
      ),
      children: (
        <Suspense fallback={tabFallback}>
          <EstoqueProdutoFinalTab />
        </Suspense>
      ),
    },
  ]

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <PageHeaderCard
        title="Estoque"
        subtitle="Posição atual de estoque: matéria-prima e insumos, produtos base (espumas e aglomerados) e produto final."
      />

      <Card className="app-card no-hover" variant="borderless" style={{ padding: 0 }}>
        <Tabs
          activeKey={activeTab}
          onChange={handleTabChange}
          type="card"
          size="large"
          items={tabItems}
        />
      </Card>
    </Space>
  )
}
