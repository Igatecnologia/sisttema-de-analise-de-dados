import { DeleteOutlined, EyeOutlined, LinkOutlined } from '@ant-design/icons'
import { App, Button, Card, Empty, Select, Space, Table, Tag, Typography } from 'antd'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { PageHeaderCard } from '../components/PageHeaderCard'
import { deleteViewApi, listSavedViewsApi, type ApiSavedView } from '../services/savedViewsService'
import { createPublicShare } from '../services/publicSharesService'
import { queryKeys } from '../query/queryKeys'

const pageOptions = [
  { value: 'financeiro', label: 'Financeiro', path: '/financeiro' },
  { value: 'relatorios', label: 'Relatorios', path: '/relatorios' },
  { value: 'vendas-analitico', label: 'Vendas', path: '/dashboard/vendas-analitico' },
]

export function SavedViewsPage() {
  const navigate = useNavigate()
  const { message } = App.useApp()
  const queryClient = useQueryClient()
  const [pageKey, setPageKey] = useState(pageOptions[0].value)
  const selectedPage = useMemo(() => pageOptions.find((item) => item.value === pageKey) ?? pageOptions[0], [pageKey])
  const viewsQuery = useQuery({ queryKey: queryKeys.savedViews(pageKey), queryFn: () => listSavedViewsApi(pageKey) })
  const views = viewsQuery.data ?? []
  const deleteMutation = useMutation({
    mutationFn: deleteViewApi,
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: queryKeys.savedViews(pageKey) }),
  })
  const shareMutation = useMutation({
    mutationFn: (view: ApiSavedView) => createPublicShare({
      title: view.name,
      description: `Visao salva de ${selectedPage.label}`,
      payload: { pageKey, path: selectedPage.path, params: view.params },
      expiresAt: null,
    }),
    onSuccess: async (share) => {
      const url = `${window.location.origin}/share/${share.token}`
      await navigator.clipboard?.writeText(url).catch(() => undefined)
      message.success('Link publico criado e copiado.')
      await queryClient.invalidateQueries({ queryKey: queryKeys.publicShares() })
    },
  })

  function remove(id: string) {
    deleteMutation.mutate(id)
  }

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <PageHeaderCard
        title="Visoes salvas"
        subtitle="Filtros e perspectivas reutilizaveis por area do sistema."
        extra={<Select value={pageKey} onChange={setPageKey} options={pageOptions} style={{ width: 220 }} />}
      />
      <Card className="app-card" variant="borderless">
        {views.length ? (
          <Table<ApiSavedView>
            rowKey="id"
            loading={viewsQuery.isLoading}
            dataSource={views}
            pagination={false}
            columns={[
              { title: 'Nome', dataIndex: 'name', render: (value) => <Typography.Text strong>{value}</Typography.Text> },
              { title: 'Area', render: () => <Tag>{selectedPage.label}</Tag> },
              { title: 'Parametros', dataIndex: 'params', render: (value) => <Typography.Text code>{value || 'sem filtros'}</Typography.Text> },
              { title: 'Criada em', dataIndex: 'createdAt', render: (value) => new Date(value).toLocaleString('pt-BR') },
              {
                title: '',
                render: (_, view) => (
                  <Space>
                    <Button size="small" icon={<EyeOutlined />} onClick={() => navigate(`${selectedPage.path}?${view.params}`)}>Abrir</Button>
                    <Button size="small" icon={<LinkOutlined />} loading={shareMutation.isPending} onClick={() => shareMutation.mutate(view)}>Compartilhar</Button>
                    <Button size="small" danger icon={<DeleteOutlined />} onClick={() => remove(view.id)}>Excluir</Button>
                  </Space>
                ),
              },
            ]}
          />
        ) : (
          <Empty description="Nenhuma visao salva para esta area" />
        )}
      </Card>
    </Space>
  )
}
