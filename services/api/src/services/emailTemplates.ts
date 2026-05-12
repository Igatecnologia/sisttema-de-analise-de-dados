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

export function welcomeUserTemplate(input: { companyName: string; loginUrl: string; userName: string; createdByName?: string }): EmailTemplate {
  const introBy = input.createdByName ? `${escapeHtml(input.createdByName)} criou seu acesso ao ` : 'Seu acesso foi criado em '
  return {
    subject: `Bem-vindo a ${input.companyName} no IGA`,
    text: `Ola ${input.userName}. ${input.createdByName ?? 'Um administrador'} criou seu acesso em ${input.companyName}. Acesse: ${input.loginUrl}. Use a senha temporaria informada pelo administrador e troque no primeiro login.`,
    html: shell(`Bem-vindo, ${input.userName}`,
      `<p>${introBy}<strong>${escapeHtml(input.companyName)}</strong>.</p>` +
      `<p>Use a senha temporaria informada pelo administrador. Voce sera solicitado a troca-la no primeiro acesso.</p>` +
      button(input.loginUrl, 'Acessar IGA Gestao')
    ),
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

/**
 * Login alerts (SEC-2.10) — notificacoes de mudanca de seguranca para o usuario.
 * Sempre incluem CTA "nao fui eu" que aponta para reset de senha.
 */
type SecurityAlertCtx = {
  userName: string
  ip: string
  userAgent: string
  occurredAt: string
  resetUrl: string
}

function securityAlertBody(reason: string, ctx: SecurityAlertCtx): string {
  return `
    <p>Ola, ${escapeHtml(ctx.userName)}.</p>
    <p>${escapeHtml(reason)}</p>
    <ul style="font-size:14px;color:#566678">
      <li><strong>Quando:</strong> ${escapeHtml(ctx.occurredAt)}</li>
      <li><strong>IP:</strong> ${escapeHtml(ctx.ip)}</li>
      <li><strong>Dispositivo:</strong> ${escapeHtml(ctx.userAgent.slice(0, 200))}</li>
    </ul>
    <p style="font-size:13px;color:#566678">Se nao foi voce, redefina a senha agora — todas as sessoes ativas sao revogadas.</p>
    ${button(ctx.resetUrl, 'Nao fui eu — redefinir senha')}
  `
}

export function newDeviceLoginTemplate(ctx: SecurityAlertCtx): EmailTemplate {
  return {
    subject: 'Novo login detectado',
    text: `Novo login na sua conta. Em ${ctx.occurredAt} de ${ctx.ip}. Se nao foi voce: ${ctx.resetUrl}`,
    html: shell('Novo login detectado', securityAlertBody('Detectamos um login a partir de um dispositivo ou local que nao reconhecemos.', ctx)),
  }
}

export function passwordChangedTemplate(ctx: SecurityAlertCtx): EmailTemplate {
  return {
    subject: 'Sua senha foi alterada',
    text: `Sua senha foi alterada em ${ctx.occurredAt} de ${ctx.ip}. Se nao foi voce: ${ctx.resetUrl}`,
    html: shell('Senha alterada', securityAlertBody('Sua senha de acesso foi alterada com sucesso.', ctx)),
  }
}

export function emailChangedTemplate(ctx: SecurityAlertCtx & { newEmail: string }): EmailTemplate {
  return {
    subject: 'Email da conta foi alterado',
    text: `O email da conta foi alterado para ${ctx.newEmail} em ${ctx.occurredAt}. Se nao foi voce: ${ctx.resetUrl}`,
    html: shell('Email alterado', securityAlertBody(`O email principal da sua conta foi alterado para ${ctx.newEmail}.`, ctx)),
  }
}

export function mfaToggleTemplate(ctx: SecurityAlertCtx & { enabled: boolean }): EmailTemplate {
  const action = ctx.enabled ? 'habilitada' : 'desabilitada'
  return {
    subject: `Autenticacao em dois fatores ${action}`,
    text: `MFA ${action} na sua conta em ${ctx.occurredAt} de ${ctx.ip}. Se nao foi voce: ${ctx.resetUrl}`,
    html: shell(`MFA ${action}`, securityAlertBody(`A autenticacao em dois fatores foi ${action} na sua conta.`, ctx)),
  }
}


/**
 * P1-02 (audit 2026-05-12): Daily AI Digest — email diário com resumo
 * proativo gerado por LLM. Diferencial competitivo vs Metabase/Tableau.
 * Renderiza highlights, alertas e recomendação de ação.
 */
export type DailyDigestSection = {
  emoji?: string
  title: string
  body: string
  link?: { label: string; url: string }
}
export function dailyDigestTemplate(input: {
  companyName: string
  userName: string
  date: string
  sections: DailyDigestSection[]
  dashboardUrl: string
  unsubscribeUrl: string
}): EmailTemplate {
  const dateBr = input.date
  const subject = `[${input.companyName}] Resumo do dia · ${dateBr}`
  const sectionsHtml = input.sections.map((s) => `
    <div style="margin: 16px 0; padding: 12px 14px; background: #fafafa; border-left: 3px solid #0052ff; border-radius: 4px;">
      <div style="font-weight: 600; font-size: 14px; color: #111;">${s.emoji ? `${s.emoji} ` : ''}${escapeHtml(s.title)}</div>
      <div style="font-size: 13px; color: #444; margin-top: 4px; line-height: 1.5;">${escapeHtml(s.body)}</div>
      ${s.link ? `<div style="margin-top: 6px;"><a href="${s.link.url}" style="color: #0052ff; font-size: 12px; text-decoration: none;">${escapeHtml(s.link.label)} →</a></div>` : ''}
    </div>
  `).join('')
  const text = `Olá ${input.userName}, resumo do dia em ${input.companyName} (${dateBr}):\n\n` +
    input.sections.map((s) => `${s.emoji ?? '•'} ${s.title}\n${s.body}\n${s.link ? s.link.url : ''}`).join('\n\n') +
    `\n\nAbra o painel: ${input.dashboardUrl}\n\nPra parar de receber este resumo, ajuste em /configuracoes.`
  return {
    subject,
    text,
    html: shell(`Resumo · ${dateBr}`,
      `<p style="font-size: 14px;">Olá <strong>${escapeHtml(input.userName)}</strong>,</p>
       <p style="font-size: 13px; color: #555;">Aqui está o resumo da sua operação em <strong>${escapeHtml(input.companyName)}</strong>:</p>
       ${sectionsHtml}
       ${button(input.dashboardUrl, 'Abrir painel completo')}
       <p style="font-size: 11px; color: #888; margin-top: 24px;">
         <a href="${input.unsubscribeUrl}" style="color: #888;">Desativar este resumo</a>
       </p>`),
  }
}
