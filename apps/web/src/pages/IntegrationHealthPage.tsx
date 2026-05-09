import { CheckCircleOutlined, ReloadOutlined, WarningOutlined } from '@ant-design/icons'
import { Alert, Button, Card, Space, Table, Tag, Typography } from 'antd'
import { useQuery } from '@tanstack/react-query'
import { PageHeaderCard } from '../components/PageHeaderCard'
import { queryKeys } from '../query/queryKeys'
import { listDataSources } from '../services/dataSourceService'
import { getErrorMessage } from '../api/httpError'

export function IntegrationHealthPage() {
  const sourcesQuery = useQuery({ queryKey: queryKeys.dataSources(), queryFn: listDataSources, staleTime: 30_000 })
  const sources = sourcesQuery.data ?? []

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <PageHeaderCard
        title="Saude das integracoes"
        subtitle="Status consolidado das fontes de dados e sincronizacoes."
        extra={<Button icon={<ReloadOutlined />} onClick={() => sourcesQuery.refetch()}>Atualizar</Button>}
      />
      {sourcesQuery.isError ? (
        <Alert type="error" showIcon message="Falha ao carregar fontes" description={getErrorMessage(sourcesQuery.error, 'Tente novamente em instantes.')} />
      ) : null}
      <Card className="app-card" variant="borderless">
        <Table
          rowKey="id"
          loading={sourcesQuery.isLoading}
          dataSource={sources}
          pagination={{ pageSize: 10 }}
          columns={[
            { title: 'Fonte', dataIndex: 'name', render: (value) => <Typography.Text strong>{value}</Typography.Text> },
            { title: 'Tipo', dataIndex: 'type', render: (value) => <Tag>{value}</Tag> },
            {
              title: 'Status',
              dataIndex: 'status',
              render: (value) => value === 'active'
                ? <Tag color="green" icon={<CheckCircleOutlined />}>Saudavel</Tag>
                : <Tag color="gold" icon={<WarningOutlined />}>Atencao</Tag>,
            },
            { title: 'Ultima sincronizacao', dataIndex: 'lastSyncAt', render: (value) => value ? new Date(value).toLocaleString('pt-BR') : 'Sem sincronizacao' },
          ]}
        />
      </Card>
    </Space>
  )
}
