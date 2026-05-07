import { ArrowDownOutlined, ArrowUpOutlined, MinusOutlined } from '@ant-design/icons'
import { Skeleton, Tag, Tooltip } from 'antd'
import { useEffect, useRef, useState } from 'react'
import { deltaColor } from '../theme/colors'

function AnimatedNumber({ value }: { value: number }) {
  const [display, setDisplay] = useState(value)
  const displayRef = useRef(value)
  useEffect(() => {
    if (!Number.isFinite(value)) return
    const start = displayRef.current
    const delta = value - start
    const startedAt = performance.now()
    let raf = 0
    const tick = (now: number) => {
      const progress = Math.min((now - startedAt) / 500, 1)
      const next = start + delta * (1 - Math.pow(1 - progress, 3))
      displayRef.current = next
      setDisplay(next)
      if (progress < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value])
  return <>{Math.round(display).toLocaleString('pt-BR')}</>
}

export function MetricCard({
  title,
  value,
  previousValue,
  deltaPct,
  hero,
  loading,
  subtitle,
  description,
  accentColor,
}: {
  title: string
  value: string | number
  previousValue?: string | number
  deltaPct?: number
  hero?: boolean
  loading?: boolean
  subtitle?: string
  description?: string
  accentColor?: string
}) {
  const trend =
    typeof deltaPct !== 'number' ? null : deltaPct > 0 ? 'up' : deltaPct < 0 ? 'down' : 'flat'
  const trendColorValue = trend === 'up' ? deltaColor(1) : trend === 'down' ? deltaColor(-1) : deltaColor(0)
  const accent = accentColor ?? (trend ? trendColorValue : 'var(--qc-primary)')

  if (loading) {
    return (
      <div className={`metric-card${hero ? ' metric-card--hero' : ''}`}>
        <div className="metric-card__accent" style={{ background: 'var(--qc-border)' }} />
        <div className="metric-card__content">
          <Skeleton active paragraph={{ rows: 1 }} title={{ width: '60%' }} />
        </div>
      </div>
    )
  }

  const card = (
    <div className={`metric-card${hero ? ' metric-card--hero' : ''}`}>
      <div className="metric-card__accent" style={{ background: accent }} />
      <div className="metric-card__content">
        <span className="metric-card__title">{title}</span>
        <span className={`metric-card__value${hero ? ' metric-card__value--hero' : ''}`}>
          {typeof value === 'number' ? <AnimatedNumber value={value} /> : value}
        </span>
        {subtitle && (
          <span className="metric-card__prev">{subtitle}</span>
        )}
        {previousValue !== undefined && (
          <span className="metric-card__prev">Anterior: {previousValue}</span>
        )}
        {typeof deltaPct === 'number' && (
          <Tag
            color={trend === 'up' ? 'green' : trend === 'down' ? 'red' : 'default'}
            style={{ marginTop: 6, fontVariantNumeric: 'tabular-nums' }}
          >
            {trend === 'up' ? <ArrowUpOutlined /> : trend === 'down' ? <ArrowDownOutlined /> : <MinusOutlined />}{' '}
            {deltaPct > 0 ? '+' : ''}
            {deltaPct.toFixed(1)}%
          </Tag>
        )}
      </div>
    </div>
  )

  return description ? <Tooltip title={description}>{card}</Tooltip> : card
}
