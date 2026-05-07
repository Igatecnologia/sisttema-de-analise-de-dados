import { Button, Modal, Space, Switch, Typography } from 'antd'
import { useEffect, useState } from 'react'

/**
 * Banner LGPD de consentimento — 3 categorias (essential / analytics / marketing).
 * Essenciais nao tem opt-out. Decisao salva em localStorage com versao.
 *
 * Uso: outros componentes consultam `getConsent()` para saber se podem disparar
 * GA4/Hotjar/etc.
 */
const STORAGE_KEY = 'iga.cookieConsent.v1'

export type ConsentChoice = {
  essential: true
  analytics: boolean
  marketing: boolean
  decidedAt: string
}

export function getConsent(): ConsentChoice | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<ConsentChoice>
    if (parsed && typeof parsed === 'object' && parsed.decidedAt) {
      return {
        essential: true,
        analytics: Boolean(parsed.analytics),
        marketing: Boolean(parsed.marketing),
        decidedAt: parsed.decidedAt,
      }
    }
    return null
  } catch {
    return null
  }
}

function saveConsent(choice: Omit<ConsentChoice, 'essential' | 'decidedAt'>) {
  const data: ConsentChoice = {
    essential: true,
    analytics: choice.analytics,
    marketing: choice.marketing,
    decidedAt: new Date().toISOString(),
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

export function CookieConsent() {
  const [visible, setVisible] = useState(false)
  const [details, setDetails] = useState(false)
  const [analytics, setAnalytics] = useState(false)
  const [marketing, setMarketing] = useState(false)

  useEffect(() => {
    const current = getConsent()
    if (!current) setVisible(true)
  }, [])

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
          left: 16,
          right: 16,
          maxWidth: 720,
          margin: '0 auto',
          padding: 20,
          background: 'white',
          borderRadius: 12,
          boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
          border: '1px solid #e6eaf0',
          zIndex: 9999,
        }}
      >
        <Typography.Title level={5} style={{ marginTop: 0 }}>Privacidade e cookies</Typography.Title>
        <Typography.Paragraph style={{ marginBottom: 12 }}>
          Usamos cookies essenciais para autenticacao e funcionamento. Cookies opcionais (analytics, marketing) ajudam a melhorar o produto. Voce pode aceitar tudo, recusar opcionais ou personalizar abaixo. Decisao gravada conforme LGPD.
        </Typography.Paragraph>
        <Space wrap>
          <Button type="primary" onClick={acceptAll}>Aceitar tudo</Button>
          <Button onClick={rejectOptional}>Apenas essenciais</Button>
          <Button type="link" onClick={() => setDetails(true)}>Personalizar</Button>
          <Button type="link" href="/legal/cookies" target="_blank">Saiba mais</Button>
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
