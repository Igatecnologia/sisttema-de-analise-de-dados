import { Button, Modal, Space, Typography } from 'antd'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

type PlanLimitDetail = {
  message?: string
  resource?: string
  plan?: string
  used?: number
  limit?: number
}

export function PlanLimitModal() {
  const [detail, setDetail] = useState<PlanLimitDetail | null>(null)

  useEffect(() => {
    function onLimit(event: Event) {
      const custom = event as CustomEvent<PlanLimitDetail>
      setDetail(custom.detail ?? {})
    }
    window.addEventListener('iga:plan-limit-reached', onLimit)
    return () => window.removeEventListener('iga:plan-limit-reached', onLimit)
  }, [])

  return (
    <Modal
      open={detail !== null}
      title="Limite do plano atingido"
      onCancel={() => setDetail(null)}
      footer={
        <Space>
          <Button onClick={() => setDetail(null)}>Agora nao</Button>
          <Link to="/planos" onClick={() => setDetail(null)}>
            <Button type="primary">Ver planos</Button>
          </Link>
        </Space>
      }
    >
      <Space direction="vertical" size={8}>
        <Typography.Paragraph style={{ margin: 0 }}>
          {detail?.message ?? 'Este recurso atingiu o limite do plano atual.'}
        </Typography.Paragraph>
        {detail?.resource ? (
          <Typography.Text type="secondary">
            Recurso: {detail.resource} · Plano: {detail.plan ?? '-'} · Uso: {detail.used ?? '-'} / {detail.limit ?? '-'}
          </Typography.Text>
        ) : null}
      </Space>
    </Modal>
  )
}
