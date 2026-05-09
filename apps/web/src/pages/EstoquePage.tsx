import { Card, Skeleton, Space, Tabs } from 'antd'
import { Boxes, Layers, Package, Wrench } from 'lucide-react'
import { Suspense, lazy } from 'react'
import { useSearchParams } from 'react-router-dom'
import { PageHeaderCard } from '../components/PageHeaderCard'
import { useTenant } from '../tenant/TenantContext'

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
  const tenant = useTenant()
  const labels = tenant.connector?.labels
  const productLabel = labels?.product ?? 'Produto'
  const rawMaterialLabel = labels?.rawMaterial ?? 'Matéria-prima'
  const finishedLabel = labels?.finishedProduct ?? 'Produto final'
  /** Tenant industrial mostra a aba intermediária (produto base); demais segmentos só veem matéria-prima e produto final. */
  const showIntermediateTab = tenant.segment === 'industry'

  const handleTabChange = (key: string) => {
    setSearchParams({ tab: key }, { replace: true })
  }

  const labelWith = (icon: React.ReactNode, text: string) => (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      {icon}
      {text}
    </span>
  )

  const tabItems = [
    {
      key: 'materia-prima',
      label: labelWith(<Package size={14} />, rawMaterialLabel),
      children: (
        <Suspense fallback={tabFallback}>
          <EstoqueMateriaPrimaTab />
        </Suspense>
      ),
    },
    ...(showIntermediateTab
      ? [{
          key: 'produto-base',
          label: labelWith(<Wrench size={14} />, `${productLabel} base`),
          children: (
            <Suspense fallback={tabFallback}>
              <EstoqueEspumaTab />
            </Suspense>
          ),
        }]
      : []),
    {
      key: 'produto-final',
      label: labelWith(<Layers size={14} />, finishedLabel),
      children: (
        <Suspense fallback={tabFallback}>
          <EstoqueProdutoFinalTab />
        </Suspense>
      ),
    },
  ]

  const subtitle = showIntermediateTab
    ? `Posição atual de estoque: ${rawMaterialLabel.toLowerCase()}, ${productLabel.toLowerCase()} base e ${finishedLabel.toLowerCase()}.`
    : `Posição atual de estoque: ${rawMaterialLabel.toLowerCase()} e ${finishedLabel.toLowerCase()}.`

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <PageHeaderCard
        title="Estoque"
        subtitle={subtitle}
        icon={<Boxes size={22} />}
        breadcrumbs={[{ label: 'Início', to: '/gestao' }, { label: 'ERP' }, { label: 'Estoque' }]}
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
