import { Alert, Button, Form, Input, Typography } from 'antd'
import { ArrowLeft, ArrowRight, KeyRound, Mail, ShieldCheck, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useTenant } from '../tenant/TenantContext'
import { requestPasswordReset } from '../services/authService'

export function ForgotPasswordPage() {
  const tenant = useTenant()
  const [params] = useSearchParams()
  const tenantParam = params.get('tenant') ?? ''
  const [token, setToken] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submittedEmail, setSubmittedEmail] = useState('')

  async function onFinish(values: { email: string }) {
    setSubmitting(true)
    setSubmittedEmail(values.email)
    try {
      const response = await requestPasswordReset(values.email)
      setToken(response.token ?? '')
    } finally {
      setSubmitting(false)
    }
  }

  const primaryColor = tenant.primaryColor || '#1d4ed8'

  return (
    <div className="login-shell-premium">
      {/* Coluna esquerda: formulário */}
      <div className="login-form-pane">
        <div className="login-form-inner">
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
            <Link
              to="/login"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 13,
                color: 'var(--qc-text-muted, #94a3b8)',
                marginBottom: 20,
                fontWeight: 500,
              }}
            >
              <ArrowLeft size={14} />
              Voltar para login
            </Link>

            <div className="login-headline">
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 12,
                  background: `${primaryColor}15`,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 16,
                }}
              >
                <KeyRound size={24} style={{ color: primaryColor }} />
              </div>
              <Typography.Title
                level={2}
                style={{ marginBottom: 6, fontWeight: 700, letterSpacing: '-0.02em' }}
              >
                Recuperar senha
              </Typography.Title>
              <Typography.Text type="secondary" style={{ fontSize: 14, lineHeight: 1.5 }}>
                Informe o email cadastrado e enviaremos um link para redefinir sua senha.
              </Typography.Text>
            </div>

            {token !== null ? (
              <div>
                <Alert
                  type="success"
                  showIcon
                  title="Verifique seu email"
                  description={
                    <>
                      Se o email <strong>{submittedEmail}</strong> existir em nossa base, enviamos as
                      instruções de recuperação. Cheque também sua caixa de spam.
                      {token ? (
                        <div style={{ marginTop: 12 }}>
                          <Link
                            to={`/reset-password?${tenantParam ? `tenant=${tenantParam}&` : ''}token=${token}`}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                              color: primaryColor,
                              fontWeight: 600,
                            }}
                          >
                            Abrir link de redefinição
                            <ArrowRight size={14} />
                          </Link>
                        </div>
                      ) : null}
                    </>
                  }
                  style={{ marginBottom: 16 }}
                />
                <Button
                  type="default"
                  block
                  size="large"
                  onClick={() => setToken(null)}
                  style={{ height: 48, fontSize: 15 }}
                >
                  Tentar com outro email
                </Button>
              </div>
            ) : (
              <Form
                layout="vertical"
                onFinish={onFinish}
                size="large"
                requiredMark={false}
              >
                <Form.Item
                  label="Email cadastrado"
                  name="email"
                  rules={[
                    { required: true, message: 'Informe o email.' },
                    { type: 'email', message: 'Email inválido.' },
                    { max: 254, message: 'Máximo 254 caracteres.' },
                  ]}
                  normalize={(v: string) => v.trim()}
                >
                  <Input
                    prefix={
                      <Mail size={16} style={{ color: 'var(--qc-text-muted, #94a3b8)', flexShrink: 0 }} />
                    }
                    placeholder="seu@email.com"
                    autoComplete="email"
                    maxLength={254}
                  />
                </Form.Item>

                <Button
                  type="primary"
                  htmlType="submit"
                  loading={submitting}
                  block
                  size="large"
                  style={{
                    height: 48,
                    fontSize: 15,
                    fontWeight: 600,
                    background: primaryColor,
                    borderColor: primaryColor,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                  }}
                >
                  Enviar link de recuperação
                  {!submitting && <ArrowRight size={18} />}
                </Button>
              </Form>
            )}
          </div>

          <footer className="login-footer">
            <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block' }}>
              <ShieldCheck size={12} style={{ display: 'inline', verticalAlign: -2, marginRight: 4 }} />
              Não compartilhamos seu email. O link expira em 1h.
            </Typography.Text>
          </footer>
        </div>
      </div>

      {/* Hero pane simplificada */}
      <aside
        className="login-hero-pane"
        style={{ background: `linear-gradient(135deg, ${primaryColor}f0 0%, ${primaryColor}c0 60%, #0a1628 100%)` }}
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
              {tenant.companyName} · Recuperação de acesso
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
              Sem stress. Sua conta está segura.
            </Typography.Title>
            <Typography.Paragraph
              style={{
                color: 'rgba(255,255,255,0.8)',
                fontSize: 16,
                lineHeight: 1.6,
                maxWidth: 480,
              }}
            >
              Em alguns segundos você recebe um link único e seguro para criar uma nova senha.
              Se você ativou a autenticação em dois fatores, ela continua protegendo sua conta.
            </Typography.Paragraph>
          </div>

          <div className="login-hero-bottom">
            <div className="login-hero-stats">
              <div>
                <div className="login-hero-stat-value">SHA-256</div>
                <div className="login-hero-stat-label">Hash chain</div>
              </div>
              <div className="login-hero-divider" />
              <div>
                <div className="login-hero-stat-value">Argon2id</div>
                <div className="login-hero-stat-label">Senha</div>
              </div>
              <div className="login-hero-divider" />
              <div>
                <div className="login-hero-stat-value">MFA</div>
                <div className="login-hero-stat-label">2FA opcional</div>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </div>
  )
}
