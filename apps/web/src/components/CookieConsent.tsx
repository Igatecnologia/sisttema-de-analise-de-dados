import { Button, Modal, Space, Switch, Typography } from 'antd'
import { useState } from 'react'
import { getConsent, saveConsent } from './cookieConsentStore'

/**
 * Banner LGPD de consentimento — 3 categorias (essential / analytics / marketing).
 * Essenciais nao tem opt-out. Decisao salva em localStorage com versao.
 *
 * Uso: outros componentes consultam `getConsent()` para saber se podem disparar
 * GA4/Hotjar/etc.
 */
export function CookieConsent() {
  const [visible, setVisible] = useState(() => getConsent() === null)
  const [details, setDetails] = useState(false)
  const [analytics, setAnalytics] = useState(false)
  const [marketing, setMarketing] = useState(false)

  if (!visible) return null

  function acceptAll() {
    saveConsent({ analytics: true, marketing: true })
    setVisible(false)
  }
  function rejectOptional() {
    saveConsent({ analytics: false, marketing: false })
    setVisible(false)
  }
  function saveCustom() {
    saveConsent({ analytics, marketing })
    setDetails(false)
    setVisible(false)
  }

  return (
    <>
      <div
        role="dialog"
        aria-label="Consentimento de cookies"
        style={{
          position: 'fixed',
          bottom: 16,
          right: 16,
          maxWidth: 380,
          padding: '14px 16px',
          background: 'var(--qc-glass-bg, rgba(255,255,255,0.95))',
          backdropFilter: 'blur(var(--qc-glass-blur, 12px))',
          WebkitBackdropFilter: 'blur(var(--qc-glass-blur, 12px))',
          color: 'var(--qc-text)',
          borderRadius: 12,
          boxShadow: 'var(--qc-shadow-lg, 0 8px 32px rgba(0,0,0,0.18))',
          border: '1px solid var(--qc-border-subtle, #e6eaf0)',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <span
            aria-hidden
            style={{
              fontSize: 18,
              lineHeight: 1,
              filter: 'grayscale(0.2)',
            }}
          >
            🍪
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2 }}>Cookies & privacidade</div>
            <div style={{ fontSize: 12, color: 'var(--qc-text-muted, #64748b)', lineHeight: 1.45 }}>
              Usamos essenciais para login + opcionais para melhorar o produto.{' '}
              <a href="/legal/cookies" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--qc-primary)' }}>
                Saiba mais
              </a>
            </div>
          </div>
        </div>
        <Space size={6} wrap>
          <Button type="primary" size="small" onClick={acceptAll}>Aceitar tudo</Button>
          <Button size="small" onClick={rejectOptional}>Apenas essenciais</Button>
          <Button type="text" size="small" onClick={() => setDetails(true)}>Personalizar</Button>
        </Space>
      </div>

      <Modal
        open={details}
        title="Personalizar cookies"
        onCancel={() => setDetails(false)}
        onOk={saveCustom}
        okText="Salvar preferencias"
      >
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <div>
            <Space style={{ justifyContent: 'space-between', width: '100%' }}>
              <Typography.Text strong>Essenciais</Typography.Text>
              <Switch checked disabled />
            </Space>
            <Typography.Paragraph type="secondary" style={{ margin: 0, fontSize: 12 }}>
              Necessarios para login, sessao, CSRF e seguranca. Nao podem ser desativados.
            </Typography.Paragraph>
          </div>
          <div>
            <Space style={{ justifyContent: 'space-between', width: '100%' }}>
              <Typography.Text strong>Analytics</Typography.Text>
              <Switch checked={analytics} onChange={setAnalytics} />
            </Space>
            <Typography.Paragraph type="secondary" style={{ margin: 0, fontSize: 12 }}>
              Metricas anonimas de uso (pagina, tempo, navegador). Ajuda a priorizar melhorias.
            </Typography.Paragraph>
          </div>
          <div>
            <Space style={{ justifyContent: 'space-between', width: '100%' }}>
              <Typography.Text strong>Marketing</Typography.Text>
              <Switch checked={marketing} onChange={setMarketing} />
            </Space>
            <Typography.Paragraph type="secondary" style={{ margin: 0, fontSize: 12 }}>
              Comunicacoes e ofertas relevantes ao seu perfil. Sem trocar dados com terceiros.
            </Typography.Paragraph>
          </div>
        </Space>
      </Modal>
    </>
  )
}
