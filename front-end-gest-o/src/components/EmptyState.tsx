import { Button, Empty, Space, Typography } from 'antd'
import { Link } from 'react-router-dom'

type EmptyStateProps = {
  title?: string
  description?: string
  actionLabel?: string
  actionPath?: string
  onAction?: () => void
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
}: EmptyStateProps) {
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
        {actionLabel && actionPath ? (
          <Link to={actionPath}>
            <Button type="primary" size="small">{actionLabel}</Button>
          </Link>
        ) : actionLabel && onAction ? (
          <Button type="primary" size="small" onClick={onAction}>{actionLabel}</Button>
        ) : null}
      </Empty>
    </div>
  )
}
