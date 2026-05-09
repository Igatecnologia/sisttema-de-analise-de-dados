import { Router } from 'express'
import { z } from 'zod'
import { tenantRateLimit } from '../middleware/tenantRateLimit.js'
import { sendTransactionalEmail } from '../services/transactionalEmail.js'
import { logInfo, logWarn } from '../services/structuredLog.js'
import {
  isDisposableEmail,
  validateMx,
  checkRegistrationVelocity,
} from '../services/registrationAntiFraud.js'

/**
 * Beta lead capture — recebe pedidos de convite vindos da landing page.
 * Não cria tenant nem usuário — apenas registra o lead e envia auto-resposta.
 *
 * Fluxo:
 *  1. Frontend (landing) POST com {name, email, company, erp, role, message}
 *  2. Anti-fraud: disposable email block + MX + velocity 5/h/IP
 *  3. Loga estruturado (analytics + email pra notificacao manual via cron/Sentry)
 *  4. Envia email de confirmacao ao lead
 *  5. Notifica equipe (se NOTIFY_EMAIL setado)
 */

export const leadsRouter = Router()

const leadSchema = z.object({
  name: z.string().min(2).max(120).trim(),
  email: z.string().email().max(254).trim().toLowerCase(),
  company: z.string().min(2).max(160).trim(),
  erp: z.string().max(80).trim().optional(),
  role: z.string().max(80).trim().optional(),
  message: z.string().max(800).trim().optional(),
  source: z.string().max(40).trim().optional(),
})

const limiter = tenantRateLimit({
  namespace: 'leads',
  windowMs: 60_000,
  max: 5,
  message: 'Muitos pedidos. Aguarde alguns minutos.',
})

leadsRouter.use(limiter)

leadsRouter.post('/', async (req, res) => {
  const parsed = leadSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'Dados invalidos' })
  }
  const lead = parsed.data

  if (isDisposableEmail(lead.email)) {
    logWarn('leads.blocked_disposable', { email: lead.email })
    return res.status(400).json({ message: 'Use um email corporativo valido.' })
  }

  const ip = (req.ip ?? req.socket?.remoteAddress ?? 'unknown').toString()
  const velocity = await checkRegistrationVelocity(ip)
  if (!velocity.allowed) {
    logWarn('leads.blocked_velocity', { ip })
    res.setHeader('Retry-After', String(velocity.retryAfterSec))
    return res.status(429).json({ message: 'Muitos pedidos recentes. Tente novamente em instantes.' })
  }

  const mx = await validateMx(lead.email)
  if (!mx.ok && mx.reason !== 'lookup_failed') {
    logWarn('leads.blocked_no_mx', { email: lead.email })
    return res.status(400).json({ message: 'Email nao recebe mensagens. Confira e tente novamente.' })
  }

  /** Log estruturado — operação puxa daqui para CRM/spreadsheet manual. */
  logInfo('leads.captured', {
    name: lead.name,
    email: lead.email,
    company: lead.company,
    erp: lead.erp ?? null,
    role: lead.role ?? null,
    message: lead.message ?? null,
    source: lead.source ?? 'landing',
    ip,
    receivedAt: new Date().toISOString(),
  })

  /** Auto-resposta para o lead. */
  const userAgent = req.header('user-agent') ?? 'unknown'
  void sendLeadConfirmation(lead).catch((err) => {
    logWarn('leads.email_failed', { email: lead.email, error: (err as Error).message, ua: userAgent })
  })

  /** Notificação interna (best effort). */
  const notifyEmail = process.env.LEAD_NOTIFY_EMAIL?.trim()
  if (notifyEmail) {
    void sendInternalNotification(notifyEmail, lead).catch((err) => {
      logWarn('leads.internal_notify_failed', { error: (err as Error).message })
    })
  }

  return res.status(201).json({
    accepted: true,
    message: 'Recebemos seu pedido. Em breve entraremos em contato.',
  })
})

async function sendLeadConfirmation(lead: z.infer<typeof leadSchema>) {
  const subject = `Recebemos seu pedido de convite Beta — ${lead.company}`
  const text = [
    `Oi ${lead.name},`,
    '',
    'Recebemos seu pedido de convite para o Beta da IGA Gestao.',
    '',
    'Vamos avaliar e respondemos em ate 48h uteis com proximos passos.',
    'Vagas Beta sao limitadas a 5 empresas — priorizamos perfil e contexto.',
    '',
    'Resumo do que voce nos enviou:',
    `  - Empresa: ${lead.company}`,
    lead.erp ? `  - ERP: ${lead.erp}` : null,
    lead.role ? `  - Cargo: ${lead.role}` : null,
    '',
    'Enquanto isso, da uma olhada em https://igagestao.com.br',
    '',
    'Ate breve,',
    'Equipe IGA',
    'suporte@igagestao.com.br',
  ]
    .filter(Boolean)
    .join('\n')

  const html = `<!DOCTYPE html>
<html><body style="font-family: system-ui, -apple-system, Segoe UI, sans-serif; max-width: 580px; margin: 24px auto; color: #0a0b0d; line-height: 1.55;">
<p>Oi ${escapeHtml(lead.name)},</p>
<p>Recebemos seu pedido de convite para o Beta da IGA Gestao.</p>
<p>Vamos avaliar e respondemos em ate <strong>48h uteis</strong> com proximos passos. Vagas Beta sao limitadas a 5 empresas — priorizamos perfil e contexto.</p>
<p style="background: #f5f6f8; padding: 16px; border-radius: 12px; font-size: 14px;">
  <strong>Empresa:</strong> ${escapeHtml(lead.company)}<br>
  ${lead.erp ? `<strong>ERP:</strong> ${escapeHtml(lead.erp)}<br>` : ''}
  ${lead.role ? `<strong>Cargo:</strong> ${escapeHtml(lead.role)}<br>` : ''}
</p>
<p>Ate breve,<br><strong>Equipe IGA</strong><br><a href="mailto:suporte@igagestao.com.br" style="color: #0052ff;">suporte@igagestao.com.br</a></p>
</body></html>`

  await sendTransactionalEmail(lead.email, { subject, text, html })
}

async function sendInternalNotification(to: string, lead: z.infer<typeof leadSchema>) {
  const subject = `[IGA Beta] Novo lead: ${lead.company}`
  const text = `Novo pedido de convite Beta:

Nome: ${lead.name}
Email: ${lead.email}
Empresa: ${lead.company}
ERP: ${lead.erp ?? '(nao informado)'}
Cargo: ${lead.role ?? '(nao informado)'}
Mensagem: ${lead.message ?? '(nenhuma)'}
Source: ${lead.source ?? 'landing'}

Recebido em: ${new Date().toISOString()}`

  await sendTransactionalEmail(to, { subject, text, html: `<pre style="font-family: ui-monospace, monospace;">${escapeHtml(text)}</pre>` })
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => {
    switch (c) {
      case '&':
        return '&amp;'
      case '<':
        return '&lt;'
      case '>':
        return '&gt;'
      case '"':
        return '&quot;'
      default:
        return '&#39;'
    }
  })
}
