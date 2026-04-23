import {
  Alert,
  Button,
  Form,
  Input,
  Modal,
  Radio,
  Space,
  Tag,
  Typography,
  message as antdMessage,
} from 'antd'
import { ExternalLink, KeyRound, TestTube2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { http } from '../services/http'

type Props = {
  open: boolean
  onClose: () => void
  onSaved?: () => void
}

type Provider = 'auto' | 'groq' | 'local'

type ConfigPublic = {
  provider: Provider
  groqApiKeySet: boolean
  groqApiKeyMasked: string | null
  groqModel: string | null
}

type TestResult =
  | { ok: true; provider: string; displayName?: string; sample?: string; note?: string }
  | { ok: false; provider?: string; error: string }

export function CopilotSettingsModal({ open, onClose, onSaved }: Props) {
  const [form] = Form.useForm<{
    provider: Provider
    groqApiKey: string
    groqModel: string
  }>()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [config, setConfig] = useState<ConfigPublic | null>(null)
  const [testResult, setTestResult] = useState<TestResult | null>(null)

  useEffect(() => {
    if (!open) return
    setTestResult(null)
    setLoading(true)
    void (async () => {
      try {
        const { data } = await http.get<ConfigPublic>('/api/v1/copilot/config')
        setConfig(data)
        form.setFieldsValue({
          provider: data.provider,
          groqApiKey: '',
          groqModel: data.groqModel ?? 'llama-3.3-70b-versatile',
        })
      } catch {
        antdMessage.error('Falha ao carregar configuração')
      } finally {
        setLoading(false)
      }
    })()
  }, [open, form])

  async function handleSave() {
    const values = await form.validateFields()
    setSaving(true)
    try {
      const payload: Record<string, unknown> = {
        provider: values.provider,
        groqModel: values.groqModel || null,
      }
      // Input vazio = manter chave existente; "__clear__" = limpar
      if (values.groqApiKey === '__clear__') payload.groqApiKey = null
      else if (values.groqApiKey.trim()) payload.groqApiKey = values.groqApiKey.trim()

      const { data } = await http.put<ConfigPublic>('/api/v1/copilot/config', payload)
      setConfig(data)
      form.setFieldValue('groqApiKey', '')
      antdMessage.success('Configuração salva')
      onSaved?.()
    } catch (err) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Falha ao salvar'
      antdMessage.error(msg)
    } finally {
      setSaving(false)
    }
  }

  async function handleTest() {
    setTesting(true)
    setTestResult(null)
    try {
      const { data } = await http.post<TestResult>('/api/v1/copilot/config/test')
      setTestResult(data)
    } catch (err) {
      const response = (err as { response?: { data?: TestResult } }).response
      setTestResult(response?.data ?? { ok: false, error: 'Erro inesperado' })
    } finally {
      setTesting(false)
    }
  }

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={
        <Space>
          <KeyRound size={16} />
          Configurações do Copiloto IA
        </Space>
      }
      width={560}
      footer={
        <Space>
          <Button onClick={onClose}>Fechar</Button>
          <Button icon={<TestTube2 size={14} />} loading={testing} onClick={() => void handleTest()}>
            Testar
          </Button>
          <Button type="primary" loading={saving} onClick={() => void handleSave()}>
            Salvar
          </Button>
        </Space>
      }
      destroyOnClose
    >
      <Typography.Paragraph type="secondary" style={{ fontSize: 13 }}>
        O copiloto usa <strong>Groq</strong> — gratuito, rápido e sem cartão de crédito.
        A chave é criptografada no banco (AES-256-GCM) e nunca sai desta máquina.
      </Typography.Paragraph>

      <Form form={form} layout="vertical" disabled={loading}>
        <Form.Item name="provider" label="Modo do copiloto">
          <Radio.Group>
            <Space direction="vertical">
              <Radio value="auto">
                <strong>Automático</strong> — usa Groq se configurado, senão local
              </Radio>
              <Radio value="groq">
                <strong>Groq</strong> — IA real com tool calling (recomendado)
              </Radio>
              <Radio value="local">
                <strong>Apenas local</strong> — regex + dados do sistema (sem LLM)
              </Radio>
            </Space>
          </Radio.Group>
        </Form.Item>

        <Typography.Title level={5} style={{ marginTop: 16, marginBottom: 8 }}>
          Groq
        </Typography.Title>
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 12 }}
          message={
            <Space size={4}>
              <span>Obtenha uma chave gratuita em</span>
              <a href="https://console.groq.com/keys" target="_blank" rel="noreferrer">
                console.groq.com/keys <ExternalLink size={11} style={{ verticalAlign: 'middle' }} />
              </a>
            </Space>
          }
          description="Tier gratuito: 30 req/min, 14.400 req/dia. Sem cartão de crédito."
        />
        <Form.Item
          name="groqApiKey"
          label={
            <Space>
              <span>Chave da API</span>
              {config?.groqApiKeySet && <Tag color="green">{config.groqApiKeyMasked}</Tag>}
            </Space>
          }
          extra={
            config?.groqApiKeySet
              ? 'Deixe em branco para manter a chave atual. Digite "__clear__" para remover.'
              : 'Cole aqui sua chave gsk_...'
          }
        >
          <Input.Password autoComplete="off" placeholder={config?.groqApiKeySet ? '•••••••••••• (já configurada)' : 'gsk_...'} />
        </Form.Item>
        <Form.Item name="groqModel" label="Modelo" extra="llama-3.3-70b-versatile (recomendado — tool calling nativo, qualidade alta)">
          <Input placeholder="llama-3.3-70b-versatile" />
        </Form.Item>
      </Form>

      {testResult && (
        <Alert
          type={testResult.ok ? 'success' : 'error'}
          style={{ marginTop: 12 }}
          showIcon
          message={
            testResult.ok
              ? `Conectado: ${testResult.displayName ?? testResult.provider}`
              : `Falha: ${testResult.error}`
          }
          description={testResult.ok ? testResult.note ?? (testResult.sample ? `Resposta: "${testResult.sample}"` : undefined) : undefined}
        />
      )}
    </Modal>
  )
}
