/**
 * Login alerts (SEC-2.10) — dispara emails ao usuario em eventos de mudanca
 * de seguranca. Best-effort: falha de email nunca quebra o fluxo principal.
 *
 * Eventos suportados:
 *  - novo dispositivo (UA fingerprint nao visto antes)
 *  - senha alterada
 *  - email da conta alterado
 *  - MFA habilitado/desabilitado
 */
import {
  buildPublicUrl,
  sendTransactionalEmail,
} from './transactionalEmail.js'
import {
  emailChangedTemplate,
  mfaToggleTemplate,
  newDeviceLoginTemplate,
  passwordChangedTemplate,
} from './emailTemplates.js'

export type AlertContext = {
  userEmail: string
  userName: string
  tenantSlug: string
  ip: string
  userAgent: string
}

function commonCtx(ctx: AlertContext) {
  return {
    userName: ctx.userName,
    ip: ctx.ip || 'desconhecido',
    userAgent: ctx.userAgent || 'desconhecido',
    occurredAt: new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC',
    resetUrl: buildPublicUrl(`/forgot-password?tenant=${encodeURIComponent(ctx.tenantSlug)}`),
  }
}

export async function sendNewDeviceAlert(ctx: AlertContext): Promise<void> {
  await sendTransactionalEmail(ctx.userEmail, newDeviceLoginTemplate(commonCtx(ctx))).catch(() => undefined)
}

export async function sendPasswordChangedAlert(ctx: AlertContext): Promise<void> {
  await sendTransactionalEmail(ctx.userEmail, passwordChangedTemplate(commonCtx(ctx))).catch(() => undefined)
}

export async function sendEmailChangedAlert(ctx: AlertContext & { newEmail: string }): Promise<void> {
  await sendTransactionalEmail(ctx.userEmail, emailChangedTemplate({ ...commonCtx(ctx), newEmail: ctx.newEmail })).catch(() => undefined)
}

export async function sendMfaToggleAlert(ctx: AlertContext & { enabled: boolean }): Promise<void> {
  await sendTransactionalEmail(ctx.userEmail, mfaToggleTemplate({ ...commonCtx(ctx), enabled: ctx.enabled })).catch(() => undefined)
}
