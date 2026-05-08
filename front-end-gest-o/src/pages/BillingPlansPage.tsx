import { CheckCircleFilled, MinusCircleFilled } from '@ant-design/icons'
import { Alert, Button, Card, Col, Collapse, Row, Segmented, Space, Tag, Typography, message } from 'antd'
import { useEffect, useState } from 'react'
import { PageHeaderCard } from '../components/PageHeaderCard'
import { getBillingStatus, startCheckout, type BillingStatus } from '../services/billingService'

type Cycle = 'monthly' | 'yearly'

type Plan = {
  id: 'trial' | 'pro' | 'enterprise'
  name: string
  priceMonthly: number
  priceYearly: number
  highlight?: boolean
  features: string[]
  limits: { users: string; datasources: string; copilot: string; suporte: string }
}

const PLANS: Plan[] = [
  {
    id: 'trial',
    name: 'Trial',
    priceMonthly: 0,
    priceYearly: 0,
    features: [
      '14 dias para validar a operação',
      'Dashboards essenciais',
      '2 fontes de dados',
      'Copiloto com 20 mensagens/mês',
    ],
    limits: { users: '3', datasources: '2', copilot: '20/mes', suporte: 'Email 48h' },
  },
  {
    id: 'pro',
    name: 'Pro',
    priceMonthly: 197,
    priceYearly: 1970,
    highlight: true,
    features: [
      'Dashboards completos + alertas',
      'Ate 10 fontes de dados',
      'Copiloto IA com 1000 mensagens/mes',
      'Relatorios agendados (PDF/Excel)',
      'Auditoria completa',
      'Suporte prioritario',
    ],
    limits: { users: '25', datasources: '10', copilot: '1000/mes', suporte: 'Email 12h' },
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    priceMonthly: 497,
    priceYearly: 4970,
    features: [
      'Tudo do Pro',
      'Datasources ilimitados',
      'Copiloto IA ilimitado',
      'SSO/SAML (proximo release)',
      'Webhook reverso',
      'SLA 99.5%',
      'CSM dedicado',
    ],
    limits: { users: 'Ilimitado', datasources: 'Ilimitado', copilot: 'Ilimitado', suporte: '4h SLA + WhatsApp' },
  },
]

const FAQ = [
  {
    key: '1',
    q: 'Posso trocar de plano a qualquer momento?',
    a: 'Sim. Upgrade eh imediato e cobramos prorata; downgrade entra em vigor no proximo ciclo de cobranca.',
  },
  {
    key: '2',
    q: 'Como funciona o trial?',
    a: 'O trial dura 14 dias com acesso completo aos recursos do plano Pro. Sem cartao de credito.',
  },
  {
    key: '3',
    q: 'O que acontece se eu cancelar?',
    a: 'Sua conta fica em modo somente-leitura por 7 dias. Apos isso, removemos os dados conforme solicitacao em /seguranca/lgpd.',
  },
  {
    key: '4',
    q: 'Quais formas de pagamento?',
    a: 'Cartao de credito (via Stripe). Para Enterprise tambem aceitamos boleto ou pix com nota fiscal.',
  },
]

function priceFormat(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 })
}

export function BillingPlansPage() {
  const [cycle, setCycle] = useState<Cycle>('monthly')
  const [status, setStatus] = useState<BillingStatus | null>(null)
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null)

  useEffect(() => {
    getBillingStatus().then(setStatus).catch(() => undefined)
  }, [])

  async function onSubscribe(planId: 'pro' | 'enterprise') {
    setLoadingPlan(planId)
    try {
      const { url } = await startCheckout(planId)
      window.location.assign(url)
    } catch {
      message.error('Falha ao iniciar checkout. Tente novamente.')
      setLoadingPlan(null)
    }
  }

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 24 }}>
      <PageHeaderCard
        title="Planos"
        subtitle="Escolha o plano que se encaixa no tamanho do seu time."
      />

      {status && !status.stripeEnabled ? (
        <Alert
          type="warning"
          showIcon
          message="Pagamento online ainda nao configurado"
          description="Entre em contato com o suporte para ativar sua assinatura."
        />
      ) : null}

      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <Segmented
          value={cycle}
          onChange={(v) => setCycle(v as Cycle)}
          options={[
            { label: 'Mensal', value: 'monthly' },
            { label: 'Anual (-15%)', value: 'yearly' },
          ]}
        />
      </div>

      <Row gutter={[16, 16]}>
        {PLANS.map((plan) => {
          const price = cycle === 'monthly' ? plan.priceMonthly : plan.priceYearly
          const suffix = cycle === 'monthly' ? '/mes' : '/ano'
          const isCurrent = status?.plan === plan.id
          return (
            <Col key={plan.id} xs={24} md={8}>
              <Card
                title={
                  <Space>
                    <span>{plan.name}</span>
                    {plan.highlight ? <Tag color="blue">Recomendado</Tag> : null}
                    {isCurrent ? <Tag color="green">Atual</Tag> : null}
                  </Space>
                }
                style={plan.highlight ? { borderColor: '#1677ff', boxShadow: '0 4px 12px rgba(22,119,255,0.12)' } : undefined}
              >
                <Typography.Title level={2} style={{ marginTop: 0 }}>
                  {price === 0 ? 'Gratis' : `${priceFormat(price)}${suffix}`}
                </Typography.Title>
                <Space direction="vertical" size={8} style={{ width: '100%', marginBottom: 16 }}>
                  {plan.features.map((f) => (
                    <div key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                      <CheckCircleFilled style={{ color: '#52c41a', marginTop: 4 }} />
                      <span>{f}</span>
                    </div>
                  ))}
                </Space>
                <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 16 }}>
                  Usuarios: {plan.limits.users} · Datasources: {plan.limits.datasources} · Copilot: {plan.limits.copilot}
                </Typography.Text>
                {plan.id === 'trial' ? (
                  <Button block disabled={isCurrent}>
                    {isCurrent ? 'Plano atual' : 'Trial ativo'}
                  </Button>
                ) : (
                  <Button
                    type={plan.highlight ? 'primary' : 'default'}
                    block
                    loading={loadingPlan === plan.id}
                    disabled={isCurrent || !status?.stripeEnabled}
                    onClick={() => onSubscribe(plan.id as 'pro' | 'enterprise')}
                  >
                    {isCurrent ? 'Plano atual' : `Assinar ${plan.name}`}
                  </Button>
                )}
              </Card>
            </Col>
          )
        })}
      </Row>

      <Card title="Comparativo">
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: 8 }}>Recurso</th>
              {PLANS.map((p) => (
                <th key={p.id} style={{ textAlign: 'center', padding: 8 }}>{p.name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {([
              ['Dashboards', true, true, true],
              ['Alertas', false, true, true],
              ['Relatorios agendados', false, true, true],
              ['Copiloto IA', '20/mes', '1000/mes', 'Ilimitado'],
              ['Auditoria', false, true, true],
              ['SSO/SAML', false, false, true],
              ['SLA', false, false, '99.5%'],
              ['Suporte', 'Email 48h', 'Email 12h', '4h + WhatsApp'],
            ] as Array<[string, ...Array<boolean | string>]>).map((row) => (
              <tr key={row[0]} style={{ borderTop: '1px solid #f0f0f0' }}>
                <td style={{ padding: 8 }}>{row[0]}</td>
                {row.slice(1).map((v, i) => (
                  <td key={i} style={{ padding: 8, textAlign: 'center' }}>
                    {typeof v === 'boolean'
                      ? v
                        ? <CheckCircleFilled style={{ color: '#52c41a' }} />
                        : <MinusCircleFilled style={{ color: '#bfbfbf' }} />
                      : <Typography.Text>{v}</Typography.Text>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card title="Perguntas frequentes">
        <Collapse
          accordion
          ghost
          items={FAQ.map((item) => ({ key: item.key, label: item.q, children: <Typography.Paragraph>{item.a}</Typography.Paragraph> }))}
        />
      </Card>
    </div>
  )
}

export default BillingPlansPage
