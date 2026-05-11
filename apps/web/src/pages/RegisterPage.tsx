import { Alert, Button, Form, Input, Progress, Result, Steps, Typography } from 'antd'
import {
  ArrowLeft,
  ArrowRight,
  Briefcase,
  Building2,
  CheckCircle2,
  Factory,
  FileSearch,
  Loader2,
  Mail,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Truck,
  User,
  Lock,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  listSegments,
  registerSelfService,
  type BusinessSegment,
  type SegmentInfo,
} from '../services/authService'
import {
  CnpjNotFoundError,
  formatCnpj,
  isValidCnpj,
  lookupCnpj,
  sanitizeCnpj,
  type CnpjData,
} from '../services/cnpjLookupService'
import { useTenant } from '../tenant/TenantContext'

type RegisterForm = {
  companyName: string
  name: string
  email: string
  password: string
}

type Plan = 'pro' | 'enterprise'

function slugify(value: string): string {
  return (
    value
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 64) || 'empresa'
  )
}

const SEGMENT_ICONS: Record<BusinessSegment, ReactNode> = {
  industry: <Factory size={22} />,
  commerce: <ShoppingBag size={22} />,
  services: <Briefcase size={22} />,
  distribution: <Truck size={22} />,
}

const FALLBACK_SEGMENTS: SegmentInfo[] = [
  {
    id: 'industry',
    name: 'Indústria',
    description: 'Manufatura, produção, ficha técnica, estoque e produto acabado.',
    defaultModules: [],
    recommendedConnectorId: 'iga-custom-api',
    compatibleConnectors: [],
  },
  {
    id: 'commerce',
    name: 'Comércio',
    description: 'Varejo e atacado: vendas, clientes, estoque, compras e margem.',
    defaultModules: [],
    recommendedConnectorId: 'bling',
    compatibleConnectors: [],
  },
  {
    id: 'services',
    name: 'Serviços',
    description: 'Contratos, recorrência, cobrança e acompanhamento operacional.',
    defaultModules: [],
    recommendedConnectorId: 'omie',
    compatibleConnectors: [],
  },
  {
    id: 'distribution',
    name: 'Distribuição',
    description: 'Pedidos, logística, estoque multifilial e compras.',
    defaultModules: [],
    recommendedConnectorId: 'bling',
    compatibleConnectors: [],
  },
]

const PLANS: Array<{
  id: Plan
  name: string
  priceLabel: string
  pricePeriod: string
  description: string
  features: string[]
  highlight?: boolean
}> = [
  {
    id: 'pro',
    name: 'Pro',
    priceLabel: 'R$ 197',
    pricePeriod: '/mês por tenant',
    description: 'Para PMEs que precisam de BI completo + IA + integracoes.',
    features: [
      '14 dias de teste com dados reais',
      'Multi-ERP (SGBR, Bling, Tiny, Omie, API propria)',
      'Copilot IA + relatorios agendados',
      'Convite ilimitado de equipe',
      'Suporte por email (24h)',
    ],
    highlight: true,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    priceLabel: 'a partir de R$ 497',
    pricePeriod: '/mês por tenant',
    description: 'Recursos premium com SLA, SSO e custom connectors.',
    features: [
      'Tudo do Pro',
      'SSO SAML/OIDC (WorkOS)',
      'SLA 99,5% + suporte 4h',
      'Modelo Claude Opus 4.7 no Copilot',
      'Custom connectors + write-back',
    ],
  },
]

function passwordStrength(pw: string): { score: number; label: string; color: string } {
  if (!pw) return { score: 0, label: 'Digite sua senha', color: '#94a3b8' }
  let s = 0
  if (pw.length >= 12) s += 25
  if (pw.length >= 16) s += 10
  if (/[a-z]/.test(pw)) s += 15
  if (/[A-Z]/.test(pw)) s += 15
  if (/[0-9]/.test(pw)) s += 15
  if (/[^a-zA-Z0-9]/.test(pw)) s += 20
  if (s >= 90) return { score: s, label: 'Excelente', color: '#10b981' }
  if (s >= 70) return { score: s, label: 'Forte', color: '#22c55e' }
  if (s >= 50) return { score: s, label: 'Média', color: '#f59e0b' }
  return { score: Math.max(s, 8), label: 'Fraca', color: '#ef4444' }
}

export function RegisterPage() {
  const tenant = useTenant()
  const [step, setStep] = useState(0)
  const [created, setCreated] = useState<{ slug: string; token?: string } | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [segments, setSegments] = useState<SegmentInfo[]>(FALLBACK_SEGMENTS)
  const [selectedSegment, setSelectedSegment] = useState<BusinessSegment>('industry')
  const [selectedPlan, setSelectedPlan] = useState<Plan>('pro')
  const [form] = Form.useForm<RegisterForm>()
  const [companyName, setCompanyName] = useState('')
  const [cnpj, setCnpj] = useState('')
  const [cnpjLookup, setCnpjLookup] = useState<{
    state: 'idle' | 'loading' | 'found' | 'not-found' | 'invalid' | 'error'
    data?: CnpjData
    message?: string
  }>({ state: 'idle' })
  const [adminName, setAdminName] = useState('')
  const [adminEmail, setAdminEmail] = useState('')
  const [password, setPassword] = useState('')

  useEffect(() => {
    let active = true
    listSegments()
      .then((list) => {
        if (!active || list.length === 0) return
        setSegments(list)
      })
      .catch(() => {
        /* fallback ja carregado */
      })
    return () => {
      active = false
    }
  }, [])

  const slug = useMemo(() => slugify(companyName || 'empresa'), [companyName])

  // CNPJ lookup com debounce — chama BrasilAPI quando digits === 14
  useEffect(() => {
    const digits = sanitizeCnpj(cnpj)
    if (digits.length === 0) {
      setCnpjLookup({ state: 'idle' })
      return
    }
    if (digits.length < 14) {
      setCnpjLookup({ state: 'idle' })
      return
    }
    if (!isValidCnpj(digits)) {
      setCnpjLookup({ state: 'invalid', message: 'CNPJ inválido (dígitos verificadores).' })
      return
    }
    let active = true
    setCnpjLookup({ state: 'loading' })
    const timer = window.setTimeout(() => {
      lookupCnpj(digits)
        .then((data) => {
          if (!active) return
          setCnpjLookup({ state: 'found', data })
          // Auto-preenche o nome se estiver vazio
          if (!companyName.trim()) {
            setCompanyName(data.nomeFantasia || data.razaoSocial)
          }
        })
        .catch((err: unknown) => {
          if (!active) return
          if (err instanceof CnpjNotFoundError) {
            setCnpjLookup({ state: 'not-found', message: err.message })
          } else {
            setCnpjLookup({
              state: 'error',
              message: err instanceof Error ? err.message : 'Erro ao consultar CNPJ.',
            })
          }
        })
    }, 400)
    return () => {
      active = false
      window.clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cnpj])
  const strength = useMemo(() => passwordStrength(password), [password])
  const primaryColor = tenant.primaryColor || '#1d4ed8'

  const isStepValid = useMemo(() => {
    if (step === 0) return Boolean(selectedSegment)
    if (step === 1) return companyName.trim().length >= 2
    if (step === 2) {
      return (
        adminName.trim().length >= 2 &&
        /^\S+@\S+\.\S+$/.test(adminEmail) &&
        password.length >= 12 &&
        strength.score >= 50
      )
    }
    if (step === 3) return Boolean(selectedPlan)
    return false
  }, [step, selectedSegment, companyName, adminName, adminEmail, password, strength.score, selectedPlan])

  async function submit() {
    setSubmitting(true)
    setSubmitError(null)
    try {
      const response = await registerSelfService({
        companyName: companyName.trim(),
        name: adminName.trim(),
        email: adminEmail.trim().toLowerCase(),
        password,
        slug,
        segment: selectedSegment,
      })
      setCreated({ slug: response.tenant.slug, token: response.verification?.token })
      const { trackEvent } = await import('../services/analytics')
      trackEvent('auth_register', {
        slug: response.tenant.slug,
        segment: selectedSegment,
        plan: selectedPlan,
      })
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Falha ao criar conta. Tente novamente.')
    } finally {
      setSubmitting(false)
    }
  }

  if (created) {
    return (
      <div className="login-shell-premium">
        <div className="login-form-pane">
          <div className="login-form-inner" style={{ justifyContent: 'center' }}>
            <Result
              icon={
                <div
                  style={{
                    width: 72,
                    height: 72,
                    borderRadius: 18,
                    background: `${primaryColor}15`,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto',
                  }}
                >
                  <CheckCircle2 size={36} style={{ color: primaryColor }} />
                </div>
              }
              title="Empresa criada com sucesso"
              subTitle={`Trial de 14 dias ativo. Verifique seu email para concluir o cadastro.`}
              extra={[
                created.token ? (
                  <Link
                    key="verify"
                    to={`/verify-email?tenant=${created.slug}&token=${created.token}`}
                    style={{ marginRight: 12 }}
                  >
                    <Button size="large" type="primary" style={{ background: primaryColor, borderColor: primaryColor }}>
                      Verificar email
                    </Button>
                  </Link>
                ) : null,
                <Link key="login" to={`/login?tenant=${created.slug}`}>
                  <Button size="large">Ir para login</Button>
                </Link>,
              ]}
            />
          </div>
        </div>
        <aside
          className="login-hero-pane"
          style={{
            background: `linear-gradient(135deg, ${primaryColor}f0 0%, ${primaryColor}c0 60%, #0a1628 100%)`,
          }}
        >
          <div className="login-hero-mesh" aria-hidden />
          <div className="login-hero-content">
            <div className="login-hero-message" style={{ marginTop: 'auto' }}>
              <Typography.Title
                level={1}
                style={{
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: 'clamp(28px, 3.4vw, 44px)',
                  lineHeight: 1.1,
                  marginBottom: 16,
                }}
              >
                Próximos passos.
              </Typography.Title>
              <Typography.Paragraph
                style={{ color: 'rgba(255,255,255,0.85)', fontSize: 16, lineHeight: 1.6 }}
              >
                1. Verifique seu email e ative a conta.
                <br />
                2. Conecte seu ERP em <strong>Fontes de dados</strong>.
                <br />
                3. Convide sua equipe e aproveite os 14 dias.
              </Typography.Paragraph>
            </div>
          </div>
        </aside>
      </div>
    )
  }

  return (
    <div className="login-shell-premium">
      {/* Coluna esquerda — formulário multi-step */}
      <div className="login-form-pane">
        <div className="login-form-inner" style={{ maxWidth: 520 }}>
          <header className="login-header">
            {tenant.logoUrl ? (
              <img src={tenant.logoUrl} alt={tenant.companyName} className="login-logo" />
            ) : (
              <div
                className="login-logo"
                style={{
                  background: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}cc)`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Sparkles size={18} color="#fff" />
              </div>
            )}
            <div className="login-brand">
              <Typography.Text strong style={{ fontSize: 14, lineHeight: 1.2 }}>
                {tenant.companyName}
              </Typography.Text>
              <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                {tenant.subtitle}
              </Typography.Text>
            </div>
          </header>

          <div className="login-form-content">
            <div className="login-headline">
              <Typography.Title level={2} style={{ marginBottom: 6, fontWeight: 700, letterSpacing: '-0.02em' }}>
                Criar sua conta
              </Typography.Title>
              <Typography.Text type="secondary" style={{ fontSize: 14 }}>
                4 passos rápidos. 14 dias para validar com dados reais.
              </Typography.Text>
            </div>

            <Steps
              current={step}
              size="small"
              items={[
                { title: 'Segmento' },
                { title: 'Empresa' },
                { title: 'Administrador' },
                { title: 'Plano' },
              ]}
              style={{ marginBottom: 28 }}
            />

            {submitError && (
              <Alert type="error" showIcon title={submitError} style={{ marginBottom: 16 }} />
            )}

            {/* Step 1 — Segmento */}
            {step === 0 && (
              <div className="animate-fade-in">
                <Typography.Text strong style={{ display: 'block', marginBottom: 12 }}>
                  Qual o segmento da sua empresa?
                </Typography.Text>
                <div
                  role="radiogroup"
                  aria-label="Segmento de negócio"
                  style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}
                >
                  {segments.map((seg) => {
                    const active = seg.id === selectedSegment
                    return (
                      <button
                        key={seg.id}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => setSelectedSegment(seg.id)}
                        style={{
                          cursor: 'pointer',
                          padding: 16,
                          borderRadius: 12,
                          border: active
                            ? `2px solid ${primaryColor}`
                            : '1px solid rgba(0,0,0,0.12)',
                          background: active ? `${primaryColor}10` : 'transparent',
                          textAlign: 'left',
                          minHeight: 130,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 8,
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <div style={{ color: active ? primaryColor : 'rgba(0,0,0,0.55)' }}>
                          {SEGMENT_ICONS[seg.id]}
                        </div>
                        <div style={{ fontWeight: 600, fontSize: 15 }}>{seg.name}</div>
                        <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.55)', lineHeight: 1.4 }}>
                          {seg.description}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Step 2 — Empresa */}
            {step === 1 && (
              <div className="animate-fade-in">
                <Form layout="vertical" requiredMark={false} size="large">
                  <Form.Item
                    label="CNPJ (opcional — busca automática)"
                    extra="Digite o CNPJ e buscamos os dados da empresa na Receita Federal."
                  >
                    <Input
                      prefix={
                        cnpjLookup.state === 'loading' ? (
                          <Loader2
                            size={16}
                            style={{ color: primaryColor, animation: 'spin 1s linear infinite' }}
                          />
                        ) : cnpjLookup.state === 'found' ? (
                          <CheckCircle2 size={16} style={{ color: '#10b981' }} />
                        ) : (
                          <FileSearch size={16} style={{ color: '#94a3b8' }} />
                        )
                      }
                      value={formatCnpj(cnpj)}
                      onChange={(e) => setCnpj(e.target.value)}
                      maxLength={18}
                      placeholder="00.000.000/0000-00"
                      autoFocus
                      inputMode="numeric"
                      status={
                        cnpjLookup.state === 'invalid' || cnpjLookup.state === 'not-found' || cnpjLookup.state === 'error'
                          ? 'error'
                          : undefined
                      }
                    />
                  </Form.Item>

                  {cnpjLookup.state === 'found' && cnpjLookup.data && (
                    <Alert
                      type="success"
                      showIcon
                      icon={<CheckCircle2 size={16} />}
                      style={{ marginTop: -8, marginBottom: 16 }}
                      title={
                        <span style={{ fontSize: 13 }}>
                          <strong>{cnpjLookup.data.razaoSocial}</strong>
                          {cnpjLookup.data.nomeFantasia && cnpjLookup.data.nomeFantasia !== cnpjLookup.data.razaoSocial
                            ? ` — ${cnpjLookup.data.nomeFantasia}`
                            : ''}
                        </span>
                      }
                      description={
                        <div style={{ fontSize: 12, lineHeight: 1.5 }}>
                          {cnpjLookup.data.cnaePrincipal && (
                            <div>
                              <strong>Atividade:</strong> {cnpjLookup.data.cnaePrincipal}
                            </div>
                          )}
                          {cnpjLookup.data.municipio && cnpjLookup.data.uf && (
                            <div>
                              <strong>Local:</strong> {cnpjLookup.data.municipio}/{cnpjLookup.data.uf}
                            </div>
                          )}
                          {cnpjLookup.data.situacao && (
                            <div>
                              <strong>Situação:</strong>{' '}
                              <Typography.Text
                                style={{
                                  fontSize: 12,
                                  color: cnpjLookup.data.situacao === 'ATIVA' ? '#10b981' : '#ef4444',
                                  fontWeight: 600,
                                }}
                              >
                                {cnpjLookup.data.situacao}
                              </Typography.Text>
                            </div>
                          )}
                        </div>
                      }
                    />
                  )}
                  {(cnpjLookup.state === 'not-found' ||
                    cnpjLookup.state === 'invalid' ||
                    cnpjLookup.state === 'error') && (
                    <Alert
                      type={cnpjLookup.state === 'invalid' ? 'warning' : 'error'}
                      showIcon
                      style={{ marginTop: -8, marginBottom: 16 }}
                      title={cnpjLookup.message}
                    />
                  )}

                  <Form.Item label="Nome da empresa" required>
                    <Input
                      prefix={<Building2 size={16} style={{ color: '#94a3b8' }} />}
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      maxLength={160}
                      placeholder="Ex: Indústria Acme Ltda"
                    />
                  </Form.Item>
                  {companyName.trim().length >= 2 && (
                    <div
                      style={{
                        padding: 12,
                        borderRadius: 8,
                        background: 'var(--qc-surface-2, rgba(22,119,255,0.05))',
                        marginTop: -8,
                      }}
                    >
                      <Typography.Text style={{ fontSize: 12, color: 'var(--qc-text-muted, #64748b)' }}>
                        Sua URL será:{' '}
                        <code
                          style={{
                            background: 'rgba(0,0,0,0.06)',
                            padding: '2px 6px',
                            borderRadius: 4,
                            fontSize: 12,
                          }}
                        >
                          {slug}.igagestao.com.br
                        </code>
                      </Typography.Text>
                    </div>
                  )}
                </Form>
              </div>
            )}

            {/* Step 3 — Admin */}
            {step === 2 && (
              <div className="animate-fade-in">
                <Form form={form} layout="vertical" requiredMark={false} size="large">
                  <Form.Item label="Seu nome" required>
                    <Input
                      prefix={<User size={16} style={{ color: '#94a3b8' }} />}
                      value={adminName}
                      onChange={(e) => setAdminName(e.target.value)}
                      maxLength={120}
                      placeholder="Maria Silva"
                      autoFocus
                    />
                  </Form.Item>
                  <Form.Item label="Email corporativo" required>
                    <Input
                      prefix={<Mail size={16} style={{ color: '#94a3b8' }} />}
                      value={adminEmail}
                      onChange={(e) => setAdminEmail(e.target.value)}
                      maxLength={254}
                      placeholder="maria@acme.com.br"
                      type="email"
                    />
                  </Form.Item>
                  <Form.Item label="Senha" required style={{ marginBottom: 8 }}>
                    <Input.Password
                      prefix={<Lock size={16} style={{ color: '#94a3b8' }} />}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      maxLength={128}
                      placeholder="••••••••••••"
                    />
                  </Form.Item>
                  <div style={{ marginBottom: 16 }}>
                    <Progress
                      percent={strength.score}
                      strokeColor={strength.color}
                      showInfo={false}
                      size="small"
                    />
                    <Typography.Text style={{ fontSize: 12, color: strength.color, fontWeight: 500 }}>
                      Força: {strength.label}
                    </Typography.Text>
                    <Typography.Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 4 }}>
                      Mínimo 12 caracteres. Use letras maiúsculas, números e símbolos para senha forte.
                    </Typography.Text>
                  </div>
                </Form>
              </div>
            )}

            {/* Step 4 — Plano */}
            {step === 3 && (
              <div className="animate-fade-in">
                <Typography.Text strong style={{ display: 'block', marginBottom: 12 }}>
                  Escolha seu plano
                </Typography.Text>
                <Typography.Text type="secondary" style={{ fontSize: 13, display: 'block', marginBottom: 16 }}>
                  Você ganha <strong>14 dias de teste</strong> antes da primeira cobrança.
                  Cancele quando quiser.
                </Typography.Text>
                <div style={{ display: 'grid', gap: 12 }}>
                  {PLANS.map((plan) => {
                    const active = plan.id === selectedPlan
                    return (
                      <button
                        key={plan.id}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => setSelectedPlan(plan.id)}
                        style={{
                          cursor: 'pointer',
                          padding: 18,
                          borderRadius: 12,
                          border: active
                            ? `2px solid ${primaryColor}`
                            : '1px solid rgba(0,0,0,0.12)',
                          background: active ? `${primaryColor}08` : 'transparent',
                          textAlign: 'left',
                          position: 'relative',
                        }}
                      >
                        {plan.highlight && (
                          <span
                            style={{
                              position: 'absolute',
                              top: -10,
                              right: 16,
                              background: primaryColor,
                              color: '#fff',
                              fontSize: 10,
                              fontWeight: 700,
                              padding: '3px 10px',
                              borderRadius: 12,
                              letterSpacing: '0.05em',
                              textTransform: 'uppercase',
                            }}
                          >
                            Recomendado
                          </span>
                        )}
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'flex-start',
                            marginBottom: 8,
                          }}
                        >
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 18 }}>{plan.name}</div>
                            <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.55)' }}>
                              {plan.description}
                            </div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontWeight: 700, fontSize: 18, color: primaryColor }}>
                              {plan.priceLabel}
                            </div>
                            <div style={{ fontSize: 11, color: 'rgba(0,0,0,0.55)' }}>
                              {plan.pricePeriod}
                            </div>
                          </div>
                        </div>
                        <ul style={{ listStyle: 'none', padding: 0, margin: '12px 0 0', fontSize: 13 }}>
                          {plan.features.map((f) => (
                            <li
                              key={f}
                              style={{
                                display: 'flex',
                                gap: 8,
                                alignItems: 'flex-start',
                                marginBottom: 6,
                                color: 'rgba(0,0,0,0.7)',
                              }}
                            >
                              <CheckCircle2
                                size={14}
                                style={{ color: primaryColor, flexShrink: 0, marginTop: 2 }}
                              />
                              <span>{f}</span>
                            </li>
                          ))}
                        </ul>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Navegação */}
            <div
              style={{
                display: 'flex',
                gap: 12,
                marginTop: 28,
                justifyContent: step === 0 ? 'flex-end' : 'space-between',
              }}
            >
              {step > 0 && (
                <Button
                  size="large"
                  onClick={() => setStep(step - 1)}
                  icon={<ArrowLeft size={16} />}
                  style={{ height: 48 }}
                >
                  Voltar
                </Button>
              )}
              {step < 3 ? (
                <Button
                  type="primary"
                  size="large"
                  disabled={!isStepValid}
                  onClick={() => setStep(step + 1)}
                  style={{
                    height: 48,
                    minWidth: 160,
                    background: primaryColor,
                    borderColor: primaryColor,
                    fontWeight: 600,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    justifyContent: 'center',
                  }}
                >
                  Continuar
                  <ArrowRight size={16} />
                </Button>
              ) : (
                <Button
                  type="primary"
                  size="large"
                  loading={submitting}
                  disabled={!isStepValid}
                  onClick={submit}
                  style={{
                    height: 48,
                    minWidth: 200,
                    background: primaryColor,
                    borderColor: primaryColor,
                    fontWeight: 600,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    justifyContent: 'center',
                  }}
                >
                  Criar conta
                  {!submitting && <ArrowRight size={16} />}
                </Button>
              )}
            </div>

            <div
              style={{
                marginTop: 24,
                padding: '14px 18px',
                background: 'var(--qc-surface-2, rgba(22, 119, 255, 0.05))',
                border: '1px solid var(--qc-border, rgba(22, 119, 255, 0.12))',
                borderRadius: 12,
                textAlign: 'center',
              }}
            >
              <Typography.Text style={{ fontSize: 13, color: 'var(--qc-text)' }}>
                Já tem uma conta?{' '}
                <Link to="/login" style={{ fontWeight: 600, color: primaryColor }}>
                  Fazer login
                </Link>
              </Typography.Text>
            </div>
          </div>

          <footer className="login-footer">
            <Typography.Text type="secondary" style={{ fontSize: 11 }}>
              <ShieldCheck size={11} style={{ display: 'inline', verticalAlign: -2, marginRight: 4 }} />
              Sem cartão de crédito durante os 14 dias. Ao criar conta você concorda com os{' '}
              <Link to="/legal/termos">Termos</Link> e a <Link to="/legal/privacidade">Privacidade</Link>.
            </Typography.Text>
          </footer>
        </div>
      </div>

      {/* Coluna direita — hero */}
      <aside
        className="login-hero-pane"
        style={{
          background: `linear-gradient(135deg, ${primaryColor}f0 0%, ${primaryColor}c0 60%, #0a1628 100%)`,
        }}
      >
        <div className="login-hero-mesh" aria-hidden />
        <div className="login-hero-content">
          <div className="login-hero-top">
            <Typography.Text
              style={{
                color: 'rgba(255,255,255,0.85)',
                fontSize: 13,
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
              }}
            >
              {tenant.companyName} · Trial 14 dias
            </Typography.Text>
          </div>

          <div className="login-hero-message">
            <Typography.Title
              level={1}
              style={{
                color: '#fff',
                fontWeight: 700,
                fontSize: 'clamp(28px, 3.4vw, 44px)',
                lineHeight: 1.1,
                marginBottom: 16,
                letterSpacing: '-0.03em',
              }}
            >
              Conecte seu ERP. Tome decisões com dados.
            </Typography.Title>
            <Typography.Paragraph
              style={{
                color: 'rgba(255,255,255,0.8)',
                fontSize: 16,
                lineHeight: 1.6,
                marginBottom: 32,
                maxWidth: 480,
              }}
            >
              Em até 10 minutos seu painel está rodando com dados reais do seu ERP, dashboards por
              segmento e Copilot IA pronto para responder perguntas em linguagem natural.
            </Typography.Paragraph>

            <div className="login-hero-features">
              <FeatureRow
                title="Setup em minutos"
                description="Wizard de 5 passos: perfil → marca → conector → templates → equipe."
              />
              <FeatureRow
                title="Dados reais do seu ERP"
                description="SGBR, Bling, Tiny, Omie, API própria ou CSV. Sem reescrever planilhas."
              />
              <FeatureRow
                title="14 dias para validar"
                description="Cancele antes do dia 14 sem cobrança. Decida com base no que viu."
              />
            </div>
          </div>

          <div className="login-hero-bottom">
            <div className="login-hero-stats">
              <div>
                <div className="login-hero-stat-value">4</div>
                <div className="login-hero-stat-label">Segmentos</div>
              </div>
              <div className="login-hero-divider" />
              <div>
                <div className="login-hero-stat-value">7</div>
                <div className="login-hero-stat-label">Conectores</div>
              </div>
              <div className="login-hero-divider" />
              <div>
                <div className="login-hero-stat-value">99,5%</div>
                <div className="login-hero-stat-label">Uptime SLA</div>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </div>
  )
}

function FeatureRow({ title, description }: { title: string; description: string }) {
  return (
    <div className="login-hero-feature">
      <div className="login-hero-feature-bullet">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
          <path
            d="M11.667 4L5.5 10.167 2.333 7"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <div>
        <div style={{ color: '#fff', fontSize: 15, fontWeight: 600, marginBottom: 2 }}>{title}</div>
        <div style={{ color: 'rgba(255,255,255,0.72)', fontSize: 13, lineHeight: 1.5 }}>{description}</div>
      </div>
    </div>
  )
}
