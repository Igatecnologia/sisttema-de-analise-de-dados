import { Button, Drawer, Input, Space, Tag, Tooltip, Typography, message as antdMessage } from 'antd'
import { Bot, Settings, Sparkles, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { http } from '../services/http'
import { CopilotSettingsModal } from './CopilotSettingsModal'

type Props = {
  open: boolean
  onClose: () => void
}

type Message = { role: 'user' | 'assistant'; text: string }

type ModeInfo = {
  provider: 'groq' | 'local'
  displayName: string
}

const PROVIDER_COLOR: Record<ModeInfo['provider'], string> = {
  groq: 'green',
  local: 'default',
}

export function CopilotDrawer({ open, onClose }: Props) {
  const { session } = useAuth()
  const isAdmin = session?.user.role === 'admin'
  const [prompt, setPrompt] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState<ModeInfo | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const scrollRootRef = useRef<HTMLDivElement | null>(null)
  const scrollEndRef = useRef<HTMLDivElement | null>(null)
  const composerRef = useRef<HTMLTextAreaElement | null>(null)

  const scrollToBottom = useMemo(
    () => (behavior: ScrollBehavior = 'smooth') => {
      const root = scrollRootRef.current
      if (root) root.scrollTo({ top: root.scrollHeight, behavior })
      // fallback: works even if scroll container changes
      scrollEndRef.current?.scrollIntoView({ behavior, block: 'end' })
    },
    [],
  )

  const quickPrompts = useMemo(
    () =>
      [
        { label: 'Resumo executivo', text: 'Faça um resumo executivo em 3 blocos: riscos, desempenho e próximos passos.' },
        { label: 'Pendências críticas', text: 'Liste as pendências críticas de hoje e o que deve ser priorizado agora.' },
        { label: 'Vendas de ontem', text: 'Qual foi o faturamento de ontem e como isso impacta a operação?' },
        { label: 'Últimos 7 dias', text: 'Mostre o faturamento dos últimos 7 dias e destaque tendência.' },
        { label: 'Mês vs mês passado', text: 'Compare o faturamento do mês atual com o mês passado e a variação percentual.' },
      ] as const,
    [],
  )

  function applyQuickPrompt(text: string) {
    setPrompt(text)
    window.setTimeout(() => composerRef.current?.focus(), 0)
  }

  async function loadMode() {
    try {
      const { data } = await http.get<ModeInfo>('/api/v1/copilot/mode')
      setMode(data)
    } catch {
      // noop
    }
  }

  useEffect(() => {
    if (!open) return
    void (async () => {
      try {
        const historyRes = await http.get<Array<{ role: 'user' | 'assistant'; content: string }>>(
          '/api/v1/copilot/history',
        )
        setMessages(historyRes.data.map((item) => ({ role: item.role, text: item.content })))
      } catch {
        // noop
      }
      void loadMode()
    })()
  }, [open])

  useEffect(() => {
    if (!open) return
    // ao abrir, histórico pode renderizar depois — rola pro fim imediatamente e após um tick
    scrollToBottom('auto')
    const t = window.setTimeout(() => scrollToBottom('auto'), 0)
    return () => window.clearTimeout(t)
  }, [open, scrollToBottom])

  useEffect(() => {
    if (!open) return
    scrollToBottom('smooth')
  }, [open, messages.length, scrollToBottom])

  async function askCopilot() {
    const question = prompt.trim()
    if (!question || loading) return
    setPrompt('')
    setLoading(true)
    setMessages((prev) => [...prev, { role: 'user', text: question }, { role: 'assistant', text: '' }])
    scrollToBottom('smooth')

    try {
      const csrfMatch = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]+)/)
      const csrfToken = csrfMatch ? decodeURIComponent(csrfMatch[1]) : undefined
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (csrfToken) headers['X-XSRF-TOKEN'] = csrfToken
      const response = await fetch(`${http.defaults.baseURL}/api/v1/copilot/chat`, {
        method: 'POST',
        credentials: 'include',
        headers,
        body: JSON.stringify({ prompt: question }),
      })
      if (!response.ok) {
        const reason = response.status === 429 ? 'Limite de perguntas atingido. Aguarde 1 minuto.' : `Erro ${response.status}`
        setMessages((prev) => {
          const next = [...prev]
          const idx = next.length - 1
          if (idx >= 0 && next[idx].role === 'assistant') next[idx] = { ...next[idx], text: reason }
          return next
        })
        return
      }
      const reader = response.body?.getReader()
      if (!reader) throw new Error('Sem stream')
      const decoder = new TextDecoder()
      let buffer = ''
      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const events = buffer.split('\n\n')
        buffer = events.pop() ?? ''
        for (const evt of events) {
          const line = evt.split('\n').find((l) => l.startsWith('data: '))
          if (!line) continue
          let payload: { type: string; text?: string }
          try {
            payload = JSON.parse(line.slice(6)) as { type: string; text?: string }
          } catch {
            continue
          }
          if (payload.type === 'token' && payload.text) {
            setMessages((prev) => {
              const next = [...prev]
              const idx = next.length - 1
              if (idx >= 0 && next[idx].role === 'assistant') {
                next[idx] = { ...next[idx], text: `${next[idx].text}${payload.text}` }
              }
              return next
            })
          }
        }
      }
    } catch {
      setMessages((prev) => [...prev, { role: 'assistant', text: 'Falha ao consultar copiloto.' }])
    } finally {
      setLoading(false)
    }
  }

  async function clearHistory() {
    try {
      await http.delete('/api/v1/copilot/history')
      setMessages([])
      antdMessage.success('Histórico limpo')
    } catch {
      antdMessage.error('Não foi possível limpar')
    }
  }

  const providerTag = mode ? (
    <Tooltip title={`Provider ativo: ${mode.displayName}`}>
      <Tag color={PROVIDER_COLOR[mode.provider]} icon={<Sparkles size={12} style={{ verticalAlign: 'middle' }} />}>
        {mode.displayName}
      </Tag>
    </Tooltip>
  ) : null

  return (
    <Drawer
      open={open}
      onClose={onClose}
      className="copilot-drawer"
      title={
        <div className="copilot-title">
          <div className="copilot-title__brand">
            <span className="copilot-title__icon" aria-hidden>
              <Bot size={18} />
            </span>
            <div className="copilot-title__text">
              <div className="copilot-title__name">Copiloto IGA</div>
              <div className="copilot-title__sub">
                {providerTag ?? <span className="copilot-title__hint">pronto para consultar o sistema</span>}
              </div>
            </div>
          </div>
        </div>
      }
      extra={
        <Space size={4}>
          {isAdmin && (
            <Tooltip title="Configurações do copiloto">
              <Button size="small" type="text" icon={<Settings size={14} />} onClick={() => setSettingsOpen(true)} />
            </Tooltip>
          )}
          <Tooltip title="Limpar histórico">
            <Button size="small" type="text" icon={<Trash2 size={14} />} onClick={() => void clearHistory()} />
          </Tooltip>
        </Space>
      }
      width={460}
    >
      <div className="copilot-shell">
        {messages.length === 0 ? (
          <div className="copilot-hero">
            <div className="copilot-hero__card">
              <Typography.Text className="copilot-hero__eyebrow">Atalhos rápidos</Typography.Text>
              <Typography.Paragraph className="copilot-hero__lead">
                Use perguntas de gestão para decidir prioridades, riscos e desempenho do negócio.
              </Typography.Paragraph>
              <div className="copilot-quick">
                {quickPrompts.map((q) => (
                  <button key={q.label} className="copilot-quick__chip" onClick={() => applyQuickPrompt(q.text)} type="button">
                    {q.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        <div className="copilot-stream" ref={scrollRootRef}>
          {messages.map((m, i) => (
            <div key={i} className={`copilot-bubble copilot-bubble--${m.role}`}>
              <div className="copilot-bubble__inner">
                <Typography.Text className="copilot-bubble__text">
                  {m.text || (m.role === 'assistant' ? '...' : '')}
                </Typography.Text>
              </div>
            </div>
          ))}
          <div ref={scrollEndRef} />
        </div>

        <div className="copilot-composer">
          <div className="copilot-composer__hint">
            <span className="copilot-composer__kbd">Enter</span> enviar · <span className="copilot-composer__kbd">Shift</span>+<span className="copilot-composer__kbd">Enter</span> nova linha
          </div>
          <Input.TextArea
            ref={(node) => {
              // antd TextArea expõe o textarea interno via .resizableTextArea?.textArea; mas manter fallback simples
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const anyNode = node as any
              composerRef.current = anyNode?.resizableTextArea?.textArea ?? null
            }}
            className="copilot-composer__input"
            rows={3}
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder='Ex.: "resumo executivo", "vendas de ontem", "mês atual vs mês passado"'
            onPressEnter={(event) => {
              if (!event.shiftKey) {
                event.preventDefault()
                void askCopilot()
              }
            }}
          />
          <div className="copilot-composer__bar">
            <div className="copilot-composer__chips" aria-hidden={loading}>
              {prompt.trim().length === 0
                ? quickPrompts.slice(0, 3).map((q) => (
                    <button key={q.label} className="copilot-composer__chip" onClick={() => applyQuickPrompt(q.text)} type="button">
                      {q.label}
                    </button>
                  ))
                : null}
            </div>
            <Button className="copilot-composer__send" type="primary" onClick={() => void askCopilot()} loading={loading}>
              Perguntar
            </Button>
          </div>
        </div>
      </div>
      {isAdmin && (
        <CopilotSettingsModal
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          onSaved={() => void loadMode()}
        />
      )}
    </Drawer>
  )
}
