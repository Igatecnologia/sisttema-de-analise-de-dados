import nodemailer from 'nodemailer'
import type { EmailTemplate } from './emailTemplates.js'

function frontendUrl(): string {
  return (process.env.FRONTEND_URL ?? 'http://localhost:5173').replace(/\/+$/, '')
}

export function buildPublicUrl(path: string): string {
  return `${frontendUrl()}${path.startsWith('/') ? path : `/${path}`}`
}

export async function sendTransactionalEmail(to: string, template: EmailTemplate): Promise<{ sent: boolean }> {
  const host = process.env.SMTP_HOST?.trim()
  const from = process.env.SMTP_FROM?.trim()
  if (!host || !from) {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[IGA Email][dev] ${template.subject} -> ${to}\n${template.text}`)
    }
    return { sent: false }
  }

  const transporter = nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === '1',
    auth: process.env.SMTP_USER ? {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS ?? '',
    } : undefined,
  })

  await transporter.sendMail({
    from,
    to,
    subject: template.subject,
    html: template.html,
    text: template.text,
  })
  return { sent: true }
}

