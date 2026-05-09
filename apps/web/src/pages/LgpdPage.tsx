import { Alert, Button, Card, Modal, Space, Typography, message } from 'antd'
import { useState } from 'react'
import { PageHeaderCard } from '../components/PageHeaderCard'
import { ScrollText } from 'lucide-react'
import { http } from '../services/http'
import { useAuth } from '../auth/AuthContext'

export function LgpdPage() {
  const { signOut } = useAuth()
  const [loading, setLoading] = useState<string | null>(null)
  const [confirmErase, setConfirmErase] = useState(false)
  const [confirmAnonymize, setConfirmAnonymize] = useState(false)

  async function downloadExport() {
    setLoading('export')
    void import('../services/analytics').then((m) => m.trackEvent('lgpd_export_requested'))
    try {
      const res = await http.get('/api/v1/lgpd/export', { responseType: 'blob' })
      const blob = new Blob([res.data as BlobPart], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `iga-export-${Date.now()}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch {
      message.error('Apenas admin do tenant pode exportar dados.')
    } finally {
      setLoading(null)
    }
  }

  async function downloadMyData() {
    setLoading('mydata')
    try {
      const { data } = await http.get('/api/v1/lgpd/my-data')
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `meus-dados-${Date.now()}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch {
      message.error('Falha ao baixar dados.')
    } finally {
      setLoading(null)
    }
  }

  async function doAnonymize() {
    setConfirmAnonymize(false)
    setLoading('anonymize')
    try {
      await http.post('/api/v1/lgpd/anonymize')
      void import('../services/analytics').then((m) => m.trackEvent('lgpd_anonymize_requested'))
      message.success('Sua conta foi anonimizada. Voce sera desconectado.')
      setTimeout(() => signOut(), 1500)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Falha ao anonimizar'
      message.error(msg)
    } finally {
      setLoading(null)
    }
  }

  async function doErase() {
    setConfirmErase(false)
    setLoading('erase')
    try {
      await http.post('/api/v1/lgpd/erase')
      void import('../services/analytics').then((m) => m.trackEvent('lgpd_erase_requested'))
      message.success('Sua conta foi marcada para exclusao. Voce sera desconectado.')
      setTimeout(() => signOut(), 1500)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Falha ao excluir'
      message.error(msg.includes('unico admin') ? 'Voce eh o unico admin ativo. Convide outro admin antes de excluir.' : msg)
    } finally {
      setLoading(null)
    }
  }

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <PageHeaderCard
        title="Privacidade e LGPD"
        subtitle="Exerça seus direitos previstos na Lei Geral de Proteção de Dados (Lei 13.709/2018)."
        icon={<ScrollText size={22} />}
        breadcrumbs={[{ label: 'Início', to: '/gestao' }, { label: 'Conta' }, { label: 'Privacidade (LGPD)' }]}
      />

      <Card title="Acesso aos seus dados">
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Typography.Text>Baixe um arquivo JSON com todos os dados pessoais que armazenamos sobre voce.</Typography.Text>
          <Space wrap>
            <Button onClick={downloadMyData} loading={loading === 'mydata'}>Baixar meus dados (JSON)</Button>
            <Button onClick={downloadExport} loading={loading === 'export'}>Exportar dados do tenant (admin)</Button>
          </Space>
        </Space>
      </Card>

      <Card title="Anonimizacao">
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Alert
            type="info"
            showIcon
            message="O que muda?"
            description="Seu nome e email viram [ANONIMIZADO]. Atividades historicas sao mantidas para fins estatisticos. Login fica indisponivel."
          />
          <Button danger onClick={() => setConfirmAnonymize(true)} loading={loading === 'anonymize'}>
            Anonimizar minha conta
          </Button>
        </Space>
      </Card>

      <Card title="Exclusao (right to be forgotten)">
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Alert
            type="warning"
            showIcon
            message="Acao irreversivel"
            description="Soft delete imediato + hard delete em 7 dias. Backups sao purgados em 30 dias. Dados financeiros mantidos 5 anos por obrigacao legal."
          />
          <Button danger onClick={() => setConfirmErase(true)} loading={loading === 'erase'}>
            Excluir minha conta
          </Button>
        </Space>
      </Card>

      <Card title="Outros direitos">
        <Typography.Paragraph>
          Para correcao, oposicao ou outros direitos previstos na LGPD Art. 18, entre em contato:
        </Typography.Paragraph>
        <Space direction="vertical">
          <Typography.Text><strong>Email DPO:</strong> lgpd@igagestao.com.br</Typography.Text>
          <Typography.Text type="secondary">SLA: resposta em ate 15 dias uteis.</Typography.Text>
        </Space>
      </Card>

      <Modal
        open={confirmAnonymize}
        title="Anonimizar conta"
        okText="Sim, anonimizar"
        okButtonProps={{ danger: true }}
        onCancel={() => setConfirmAnonymize(false)}
        onOk={doAnonymize}
      >
        <Typography.Paragraph>
          Voce nao podera mais fazer login com este email. Atividades historicas serao mantidas anonimizadas. Tem certeza?
        </Typography.Paragraph>
      </Modal>

      <Modal
        open={confirmErase}
        title="Excluir conta"
        okText="Sim, excluir"
        okButtonProps={{ danger: true }}
        onCancel={() => setConfirmErase(false)}
        onOk={doErase}
      >
        <Typography.Paragraph>
          Tem certeza? Esta acao eh irreversivel.
        </Typography.Paragraph>
      </Modal>
    </div>
  )
}

export default LgpdPage
