import { useState, type ReactNode } from 'react'
import { Button, Empty, Space, Typography } from 'antd'
import { Link } from 'react-router-dom'

type EmptyStateProps = {
  title?: string
  description?: string
  actionLabel?: string
  actionPath?: string
  onAction?: () => void
  /**
   * UX-M4 (audit 2026-05-12): conteúdo opcional collapsable inline (ex: form
   * mini de cadastro) pra reduzir cliques. Quando informado, a action vira
   * "expandir" e o conteúdo aparece dentro do próprio empty state.
   */
  inlineActionLabel?: string
  inlineContent?: ReactNode
}

/**
 * Empty state contextual — substitui o <Empty> genérico do Ant Design
 * com mensagem descritiva e ação sugerida.
 */
export function EmptyState({
  title = 'Sem dados para exibir',
  description,
  actionLabel,
  actionPath,
  onAction,
  inlineActionLabel,
  inlineContent,
}: EmptyStateProps) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div style={{ padding: '48px 24px', textAlign: 'center' }}>
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description={
          <Space direction="vertical" size={8}>
            <Typography.Text strong style={{ fontSize: 15 }}>{title}</Typography.Text>
            {description && (
              <Typography.Text type="secondary" style={{ fontSize: 13 }}>{description}</Typography.Text>
            )}
          </Space>
        }
      >
        <Space size={8} wrap style={{ justifyContent: 'center' }}>
          {actionLabel && actionPath ? (
            <Link to={actionPath}>
              <Button type={inlineContent ? 'default' : 'primary'} size="small">{actionLabel}</Button>
            </Link>
          ) : actionLabel && onAction ? (
            <Button type={inlineContent ? 'default' : 'primary'} size="small" onClick={onAction}>{actionLabel}</Button>
          ) : null}
          {inlineContent && inlineActionLabel ? (
            <Button type="primary" size="small" onClick={() => setExpanded((s) => !s)}>
              {expanded ? 'Cancelar' : inlineActionLabel}
            </Button>
          ) : null}
        </Space>
        {inlineContent && expanded ? (
          <div style={{ marginTop: 20, maxWidth: 520, marginInline: 'auto', textAlign: 'left' }}>
            {inlineContent}
          </div>
        ) : null}
      </Empty>
    </div>
  )
}
