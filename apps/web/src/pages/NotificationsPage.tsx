import { Alert, Badge, Button, Card, Input, Select, Space, Table, Tag, Typography } from 'antd'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ReloadOutlined } from '@ant-design/icons'
import { useMemo, useState } from 'react'
import { PageHeaderCard } from '../components/PageHeaderCard'
import { queryKeys } from '../query/queryKeys'
import { listAlerts, markAlertAsRead, type AppAlert } from '../services/alertsService'
import { getErrorMessage } from '../api/httpError'

const severityColor: Record<AppAlert['severity'], string> = {
  info: 'blue',
  warning: 'gold',
  error: 'red',
}

export function NotificationsPage() {
  const queryClient = useQueryClient()
  const [q, setQ] = useState('')
  const [severity, setSeverity] = useState<string>('all')
  const [status, setStatus] = useState<string>('all')
  const alertsQuery = useQuery({ queryKey: queryKeys.alerts(), queryFn: listAlerts, refetchInterval: 30_000 })
  const alerts = useMemo(() => alertsQuery.data ?? [], [alertsQuery.data])

  const filtered = useMemo(() => {
    const text = q.trim().toLowerCase()
    return alerts.filter((item) => {
      const matchesText = !text || `${item.title} ${item.message} ${item.type}`.toLowerCase().includes(text)
      const matchesSeverity = severity === 'all' || item.severity === severity
      const matchesStatus = status === 'all' || (status === 'unread' ? !item.readAt : Boolean(item.readAt))
      return matchesText && matchesSeverity && matchesStatus
    })
  }, [alerts, q, severity, status])

  const unreadCount = alerts.filter((item) => !item.readAt).length

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <PageHeaderCard
        title="Notificacoes"
        subtitle="Historico completo de alertas do produto, operacao e seguranca."
        extra={<Button icon={<ReloadOutlined />} onClick={() => alertsQuery.refetch()}>Atualizar</Button>}
      />

      {alertsQuery.isError ? (
        <Alert
          type="error"
          showIcon
          title="Nao foi possivel carregar notificacoes"
          description={getErrorMessage(alertsQuery.error, 'Tente novamente em instantes.')}
        />
      ) : null}

      <Card className="app-card" variant="borderless">
        <Space wrap style={{ marginBottom: 16 }}>
          <Input.Search placeholder="Buscar notificacoes" allowClear value={q} onChange={(e) => setQ(e.target.value)} style={{ width: 280 }} />
          <Select
            value={severity}
            onChange={setSeverity}
            style={{ width: 170 }}
            options={[
              { value: 'all', label: 'Todas severidades' },
              { value: 'info', label: 'Informacao' },
              { value: 'warning', label: 'Atencao' },
              { value: 'error', label: 'Critico' },
            ]}
          />
          <Select
            value={status}
            onChange={setStatus}
            style={{ width: 150 }}
            options={[
              { value: 'all', label: 'Todos status' },
              { value: 'unread', label: 'Nao lidas' },
              { value: 'read', label: 'Lidas' },
            ]}
          />
          <Badge count={unreadCount} showZero color="#1A7AB5">
            <Tag>nao lidas</Tag>
          </Badge>
        </Space>

        <Table<AppAlert>
          rowKey="id"
          loading={alertsQuery.isLoading}
          dataSource={filtered}
          pagination={{ pageSize: 12, showTotal: (total) => `${total} notificacoes` }}
          columns={[
            {
              title: 'Status',
              width: 110,
              render: (_, item) => item.readAt ? <Tag>Lida</Tag> : <Badge status="processing" text="Nova" />,
            },
            {
              title: 'Tipo',
              dataIndex: 'type',
              width: 150,
              render: (value, item) => <Tag color={severityColor[item.severity]}>{value}</Tag>,
            },
            {
              title: 'Notificacao',
              render: (_, item) => (
                <Space direction="vertical" size={0}>
                  <Typography.Text strong>{item.title}</Typography.Text>
                  <Typography.Text type="secondary">{item.message}</Typography.Text>
                </Space>
              ),
            },
            { title: 'Criada em', dataIndex: 'createdAt', width: 190, render: (value) => new Date(value).toLocaleString('pt-BR') },
            {
              title: '',
              width: 150,
              render: (_, item) => (
                <Button
                  size="small"
                  disabled={Boolean(item.readAt)}
                  onClick={async () => {
                    await markAlertAsRead(item.id)
                    queryClient.invalidateQueries({ queryKey: queryKeys.alerts() })
                  }}
                >
                  Marcar lida
                </Button>
              ),
            },
          ]}
        />
      </Card>
    </Space>
  )
}
