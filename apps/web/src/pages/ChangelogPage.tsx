import { RocketOutlined } from '@ant-design/icons'
import { Card, Skeleton, Space, Tag, Timeline, Typography } from 'antd'
import { useQuery } from '@tanstack/react-query'
import { PageHeaderCard } from '../components/PageHeaderCard'
import { Sparkles } from 'lucide-react'
import { queryKeys } from '../query/queryKeys'
import { listChangelog } from '../services/changelogService'

export function ChangelogPage() {
  const changelogQuery = useQuery({ queryKey: queryKeys.changelog(), queryFn: listChangelog, staleTime: 10 * 60_000 })
  const releases = changelogQuery.data ?? []

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <PageHeaderCard
        title="Novidades"
        subtitle="Histórico de melhorias, correções e recursos liberados."
        icon={<Sparkles size={22} />}
        breadcrumbs={[{ label: 'Início', to: '/gestao' }, { label: 'Suporte' }, { label: 'Novidades' }]}
      />
      <Card className="app-card" variant="borderless">
        {changelogQuery.isLoading ? <Skeleton active paragraph={{ rows: 6 }} /> : null}
        <Timeline
          items={releases.map((release) => ({
            dot: <RocketOutlined />,
            children: (
              <Space direction="vertical" size={8}>
                <Space wrap>
                  <Tag color="blue">{release.version}</Tag>
                  <Tag>{release.type}</Tag>
                  <Typography.Text type="secondary">{new Date(`${release.date}T00:00:00`).toLocaleDateString('pt-BR')}</Typography.Text>
                </Space>
                <Typography.Title level={5} style={{ margin: 0 }}>{release.title}</Typography.Title>
                <ul style={{ marginTop: 0 }}>
                  {release.items.map((item) => <li key={item}>{item}</li>)}
                </ul>
              </Space>
            ),
          }))}
        />
      </Card>
    </Space>
  )
}
