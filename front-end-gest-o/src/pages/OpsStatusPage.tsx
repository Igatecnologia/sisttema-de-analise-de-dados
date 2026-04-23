import { CloudServerOutlined, ReloadOutlined } from '@ant-design/icons'
import { Alert, Button, Card, Descriptions, Space, Spin, Typography } from 'antd'
import { useQuery } from '@tanstack/react-query'
import { PageHeaderCard } from '../components/PageHeaderCard'
import { DevErrorDetail } from '../components/DevErrorDetail'
import { getErrorMessage } from '../api/httpError'
import { getOpsStatus } from '../services/opsService'
import { queryKeys } from '../query/queryKeys'

export function OpsStatusPage() {
  const query = useQuery({
    queryKey: queryKeys.opsStatus(),
    queryFn: getOpsStatus,
    staleTime: 15_000,
  })

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <PageHeaderCard
        title="Operação do sistema"
        subtitle="Saúde do backend, proxy e alertas de reconciliação (somente administradores)."
      />

      {query.isLoading && (
        <Card className="app-card" variant="borderless">
          <Spin />
        </Card>
      )}

      {query.isError && (
        <Alert
          type="error"
          showIcon
          message="Não foi possível carregar o status"
          description={
            <>
              {getErrorMessage(query.error, 'Verifique se a API está no ar e se você está autenticado como admin.')}
              <DevErrorDetail error={query.error} />
            </>
          }
          action={
            <Button size="small" onClick={() => query.refetch()}>
              Tentar novamente
            </Button>
          }
        />
      )}

      {query.data && (
        <Card
          className="app-card"
          variant="borderless"
          title={
            <Space>
              <CloudServerOutlined />
              Snapshot
            </Space>
          }
          extra={
            <Button icon={<ReloadOutlined />} loading={query.isFetching} onClick={() => query.refetch()}>
              Atualizar
            </Button>
          }
        >
          <Descriptions bordered size="small" column={{ xs: 1, sm: 2 }}>
            <Descriptions.Item label="Horário (API)">{query.data.timestamp}</Descriptions.Item>
            <Descriptions.Item label="Uptime (s)">{query.data.uptimeSec}</Descriptions.Item>
            <Descriptions.Item label="NODE_ENV">{query.data.nodeEnv}</Descriptions.Item>
            <Descriptions.Item label="Arquivo users.json">{query.data.storage.users ? 'OK' : 'ausente'}</Descriptions.Item>
            <Descriptions.Item label="Arquivo datasources.json">
              {query.data.storage.datasources ? 'OK' : 'ausente'}
            </Descriptions.Item>
            <Descriptions.Item label="Cache de tokens (proxy)">{query.data.proxy.tokenCacheSize}</Descriptions.Item>
          </Descriptions>

          <Typography.Title level={5} style={{ marginTop: 24 }}>
            Estatísticas do proxy
          </Typography.Title>
          <pre
            style={{
              margin: 0,
              padding: 12,
              borderRadius: 8,
              background: 'rgba(15, 23, 42, 0.06)',
              fontSize: 12,
              overflow: 'auto',
              maxHeight: 220,
            }}
          >
            {JSON.stringify(query.data.proxy.stats, null, 2)}
          </pre>

          <Typography.Title level={5} style={{ marginTop: 16 }}>
            Reconciliação agendada
          </Typography.Title>
          <pre
            style={{
              margin: 0,
              padding: 12,
              borderRadius: 8,
              background: 'rgba(15, 23, 42, 0.06)',
              fontSize: 12,
              overflow: 'auto',
              maxHeight: 280,
            }}
          >
            {JSON.stringify(query.data.proxy.reconcileAlert, null, 2)}
          </pre>
        </Card>
      )}
    </Space>
  )
}
