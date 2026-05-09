import { useMemo } from 'react'
import { App, Button, Dropdown, Space, Tag, Typography } from 'antd'
import { CheckOutlined, DownOutlined, SwapOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useTenant } from '../tenant/TenantContext'
import { listOrganizations, switchOrganization } from '../services/organizationsService'
import { queryKeys } from '../query/queryKeys'

/**
 * Chip clicável no header mostrando o tenant atual com dropdown para
 * troca rápida. Funciona junto com o item "Organizações" do menu de
 * usuário — aqui é o atalho de 1 clique.
 */
export function OrgSwitcher() {
  const tenant = useTenant()
  const navigate = useNavigate()
  const { message, notification } = App.useApp()
  const orgsQuery = useQuery({
    queryKey: queryKeys.organizations(),
    queryFn: listOrganizations,
    staleTime: 5 * 60_000,
  })
  const switchMutation = useMutation({
    mutationFn: switchOrganization,
    onSuccess: async (result) => {
      await navigator.clipboard?.writeText(result.slug).catch(() => undefined)
      notification.info({ message: result.message, description: `Slug copiado: ${result.slug}` })
      message.info('Entre novamente selecionando a organização copiada.')
    },
  })

  const orgs = orgsQuery.data ?? []
  const hasMultiple = orgs.length > 1

  const items = useMemo(() => {
    if (orgs.length === 0) {
      return [{ key: 'manage', label: 'Gerenciar organizações', onClick: () => navigate('/orgs') }]
    }
    const orgItems = orgs.slice(0, 8).map((org) => ({
      key: org.id,
      label: (
        <Space>
          {org.current ? <CheckOutlined style={{ color: '#52c41a' }} /> : <SwapOutlined />}
          <span>{org.name}</span>
          <Tag>{org.plan}</Tag>
        </Space>
      ),
      disabled: org.current,
      onClick: () => switchMutation.mutate(org.slug),
    }))
    return [
      ...orgItems,
      { type: 'divider' as const },
      { key: 'manage', label: 'Gerenciar organizações', onClick: () => navigate('/orgs') },
    ]
  }, [orgs, navigate, switchMutation])

  if (!hasMultiple && orgs.length <= 1) {
    /** Single-tenant — só mostra o nome, sem dropdown. */
    return (
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        {tenant.companyName}
      </Typography.Text>
    )
  }

  return (
    <Dropdown menu={{ items }} trigger={['click']} placement="bottomLeft">
      <Button
        type="text"
        size="small"
        aria-label={`Trocar organização (atual: ${tenant.companyName})`}
        style={{ padding: '0 6px', height: 22, fontSize: 12, color: 'inherit', opacity: 0.8 }}
      >
        <Space size={4}>
          <span>{tenant.companyName}</span>
          <DownOutlined style={{ fontSize: 10 }} />
        </Space>
      </Button>
    </Dropdown>
  )
}
