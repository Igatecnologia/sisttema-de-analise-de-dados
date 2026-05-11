import { Button, Card, Progress, Space, Tag, Typography } from 'antd'
import { Check, ChevronRight, Database, Palette, Sparkles, Users, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { hasAnySources, listDataSources } from '../services/dataSourceService'
import { listUsers } from '../services/usersService'
import { useTenant } from '../tenant/TenantContext'
import { queryKeys } from '../query/queryKeys'
import { hasOpenedCopilot, markCopilotOpened, OPEN_COPILOT_EVENT } from './gettingStartedEvents'

const { Title, Text } = Typography

const DISMISS_KEY = 'iga.gettingStarted.dismissed'

type Step = {
  id: 'datasource' | 'team' | 'brand' | 'copilot'
  title: string
  description: string
  cta: string
  href?: string
  onAction?: () => void
  icon: React.ReactNode
  done: boolean
}

export function GettingStartedChecklist() {
  const tenant = useTenant()
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(DISMISS_KEY) === '1'
    } catch {
      return false
    }
  })
  const [copilotOpened, setCopilotOpened] = useState(() => {
    return hasOpenedCopilot()
  })

  // Re-checa flag do copilot quando volta pro foco (caso usuário abra copilot e volte)
  useEffect(() => {
    function recheck() {
      setCopilotOpened(hasOpenedCopilot())
    }
    window.addEventListener('focus', recheck)
    window.addEventListener('storage', recheck)
    return () => {
      window.removeEventListener('focus', recheck)
      window.removeEventListener('storage', recheck)
    }
  }, [])

  const dataSourcesQuery = useQuery({
    queryKey: ['datasources', 'list'],
    queryFn: listDataSources,
    staleTime: 60_000,
  })

  const usersQuery = useQuery({
    queryKey: queryKeys.users({ q: '', role: 'all', status: 'all' }),
    queryFn: listUsers,
    staleTime: 60_000,
  })

  const hasDataSource = (dataSourcesQuery.data && dataSourcesQuery.data.length > 0) || hasAnySources()
  const hasInvitedTeam = (usersQuery.data?.length ?? 0) > 1
  const hasCustomBrand = Boolean(tenant.logoUrl) || Boolean(tenant.primaryColor)

  const steps = useMemo<Step[]>(
    () => [
      {
        id: 'datasource',
        title: 'Conectar uma fonte de dados',
        description: 'Plug seu ERP, BI ou suba CSV pra ver os dashboards com dados reais.',
        cta: 'Conectar agora',
        href: '/fontes-de-dados',
        icon: <Database size={18} />,
        done: Boolean(hasDataSource),
      },
      {
        id: 'team',
        title: 'Convidar o time',
        description: 'Mande convite por email pros colegas — vendas, finanças, ops.',
        cta: 'Convidar pessoas',
        href: '/usuarios',
        icon: <Users size={18} />,
        done: hasInvitedTeam,
      },
      {
        id: 'brand',
        title: 'Personalizar a marca',
        description: 'Coloque seu logo e cor primária — o app vira a sua cara.',
        cta: 'Customizar',
        href: '/configuracoes',
        icon: <Palette size={18} />,
        done: hasCustomBrand,
      },
      {
        id: 'copilot',
        title: 'Conhecer o Copilot IA',
        description: 'Pergunte em linguagem natural — "qual produto mais lucrou em maio?"',
        cta: 'Abrir Copilot',
        onAction: () => {
          markCopilotOpened()
          setCopilotOpened(true)
          window.dispatchEvent(new CustomEvent(OPEN_COPILOT_EVENT))
        },
        icon: <Sparkles size={18} />,
        done: copilotOpened,
      },
    ],
    [hasDataSource, hasInvitedTeam, hasCustomBrand, copilotOpened],
  )

  const doneCount = steps.filter((s) => s.done).length
  const allDone = doneCount === steps.length

  if (dismissed || allDone) return null

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, '1')
    } catch {
      /* ignora */
    }
    setDismissed(true)
  }

  return (
    <Card
      className="app-card no-hover"
      variant="borderless"
      styles={{
        body: {
          padding: 20,
          background: 'linear-gradient(135deg, var(--qc-primary-light) 0%, transparent 60%)',
        },
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 16 }}>
        <Space direction="vertical" size={4} style={{ flex: 1, minWidth: 0 }}>
          <Space size={8} align="center" wrap>
            <Title level={4} style={{ margin: 0 }}>
              Começando com a IGA
            </Title>
            <Tag color="blue">{doneCount} / {steps.length}</Tag>
          </Space>
          <Text type="secondary" style={{ fontSize: 13 }}>
            Quatro passos rápidos pra deixar sua conta no jeito.
          </Text>
        </Space>
        <Button
          type="text"
          size="small"
          icon={<X size={14} />}
          onClick={dismiss}
          aria-label="Dispensar guia"
        />
      </div>

      <Progress
        percent={Math.round((doneCount / steps.length) * 100)}
        showInfo={false}
        size="small"
        style={{ marginBottom: 16 }}
      />

      <Space direction="vertical" size={8} style={{ width: '100%' }}>
        {steps.map((step) => (
          <StepRow key={step.id} step={step} />
        ))}
      </Space>
    </Card>
  )
}

function StepRow({ step }: { step: Step }) {
  const content = (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 12px',
        borderRadius: 10,
        background: step.done ? 'rgba(82,196,26,0.08)' : 'var(--qc-surface)',
        border: `1px solid ${step.done ? 'rgba(82,196,26,0.25)' : 'var(--qc-border-subtle)'}`,
        transition: 'background 120ms ease',
      }}
    >
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: step.done ? 'rgba(82,196,26,0.15)' : 'rgba(22,119,255,0.08)',
          color: step.done ? 'var(--qc-success)' : 'var(--qc-primary)',
          flexShrink: 0,
        }}
      >
        {step.done ? <Check size={18} /> : step.icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <Text strong style={{ display: 'block', textDecoration: step.done ? 'line-through' : 'none', opacity: step.done ? 0.7 : 1 }}>
          {step.title}
        </Text>
        {!step.done ? (
          <Text type="secondary" style={{ fontSize: 12 }}>
            {step.description}
          </Text>
        ) : null}
      </div>
      {!step.done ? (
        <Space size={6}>
          <Text style={{ color: 'var(--qc-primary)', fontWeight: 500, fontSize: 13 }}>{step.cta}</Text>
          <ChevronRight size={16} color="var(--qc-primary)" />
        </Space>
      ) : (
        <Tag color="success" style={{ margin: 0 }}>Pronto</Tag>
      )}
    </div>
  )

  if (step.done) return content
  if (step.href) return <Link to={step.href} style={{ display: 'block', color: 'inherit' }}>{content}</Link>
  return (
    <button
      onClick={step.onAction}
      style={{
        background: 'none',
        border: 'none',
        padding: 0,
        cursor: 'pointer',
        width: '100%',
        textAlign: 'inherit',
        color: 'inherit',
      }}
    >
      {content}
    </button>
  )
}
