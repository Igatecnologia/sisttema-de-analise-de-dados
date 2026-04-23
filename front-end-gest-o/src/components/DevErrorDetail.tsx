import { Collapse, Typography } from 'antd'
import { getTechnicalErrorDetail } from '../api/httpError'

type Props = {
  error: unknown
}

export function DevErrorDetail({ error }: Props) {
  const detail = getTechnicalErrorDetail(error)
  if (!detail) return null

  return (
    <Collapse
      ghost
      size="small"
      style={{ marginTop: 8 }}
      items={[
        {
          key: 'dev-detail',
          label: <Typography.Text type="secondary">Detalhe técnico (apenas em desenvolvimento)</Typography.Text>,
          children: (
            <pre
              style={{
                margin: 0,
                maxHeight: 220,
                overflow: 'auto',
                fontSize: 11,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {detail}
            </pre>
          ),
        },
      ]}
    />
  )
}
