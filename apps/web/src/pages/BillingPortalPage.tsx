import { Alert, Badge, Button, Card, Col, Progress, Row, Skeleton, Space, Tag, Typography, message } from 'antd'
import { Link } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import {
  ArrowUpRight,
  Calendar,
  CreditCard,
  Database,
  ExternalLink,
  FileText,
  Shield,
  Sparkles,
  Users,
} from 'lucide-react'
import { getBillingStatus, openBillingPortal, type BillingStatus } from '../services/billingService'

const { Title, Text } = Typography

const STATUS_LABEL: Record<string, string> = {
  active: 'Ativo',
  trialing: 'Em trial',
  trial_expired: 'Trial expirado',
  past_due: 'Pagamento atrasado',
  canceled: 'Cancelado',
  unpaid: 'Sem pagamento',
  grace: 'Período de graça',
  incomplete: 'Incompleto',
}

const STATUS_BADGE: Record<string, 'success' | 'processing' | 'warning' | 'error' | 'default'> = {
  active: 'success',
  trialing: 'processing',
  trial_expired: 'error',
  past_due: 'warning',
  canceled: 'default',
  unpaid: 'error',
  grace: 'warning',
  incomplete: 'warning',
}

const PLAN_LABEL: Record<string, string> = {
  trial: 'Trial',
  starter: 'Starter',
  pro: 'Pro',
  enterprise: 'Enterprise',
}

const PLAN_GRADIENT: Record<string, string> = {
  trial: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 50%, #06b6d4 100%)',
  starter: 'linear-gradient(135deg, #0891b2 0%, #06b6d4 100%)',
  pro: 'linear-gradient(135deg, #6d28d9 0%, #8b5cf6 50%, #ec4899 100%)',
  enterprise: 'linear-gradient(135deg, #b45309 0%, #f59e0b 50%, #fbbf24 100%)',
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch {
    return iso
  }
}

function daysBetween(iso: string | null): number | null {
  if (!iso) return null
  const ms = Date.parse(iso) - Date.now()
  if (!Number.isFinite(ms)) return null
  return Math.ceil(ms / (24 * 60 * 60 * 1000))
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
      message.error('Tenant ainda não tem assinatura ativa. Vá em Planos primeiro.')
      setOpening(false)
    }
  }

  if (loading) {
    return (
      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Skeleton.Node active style={{ width: '100%', height: 220 }} />
        <Skeleton active />
      </div>
    )
  }

  if (!status) {
    return (
      <div style={{ padding: 16 }}>
        <Alert type="error" showIcon title="Não foi possível carregar status de billing." />
      </div>
    )
  }

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <HeroCard status={status} opening={opening} onOpenPortal={onOpenPortal} />

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={14}>
          <PeriodCard status={status} />
        </Col>
        <Col xs={24} lg={10}>
          <ActionsCard status={status} opening={opening} onOpenPortal={onOpenPortal} />
        </Col>
      </Row>

      <UsageSection status={status} />

      <DocumentsCard />
    </div>
  )
}

function HeroCard({ status, opening, onOpenPortal }: { status: BillingStatus; opening: boolean; onOpenPortal: () => void }) {
  const planLabel = PLAN_LABEL[status.plan] ?? status.plan
  const gradient = PLAN_GRADIENT[status.plan] ?? PLAN_GRADIENT.trial
  const isTrial = status.status === 'trialing' || status.plan === 'trial'
  const trialDays = daysBetween(status.trialEndsAt)
  const periodDays = daysBetween(status.currentPeriodEnd)
  const days = isTrial ? trialDays : periodDays
  const ringPercent = useMemo(() => {
    if (days == null) return 100
    if (isTrial) {
      const total = 14
      const used = Math.max(0, total - Math.max(0, days))
      return Math.min(100, Math.round((used / total) * 100))
    }
    if (periodDays != null) {
      const used = Math.max(0, 30 - Math.max(0, periodDays))
      return Math.min(100, Math.round((used / 30) * 100))
    }
    return 0
  }, [days, isTrial, periodDays])

  return (
    <Card
      variant="borderless"
      styles={{
        body: {
          padding: 0,
          background: gradient,
          borderRadius: 16,
          color: '#fff',
          overflow: 'hidden',
          position: 'relative',
        },
      }}
      style={{ overflow: 'hidden', border: 'none' }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'radial-gradient(circle at 90% -10%, rgba(255,255,255,0.18), transparent 40%), radial-gradient(circle at -10% 110%, rgba(255,255,255,0.12), transparent 40%)',
          pointerEvents: 'none',
        }}
      />

      <div style={{ position: 'relative', padding: 28 }}>
        <Row align="middle" gutter={[24, 24]}>
          <Col xs={24} md={16}>
            <Space size={8} style={{ opacity: 0.85, fontSize: 13 }}>
              <Sparkles size={14} />
              Sua assinatura
            </Space>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginTop: 8, flexWrap: 'wrap' }}>
              <Title level={1} style={{ color: '#fff', margin: 0, fontSize: 44, fontWeight: 700, letterSpacing: -1 }}>
                {planLabel}
              </Title>
              <Badge
                status={STATUS_BADGE[status.status] ?? 'default'}
                text={
                  <span style={{ color: '#fff', fontWeight: 500 }}>
                    {STATUS_LABEL[status.status] ?? status.status}
                  </span>
                }
              />
              {status.cancelAtPeriodEnd ? (
                <Tag color="warning" style={{ marginLeft: 4 }}>
                  Cancelamento agendado
                </Tag>
              ) : null}
            </div>

            <Text style={{ color: 'rgba(255,255,255,0.85)', display: 'block', marginTop: 8, fontSize: 14 }}>
              {isTrial && trialDays != null && trialDays > 0
                ? `Trial expira em ${formatDate(status.trialEndsAt)} — aproveite pra plugar dados, convidar o time e testar tudo.`
                : isTrial && trialDays != null && trialDays <= 0
                ? 'Seu trial expirou. Assine um plano pra continuar usando.'
                : status.currentPeriodEnd
                ? `Próxima cobrança em ${formatDate(status.currentPeriodEnd)}.`
                : 'Plano sem renovação automática.'}
            </Text>

            <Space size={8} wrap style={{ marginTop: 20 }}>
              <Link to="/planos">
                <Button type="primary" size="large" icon={<ArrowUpRight size={16} />} style={{ background: '#fff', color: '#111', borderColor: '#fff', fontWeight: 600 }}>
                  {isTrial ? 'Assinar plano' : 'Mudar de plano'}
                </Button>
              </Link>
              <Button
                size="large"
                ghost
                icon={<ExternalLink size={16} />}
                loading={opening}
                onClick={onOpenPortal}
                disabled={!status.stripeEnabled}
              >
                Portal de pagamento
              </Button>
            </Space>
          </Col>

          <Col xs={24} md={8}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
              <div
                style={{
                  position: 'relative',
                  background: 'rgba(255,255,255,0.12)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: 16,
                  padding: 20,
                  minWidth: 200,
                  textAlign: 'center',
                  backdropFilter: 'blur(8px)',
                }}
              >
                <Progress
                  type="circle"
                  percent={ringPercent}
                  size={120}
                  strokeColor="#fff"
                  trailColor="rgba(255,255,255,0.2)"
                  format={() =>
                    days != null && days > 0 ? (
                      <div>
                        <div style={{ color: '#fff', fontSize: 28, fontWeight: 700, lineHeight: 1 }}>{days}</div>
                        <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: 11, marginTop: 4, textTransform: 'uppercase', letterSpacing: 1 }}>
                          {days === 1 ? 'dia' : 'dias'}
                        </div>
                      </div>
                    ) : (
                      <div style={{ color: '#fff', fontSize: 14, fontWeight: 600 }}>
                        {days != null && days <= 0 ? 'Expirado' : '—'}
                      </div>
                    )
                  }
                />
                <Text style={{ color: 'rgba(255,255,255,0.85)', display: 'block', marginTop: 12, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 }}>
                  {isTrial ? 'restantes do trial' : 'até a renovação'}
                </Text>
              </div>
            </div>
          </Col>
        </Row>

        {!status.access.allowed ? (
          <Alert
            type="error"
            showIcon
            title="Acesso bloqueado"
            description={
              status.access.reason === 'trial_expired'
                ? 'Seu trial expirou. Assine um plano para continuar usando.'
                : 'Sua assinatura não está ativa. Atualize o pagamento para liberar acesso completo.'
            }
            style={{ marginTop: 20, background: 'rgba(255,255,255,0.95)' }}
          />
        ) : null}
      </div>
    </Card>
  )
}

function PeriodCard({ status }: { status: BillingStatus }) {
  const items: Array<{ icon: React.ReactNode; label: string; value: React.ReactNode; muted?: boolean }> = [
    {
      icon: <Calendar size={16} />,
      label: 'Trial até',
      value: status.trialEndsAt ? formatDate(status.trialEndsAt) : '—',
    },
    {
      icon: <CreditCard size={16} />,
      label: status.cancelAtPeriodEnd ? 'Termina em' : 'Próxima cobrança',
      value: status.currentPeriodEnd ? formatDate(status.currentPeriodEnd) : '—',
    },
    {
      icon: <Shield size={16} />,
      label: 'Acesso',
      value: status.access.allowed ? (
        <Tag color="success" style={{ margin: 0 }}>
          Total
        </Tag>
      ) : (
        <Tag color="error" style={{ margin: 0 }}>
          Somente leitura
        </Tag>
      ),
    },
    {
      icon: <FileText size={16} />,
      label: 'Pagamento online',
      value: status.stripeEnabled ? (
        <Tag color="blue" style={{ margin: 0 }}>
          Habilitado
        </Tag>
      ) : (
        <Tag style={{ margin: 0 }}>Manual</Tag>
      ),
    },
  ]

  return (
    <Card title="Detalhes da assinatura" style={{ height: '100%' }}>
      <Space direction="vertical" size={0} style={{ width: '100%' }}>
        {items.map((item, i) => (
          <div
            key={item.label}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '14px 0',
              borderBottom: i < items.length - 1 ? '1px solid var(--qc-border-subtle)' : 'none',
            }}
          >
            <Space size={10} style={{ color: 'var(--qc-text-muted)' }}>
              {item.icon}
              <Text style={{ color: 'var(--qc-text-muted)' }}>{item.label}</Text>
            </Space>
            <div style={{ fontWeight: 500 }}>{item.value}</div>
          </div>
        ))}
      </Space>
    </Card>
  )
}

function ActionsCard({ status, opening, onOpenPortal }: { status: BillingStatus; opening: boolean; onOpenPortal: () => void }) {
  return (
    <Card title="Ações rápidas" style={{ height: '100%' }}>
      <Space direction="vertical" size={10} style={{ width: '100%' }}>
        <Link to="/planos" style={{ display: 'block' }}>
          <Button block size="large" type="primary" icon={<ArrowUpRight size={16} />}>
            Comparar e mudar de plano
          </Button>
        </Link>
        <Button
          block
          size="large"
          icon={<ExternalLink size={16} />}
          loading={opening}
          onClick={onOpenPortal}
          disabled={!status.stripeEnabled}
        >
          Portal de pagamento (Stripe)
        </Button>
        <Button
          block
          size="large"
          icon={<FileText size={16} />}
          loading={opening}
          onClick={onOpenPortal}
          disabled={!status.stripeEnabled}
        >
          Ver faturas e recibos
        </Button>
        {!status.stripeEnabled ? (
          <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 4 }}>
            Pagamento online ainda não configurado pra este tenant. Fale com o suporte.
          </Text>
        ) : null}
      </Space>
    </Card>
  )
}

function UsageSection({ status }: { status: BillingStatus }) {
  const items = [
    {
      label: 'Usuários',
      icon: <Users size={18} />,
      used: status.usage?.users ?? 0,
      limit: status.limits?.users ?? null,
    },
    {
      label: 'Fontes de dados',
      icon: <Database size={18} />,
      used: status.usage?.datasources ?? 0,
      limit: status.limits?.datasources ?? null,
    },
    {
      label: 'Mensagens do Copilot',
      icon: <Sparkles size={18} />,
      used: status.usage?.copilotMessagesMonthly ?? 0,
      limit: status.limits?.copilotMessagesMonthly ?? null,
      sub: 'no mês',
    },
  ]

  return (
    <Card
      title="Uso do plano"
      extra={
        <Text type="secondary" style={{ fontSize: 12 }}>
          Limites aplicados em tempo real
        </Text>
      }
    >
      <Row gutter={[16, 16]}>
        {items.map((item) => (
          <Col key={item.label} xs={24} md={8}>
            <UsageRing {...item} />
          </Col>
        ))}
      </Row>
    </Card>
  )
}

function UsageRing({
  label,
  icon,
  used,
  limit,
  sub,
}: {
  label: string
  icon: React.ReactNode
  used: number
  limit: number | null
  sub?: string
}) {
  const unlimited = limit == null || limit <= 0
  const percent = unlimited ? 0 : Math.min(100, Math.round((used / limit) * 100))
  const color = unlimited ? '#52c41a' : percent >= 100 ? '#ff4d4f' : percent >= 80 ? '#faad14' : '#1d4ed8'

  return (
    <div
      style={{
        display: 'flex',
        gap: 16,
        alignItems: 'center',
        padding: 12,
        borderRadius: 12,
        background: 'var(--qc-surface)',
        border: '1px solid var(--qc-border-subtle)',
      }}
    >
      <Progress
        type="circle"
        size={72}
        percent={unlimited ? 100 : percent}
        strokeColor={color}
        trailColor="var(--qc-border-subtle)"
        strokeWidth={9}
        format={() =>
          unlimited ? <span style={{ fontSize: 14, color }}>∞</span> : <span style={{ fontWeight: 600, fontSize: 14 }}>{percent}%</span>
        }
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <Space size={6} style={{ color: 'var(--qc-text-muted)' }}>
          {icon}
          <Text style={{ color: 'var(--qc-text-muted)', fontSize: 13 }}>{label}</Text>
        </Space>
        <div style={{ marginTop: 4, fontSize: 22, fontWeight: 700, lineHeight: 1.1 }}>
          {used.toLocaleString('pt-BR')}
          <Text type="secondary" style={{ fontSize: 14, fontWeight: 500, marginLeft: 6 }}>
            / {unlimited ? 'ilimitado' : limit.toLocaleString('pt-BR')}
          </Text>
        </div>
        {sub ? (
          <Text type="secondary" style={{ fontSize: 11 }}>
            {sub}
          </Text>
        ) : null}
      </div>
    </div>
  )
}

function DocumentsCard() {
  const links: Array<{ to: string; label: string; description: string }> = [
    { to: '/legal/termos', label: 'Termos de uso', description: 'Condições contratuais do serviço' },
    { to: '/legal/privacidade', label: 'Política de privacidade', description: 'Como tratamos dados pessoais' },
    { to: '/seguranca/lgpd', label: 'Solicitar dados / exclusão (LGPD)', description: 'Exporte ou apague seus dados' },
  ]
  return (
    <Card title="Documentos e direitos">
      <Row gutter={[12, 12]}>
        {links.map((link) => (
          <Col key={link.to} xs={24} md={8}>
            <Link to={link.to} style={{ display: 'block' }}>
              <div
                style={{
                  padding: 14,
                  borderRadius: 10,
                  border: '1px solid var(--qc-border-subtle)',
                  background: 'var(--qc-surface)',
                  transition: 'all 120ms ease',
                  height: '100%',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--qc-primary)'
                  e.currentTarget.style.transform = 'translateY(-1px)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--qc-border-subtle)'
                  e.currentTarget.style.transform = 'translateY(0)'
                }}
              >
                <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                  <Text strong>{link.label}</Text>
                  <ArrowUpRight size={14} color="var(--qc-text-muted)" />
                </Space>
                <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 4 }}>
                  {link.description}
                </Text>
              </div>
            </Link>
          </Col>
        ))}
      </Row>
    </Card>
  )
}

export default BillingPortalPage
