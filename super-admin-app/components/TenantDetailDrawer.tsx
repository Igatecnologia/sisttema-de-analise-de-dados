'use client'

import { Badge, Descriptions, Drawer, Empty, Skeleton, Space, Table, Tag, Typography, message } from 'antd'
import dayjs from 'dayjs'
import { useEffect, useState } from 'react'
import { api, ApiError, type TenantDetail } from '@/lib/api'

type Props = {
  tenantId: string | null
  onClose: () => void
}

const PLAN_COLORS: Record<string, string> = {
  enterprise: 'gold',
  pro: 'blue',
  starter: 'cyan',
  trial: 'default',
}

export function TenantDetailDrawer({ tenantId, onClose }: Props) {
  const [detail, setDetail] = useState<TenantDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState<'info' | 'users' | 'datasources' | 'audit'>('info')

  useEffect(() => {
    if (!tenantId) {
      setDetail(null)
      return
    }
    setLoading(true)
    setTab('info')
    api
      .get<TenantDetail>(`/v1/super-admin/tenants/${tenantId}/detail`)
      .then(setDetail)
      .catch((err) => {
        const msg = err instanceof ApiError ? err.message : 'Falha ao carregar detalhes'
        message.error(msg)
        setDetail(null)
      })
      .finally(() => setLoading(false))
  }, [tenantId])

  return (
    <Drawer
      open={!!tenantId}
      onClose={onClose}
      width={640}
      title={detail ? detail.tenant.name : 'Detalhes do tenant'}
      destroyOnClose
    >
      {loading || !detail ? (
        <Skeleton active />
      ) : (
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid var(--border)', paddingBottom: 8 }}>
            {(
              [
                ['info', 'Resumo'],
                ['users', `Usuários (${detail.users.length})`],
                ['datasources', `Fontes (${detail.datasources.length})`],
                ['audit', `Audit (${detail.recentAudit.length})`],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  padding: '6px 12px',
                  cursor: 'pointer',
                  borderRadius: 6,
                  fontSize: 13,
                  color: tab === key ? '#f59e0b' : '#94a3b8',
                  fontWeight: tab === key ? 600 : 400,
                  borderBottom: tab === key ? '2px solid #f59e0b' : '2px solid transparent',
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === 'info' ? (
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="ID"><Typography.Text code>{detail.tenant.id}</Typography.Text></Descriptions.Item>
              <Descriptions.Item label="Slug">{detail.tenant.slug}</Descriptions.Item>
              <Descriptions.Item label="Subtítulo">{detail.tenant.subtitle}</Descriptions.Item>
              <Descriptions.Item label="Plano"><Tag color={PLAN_COLORS[detail.tenant.plan]}>{detail.tenant.plan}</Tag></Descriptions.Item>
              <Descriptions.Item label="Status">
                <Badge status={detail.tenant.status === 'active' ? 'success' : detail.tenant.status === 'suspended' ? 'error' : 'warning'} text={detail.tenant.status} />
              </Descriptions.Item>
              <Descriptions.Item label="Connector">{detail.tenant.connectorId}</Descriptions.Item>
              <Descriptions.Item label="Trial até">{detail.tenant.trialEndsAt ? dayjs(detail.tenant.trialEndsAt).format('DD/MM/YYYY') : '—'}</Descriptions.Item>
              <Descriptions.Item label="MRR">{detail.tenant.mrrBrlCents > 0 ? `R$ ${(detail.tenant.mrrBrlCents / 100).toLocaleString('pt-BR')}` : '—'}</Descriptions.Item>
              <Descriptions.Item label="Módulos">
                <Space wrap size={4}>
                  {detail.tenant.enabledModules.map((m) => <Tag key={m}>{m}</Tag>)}
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="Criado em">{dayjs(detail.tenant.createdAt).format('DD/MM/YYYY HH:mm')}</Descriptions.Item>
            </Descriptions>
          ) : null}

          {tab === 'users' ? (
            detail.users.length === 0 ? (
              <Empty description="Sem usuários" />
            ) : (
              <Table
                rowKey="id"
                size="small"
                pagination={false}
                dataSource={detail.users}
                columns={[
                  { title: 'Nome', dataIndex: 'name', key: 'name' },
                  { title: 'Email', dataIndex: 'email', key: 'email' },
                  { title: 'Papel', dataIndex: 'role', key: 'role', render: (v: string) => <Tag>{v}</Tag> },
                  { title: 'Status', dataIndex: 'status', key: 'status' },
                ]}
              />
            )
          ) : null}

          {tab === 'datasources' ? (
            detail.datasources.length === 0 ? (
              <Empty description="Sem fontes" />
            ) : (
              <Table
                rowKey="id"
                size="small"
                pagination={false}
                dataSource={detail.datasources}
                columns={[
                  { title: 'Nome', dataIndex: 'name', key: 'name' },
                  { title: 'ID', dataIndex: 'id', key: 'id', render: (v: string) => <Typography.Text code>{v}</Typography.Text> },
                ]}
              />
            )
          ) : null}

          {tab === 'audit' ? (
            detail.recentAudit.length === 0 ? (
              <Empty description="Sem eventos" />
            ) : (
              <Table
                rowKey="id"
                size="small"
                pagination={false}
                dataSource={detail.recentAudit}
                columns={[
                  { title: 'Quando', dataIndex: 'createdAt', key: 'createdAt', width: 160, render: (v: string) => dayjs(v).format('DD/MM HH:mm') },
                  { title: 'Ação', dataIndex: 'action', key: 'action', render: (v: string) => <Tag>{v}</Tag> },
                ]}
              />
            )
          ) : null}
        </Space>
      )}
    </Drawer>
  )
}
