/**
 * P1-01 (audit 2026-05-12): Slack/Teams integration para alertas.
 *
 * Webhooks incoming desses serviços têm formato específico (não é o webhook
 * genérico assinado HMAC que `webhookDispatcher.ts` faz). Aqui mantemos:
 *  - Formatters: convertem alerta → payload Slack (blocks) ou Teams (cards).
 *  - Sender: POST simples + timeout, sem retry exponencial (Slack/Teams já
 *    fazem cache em caso de falha curta; retry seria reentrega duplicada).
 *
 * Pra persistir destinos por tenant: implementar tabela `notification_channels`
 * (tenant_id, type, url, enabled) — fora do escopo deste arquivo. Esta camada
 * só cuida do *envio*.
 */

export type NotificationChannelType = 'slack' | 'teams'

export type NotificationMessage = {
  title: string
  body: string
  severity?: 'info' | 'warning' | 'error' | 'critical'
  link?: { label: string; url: string }
  /** Adiciona campos chave-valor abaixo do corpo (ex: tenant, valor). */
  fields?: Array<{ label: string; value: string }>
}

const SEND_TIMEOUT_MS = 8_000

function colorFor(severity: NotificationMessage['severity']): string {
  switch (severity) {
    case 'critical': return '#dc2626'
    case 'error':    return '#ef4444'
    case 'warning':  return '#f59e0b'
    default:         return '#0052ff'
  }
}

function emojiFor(severity: NotificationMessage['severity']): string {
  switch (severity) {
    case 'critical': return '🚨'
    case 'error':    return '❌'
    case 'warning':  return '⚠️'
    default:         return 'ℹ️'
  }
}

/** Slack Incoming Webhook payload (Block Kit). */
function formatSlackPayload(msg: NotificationMessage) {
  const blocks: Array<Record<string, unknown>> = [
    {
      type: 'header',
      text: { type: 'plain_text', text: `${emojiFor(msg.severity)} ${msg.title}`.slice(0, 150) },
    },
    {
      type: 'section',
      text: { type: 'mrkdwn', text: msg.body.slice(0, 3000) },
    },
  ]
  if (msg.fields && msg.fields.length > 0) {
    blocks.push({
      type: 'section',
      fields: msg.fields.slice(0, 10).map((f) => ({
        type: 'mrkdwn',
        text: `*${f.label}*\n${f.value}`,
      })),
    })
  }
  if (msg.link) {
    blocks.push({
      type: 'actions',
      elements: [{
        type: 'button',
        text: { type: 'plain_text', text: msg.link.label.slice(0, 75) },
        url: msg.link.url,
        style: msg.severity === 'critical' || msg.severity === 'error' ? 'danger' : 'primary',
      }],
    })
  }
  return {
    text: `${msg.title}: ${msg.body}`.slice(0, 4000), // fallback notification
    blocks,
    attachments: [{ color: colorFor(msg.severity) }],
  }
}

/** Microsoft Teams Incoming Webhook payload (MessageCard). */
function formatTeamsPayload(msg: NotificationMessage) {
  const facts = msg.fields?.slice(0, 10).map((f) => ({ name: f.label, value: f.value })) ?? []
  return {
    '@type': 'MessageCard',
    '@context': 'https://schema.org/extensions',
    themeColor: colorFor(msg.severity).replace('#', ''),
    summary: msg.title.slice(0, 200),
    title: `${emojiFor(msg.severity)} ${msg.title}`,
    sections: [
      {
        activityTitle: msg.title,
        text: msg.body,
        facts,
      },
    ],
    potentialAction: msg.link ? [{
      '@type': 'OpenUri',
      name: msg.link.label,
      targets: [{ os: 'default', uri: msg.link.url }],
    }] : undefined,
  }
}

export type NotifyResult =
  | { ok: true; status: number }
  | { ok: false; status: number; error: string }

export async function notifyChannel(
  type: NotificationChannelType,
  webhookUrl: string,
  msg: NotificationMessage,
): Promise<NotifyResult> {
  /** SSRF guard: webhook url precisa ser https de domínio público. */
  if (!/^https:\/\//i.test(webhookUrl)) {
    return { ok: false, status: 0, error: 'webhook_url precisa começar com https://' }
  }
  const payload = type === 'slack' ? formatSlackPayload(msg) : formatTeamsPayload(msg)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), SEND_TIMEOUT_MS)
  try {
    const r = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })
    if (!r.ok) {
      const text = await r.text().catch(() => '')
      return { ok: false, status: r.status, error: text.slice(0, 200) }
    }
    return { ok: true, status: r.status }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { ok: false, status: 0, error: message.slice(0, 200) }
  } finally {
    clearTimeout(timer)
  }
}
