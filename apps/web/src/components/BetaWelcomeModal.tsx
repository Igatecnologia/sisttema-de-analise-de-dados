import { useEffect, useState } from 'react'
import { Button, Modal, Space, Typography, theme } from 'antd'
import { RocketOutlined, MessageOutlined, SafetyOutlined, ExportOutlined, ApiOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

const STORAGE_KEY = 'iga.betaWelcome.dismissed.v1'

/**
 * Modal de boas-vindas para clientes Beta — aparece no primeiro login do admin.
 * Localiza apenas via localStorage (não server-side) — se cliente limpar o
 * storage, vê de novo. É lembrete amigável, não bloqueador.
 *
 * Não aparece se:
 * - localStorage ja marcou como dismissed
 * - usuário não é admin (manager/viewer não veem)
 * - sessão tem `mustChangePassword` (prioriza modal de troca)
 */
export function BetaWelcomeModal() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!session) return
    if (session.user.role !== 'admin') return
    if (session.user.mustChangePassword) return
    try {
      if (localStorage.getItem(STORAGE_KEY) === '1') return
    } catch {
      return
    }
    /** Pequeno delay pra não competir com modal de Termos. */
    const timer = setTimeout(() => setOpen(true), 1200)
    return () => clearTimeout(timer)
  }, [session])

  const dismiss = () => {
    try {
      localStorage.setItem(STORAGE_KEY, '1')
    } catch {
      /* ignore */
    }
    setOpen(false)
  }

  return (
    <Modal
      open={open}
      onCancel={dismiss}
      onOk={dismiss}
      width={620}
      centered
      footer={
        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <Button type="text" onClick={dismiss}>
            Não mostrar novamente
          </Button>
          <Space>
            <Button onClick={dismiss}>Explorar depois</Button>
            {/* UX-M2 (audit): CTA primary direto pra ação principal — admin
                nao precisa ler texto, ja vai pro caminho mais valioso. */}
            <Button
              type="primary"
              onClick={() => { dismiss(); navigate('/fontes-de-dados') }}
              icon={<ApiOutlined />}
            >
              Cadastrar primeira fonte
            </Button>
          </Space>
        </Space>
      }
      title={
        <span>
          <RocketOutlined style={{ marginRight: 8, color: '#0052ff' }} />
          Bem-vindo ao Beta IGA Gestão
        </span>
      }
    >
      <Typography>
        <Typography.Paragraph style={{ fontSize: 15 }}>
          Você é um dos 5 administradores Beta. Antes de mais nada — obrigado por estar aqui.
        </Typography.Paragraph>

        <Typography.Title level={5} style={{ marginTop: 24 }}>
          Como funciona
        </Typography.Title>
        <Space direction="vertical" size="middle" style={{ width: '100%', marginTop: 8 }}>
          <FeatureRow
            icon={<RocketOutlined style={{ color: '#0052ff' }} />}
            title="Sem cobrança, sem cartão"
            desc="Você usa de graça enquanto durar o Beta. Vamos avisar com 30 dias de antecedência se algo mudar."
          />
          <FeatureRow
            icon={<MessageOutlined style={{ color: '#10b981' }} />}
            title="Suporte direto no WhatsApp"
            desc="Não somos bot. Travou alguma coisa? Manda mensagem que a gente ajuda em até 2h em horário comercial."
          />
          <FeatureRow
            icon={<SafetyOutlined style={{ color: '#f5a623' }} />}
            title="Sem SLA formal"
            desc="É Beta. Pode ter bug, pode ficar instável, podemos mudar coisas sem avisar. Em troca, você dá feedback honesto."
          />
          <FeatureRow
            icon={<ExportOutlined style={{ color: '#6e4eff' }} />}
            title="Seus dados são seus"
            desc="A qualquer momento você exporta tudo em /seguranca/lgpd. Sem amarras."
          />
        </Space>

        <NextStepHint />
      </Typography>
    </Modal>
  )
}

function NextStepHint() {
  const { token } = theme.useToken()
  return (
    <Typography.Paragraph
      style={{
        marginTop: 24,
        padding: 16,
        background: token.colorFillTertiary,
        borderRadius: 12,
        fontSize: 13,
        color: token.colorText,
      }}
    >
      <strong>Próximo passo:</strong> configure sua primeira fonte de dados em{' '}
      <strong>Fontes de Dados</strong> (no menu lateral). Em 10 minutos você está vendo seus
      dados reais no dashboard.
    </Typography.Paragraph>
  )
}

function FeatureRow({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode
  title: string
  desc: string
}) {
  const { token } = theme.useToken()
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          background: token.colorFillTertiary,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          fontSize: 16,
        }}
      >
        {icon}
      </div>
      <div>
        <div style={{ fontWeight: 600, fontSize: 14, color: token.colorText }}>{title}</div>
        <Typography.Text
          type="secondary"
          style={{ fontSize: 13, marginTop: 2, lineHeight: 1.5, display: 'block' }}
        >
          {desc}
        </Typography.Text>
      </div>
    </div>
  )
}
