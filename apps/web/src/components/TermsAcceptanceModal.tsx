import { useEffect, useState } from 'react'
import { Alert, App, Button, Checkbox, Modal, Typography } from 'antd'
import { FileTextOutlined } from '@ant-design/icons'
import { http } from '../services/http'
import { useAuth } from '../auth/AuthContext'

/**
 * SEC-4.4 — Modal blocker de aceite de Termos/Privacidade.
 * Aparece quando o backend retorna `needsAcceptance: true` em /legal/terms-status.
 * Bloqueia a UI ate o usuario aceitar a versao atual.
 */

type TermsStatus = {
  needsAcceptance: boolean
  currentVersion: { terms: string; privacy: string; documentHash: string }
  acceptedVersion: {
    terms: string
    privacy: string
    documentHash: string
    acceptedAt: string
  } | null
}

export function TermsAcceptanceModal() {
  const { session, signOut } = useAuth()
  const { notification } = App.useApp()
  const [status, setStatus] = useState<TermsStatus | null>(null)
  const [accepted, setAccepted] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!session) return
    let cancelled = false
    http
      .get<TermsStatus>('/api/v1/legal/terms-status')
      .then((res) => {
        if (!cancelled) setStatus(res.data)
      })
      .catch(() => {
        /** Falha silenciosa: nao bloqueia o app se o endpoint cair. */
      })
    return () => {
      cancelled = true
    }
  }, [session])

  const open = Boolean(status?.needsAcceptance && session)

  const handleAccept = async () => {
    if (!accepted) return
    try {
      setSubmitting(true)
      await http.post('/api/v1/legal/accept-terms')
      setStatus((prev) => (prev ? { ...prev, needsAcceptance: false } : prev))
      const { trackEvent } = await import('../services/analytics')
      trackEvent('terms_accepted', {
        termsVersion: status?.currentVersion.terms,
        privacyVersion: status?.currentVersion.privacy,
      })
      notification.success({
        message: 'Termos aceitos',
        description: 'Voce ja pode continuar usando o sistema.',
      })
    } catch (err) {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined
      notification.error({
        message: 'Falha ao registrar aceite',
        description: msg ?? (err instanceof Error ? err.message : 'Tente novamente'),
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open={open}
      title={
        <span>
          <FileTextOutlined style={{ marginRight: 8 }} />
          Atualizamos nossos Termos e Politica de Privacidade
        </span>
      }
      closable={false}
      maskClosable={false}
      keyboard={false}
      width={640}
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Button type="text" danger onClick={() => signOut()} disabled={submitting}>
            Sair sem aceitar
          </Button>
          <Button type="primary" loading={submitting} disabled={!accepted} onClick={handleAccept}>
            Aceitar e continuar
          </Button>
        </div>
      }
    >
      <Alert
        type="info"
        showIcon
        title="Sua acao eh necessaria para continuar"
        description={
          status
            ? `Versao atual: Termos ${status.currentVersion.terms} / Privacidade ${status.currentVersion.privacy}.`
            : 'Carregando versoes...'
        }
        style={{ marginBottom: 16 }}
      />
      <Typography.Paragraph>
        Atualizamos os documentos legais que regem o uso da IGA Gestao. Antes de continuar,
        confirme que leu e concorda com a versao atual.
      </Typography.Paragraph>
      <Typography.Paragraph>
        <a href="/legal/termos" target="_blank" rel="noopener noreferrer">
          Ver Termos de Uso
        </a>
        {' · '}
        <a href="/legal/privacidade" target="_blank" rel="noopener noreferrer">
          Ver Politica de Privacidade
        </a>
        {' · '}
        <a href="/legal/sub-processors" target="_blank" rel="noopener noreferrer">
          Sub-processadores
        </a>
      </Typography.Paragraph>
      <Checkbox checked={accepted} onChange={(e) => setAccepted(e.target.checked)}>
        Li e concordo com os Termos de Uso e a Politica de Privacidade atualizados.
      </Checkbox>
    </Modal>
  )
}
