import { Button, Card, Empty, Space, Typography } from 'antd'
import type { ReactNode } from 'react'

type Action = {
  label: string
  onClick: () => void
  type?: 'primary' | 'default'
}

type Props = {
  title: string
  description?: string
  icon?: ReactNode
  /** Ação primária (ex.: "Cadastrar fonte", "Atualizar"). */
  action?: Action
  /** Ação secundária opcional. */
  secondaryAction?: Action
  /** Usa Empty do Ant sem Card (modo inline). */
  bare?: boolean
}

/**
 * Estado vazio padronizado — usado quando uma lista/tabela não tem dados ou
 * quando a página ainda não foi configurada (ex.: sem fonte SGBR cadastrada).
 * Usa Empty do AntD + Card para manter consistência visual com o resto do app.
 */
export function EmptyStateCard({ title, description, icon, action, secondaryAction, bare }: Props) {
  const content = (
    <Empty
      image={icon ?? Empty.PRESENTED_IMAGE_SIMPLE}
      description={
        <Space direction="vertical" size={4} style={{ maxWidth: 420 }}>
          <Typography.Text strong style={{ fontSize: 15 }}>
            {title}
          </Typography.Text>
          {description && (
            <Typography.Text type="secondary" style={{ fontSize: 13 }}>
              {description}
            </Typography.Text>
          )}
        </Space>
      }
    >
      {(action || secondaryAction) && (
        <Space style={{ marginTop: 12 }}>
          {action && (
            <Button type={action.type ?? 'primary'} onClick={action.onClick}>
              {action.label}
            </Button>
          )}
          {secondaryAction && (
            <Button type={secondaryAction.type ?? 'default'} onClick={secondaryAction.onClick}>
              {secondaryAction.label}
            </Button>
          )}
        </Space>
      )}
    </Empty>
  )

  if (bare) return content
  return (
    <Card className="app-card" variant="borderless" style={{ padding: '32px 16px' }}>
      {content}
    </Card>
  )
}
