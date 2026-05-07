export type EmailTemplate = {
  subject: string
  html: string
  text: string
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[char] ?? char))
}

function shell(title: string, body: string): string {
  return `
  <!doctype html>
  <html lang="pt-BR">
    <body style="margin:0;background:#f6f8fb;font-family:Arial,sans-serif;color:#172033">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
        <tr><td align="center" style="padding:32px 16px">
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:560px;background:#fff;border:1px solid #e6eaf0;border-radius:12px">
            <tr><td style="padding:28px">
              <h1 style="margin:0 0 16px;font-size:22px">${escapeHtml(title)}</h1>
              ${body}
            </td></tr>
          </table>
        </td></tr>
      </table>
    </body>
  </html>`
}

function button(url: string, label: string): string {
  return `<p style="margin:24px 0"><a href="${escapeHtml(url)}" style="background:#1677ff;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none">${escapeHtml(label)}</a></p>`
}

export function welcomeVerificationTemplate(input: { companyName: string; verifyUrl: string }): EmailTemplate {
  const subject = `Verifique seu email - ${input.companyName}`
  const text = `Bem-vindo a ${input.companyName}. Verifique seu email: ${input.verifyUrl}`
  return {
    subject,
    text,
    html: shell('Bem-vindo', `<p>Seu trial foi criado para <strong>${escapeHtml(input.companyName)}</strong>.</p>${button(input.verifyUrl, 'Verificar email')}`),
  }
}

export function inviteTemplate(input: { companyName: string; inviteUrl: string }): EmailTemplate {
  return {
    subject: `Convite para ${input.companyName}`,
    text: `Voce foi convidado para ${input.companyName}: ${input.inviteUrl}`,
    html: shell('Convite de equipe', `<p>Voce foi convidado para acessar <strong>${escapeHtml(input.companyName)}</strong>.</p>${button(input.inviteUrl, 'Aceitar convite')}`),
  }
}

export function resetPasswordTemplate(input: { resetUrl: string }): EmailTemplate {
  return {
    subject: 'Redefinicao de senha',
    text: `Redefina sua senha: ${input.resetUrl}`,
    html: shell('Redefinicao de senha', `<p>Este link expira em 1 hora.</p>${button(input.resetUrl, 'Redefinir senha')}`),
  }
}

export function trialExpiringTemplate(input: { companyName: string; daysLeft: number; billingUrl: string }): EmailTemplate {
  return {
    subject: `Seu trial expira em ${input.daysLeft} dias`,
    text: `O trial de ${input.companyName} expira em ${input.daysLeft} dias: ${input.billingUrl}`,
    html: shell('Trial expirando', `<p>O trial de <strong>${escapeHtml(input.companyName)}</strong> expira em ${input.daysLeft} dias.</p>${button(input.billingUrl, 'Ver planos')}`),
  }
}

export function trialExpiredTemplate(input: { companyName: string; billingUrl: string }): EmailTemplate {
  return {
    subject: 'Trial expirado',
    text: `O trial de ${input.companyName} expirou: ${input.billingUrl}`,
    html: shell('Trial expirado', `<p>O trial de <strong>${escapeHtml(input.companyName)}</strong> expirou.</p>${button(input.billingUrl, 'Ativar plano')}`),
  }
}

