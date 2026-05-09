import {
  Alert,
  Button,
  Form,
  Input,
  Modal,
  Select,
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

type Provider = 'auto' | 'openai' | 'anthropic' | 'gemini' | 'groq' | 'openrouter' | 'custom' | 'local'

type ConfigPublic = {
  provider: Provider
  apiKeySet: boolean
  apiKeyMasked: string | null
  model: string | null
  baseUrl: string | null
}

type TestResult =
  | { ok: true; provider: string; displayName?: string; sample?: string; note?: string }
  | { ok: false; provider?: string; error: string }

type ProviderInfo = {
  label: string
  description: string
  defaultModel: string
  keyDocsUrl: string
  keyDocsLabel: string
  keyPlaceholder: string
  freeNote?: string
  needsBaseUrl?: boolean
}

const PROVIDERS: Record<Exclude<Provider, 'auto' | 'local'>, ProviderInfo> = {
  openai: {
    label: 'OpenAI',
    description: 'GPT-4o, GPT-4o-mini, GPT-4-turbo. Pago por uso.',
    defaultModel: 'gpt-4o-mini',
    keyDocsUrl: 'https://platform.openai.com/api-keys',
    keyDocsLabel: 'platform.openai.com/api-keys',
    keyPlaceholder: 'sk-proj-...',
  },
  anthropic: {
    label: 'Anthropic Claude',
    description: 'Claude Opus 4.7, Sonnet 4.6, Haiku 4.5. Melhor qualidade do mercado.',
    defaultModel: 'claude-sonnet-4-6',
    keyDocsUrl: 'https://console.anthropic.com/settings/keys',
    keyDocsLabel: 'console.anthropic.com',
    keyPlaceholder: 'sk-ant-api03-...',
  },
  gemini: {
    label: 'Google Gemini',
    description: 'Gemini 2.0 Flash (rapido), 1.5 Pro (longo contexto).',
    defaultModel: 'gemini-2.0-flash',
    keyDocsUrl: 'https://aistudio.google.com/apikey',
    keyDocsLabel: 'aistudio.google.com',
    keyPlaceholder: 'AIza...',
    freeNote: 'Free tier: 15 RPM em Gemini 2.0 Flash.',
  },
  groq: {
    label: 'Groq',
    description: 'Llama 3.3 70B, Mixtral. Velocidade extrema (>500 tok/s).',
    defaultModel: 'llama-3.3-70b-versatile',
    keyDocsUrl: 'https://console.groq.com/keys',
    keyDocsLabel: 'console.groq.com',
    keyPlaceholder: 'gsk_...',
    freeNote: 'Free tier: 30 RPM, 14.400 req/dia. Sem cartao.',
  },
  openrouter: {
    label: 'OpenRouter',
    description: 'Acesso unificado a 200+ modelos (Claude, GPT, Llama, etc.) com 1 chave.',
    defaultModel: 'anthropic/claude-3.5-sonnet',
    keyDocsUrl: 'https://openrouter.ai/keys',
    keyDocsLabel: 'openrouter.ai/keys',
    keyPlaceholder: 'sk-or-v1-...',
  },
  custom: {
    label: 'Custom (OpenAI-compatible)',
    description: 'Ollama, LM Studio, vLLM, ou qualquer endpoint compativel com OpenAI.',
    defaultModel: 'llama3.1',
    keyDocsUrl: 'https://github.com/ollama/ollama/blob/main/docs/openai.md',
    keyDocsLabel: 'docs Ollama OpenAI compat',
    keyPlaceholder: 'qualquer-coisa-ou-vazio',
    needsBaseUrl: true,
  },
}

export function CopilotSettingsModal({ open, onClose, onSaved }: Props) {
  const [form] = Form.useForm<{
    provider: Provider
    apiKey: string
    model: string
    baseUrl: string
  }>()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [config, setConfig] = useState<ConfigPublic | null>(null)
  const [testResult, setTestResult] = useState<TestResult | null>(null)
  const [selectedProvider, setSelectedProvider] = useState<Provider>('auto')

  useEffect(() => {
    if (!open) return
    setTestResult(null)
    setLoading(true)
    void (async () => {
      try {
        const { data } = await http.get<ConfigPublic>('/api/v1/copilot/config')
        setConfig(data)
        setSelectedProvider(data.provider)
        form.setFieldsValue({
          provider: data.provider,
          apiKey: '',
          model: data.model ?? '',
          baseUrl: data.baseUrl ?? '',
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
        model: values.model?.trim() || null,
      }
      if (values.provider === 'custom') {
        payload.baseUrl = values.baseUrl?.trim() || null
      } else {
        payload.baseUrl = null
      }
      // Input vazio = manter chave existente; "__clear__" = limpar
      if (values.apiKey === '__clear__') payload.apiKey = null
      else if (values.apiKey?.trim()) payload.apiKey = values.apiKey.trim()

      const { data } = await http.put<ConfigPublic>('/api/v1/copilot/config', payload)
      setConfig(data)
      setSelectedProvider(data.provider)
      form.setFieldValue('apiKey', '')
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

  const providerInfo = selectedProvider !== 'auto' && selectedProvider !== 'local'
    ? PROVIDERS[selectedProvider]
    : null

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
      width={620}
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
        Use sua propria chave de qualquer provedor IA: <strong>OpenAI</strong>, <strong>Anthropic Claude</strong>,
        <strong> Google Gemini</strong>, <strong>Groq</strong>, <strong>OpenRouter</strong> ou um endpoint customizado.
        A chave fica criptografada no banco (AES-256-GCM) e nunca eh exposta em logs.
      </Typography.Paragraph>

      <Form form={form} layout="vertical" disabled={loading}>
        <Form.Item name="provider" label="Provedor IA">
          <Select
            onChange={(v) => setSelectedProvider(v as Provider)}
            options={[
              { value: 'auto', label: 'Automatico — usa o primeiro provedor configurado' },
              { value: 'openai', label: 'OpenAI (GPT-4o, GPT-4o-mini)' },
              { value: 'anthropic', label: 'Anthropic Claude (Opus 4.7, Sonnet 4.6, Haiku 4.5)' },
              { value: 'gemini', label: 'Google Gemini (2.0 Flash, 1.5 Pro)' },
              { value: 'groq', label: 'Groq (Llama 3.3 70B, gratuito)' },
              { value: 'openrouter', label: 'OpenRouter (200+ modelos)' },
              { value: 'custom', label: 'Custom (Ollama / LM Studio / self-hosted)' },
              { value: 'local', label: 'Apenas local (sem LLM, regex+tools)' },
            ]}
          />
        </Form.Item>

        {providerInfo && (
          <>
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 12 }}
              message={
                <Space size={4}>
                  <span>{providerInfo.description}</span>
                </Space>
              }
              description={
                <Space direction="vertical" size={2}>
                  <Space size={4}>
                    <span>Obter chave em</span>
                    <a href={providerInfo.keyDocsUrl} target="_blank" rel="noreferrer">
                      {providerInfo.keyDocsLabel}{' '}
                      <ExternalLink size={11} style={{ verticalAlign: 'middle' }} />
                    </a>
                  </Space>
                  {providerInfo.freeNote && <span style={{ fontSize: 12, opacity: 0.8 }}>{providerInfo.freeNote}</span>}
                </Space>
              }
            />
            <Form.Item
              name="apiKey"
              label={
                <Space>
                  <span>API key</span>
                  {config?.apiKeySet && <Tag color="green">{config.apiKeyMasked}</Tag>}
                </Space>
              }
              extra={
                config?.apiKeySet
                  ? 'Deixe em branco para manter a chave atual. Digite "__clear__" para remover.'
                  : `Cole aqui sua chave (${providerInfo.keyPlaceholder})`
              }
            >
              <Input.Password
                autoComplete="off"
                placeholder={config?.apiKeySet ? '•••••••••••• (ja configurada)' : providerInfo.keyPlaceholder}
              />
            </Form.Item>
            <Form.Item
              name="model"
              label="Modelo"
              extra={`Default: ${providerInfo.defaultModel}. Deixe em branco para usar o default.`}
            >
              <Input placeholder={providerInfo.defaultModel} />
            </Form.Item>
            {providerInfo.needsBaseUrl && (
              <Form.Item
                name="baseUrl"
                label="Base URL"
                rules={[{ required: true, message: 'Informe a URL base (sem /chat/completions)' }]}
                extra="Ex: http://localhost:11434/v1 (Ollama) ou http://localhost:1234/v1 (LM Studio)"
              >
                <Input placeholder="http://localhost:11434/v1" />
              </Form.Item>
            )}
          </>
        )}

        {selectedProvider === 'auto' && (
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 12 }}
            message="Modo automatico"
            description="O sistema tenta na ordem: Anthropic → OpenAI → Gemini → Groq → OpenRouter. Configure pelo menos uma chave para usar IA real, ou caira no fallback local."
          />
        )}

        {selectedProvider === 'local' && (
          <Alert
            type="warning"
            showIcon
            style={{ marginBottom: 12 }}
            message="Modo local (sem LLM)"
            description="Usa apenas regex + tools. Funciona offline mas nao entende perguntas em linguagem natural. Indicado quando nao ha conectividade."
          />
        )}
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
