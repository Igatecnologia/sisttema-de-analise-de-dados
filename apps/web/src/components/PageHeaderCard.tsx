import { Card, Space, Typography } from 'antd'

type PageHeaderCardProps = {
  title: string
  subtitle?: string
  extra?: React.ReactNode
}

export function PageHeaderCard({ title, subtitle, extra }: PageHeaderCardProps) {
  return (
    <Card className="app-card page-header-card no-hover" variant="borderless">
      <Space
        style={{ width: '100%', justifyContent: 'space-between' }}
        align="center"
      >
        <div>
          <Typography.Title level={4} style={{ margin: 0, letterSpacing: -0.4 }}>
            {title}
          </Typography.Title>
          {subtitle ? (
            <Typography.Text type="secondary">{subtitle}</Typography.Text>
          ) : null}
        </div>
        {extra ? <div>{extra}</div> : null}
      </Space>
    </Card>
  )
}

