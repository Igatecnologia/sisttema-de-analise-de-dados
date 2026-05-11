import { Alert, Button, Input, Modal, Space, Steps, Typography, message } from 'antd'
import { useEffect, useState } from 'react'
import { buildQrCodeUrl, confirmMfaSetup, initMfaSetup } from '../services/mfaService'

type Step = 'init' | 'confirm' | 'codes'

type Props = {
  open: boolean
  onClose: () => void
  onEnabled?: () => void
}

export function MfaSetupModal({ open, onClose, onEnabled }: Props) {
  const [step, setStep] = useState<Step>('init')
  const [otpauthUrl, setOtpauthUrl] = useState<string>('')
  const [secret, setSecret] = useState<string>('')
  const [totp, setTotp] = useState('')
  const [backupCodes, setBackupCodes] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setStep('init')
    setTotp('')
    setBackupCodes([])
    setErrorMsg(null)
    setLoading(true)
    initMfaSetup()
      .then((data) => {
        setOtpauthUrl(data.otpauthUrl)
        setSecret(data.secret)
        setStep('confirm')
      })
      .catch(() => setErrorMsg('Falha ao iniciar configuracao do 2FA.'))
      .finally(() => setLoading(false))
  }, [open])

  async function onConfirm() {
    setLoading(true)
    setErrorMsg(null)
    try {
      const result = await confirmMfaSetup(totp.trim())
      setBackupCodes(result.backupCodes)
      setStep('codes')
      const { trackEvent } = await import('../services/analytics')
      trackEvent('mfa_enabled')
      onEnabled?.()
    } catch {
      setErrorMsg('Codigo invalido. Confira no app autenticador e tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  function copyCodes() {
    navigator.clipboard.writeText(backupCodes.join('\n'))
      .then(() => message.success('Codigos copiados.'))
      .catch(() => message.error('Falha ao copiar.'))
  }

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title="Configurar autenticacao em dois fatores"
      footer={null}
      width={520}
      destroyOnHidden
    >
      <Steps
        size="small"
        current={step === 'init' ? 0 : step === 'confirm' ? 1 : 2}
        items={[
          { title: 'Escanear QR' },
          { title: 'Confirmar codigo' },
          { title: 'Backup codes' },
        ]}
        style={{ marginBottom: 24 }}
      />

      {errorMsg ? <Alert type="error" showIcon title={errorMsg} style={{ marginBottom: 16 }} /> : null}

      {step === 'confirm' ? (
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Typography.Text>
            Escaneie o QR abaixo com Google Authenticator, Authy, 1Password ou similar.
          </Typography.Text>
          <div style={{ textAlign: 'center', padding: 12 }}>
            {otpauthUrl ? (
              <img
                src={buildQrCodeUrl(otpauthUrl, 200)}
                alt="QR code do 2FA"
                width={200}
                height={200}
                style={{ borderRadius: 8 }}
              />
            ) : null}
          </div>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            Nao consegue escanear? Use este codigo:
          </Typography.Text>
          <Input.TextArea value={secret} readOnly autoSize rows={1} />
          <Typography.Text>Insira o codigo de 6 digitos gerado pelo app:</Typography.Text>
          <Input
            placeholder="000000"
            value={totp}
            onChange={(e) => setTotp(e.target.value.replace(/\D/g, '').slice(0, 6))}
            inputMode="numeric"
            maxLength={6}
          />
          <Button type="primary" onClick={onConfirm} loading={loading} disabled={totp.length !== 6} block>
            Ativar 2FA
          </Button>
        </Space>
      ) : null}

      {step === 'codes' ? (
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Alert
            type="warning"
            showIcon
            title="Guarde os codigos de backup agora"
            description="Estes codigos so sao mostrados uma vez. Cada codigo eh de uso unico e serve para entrar caso voce perca acesso ao app autenticador."
          />
          <Input.TextArea
            value={backupCodes.join('\n')}
            readOnly
            autoSize={{ minRows: 5, maxRows: 12 }}
            style={{ fontFamily: 'monospace' }}
          />
          <Space>
            <Button onClick={copyCodes}>Copiar codigos</Button>
            <Button type="primary" onClick={onClose}>Concluir</Button>
          </Space>
        </Space>
      ) : null}

      {step === 'init' ? <div style={{ textAlign: 'center', padding: 24 }}>Carregando...</div> : null}
    </Modal>
  )
}
