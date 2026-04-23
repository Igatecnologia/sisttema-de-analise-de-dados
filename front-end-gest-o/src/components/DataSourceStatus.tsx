import { Badge, Space, Tooltip, Typography } from 'antd'

type DataSourceStatusProps = {
  status: 'connected' | 'error' | 'pending' | 'disabled'
  lastCheckedAt?: string | null
  lastError?: string | null
  compact?: boolean
}

const STATUS_MAP: Record<string, { badge: 'success' | 'error' | 'processing' | 'default'; label: string }> = {
  connected: { badge: 'success', label: 'Conectado' },
  error: { badge: 'error', label: 'Erro' },
  pending: { badge: 'processing', label: 'Pendente' },
  disabled: { badge: 'default', label: 'Desativado' },
}

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  /** Evita leitura colada com o rótulo "Erro" (ex.: "Erroagora"). */
  if (mins < 1) return 'há instantes'
  if (mins < 60) return `${mins} min atrás`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h atrás`
  return new Date(iso).toLocaleDateString('pt-BR')
}

export function DataSourceStatus({ status, lastCheckedAt, lastError, compact }: DataSourceStatusProps) {
  const st = STATUS_MAP[status] ?? STATUS_MAP.pending

  const badge = <Badge status={st.badge} text={compact ? undefined : st.label} />

  const timeEl = !compact && lastCheckedAt && (
    <Typography.Text type="secondary" style={{ fontSize: 11 }}>
      {formatRelativeTime(lastCheckedAt)}
    </Typography.Text>
  )

  if (status === 'error' && lastError) {
    return (
      <Tooltip title={lastError}>
        <span style={{ cursor: 'help' }}>
          <Space size={6} align="center" wrap={false}>
            {badge}
            {timeEl && (
              <>
                <Typography.Text type="secondary" style={{ fontSize: 11, userSelect: 'none' }}>
                  ·
                </Typography.Text>
                {timeEl}
              </>
            )}
          </Space>
        </span>
      </Tooltip>
    )
  }

  return (
    <Space size={6} align="center" wrap={false}>
      {badge}
      {timeEl && (
        <>
          <Typography.Text type="secondary" style={{ fontSize: 11, userSelect: 'none' }}>
            ·
          </Typography.Text>
          {timeEl}
        </>
      )}
    </Space>
  )
}
