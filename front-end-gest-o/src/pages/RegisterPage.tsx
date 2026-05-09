import { Button, Card, Form, Input, Result, Steps, Typography } from 'antd'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listSegments, registerSelfService, type BusinessSegment, type SegmentInfo } from '../services/authService'
import { useTenant } from '../tenant/TenantContext'

type RegisterForm = {
  companyName: string
  name: string
  email: string
  password: string
}

function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64) || 'empresa'
}

const SEGMENT_ICONS: Record<BusinessSegment, string> = {
  industry: '🏭',
  commerce: '🛒',
  services: '🛠️',
  distribution: '🚚',
}

/** Fallback caso o /segments demore a responder. Mantido alinhado com back-end/src/segments.ts. */
const FALLBACK_SEGMENTS: SegmentInfo[] = [
  { id: 'industry', name: 'Indústria', description: 'Manufatura, produção, ficha técnica, estoque e produto acabado.', defaultModules: [], recommendedConnectorId: 'iga-custom-api', compatibleConnectors: [] },
  { id: 'commerce', name: 'Comércio', description: 'Varejo e atacado: vendas, clientes, estoque, compras e margem.', defaultModules: [], recommendedConnectorId: 'bling', compatibleConnectors: [] },
  { id: 'services', name: 'Serviços', description: 'Contratos, recorrência, cobrança e acompanhamento operacional.', defaultModules: [], recommendedConnectorId: 'omie', compatibleConnectors: [] },
  { id: 'distribution', name: 'Distribuição', description: 'Pedidos, logística, estoque multifilial e compras.', defaultModules: [], recommendedConnectorId: 'bling', compatibleConnectors: [] },
]

export function RegisterPage() {
  const tenant = useTenant()
  const [created, setCreated] = useState<{ slug: string; token?: string } | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [segments, setSegments] = useState<SegmentInfo[]>(FALLBACK_SEGMENTS)
  const [selectedSegment, setSelectedSegment] = useState<BusinessSegment>('industry')
  const [form] = Form.useForm<RegisterForm>()

  useEffect(() => {
    let active = true
    listSegments()
      .then((list) => {
        if (!active || list.length === 0) return
        setSegments(list)
      })
      .catch(() => {
        /** Fallback ja carregado — silencioso ou loga via Sentry. */
      })
    return () => {
      active = false
    }
  }, [])

  async function onFinish(values: RegisterForm) {
    setSubmitting(true)
    try {
      const slug = slugify(values.companyName)
      const response = await registerSelfService({
        ...values,
        slug,
        segment: selectedSegment,
      })
      setCreated({ slug: response.tenant.slug, token: response.verification?.token })
      const { trackEvent } = await import('../services/analytics')
      trackEvent('auth_register', { slug: response.tenant.slug, segment: selectedSegment })
    } finally {
      setSubmitting(false)
    }
  }

  if (created) {
    return (
      <div className="login-shell">
        <Card className="app-card" style={{ width: 'min(720px, 92vw)' }}>
          <Result
            status="success"
            title="Empresa criada"
            subTitle="Seu trial de 14 dias esta ativo. Verifique o email e conclua o onboarding."
            extra={[
              created.token ? <Link key="verify" to={`/verify-email?tenant=${created.slug}&token=${created.token}`}>Verificar email</Link> : null,
              <Link key="login" to={`/login?tenant=${created.slug}`}>Entrar</Link>,
            ]}
          />
        </Card>
      </div>
    )
  }

  return (
    <div className="login-shell register-shell">
      <div className="login-card-wrap" style={{ maxWidth: 980 }}>
        <div className="login-brand-strip">
          <img src={tenant.logoUrl} alt={tenant.companyName} className="login-header-logo" />
          <div>
            <div className="login-brand-text">Teste gratis</div>
            <div className="login-brand-sub">14 dias para validar dados, equipe e dashboards</div>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: 16 }}>
          <Card className="app-card">
            <Steps
              size="small"
              current={0}
              items={[{ title: 'Segmento' }, { title: 'Empresa' }, { title: 'Admin' }, { title: 'Onboarding' }]}
              style={{ marginBottom: 24 }}
            />
            <Typography.Title level={2}>Criar conta</Typography.Title>
            <Typography.Paragraph type="secondary" style={{ marginTop: -8 }}>
              14 dias grátis, sem cartão de crédito.
            </Typography.Paragraph>

            <Typography.Text strong style={{ display: 'block', marginBottom: 8 }}>
              Qual o segmento da sua empresa?
            </Typography.Text>
            <div
              role="radiogroup"
              aria-label="Segmento de negócio"
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                gap: 8,
                marginBottom: 16,
              }}
            >
              {segments.map((seg) => {
                const active = seg.id === selectedSegment
                return (
                  <button
                    key={seg.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => {
                      setSelectedSegment(seg.id)
                      void import('../services/analytics').then((m) => m.trackEvent('segment_selected', { segment: seg.id }))
                    }}
                    style={{
                      cursor: 'pointer',
                      padding: 12,
                      borderRadius: 12,
                      border: active ? '2px solid #1677ff' : '1px solid rgba(0,0,0,0.12)',
                      background: active ? 'rgba(22,119,255,0.08)' : 'transparent',
                      textAlign: 'left',
                      minHeight: 96,
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ fontSize: 22, lineHeight: 1, marginBottom: 4 }}>{SEGMENT_ICONS[seg.id]}</div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{seg.name}</div>
                    <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.55)', marginTop: 2 }}>{seg.description}</div>
                  </button>
                )
              })}
            </div>

            <Form<RegisterForm> form={form} layout="vertical" onFinish={onFinish}>
              <Form.Item name="companyName" label="Nome da empresa" rules={[{ required: true, min: 2 }]}>
                <Input maxLength={160} placeholder="Acme Indústria" />
              </Form.Item>
              <Form.Item name="name" label="Seu nome" rules={[{ required: true, min: 2 }]}>
                <Input maxLength={120} placeholder="Maria Silva" />
              </Form.Item>
              <Form.Item name="email" label="Email corporativo" rules={[{ required: true, type: 'email' }]}>
                <Input maxLength={254} placeholder="maria@acme.com.br" />
              </Form.Item>
              <Form.Item
                name="password"
                label="Senha"
                rules={[{ required: true, min: 12, message: 'Mínimo 12 caracteres.' }]}
                extra="Mínimo 12 caracteres. Use mistura de letras, números e símbolos."
              >
                <Input.Password maxLength={128} placeholder="••••••••••••" />
              </Form.Item>
              <Button type="primary" htmlType="submit" loading={submitting} block size="large">
                Começar trial grátis
              </Button>
              <Typography.Paragraph type="secondary" style={{ fontSize: 12, marginTop: 12, marginBottom: 0, textAlign: 'center' }}>
                Já tem conta? <Link to="/login">Entrar</Link>
              </Typography.Paragraph>
            </Form>
          </Card>
          <aside style={{ padding: 24, borderRadius: 16, background: 'rgba(22,119,255,0.08)', border: '1px solid rgba(22,119,255,0.18)' }}>
            <Typography.Title level={3}>Trial pronto para dados reais</Typography.Title>
            <Typography.Paragraph>
              Conecte seu ERP, planilhas ou uma API própria criada pela IGA. Cada segmento ganha módulos, dashboards e fluxos pré-configurados.
            </Typography.Paragraph>
            <Typography.Text strong>Inclui:</Typography.Text>
            <ul>
              <li>14 dias de teste</li>
              <li>Templates por segmento</li>
              <li>Permissões por perfil</li>
              <li>Convite de equipe</li>
            </ul>
          </aside>
        </div>
      </div>
    </div>
  )
}
