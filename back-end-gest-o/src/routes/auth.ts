import { Router, type Response } from 'express'
import { z } from 'zod'
import {
  genUserId,
  readAllUsersAsync,
  writeAllUsersAsync,
  verifyUserPassword,
  verifyUserPasswordAsync,
  hashUserPassword,
  hashUserPasswordAsync,
  isLegacyPasswordHash,
} from '../userStorage.js'
import { resolveEffectivePermissions } from '../permissions.js'
import { registerToken, revokeToken, revokeAllUserSessions, requireAuth, requireAdmin, type AuthenticatedRequest } from '../middleware/auth.js'
import { redisRateLimit } from '../middleware/redisRateLimit.js'
import { resolveTenantId } from '../utils/tenant.js'
import { logAudit } from '../services/auditLog.js'
import { generateCsrfToken, buildCsrfCookie } from '../middleware/csrf.js'
import { createAuthActionToken, consumeAuthActionToken } from '../services/authActionTokens.js'
import { findTenantBySlug, genTenantId, upsertTenant } from '../tenantStorage.js'
import { signSessionJwt } from '../services/sessionJwt.js'
import { buildSessionBinding } from '../services/sessionStore.js'
import { tenantRateLimit } from '../middleware/tenantRateLimit.js'
import { maxBodySize } from '../middleware/maxBodySize.js'
import { requireTurnstile } from '../middleware/turnstile.js'
import {
  clearLoginFailures,
  getLockState,
  recordLoginFailure,
} from '../services/accountLockout.js'
import { checkPwnedPassword } from '../services/pwnedPassword.js'
import { sendPasswordChangedAlert } from '../services/loginAlerts.js'
import { isPasswordReused, recordPasswordHistory } from '../services/passwordHistory.js'
import { sendNewDeviceAlertIfUnknown } from '../services/knownDevices.js'
import {
  issueRefreshTokenForLogin,
  revokeAllRefreshForUser,
  rotateRefreshToken,
} from '../services/refreshTokenStore.js'
import {
  confirmMfaSetup,
  disableMfa,
  getMfaStatus,
  initMfaSetup,
  regenerateBackupCodes,
  verifyMfaToken,
} from '../services/mfa.js'
import { sendMfaToggleAlert } from '../services/loginAlerts.js'
import { buildPublicUrl, sendTransactionalEmail } from '../services/transactionalEmail.js'
import { inviteTemplate, resetPasswordTemplate, welcomeVerificationTemplate } from '../services/emailTemplates.js'

export const authRouter = Router()

/** Endpoints de auth nao processam payloads grandes — 4KB cobre register completo. */
authRouter.use(maxBodySize(4 * 1024))

/**
 * Secure flag só quando em HTTPS real — Electron roda em http://127.0.0.1,
 * onde o Chromium descarta cookies Secure e o login quebra silenciosamente.
 */
const useSecureCookie =
  process.env.NODE_ENV === 'production' && !process.env.ELECTRON_RUN_AS_NODE

function buildSessionCookie(token: string): string {
  const parts = [
    `iga_session=${encodeURIComponent(token)}`,
    'HttpOnly',
    'Path=/',
    'Max-Age=28800',
    'SameSite=Strict',
  ]
  if (useSecureCookie) parts.push('Secure')
  return parts.join('; ')
}

function clearSessionCookie(): string {
  const parts = [
    'iga_session=',
    'HttpOnly',
    'Path=/',
    'Max-Age=0',
    'SameSite=Strict',
  ]
  if (useSecureCookie) parts.push('Secure')
  return parts.join('; ')
}

function readSessionCookieToken(cookieHeader?: string): string | null {
  if (!cookieHeader) return null
  const cookies = cookieHeader.split(';')
  for (const cookie of cookies) {
    const [name, ...valueParts] = cookie.trim().split('=')
    if (name !== 'iga_session') continue
    const value = valueParts.join('=')
    return value ? decodeURIComponent(value) : null
  }
  return null
}

/** Rate limit: 20 tentativas de login por IP a cada 15 min — mitiga brute force. */
const loginLimiter = redisRateLimit({
  namespace: 'auth:login',
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { message: 'Muitas tentativas. Aguarde 15 minutos.' },
})

const tenantAuthLimiter = tenantRateLimit({
  namespace: 'auth',
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: 'Muitas tentativas. Aguarde alguns minutos.',
})

const loginSchema = z.object({
  email: z.string().email('Email invalido'),
  password: z.string().min(1, 'Senha obrigatoria'),
  /** SEC-2.1: TOTP de 6 digitos OU backup code de 8 hex. */
  totp: z.string().min(6).max(16).optional(),
})

const registerSchema = z.object({
  companyName: z.string().min(2, 'Nome da empresa obrigatorio').max(160),
  slug: z.string().min(2).max(64).regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/, 'Slug invalido'),
  name: z.string().min(2, 'Nome obrigatorio').max(120),
  email: z.string().email('Email invalido').max(254).trim().toLowerCase(),
  password: z.string(),
  connectorId: z.string().min(2).max(64).default('sgbr-espuma'),
})

const inviteSchema = z.object({
  email: z.string().email('Email invalido').max(254).trim().toLowerCase(),
  name: z.string().min(2).max(120).optional(),
  role: z.enum(['admin', 'manager', 'viewer']).default('viewer'),
  permissions: z.array(z.string().min(1).max(80)).optional(),
})

const acceptInviteSchema = z.object({
  token: z.string().min(32),
  name: z.string().min(2).max(120).optional(),
  password: z.string(),
})

const forgotPasswordSchema = z.object({
  email: z.string().email('Email invalido').max(254).trim().toLowerCase(),
})

const resetPasswordSchema = z.object({
  token: z.string().min(32),
  password: z.string(),
})

const verifyEmailSchema = z.object({
  token: z.string().min(32),
})

const changePasswordLimiter = redisRateLimit({
  namespace: 'auth:change-password',
  windowMs: 60 * 60 * 1000,
  max: 5,
})

/**
 * POST /api/v1/auth/login
 */
authRouter.post('/login', tenantAuthLimiter, loginLimiter, requireTurnstile, async (req, res) => {
  const parsed = loginSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'Dados invalidos' })
  }

  const { email, password } = parsed.data
  const tenantId = resolveTenantId(req)
  const normalizedEmail = email.trim().toLowerCase()

  /**
   * SEC-2.4: bloqueio por conta antes de validar senha. Atacante com botnet
   * burla o rate limit por IP, mas nao consegue burlar lock por email.
   */
  const lockState = await getLockState(tenantId, normalizedEmail)
  if (lockState.locked) {
    logAudit({
      action: lockState.requireReset ? 'login_blocked_reset_required' : 'login_blocked_locked',
      resource: 'auth',
      metadata: { email: normalizedEmail, tenantId, lockoutCount24h: lockState.lockoutCount24h, ip: req.ip },
    })
    if (lockState.requireReset) {
      return res.status(423).json({
        message: 'Conta bloqueada por excesso de falhas. Use "Esqueci minha senha" para liberar.',
        requireReset: true,
      })
    }
    return res.status(423).json({
      message: 'Conta temporariamente bloqueada apos varias tentativas. Tente novamente em alguns minutos.',
      lockedUntil: lockState.lockedUntil,
    })
  }

  const allUsers = await readAllUsersAsync()
  const user = allUsers.find(
    (u) =>
      u.tenantId === tenantId &&
      u.email.toLowerCase() === normalizedEmail &&
      u.status === 'active',
  )

  const passwordOk = user ? await verifyUserPasswordAsync(password, user.passwordHash) : false

  /** SEC-2.1: se MFA ativado, exige TOTP no mesmo request. Sem token -> 200 mfaRequired. */
  if (user && passwordOk) {
    const mfaStatus = await getMfaStatus(user.id)
    if (mfaStatus.enabled) {
      if (!parsed.data.totp) {
        return res.status(200).json({ mfaRequired: true, message: 'Codigo de autenticacao em dois fatores obrigatorio.' })
      }
      const mfaCheck = await verifyMfaToken(user.id, parsed.data.totp)
      if (!mfaCheck.ok) {
        const newState = await recordLoginFailure(tenantId, normalizedEmail)
        logAudit({
          userId: user.id,
          action: 'mfa_failed',
          resource: 'auth',
          metadata: { ip: req.ip, tenantId, failuresInWindow: newState.failuresInWindow, nowLocked: newState.locked },
        })
        if (newState.locked) {
          return res.status(423).json({ message: 'Conta bloqueada apos varias tentativas.', lockedUntil: newState.lockedUntil })
        }
        return res.status(401).json({ message: 'Codigo de autenticacao invalido' })
      }
      logAudit({
        userId: user.id,
        action: mfaCheck.usedBackupCode ? 'mfa_backup_code_used' : 'mfa_success',
        resource: 'auth',
        metadata: { ip: req.ip, tenantId },
      })
    }
  }

  if (!user || !passwordOk) {
    const newState = await recordLoginFailure(tenantId, normalizedEmail)
    logAudit({
      action: 'login_failed',
      resource: 'auth',
      metadata: {
        email: normalizedEmail,
        ip: req.ip,
        tenantId,
        failuresInWindow: newState.failuresInWindow,
        nowLocked: newState.locked,
      },
    })
    if (newState.locked) {
      return res.status(423).json({
        message: 'Conta bloqueada apos varias tentativas. Tente novamente em alguns minutos.',
        lockedUntil: newState.lockedUntil,
      })
    }
    return res.status(401).json({ message: 'Email ou senha incorretos' })
  }

  await clearLoginFailures(tenantId, normalizedEmail)

  /** SEC-1.2 graceful migration: rehash para argon2id no proximo login bem-sucedido. */
  if (isLegacyPasswordHash(user.passwordHash)) {
    try {
      const upgradedHash = await hashUserPasswordAsync(password)
      const idx = allUsers.findIndex((u) => u.id === user.id)
      if (idx >= 0) {
        allUsers[idx] = { ...allUsers[idx], passwordHash: upgradedHash, updatedAt: new Date().toISOString() }
        await writeAllUsersAsync(allUsers)
      }
    } catch {
      /** Falha no rehash nao impede o login. */
    }
  }

  const tenant = await findTenantBySlug(tenantId)
  const token = signSessionJwt({
    sub: user.id,
    tid: tenantId,
    role: user.role,
    plan: tenant?.plan ?? 'trial',
  })
  /** SEC-2.5: amarra a sessao a IP/UA + uaFamily para detectar hijack futuro. */
  const userAgent = typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : ''
  const binding = buildSessionBinding(req.ip ?? '', userAgent)
  await registerToken(token, user.id, tenantId, binding)
  /** SEC-2.6: emite refresh token na familia atual. Frontend pode armazenar em cookie httpOnly separado. */
  const refreshIssue = await issueRefreshTokenForLogin(user.id, tenantId, { ipHash: binding.ipHash, uaHash: binding.uaHash }).catch(() => null)
  logAudit({ userId: user.id, action: 'login_success', resource: 'auth', metadata: { ip: req.ip, tenantId, uaFamily: binding.uaFamily } })
  /**
   * SEC-2.10: alerta novo dispositivo. "Novo" = uaHash nunca visto.
   * Pulamos no primeiro login do tenant (sem historico) para evitar spam.
   */
  void sendNewDeviceAlertIfUnknown(
    { userId: user.id, userEmail: user.email, userName: user.name, tenantSlug: tenantId, ip: req.ip ?? '', userAgent },
    binding.uaHash,
  )
  const csrfToken = generateCsrfToken()
  res.setHeader('Set-Cookie', [buildSessionCookie(token), buildCsrfCookie(csrfToken)])

  const permissions = resolveEffectivePermissions(user.role, user.permissions)

  res.json({
    token,
    /** SEC-2.6: refresh token entregue para clients que querem long-lived sessions. */
    ...(refreshIssue ? { refreshToken: refreshIssue.token, refreshExpiresAt: refreshIssue.expiresAt } : {}),
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      /** Se true, frontend deve bloquear o app e redirecionar para troca de senha. */
      mustChangePassword: user.mustChangePassword ?? false,
    },
    permissions,
  })
})

/**
 * POST /api/v1/auth/refresh
 * Rotaciona refresh token e emite novo access token (session). Detecta reuse:
 * se o mesmo token eh apresentado 2x, revoga a familia inteira.
 */
const refreshSchema = z.object({ refreshToken: z.string().min(20) })

authRouter.post('/refresh', async (req, res) => {
  const parsed = refreshSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: 'refreshToken obrigatorio' })
  }
  const userAgent = typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : ''
  const binding = buildSessionBinding(req.ip ?? '', userAgent)
  const result = await rotateRefreshToken(parsed.data.refreshToken, { ipHash: binding.ipHash, uaHash: binding.uaHash })
  if (!result.ok) {
    if (result.reason === 'reuse_detected') {
      logAudit({ action: 'refresh_reuse_detected', resource: 'auth', metadata: { ip: req.ip } })
      return res.status(401).json({ message: 'Sessao comprometida. Faca login novamente.', revoked: true })
    }
    return res.status(401).json({ message: 'Refresh token invalido ou expirado' })
  }
  /** Cria novo access token na mesma "sessao" (registerToken). */
  const tenant = await findTenantBySlug(result.tenantId)
  const accessToken = signSessionJwt({
    sub: result.userId,
    tid: result.tenantId,
    role: 'admin',
    plan: tenant?.plan ?? 'trial',
  })
  await registerToken(accessToken, result.userId, result.tenantId, binding)
  logAudit({ userId: result.userId, action: 'refresh_rotated', resource: 'auth', metadata: { ip: req.ip, familyId: result.familyId } })
  res.json({
    token: accessToken,
    refreshToken: result.issue.token,
    refreshExpiresAt: result.issue.expiresAt,
  })
})

/** Mínimo 12 chars, maiúscula, minúscula, dígito e caractere especial — impede senhas triviais. */
const strongPasswordSchema = z
  .string()
  .min(12, 'Senha deve ter no minimo 12 caracteres')
  .regex(/[a-z]/, 'Inclua ao menos uma letra minuscula')
  .regex(/[A-Z]/, 'Inclua ao menos uma letra maiuscula')
  .regex(/\d/, 'Inclua ao menos um numero')
  .regex(/[^A-Za-z0-9]/, 'Inclua ao menos um caractere especial (!@#$%...)')

function validateStrongPassword(password: string): string | null {
  const parsed = strongPasswordSchema.safeParse(password)
  return parsed.success ? null : parsed.error.issues[0]?.message ?? 'Senha invalida'
}

/**
 * SEC-2.3: rejeita senhas amplamente vazadas (HIBP k-anonymity).
 * Aplicar em register/change-password/reset-password/accept-invite.
 */
async function validatePasswordNotPwned(password: string): Promise<string | null> {
  const result = await checkPwnedPassword(password)
  if (result.skipped) return null
  if (result.blocked) {
    return `Esta senha aparece em vazamentos publicos (${result.count.toLocaleString('pt-BR')} ocorrencias). Escolha outra.`
  }
  return null
}

function devTokenPayload(token: string) {
  return process.env.NODE_ENV === 'production' ? {} : { token }
}

function trialEndsAt(): string {
  return new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
}

function tenantUrlParam(slugOrId: string): string {
  return encodeURIComponent(slugOrId.trim().toLowerCase())
}

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Senha atual obrigatoria'),
  newPassword: strongPasswordSchema,
})

/**
 * POST /api/v1/auth/change-password
 * Troca a senha do usuário autenticado. Limpa `mustChangePassword` se estava ativo.
 */
authRouter.post('/change-password', requireAuth, changePasswordLimiter, async (req, res: Response) => {
  const authReq = req as unknown as AuthenticatedRequest
  const parsed = changePasswordSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'Dados invalidos' })
  }
  const { currentPassword, newPassword } = parsed.data
  if (currentPassword === newPassword) {
    return res.status(400).json({ message: 'A nova senha deve ser diferente da atual' })
  }
  const pwnedError = await validatePasswordNotPwned(newPassword)
  if (pwnedError) return res.status(400).json({ message: pwnedError })

  const all = await readAllUsersAsync()
  const idx = all.findIndex((u) => u.id === authReq.userId)
  if (idx < 0) return res.status(404).json({ message: 'Usuario nao encontrado' })

  if (!verifyUserPassword(currentPassword, all[idx].passwordHash)) {
    logAudit({ userId: authReq.userId, action: 'password_change_failed', resource: 'auth', metadata: { ip: req.ip } })
    return res.status(401).json({ message: 'Senha atual incorreta' })
  }

  /** SEC-2.8: bloquear reuso das ultimas senhas (inclui a atual). */
  if (await isPasswordReused(authReq.userId, newPassword)) {
    return res.status(400).json({ message: 'A senha nova nao pode ser igual a uma das ultimas senhas usadas.' })
  }

  const newHash = await hashUserPasswordAsync(newPassword)
  all[idx] = {
    ...all[idx],
    passwordHash: newHash,
    mustChangePassword: false,
    updatedAt: new Date().toISOString(),
  }
  await writeAllUsersAsync(all)
  await recordPasswordHistory(authReq.userId, newHash).catch(() => undefined)
  logAudit({ userId: authReq.userId, action: 'password_changed', resource: 'auth', metadata: { ip: req.ip } })
  /** SEC-2.10: alerta o usuario que a senha mudou — best-effort, fora do critical path. */
  void sendPasswordChangedAlert({
    userEmail: all[idx].email,
    userName: all[idx].name,
    tenantSlug: all[idx].tenantId,
    ip: req.ip ?? '',
    userAgent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : '',
  })
  res.json({ ok: true })
})

authRouter.post('/register', tenantAuthLimiter, requireTurnstile, async (req, res) => {
  const parsed = registerSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'Dados invalidos' })
  }
  const passwordError = validateStrongPassword(parsed.data.password)
  if (passwordError) return res.status(400).json({ message: passwordError })
  const pwnedError = await validatePasswordNotPwned(parsed.data.password)
  if (pwnedError) return res.status(400).json({ message: pwnedError })

  const slug = parsed.data.slug.trim().toLowerCase()
  const existingTenant = await findTenantBySlug(slug)
  if (existingTenant) return res.status(409).json({ message: 'Ja existe uma empresa com este slug' })

  const users = await readAllUsersAsync()
  const emailExists = users.some((u) => u.email.toLowerCase() === parsed.data.email && u.tenantId === genTenantId(slug))
  if (emailExists) return res.status(409).json({ message: 'Este email ja esta cadastrado' })

  const tenantId = genTenantId(slug)
  const now = new Date().toISOString()
  const tenant = await upsertTenant({
    id: tenantId,
    slug,
    name: parsed.data.companyName.trim(),
    subtitle: 'Gestao e Analise de Dados',
    logoUrl: null,
    primaryColor: null,
    enabledModules: ['dashboard', 'financeiro', 'relatorios', 'usuarios', 'auditoria', 'datasources', 'operations'],
    connectorId: parsed.data.connectorId,
    plan: 'trial',
    trialEndsAt: trialEndsAt(),
    status: 'active',
  })
  const user = {
    id: genUserId(),
    tenantId: tenant.id,
    name: parsed.data.name.trim(),
    email: parsed.data.email,
    role: 'admin' as const,
    status: 'active' as const,
    passwordHash: await hashUserPasswordAsync(parsed.data.password),
    mustChangePassword: false,
    emailVerifiedAt: null,
    createdAt: now,
    updatedAt: now,
  }
  await writeAllUsersAsync([...users, user])
  const verification = await createAuthActionToken({
    tenantId: tenant.id,
    userId: user.id,
    email: user.email,
    type: 'email_verify',
    ttlMs: 24 * 60 * 60 * 1000,
  })
  await sendTransactionalEmail(
    user.email,
    welcomeVerificationTemplate({
      companyName: tenant.name,
      verifyUrl: buildPublicUrl(`/verify-email?tenant=${tenantUrlParam(tenant.slug)}&token=${verification.token}`),
    }),
  )
  logAudit({ userId: user.id, action: 'tenant_registered', resource: 'auth', metadata: { tenantId: tenant.id, slug } })
  res.status(201).json({
    tenant: { id: tenant.id, slug: tenant.slug, companyName: tenant.name, trialEndsAt: tenant.trialEndsAt },
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
    verification: devTokenPayload(verification.token),
  })
})

authRouter.post('/invite', requireAdmin, tenantAuthLimiter, async (req, res) => {
  const authReq = req as unknown as AuthenticatedRequest
  const parsed = inviteSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'Dados invalidos' })
  }
  const existing = (await readAllUsersAsync()).find(
    (u) => u.tenantId === authReq.tenantId && u.email.toLowerCase() === parsed.data.email,
  )
  if (existing) return res.status(409).json({ message: 'Usuario ja cadastrado neste tenant' })

  const invite = await createAuthActionToken({
    tenantId: authReq.tenantId,
    email: parsed.data.email,
    type: 'invite',
    ttlMs: 48 * 60 * 60 * 1000,
    metadata: {
      name: parsed.data.name ?? '',
      role: parsed.data.role,
      permissions: parsed.data.permissions ?? [],
      invitedBy: authReq.userId,
    },
  })
  const tenant = await findTenantBySlug(authReq.tenantId)
  const tenantParam = tenant?.slug ?? authReq.tenantId
  await sendTransactionalEmail(
    parsed.data.email,
    inviteTemplate({
      companyName: tenant?.name ?? 'IGA',
      inviteUrl: buildPublicUrl(`/accept-invite?tenant=${tenantUrlParam(tenantParam)}&token=${invite.token}`),
    }),
  )
  logAudit({ userId: authReq.userId, action: 'invite_created', resource: 'auth', metadata: { email: parsed.data.email } })
  res.status(201).json({ ok: true, expiresAt: invite.record.expiresAt, ...devTokenPayload(invite.token) })
})

authRouter.post('/accept-invite', tenantAuthLimiter, async (req, res) => {
  const parsed = acceptInviteSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'Dados invalidos' })
  }
  const passwordError = validateStrongPassword(parsed.data.password)
  if (passwordError) return res.status(400).json({ message: passwordError })
  const pwnedError = await validatePasswordNotPwned(parsed.data.password)
  if (pwnedError) return res.status(400).json({ message: pwnedError })
  const invite = await consumeAuthActionToken('invite', parsed.data.token)
  if (!invite) return res.status(400).json({ message: 'Convite invalido ou expirado' })

  const users = await readAllUsersAsync()
  if (users.some((u) => u.tenantId === invite.tenantId && u.email.toLowerCase() === invite.email)) {
    return res.status(409).json({ message: 'Usuario ja cadastrado neste tenant' })
  }
  const now = new Date().toISOString()
  const inviteRole: 'admin' | 'manager' | 'viewer' =
    invite.metadata.role === 'admin' || invite.metadata.role === 'manager' ? invite.metadata.role : 'viewer'
  const user = {
    id: genUserId(),
    tenantId: invite.tenantId,
    name: parsed.data.name?.trim() || String(invite.metadata.name || invite.email),
    email: invite.email,
    role: inviteRole,
    status: 'active' as const,
    permissions: Array.isArray(invite.metadata.permissions)
      ? invite.metadata.permissions.filter((item): item is string => typeof item === 'string')
      : undefined,
    passwordHash: await hashUserPasswordAsync(parsed.data.password),
    mustChangePassword: false,
    emailVerifiedAt: new Date().toISOString(),
    createdAt: now,
    updatedAt: now,
  }
  await writeAllUsersAsync([...users, user])
  logAudit({ userId: user.id, action: 'invite_accepted', resource: 'auth', metadata: { tenantId: invite.tenantId } })
  res.status(201).json({ ok: true, user: { id: user.id, name: user.name, email: user.email, role: user.role } })
})

/**
 * Tempo minimo de resposta (ms) — evita timing oracle que revela se email existe.
 * SEC-2.9: endpoint sempre responde com mesmo shape e tempo proximo do baseline.
 */
const FORGOT_PASSWORD_BASELINE_MS = 600
const GENERIC_FORGOT_MESSAGE = 'Se o email existir, enviamos um link para redefinir a senha.'

authRouter.post('/forgot-password', tenantAuthLimiter, requireTurnstile, async (req, res) => {
  const startedAt = Date.now()
  const parsed = forgotPasswordSchema.safeParse(req.body)
  if (!parsed.success) {
    /** Validacao de schema eh user error obvio — responder cedo nao vaza oracle. */
    return res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'Dados invalidos' })
  }
  const tenantId = resolveTenantId(req)

  const respondGeneric = async (devToken?: string) => {
    const elapsed = Date.now() - startedAt
    if (elapsed < FORGOT_PASSWORD_BASELINE_MS) {
      await new Promise((resolve) => setTimeout(resolve, FORGOT_PASSWORD_BASELINE_MS - elapsed))
    }
    res.json({ ok: true, message: GENERIC_FORGOT_MESSAGE, ...(devToken ? devTokenPayload(devToken) : {}) })
  }

  try {
    const user = (await readAllUsersAsync()).find(
      (u) => u.tenantId === tenantId && u.email.toLowerCase() === parsed.data.email && u.status === 'active',
    )
    if (!user) {
      logAudit({ action: 'password_reset_requested_unknown', resource: 'auth', metadata: { tenantId, email: parsed.data.email } })
      return respondGeneric()
    }
    const reset = await createAuthActionToken({
      tenantId,
      userId: user.id,
      email: user.email,
      type: 'password_reset',
      ttlMs: 60 * 60 * 1000,
    })
    await sendTransactionalEmail(user.email, resetPasswordTemplate({
      resetUrl: buildPublicUrl(`/reset-password?tenant=${tenantUrlParam(tenantId)}&token=${reset.token}`),
    })).catch(() => undefined)
    logAudit({ userId: user.id, action: 'password_reset_requested', resource: 'auth', metadata: { tenantId } })
    return respondGeneric(reset.token)
  } catch {
    /** Falha de DB/email NAO revela ao atacante — resposta generica e baseline mantido. */
    return respondGeneric()
  }
})

authRouter.post('/reset-password', tenantAuthLimiter, async (req, res) => {
  const parsed = resetPasswordSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'Dados invalidos' })
  }
  const passwordError = validateStrongPassword(parsed.data.password)
  if (passwordError) return res.status(400).json({ message: passwordError })
  const pwnedError = await validatePasswordNotPwned(parsed.data.password)
  if (pwnedError) return res.status(400).json({ message: pwnedError })
  const reset = await consumeAuthActionToken('password_reset', parsed.data.token)
  if (!reset?.userId) return res.status(400).json({ message: 'Token invalido ou expirado' })
  const users = await readAllUsersAsync()
  const idx = users.findIndex((u) => u.id === reset.userId && u.tenantId === reset.tenantId)
  if (idx < 0) return res.status(400).json({ message: 'Token invalido ou expirado' })

  if (await isPasswordReused(users[idx].id, parsed.data.password)) {
    return res.status(400).json({ message: 'A senha nova nao pode ser igual a uma das ultimas senhas usadas.' })
  }

  const newHash = await hashUserPasswordAsync(parsed.data.password)
  users[idx] = {
    ...users[idx],
    passwordHash: newHash,
    mustChangePassword: false,
    updatedAt: new Date().toISOString(),
  }
  await writeAllUsersAsync(users)
  await recordPasswordHistory(users[idx].id, newHash).catch(() => undefined)
  await revokeAllUserSessions(users[idx].id)
  logAudit({ userId: users[idx].id, action: 'password_reset_completed', resource: 'auth', metadata: { tenantId: reset.tenantId } })
  res.json({ ok: true })
})

authRouter.post('/verify-email', tenantAuthLimiter, async (req, res) => {
  const parsed = verifyEmailSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'Dados invalidos' })
  }
  const verification = await consumeAuthActionToken('email_verify', parsed.data.token)
  if (!verification) return res.status(400).json({ message: 'Token invalido ou expirado' })
  if (verification.userId) {
    const users = await readAllUsersAsync()
    const idx = users.findIndex((u) => u.id === verification.userId && u.tenantId === verification.tenantId)
    if (idx >= 0) {
      users[idx] = { ...users[idx], emailVerifiedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
      await writeAllUsersAsync(users)
    }
  }
  logAudit({ userId: verification.userId ?? undefined, action: 'email_verified', resource: 'auth', metadata: { tenantId: verification.tenantId } })
  res.json({ ok: true })
})

/**
 * GET /api/v1/auth/me
 * Resolve usuário autenticado a partir do cookie HttpOnly/sessão ativa.
 */
authRouter.get('/me', requireAuth, async (req, res) => {
  const authReq = req as unknown as AuthenticatedRequest
  const user = (await readAllUsersAsync()).find((u) => u.id === authReq.userId && u.status === 'active')
  if (!user) return res.status(401).json({ message: 'Sessão inválida' })
  const permissions = resolveEffectivePermissions(user.role, user.permissions)
  return res.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      mustChangePassword: user.mustChangePassword ?? false,
    },
    permissions,
  })
})

/**
 * POST /api/v1/auth/logout
 */
authRouter.post('/logout', async (req, res) => {
  const header = req.headers.authorization
  const token = header?.startsWith('Bearer ')
    ? header.slice(7)
    : readSessionCookieToken(req.headers.cookie)
  if (token) await revokeToken(token)
  logAudit({ action: 'logout', resource: 'auth', metadata: { ip: req.ip } })
  res.setHeader('Set-Cookie', clearSessionCookie())
  res.json({ ok: true })
})

/**
 * POST /api/v1/auth/logout-all
 * Revoga TODAS as sessões do usuário autenticado (logout em todos os dispositivos).
 */
authRouter.post('/logout-all', requireAuth, async (req, res) => {
  const authReq = req as unknown as AuthenticatedRequest
  const revoked = await revokeAllUserSessions(authReq.userId)
  await revokeAllRefreshForUser(authReq.userId).catch(() => undefined)
  logAudit({ userId: authReq.userId, action: 'logout_all', resource: 'auth', metadata: { ip: req.ip, sessionsRevoked: revoked } })
  res.setHeader('Set-Cookie', clearSessionCookie())
  res.json({ ok: true, sessionsRevoked: revoked })
})

// ─── MFA/TOTP (SEC-2.1) ────────────────────────────────────────────────────

const mfaConfirmSchema = z.object({ totp: z.string().regex(/^\d{6}$/, 'Codigo deve ter 6 digitos') })
const mfaDisableSchema = z.object({
  password: z.string().min(1, 'Senha obrigatoria'),
  totp: z.string().min(6).max(16),
})

async function findAuthenticatedUser(authReq: AuthenticatedRequest) {
  const all = await readAllUsersAsync()
  return all.find((u) => u.id === authReq.userId && u.tenantId === authReq.tenantId) ?? null
}

authRouter.get('/mfa/status', requireAuth, async (req, res: Response) => {
  const authReq = req as unknown as AuthenticatedRequest
  const status = await getMfaStatus(authReq.userId)
  res.json(status)
})

authRouter.post('/mfa/setup-init', requireAuth, async (req, res: Response) => {
  const authReq = req as unknown as AuthenticatedRequest
  const user = await findAuthenticatedUser(authReq)
  if (!user) return res.status(404).json({ message: 'Usuario nao encontrado' })
  const tenant = await findTenantBySlug(authReq.tenantId)
  const issuer = tenant?.name ?? 'IGA Gestao'
  const result = await initMfaSetup(user.id, user.email, issuer)
  /** Secret retornado uma vez para fallback caso QR nao funcione. */
  res.json({ otpauthUrl: result.otpauthUrl, secret: result.secret })
})

authRouter.post('/mfa/setup-confirm', requireAuth, async (req, res: Response) => {
  const authReq = req as unknown as AuthenticatedRequest
  const parsed = mfaConfirmSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'Dados invalidos' })
  }
  const result = await confirmMfaSetup(authReq.userId, parsed.data.totp)
  if (!result.ok) {
    return res.status(400).json({ message: result.reason === 'no_pending' ? 'Nenhum setup pendente' : 'Codigo invalido' })
  }
  const user = await findAuthenticatedUser(authReq)
  if (user) {
    void sendMfaToggleAlert({
      userEmail: user.email,
      userName: user.name,
      tenantSlug: authReq.tenantId,
      ip: req.ip ?? '',
      userAgent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : '',
      enabled: true,
    })
  }
  logAudit({ userId: authReq.userId, action: 'mfa_enabled', resource: 'auth', metadata: { ip: req.ip } })
  /** Backup codes retornados UMA vez. Frontend deve forcar download/copy. */
  res.json({ ok: true, backupCodes: result.backupCodes })
})

authRouter.post('/mfa/disable', requireAuth, async (req, res: Response) => {
  const authReq = req as unknown as AuthenticatedRequest
  const parsed = mfaDisableSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'Dados invalidos' })
  }
  const user = await findAuthenticatedUser(authReq)
  if (!user) return res.status(404).json({ message: 'Usuario nao encontrado' })
  if (!(await verifyUserPasswordAsync(parsed.data.password, user.passwordHash))) {
    return res.status(401).json({ message: 'Senha incorreta' })
  }
  const tokenCheck = await verifyMfaToken(authReq.userId, parsed.data.totp)
  if (!tokenCheck.ok) return res.status(401).json({ message: 'Codigo MFA invalido' })
  await disableMfa(authReq.userId)
  void sendMfaToggleAlert({
    userEmail: user.email,
    userName: user.name,
    tenantSlug: authReq.tenantId,
    ip: req.ip ?? '',
    userAgent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : '',
    enabled: false,
  })
  logAudit({ userId: authReq.userId, action: 'mfa_disabled', resource: 'auth', metadata: { ip: req.ip } })
  res.json({ ok: true })
})

authRouter.post('/mfa/backup-codes/regenerate', requireAuth, async (req, res: Response) => {
  const authReq = req as unknown as AuthenticatedRequest
  const parsed = mfaDisableSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'Dados invalidos' })
  }
  const user = await findAuthenticatedUser(authReq)
  if (!user) return res.status(404).json({ message: 'Usuario nao encontrado' })
  if (!(await verifyUserPasswordAsync(parsed.data.password, user.passwordHash))) {
    return res.status(401).json({ message: 'Senha incorreta' })
  }
  const tokenCheck = await verifyMfaToken(authReq.userId, parsed.data.totp)
  if (!tokenCheck.ok) return res.status(401).json({ message: 'Codigo MFA invalido' })
  const codes = await regenerateBackupCodes(authReq.userId)
  if (!codes) return res.status(400).json({ message: 'MFA nao habilitado' })
  logAudit({ userId: authReq.userId, action: 'mfa_backup_codes_regenerated', resource: 'auth', metadata: { ip: req.ip } })
  res.json({ ok: true, backupCodes: codes })
})
