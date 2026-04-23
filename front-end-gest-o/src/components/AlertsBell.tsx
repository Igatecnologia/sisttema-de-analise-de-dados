import { Bell } from 'lucide-react'
import { Badge, Button, Dropdown, Space, Typography } from 'antd'
import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { appToast } from './feedback/Toast'
import { queryKeys } from '../query/queryKeys'
import { listAlerts, markAlertAsRead, subscribeAlerts, type AppAlert } from '../services/alertsService'
import { useNavigate } from 'react-router-dom'

export function AlertsBell() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const alertsQuery = useQuery({
    queryKey: queryKeys.alerts(),
    queryFn: listAlerts,
    refetchInterval: 30_000,
  })
  const alerts = alertsQuery.data ?? []
  const unreadCount = alerts.filter((item) => !item.readAt).length

  useEffect(() => {
    return subscribeAlerts((nextAlert) => {
      queryClient.setQueryData<AppAlert[]>(queryKeys.alerts(), (previous) => [nextAlert, ...(previous ?? [])].slice(0, 100))
      appToast.info(nextAlert.title)
    })
  }, [queryClient])

  return (
    <Dropdown
      placement="bottomRight"
      menu={{
        items: [
          ...alerts.slice(0, 10).map((item) => ({
            key: item.id,
            label: (
              <Space direction="vertical" size={2}>
                <Typography.Text strong>{item.title}</Typography.Text>
                <Typography.Text type="secondary">{item.message}</Typography.Text>
              </Space>
            ),
            onClick: async () => {
              await markAlertAsRead(item.id)
              queryClient.invalidateQueries({ queryKey: queryKeys.alerts() })
            },
          })),
          ...(alerts.length ? [{ type: 'divider' as const }] : []),
          {
            key: 'all',
            label: 'Ver todos alertas',
            onClick: () => navigate('/alertas'),
          },
        ],
      }}
    >
      <Badge count={unreadCount} size="small">
        <Button type="text" aria-label="Alertas" icon={<Bell size={18} />} />
      </Badge>
    </Dropdown>
  )
}
