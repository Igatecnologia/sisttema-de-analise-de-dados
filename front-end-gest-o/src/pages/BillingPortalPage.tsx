import { Alert, Button, Card, Descriptions, Skeleton, Space, Tag, Timeline, Typography, message } from 'antd'
import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { PageHeaderCard } from '../components/PageHeaderCard'
import { getBillingStatus, openBillingPortal, type BillingStatus } from '../services/billingService'
import { UsageBar } from '../components/UsageBar'

const STATUS_COLOR: Record<string, string> = {
  active: 'green',
  trialing: 'blue',
  trial_expired: 'red',
  past_due: 'orange',
  canceled: 'default',
  unpaid: 'red',
  grace: 'gold',
  incomplete: 'orange',
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch {
    return iso
  }
}

export function BillingPortalPage() {
  const [status, setStatus] = useState<BillingStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [opening, setOpening] = useState(false)

  useEffect(() => {
    getBillingStatus()
      .then(setStatus)
      .catch(() => message.error('Falha ao carregar status de billing'))
      .finally(() => setLoading(false))
  }, [])

  async function onOpenPortal() {
    setOpening(true)
    try {
      const { url } = await openBillingPortal()
      window.location.href = url
    } catch {
      message.error('Tenant ainda nao tem assinatura ativa. Va em Planos primeiro.')
      setOpening(false)
    }
  }

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <PageHeaderCard
        title="Plano e cobranca"
        subtitle="Veja seu plano atual, periodo de cobranca e gerencie pagamento."
      />

      {loading ? <Skeleton active /> : status ? (
        <>
          <Card title="Plano atual">
            <Space direction="vertical" size={12} style={{ width: '100%' }}>
              <Descriptions bordered column={1} size="small">
                <Descriptions.Item label="Plano">
                  <Tag color="blue" style={{ textTransform: 'capitalize' }}>{status.plan}</Tag>
                </Descriptions.Item>
                <Descriptions.Item label="Status">
                  <Tag color={STATUS_COLOR[status.status] ?? 'default'} style={{ textTransform: 'capitalize' }}>
                    {status.status.replace('_', ' ')}
                  </Tag>
                </Descriptions.Item>
                {status.trialEndsAt ? (
                  <Descriptions.Item label="Trial ate">{formatDate(status.trialEndsAt)}</Descriptions.Item>
                ) : null}
                {status.currentPeriodEnd ? (
                  <Descriptions.Item label="Periodo atual ate">{formatDate(status.currentPeriodEnd)}</Descriptions.Item>
                ) : null}
                {status.cancelAtPeriodEnd ? (
                  <Descriptions.Item label="Cancelamento agendado">
                    <Tag color="warning">Sera cancelado no fim do periodo</Tag>
                  </Descriptions.Item>
                ) : null}
              </Descriptions>

              {!status.access.allowed ? (
                <Alert
                  type="error"
                  showIcon
                  message="Acesso bloqueado"
                  description={
                    status.access.reason === 'trial_expired'
                      ? 'Seu trial expirou. Assine um plano para continuar.'
                      : 'Sua assinatura nao esta ativa. Atualize o pagamento.'
                  }
                />
              ) : null}

              <Space>
                <Button type="primary" loading={opening} onClick={onOpenPortal} disabled={!status.stripeEnabled}>
                  Abrir portal de pagamento
                </Button>
                <Link to="/planos">
                  <Button>Mudar de plano</Button>
                </Link>
              </Space>
            </Space>
          </Card>

          <Card title="Uso do plano">
            <Space direction="vertical" size={14} style={{ width: '100%' }}>
              <UsageBar label="Usuarios" used={status.usage?.users ?? 0} limit={status.limits?.users} />
              <UsageBar label="Fontes de dados" used={status.usage?.datasources ?? 0} limit={status.limits?.datasources} />
              <UsageBar label="Mensagens do copiloto no mes" used={status.usage?.copilotMessagesMonthly ?? 0} limit={status.limits?.copilotMessagesMonthly} />
              <Typography.Text type="secondary">
                Os limites sao aplicados no backend. Ao atingir o limite, novas criacoes ou chamadas ficam bloqueadas ate upgrade do plano.
              </Typography.Text>
            </Space>
          </Card>

          <Card title="Historico e notas fiscais">
            <Timeline
              items={[
                {
                  color: status.access.allowed ? 'green' : 'red',
                  children: `Status atual: ${status.status.replace('_', ' ')}`,
                },
                ...(status.currentPeriodEnd
                  ? [{ color: 'blue', children: `Periodo atual ate ${formatDate(status.currentPeriodEnd)}` }]
                  : []),
                {
                  color: 'gray',
                  children: status.stripeEnabled
                    ? 'Historico de faturas e notas fiscais disponivel no portal de pagamento.'
                    : 'Historico de faturas indisponivel enquanto o pagamento online nao estiver configurado.',
                },
              ]}
            />
            <Button loading={opening} onClick={onOpenPortal} disabled={!status.stripeEnabled}>
              Ver faturas no portal
            </Button>
          </Card>

          <Card title="Documentos">
            <Space direction="vertical" size={4}>
              <Link to="/legal/termos">Termos de uso</Link>
              <Link to="/legal/privacidade">Politica de privacidade</Link>
              <Link to="/seguranca/lgpd">Solicitar dados / exclusao (LGPD)</Link>
            </Space>
          </Card>
        </>
      ) : (
        <Alert type="error" showIcon message="Nao foi possivel carregar status de billing." />
      )}
    </div>
  )
}

export default BillingPortalPage
