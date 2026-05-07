import { Alert, Button, Card, Input, Modal, Space, Tag, Typography, message } from 'antd'
import { useEffect, useState } from 'react'
import { PageHeaderCard } from '../components/PageHeaderCard'
import { MfaSetupModal } from '../components/MfaSetupModal'
import {
  disableMfa,
  getMfaStatus,
  regenerateMfaBackupCodes,
  type MfaStatus,
} from '../services/mfaService'

export function SecurityPage() {
  const [status, setStatus] = useState<MfaStatus | null>(null)
  const [loading, setLoading] = useState(false)
  const [setupOpen, setSetupOpen] = useState(false)

  const [disableOpen, setDisableOpen] = useState(false)
  const [disablePassword, setDisablePassword] = useState('')
  const [disableTotp, setDisableTotp] = useState('')

  const [regenOpen, setRegenOpen] = useState(false)
  const [regenPassword, setRegenPassword] = useState('')
  const [regenTotp, setRegenTotp] = useState('')
  const [regenCodes, setRegenCodes] = useState<string[] | null>(null)

  async function refresh() {
    setLoading(true)
    try {
      setStatus(await getMfaStatus())
    } catch {
      message.error('Falha ao carregar status do 2FA')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
  }, [])

  async function onDisable() {
    try {
      await disableMfa(disablePassword, disableTotp.trim())
      message.success('2FA desativado.')
      setDisableOpen(false)
      setDisablePassword('')
      setDisableTotp('')
      void refresh()
    } catch {
      message.error('Senha ou codigo invalidos.')
    }
  }

  async function onRegenerate() {
    try {
      const codes = await regenerateMfaBackupCodes(regenPassword, regenTotp.trim())
      setRegenCodes(codes)
      setRegenPassword('')
      setRegenTotp('')
      void refresh()
    } catch {
      message.error('Senha ou codigo invalidos.')
    }
  }

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <PageHeaderCard
        title="Seguranca da conta"
        subtitle="Gerencie autenticacao em dois fatores e codigos de recuperacao."
      />

      <Card title="Autenticacao em dois fatores (2FA)" loading={loading}>
        {status?.enabled ? (
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <Tag color="green">Ativada</Tag>
            <Typography.Text>
              Seu login exige um codigo do app autenticador alem da senha.
            </Typography.Text>
            <Typography.Text type="secondary">
              Codigos de backup restantes: <strong>{status.backupCodesRemaining}</strong>
            </Typography.Text>
            <Space wrap>
              <Button onClick={() => setRegenOpen(true)}>Regerar codigos de backup</Button>
              <Button danger onClick={() => setDisableOpen(true)}>Desativar 2FA</Button>
            </Space>
          </Space>
        ) : (
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <Alert
              type="info"
              showIcon
              message="2FA nao esta ativada"
              description="Recomendamos fortemente ativar o segundo fator. Mesmo com a senha vazada, ninguem entra na sua conta sem o codigo do seu celular."
            />
            <Button type="primary" onClick={() => setSetupOpen(true)}>Configurar 2FA</Button>
          </Space>
        )}
      </Card>

      <MfaSetupModal
        open={setupOpen}
        onClose={() => setSetupOpen(false)}
        onEnabled={() => void refresh()}
      />

      <Modal
        open={disableOpen}
        title="Desativar 2FA"
        onCancel={() => setDisableOpen(false)}
        onOk={onDisable}
        okText="Desativar"
        okButtonProps={{ danger: true, disabled: !disablePassword || disableTotp.length < 6 }}
      >
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Typography.Text>Confirme com sua senha e um codigo TOTP atual.</Typography.Text>
          <Input.Password
            placeholder="Senha atual"
            value={disablePassword}
            onChange={(e) => setDisablePassword(e.target.value)}
            autoComplete="current-password"
          />
          <Input
            placeholder="Codigo de 6 digitos ou backup"
            value={disableTotp}
            onChange={(e) => setDisableTotp(e.target.value)}
            inputMode="numeric"
            maxLength={16}
          />
        </Space>
      </Modal>

      <Modal
        open={regenOpen}
        title="Regerar codigos de backup"
        onCancel={() => { setRegenOpen(false); setRegenCodes(null) }}
        footer={regenCodes ? <Button type="primary" onClick={() => { setRegenOpen(false); setRegenCodes(null) }}>Concluir</Button> : undefined}
        onOk={!regenCodes ? onRegenerate : undefined}
        okButtonProps={{ disabled: !regenPassword || regenTotp.length < 6 }}
        okText="Gerar novos codigos"
      >
        {regenCodes ? (
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <Alert type="warning" showIcon message="Os codigos antigos foram invalidados. Guarde os novos agora." />
            <Input.TextArea
              value={regenCodes.join('\n')}
              readOnly
              autoSize={{ minRows: 5, maxRows: 12 }}
              style={{ fontFamily: 'monospace' }}
            />
          </Space>
        ) : (
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <Typography.Text>Confirme com sua senha e um codigo TOTP atual.</Typography.Text>
            <Input.Password
              placeholder="Senha atual"
              value={regenPassword}
              onChange={(e) => setRegenPassword(e.target.value)}
              autoComplete="current-password"
            />
            <Input
              placeholder="Codigo de 6 digitos"
              value={regenTotp}
              onChange={(e) => setRegenTotp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              inputMode="numeric"
              maxLength={6}
            />
          </Space>
        )}
      </Modal>
    </div>
  )
}

export default SecurityPage
