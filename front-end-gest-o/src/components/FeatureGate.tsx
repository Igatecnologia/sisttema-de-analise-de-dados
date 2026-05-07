import { LockOutlined } from '@ant-design/icons'
import { Button, Space, Typography } from 'antd'
import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'

/**
 * FeatureGate inline — bloqueia conteudo com blur+lock e CTA para upgrade.
 * Use ao redor de tabelas/dashboards que exigem plano superior.
 */
type Props = {
  /** Plano minimo necessario. */
  requiredPlan: 'pro' | 'enterprise'
  /** Plano atual do tenant (vindo de billing/status). */
  currentPlan: string | undefined
  children: ReactNode
  title?: string
  description?: string
}

const PLAN_RANK: Record<string, number> = { free: 0, trial: 0, pro: 1, enterprise: 2 }

export function FeatureGate({ requiredPlan, currentPlan, children, title, description }: Props) {
  const allowed = (PLAN_RANK[currentPlan ?? 'free'] ?? 0) >= (PLAN_RANK[requiredPlan] ?? 0)
  if (allowed) return <>{children}</>

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ filter: 'blur(4px)', pointerEvents: 'none', userSelect: 'none' }} aria-hidden>
        {children}
      </div>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(255,255,255,0.6)',
          backdropFilter: 'blur(2px)',
        }}
      >
        <Space direction="vertical" size={12} align="center" style={{ background: 'white', padding: 24, borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', maxWidth: 420 }}>
          <LockOutlined style={{ fontSize: 32, color: '#1677ff' }} />
          <Typography.Title level={4} style={{ margin: 0, textAlign: 'center' }}>
            {title ?? `Disponivel no plano ${requiredPlan === 'pro' ? 'Pro' : 'Enterprise'}`}
          </Typography.Title>
          {description ? (
            <Typography.Paragraph type="secondary" style={{ textAlign: 'center', margin: 0 }}>{description}</Typography.Paragraph>
          ) : null}
          <Link to="/planos"><Button type="primary">Ver planos</Button></Link>
        </Space>
      </div>
    </div>
  )
}
