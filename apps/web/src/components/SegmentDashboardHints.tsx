import { Card, Space, Typography } from 'antd'
import {
  AimOutlined,
  CompassOutlined,
  InboxOutlined,
  RocketOutlined,
  RiseOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { Link } from 'react-router-dom'
import { useTenant } from '../tenant/TenantContext'
import { getDashboardConfig, type DashboardActionHint } from '../config/dashboardLayouts'

const ICON_MAP: Record<NonNullable<DashboardActionHint['icon']>, React.ReactNode> = {
  rocket: <RocketOutlined />,
  compass: <CompassOutlined />,
  target: <AimOutlined />,
  package: <InboxOutlined />,
  users: <UserOutlined />,
  'trending-up': <RiseOutlined />,
}

const HINT_DISMISS_KEY = 'iga-dismiss-segment-hints'

/**
 * Card de "boas-vindas + próximas ações" no topo do Dashboard, contextual ao
 * segmento do tenant. Filosofia: ajudar admin a descobrir features relevantes
 * sem ser intrusivo. Pode ser dismissado (localStorage) — não retorna até
 * limpar storage manualmente.
 */
export function SegmentDashboardHints() {
  const tenant = useTenant()
  const config = getDashboardConfig(tenant.segment)

  const dismissed = typeof window !== 'undefined' && window.localStorage.getItem(HINT_DISMISS_KEY) === '1'
  if (dismissed) return null

  function handleDismiss() {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(HINT_DISMISS_KEY, '1')
      /** Força re-render via reload — simples e suficiente para esse caso. */
      window.location.reload()
    } catch {
      /** localStorage indisponível — ignora silenciosamente. */
    }
  }

  return (
    <Card
      className="app-card no-hover"
      style={{
        borderLeft: `4px solid ${tenant.primaryColor ?? '#1d4ed8'}`,
        background: 'rgba(22, 119, 255, 0.03)',
      }}
      styles={{ body: { padding: 16 } }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 280 }}>
          <Typography.Title level={5} style={{ margin: 0, marginBottom: 4 }}>
            {config.headline}
          </Typography.Title>
          <Typography.Text type="secondary" style={{ fontSize: 13 }}>
            {config.subtitle}
          </Typography.Text>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Esconder dicas do segmento"
          style={{
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            padding: 4,
            color: 'var(--qc-text-muted, #8c8c8c)',
            fontSize: 13,
          }}
        >
          Não mostrar mais
        </button>
      </div>

      <Space direction="vertical" size={6} style={{ width: '100%', marginTop: 12 }}>
        {config.actions.slice(0, 3).map((action) => (
          <Link
            key={action.href}
            to={action.href}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '8px 12px',
              borderRadius: 6,
              background: 'var(--qc-canvas, rgba(255,255,255,0.5))',
              color: 'inherit',
              textDecoration: 'none',
              border: '1px solid var(--qc-border, rgba(0,0,0,0.06))',
              fontSize: 13,
              transition: 'transform 0.15s ease, border-color 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateX(2px)'
              e.currentTarget.style.borderColor = tenant.primaryColor ?? '#1d4ed8'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = ''
              e.currentTarget.style.borderColor = ''
            }}
          >
            <span style={{ color: tenant.primaryColor ?? '#1d4ed8' }}>
              {action.icon ? ICON_MAP[action.icon] : <RocketOutlined />}
            </span>
            <span>{action.label}</span>
            <span style={{ marginLeft: 'auto', opacity: 0.5 }}>→</span>
          </Link>
        ))}
      </Space>
    </Card>
  )
}
