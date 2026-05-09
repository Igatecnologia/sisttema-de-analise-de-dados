import { Progress, Space, Typography } from 'antd'

type Props = {
  label: string
  used: number
  limit: number | null | undefined
}

export function UsageBar({ label, used, limit }: Props) {
  const unlimited = limit == null
  const percent = unlimited || limit <= 0 ? 0 : Math.min(100, Math.round((used / limit) * 100))
  const status = !unlimited && percent >= 100 ? 'exception' : percent >= 80 ? 'active' : 'normal'

  return (
    <Space direction="vertical" size={4} style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
        <Typography.Text>{label}</Typography.Text>
        <Typography.Text type={status === 'exception' ? 'danger' : 'secondary'}>
          {unlimited ? `${used} / ilimitado` : `${used} / ${limit}`}
        </Typography.Text>
      </div>
      <Progress percent={percent} showInfo={false} status={status} />
    </Space>
  )
}
