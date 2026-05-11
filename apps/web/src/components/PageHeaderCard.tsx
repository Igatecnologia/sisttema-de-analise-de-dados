import { Typography } from 'antd'
import { ChevronRight } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

type Crumb = { label: string; to?: string }

type PageHeaderCardProps = {
  title: string
  subtitle?: string
  /** Acoes / botoes a direita */
  extra?: ReactNode
  /** Icone Lucide opcional ao lado do titulo */
  icon?: ReactNode
  /** Cor do icone wrapper (default: var(--qc-primary)) */
  iconColor?: string
  /** Breadcrumbs no topo. Aceita arrays imutaveis (`as const`). */
  breadcrumbs?: readonly Crumb[]
  /** Versao compacta (sem padding extra) */
  compact?: boolean
}

/**
 * Page header moderno e leve. Sem Card wrapper — usa apenas padding/border
 * para nao adicionar peso visual. Suporta breadcrumbs, icone Lucide e
 * area de actions.
 */
export function PageHeaderCard({
  title,
  subtitle,
  extra,
  icon,
  iconColor,
  breadcrumbs,
  compact,
}: PageHeaderCardProps) {
  return (
    <header
      className="page-header-modern"
      style={{
        padding: compact ? '8px 0 16px' : '4px 0 24px',
        marginBottom: compact ? 16 : 24,
        borderBottom: '1px solid var(--qc-border-subtle, rgba(0,0,0,0.06))',
      }}
    >
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav
          aria-label="Breadcrumbs"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 12,
            color: 'var(--qc-text-muted, #94a3b8)',
            marginBottom: 10,
          }}
        >
          {breadcrumbs.map((c, i) => (
            <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              {i > 0 && (
                <ChevronRight
                  size={12}
                  style={{ color: 'var(--qc-text-faint, #cbd5e1)', flexShrink: 0 }}
                />
              )}
              {c.to ? (
                <Link
                  to={c.to}
                  style={{ color: 'var(--qc-text-muted, #94a3b8)', textDecoration: 'none' }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = 'var(--qc-text, inherit)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = 'var(--qc-text-muted, #94a3b8)'
                  }}
                >
                  {c.label}
                </Link>
              ) : (
                <span>{c.label}</span>
              )}
            </span>
          ))}
        </nav>
      )}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, minWidth: 0, flex: 1 }}>
          {icon && (
            <div
              aria-hidden
              style={{
                width: 44,
                height: 44,
                flexShrink: 0,
                borderRadius: 12,
                background: iconColor
                  ? `${iconColor}15`
                  : 'var(--qc-accent-muted, rgba(22, 119, 255, 0.08))',
                color: iconColor || 'var(--qc-primary, #1d4ed8)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginTop: 2,
              }}
            >
              {icon}
            </div>
          )}
          <div style={{ minWidth: 0, flex: 1 }}>
            <Typography.Title
              level={1}
              style={{
                margin: 0,
                fontSize: 22,
                fontWeight: 700,
                letterSpacing: '-0.02em',
                lineHeight: 1.2,
              }}
            >
              {title}
            </Typography.Title>
            {subtitle && (
              <Typography.Text
                type="secondary"
                style={{ display: 'block', marginTop: 4, fontSize: 14 }}
              >
                {subtitle}
              </Typography.Text>
            )}
          </div>
        </div>
        {extra && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {extra}
          </div>
        )}
      </div>
    </header>
  )
}
