import { Router, type Response } from 'express'
import { z } from 'zod'
import {
  genUserId,
  readAllUsersAsync,
  writeAllUsersAsync,
  verifyUserPassword,
  hashUserPassword,
} from '../userStorage.js'
import { resolveEffectivePermissions } from '../permissions.js'
import { registerToken, revokeToken, revokeAllUserSessions, requireAuth, requireAdmin, type AuthenticatedRequest } from '../middleware/auth.js'
import rateLimit from 'express-rate-limit'
import { resolveTenantId } from '../utils/tenant.js'
import { logAudit } from '../services/auditLog.js'
import { generateCsrfToken, buildCsrfCookie } from '../middleware/csrf.js'
import { createAuthActionToken, consumeAuthActionToken } from '../services/authActionTokens.js'
import { findTenantBySlug, genTenantId, upsertTenant } from '../tenantStorage.js'
import { signSessionJwt } from '../services/sessionJwt.js'
import { tenantRateLimit } from '../middleware/tenantRateLimit.js'
import { maxBodySize } from '../middleware/maxBodySize.js'
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
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { message: 'Muitas tentativas. Aguarde 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
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

const changePasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
})

/**
 * POST /api/v1/auth/login
 */
authRouter.post('/login', tenantAuthLimiter, loginLimiter, async (req, res) => {
  const parsed = loginSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'Dados invalidos' })
  }

  const { email, password } = parsed.data

  const tenantId = resolveTenantId(req)
  const user = (await readAllUsersAsync()).find(
    (u) =>
      u.tenantId === tenantId &&
      u.email.toLowerCase() === email.trim().toLowerCase() &&
      u.status === 'active',
  )

  if (!user || !verifyUserPassword(password, user.passwordHash)) {
    logAudit({ action: 'login_failed', resource: 'auth', metadata: { email: email.trim().toLowerCase(), ip: req.ip } })
    return res.status(401).json({ message: 'Email ou senha incorretos' })
  }

  const tenant = await findTenantBySlug(tenantId)
  const token = signSessionJwt({
    sub: user.id,
    tid: tenantId,
    role: user.role,
    plan: tenant?.plan ?? 'trial',
  })
  await registerToken(token, user.id, tenantId)
  logAudit({ userId: user.id, action: 'login_success', resource: 'auth', metadata: { ip: req.ip, tenantId } })
  const csrfToken = generateCsrfToken()
  res.setHeader('Set-Cookie', [buildSessionCookie(token), buildCsrfCookie(csrfToken)])

  const permissions = resolveEffectivePermissions(user.role, user.permissions)

  res.json({
    token,
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

  const all = await readAllUsersAsync()
  const idx = all.findIndex((u) => u.id === authReq.userId)
  if (idx < 0) return res.status(404).json({ message: 'Usuario nao encontrado' })

  if (!verifyUserPassword(currentPassword, all[idx].passwordHash)) {
    logAudit({ userId: authReq.userId, action: 'password_change_failed', resource: 'auth', metadata: { ip: req.ip } })
    return res.status(401).json({ message: 'Senha atual incorreta' })
  }

  all[idx] = {
    ...all[idx],
    passwordHash: hashUserPassword(newPassword),
    mustChangePassword: false,
    updatedAt: new Date().toISOString(),
  }
  await writeAllUsersAsync(all)
  logAudit({ userId: authReq.userId, action: 'password_changed', resource: 'auth', metadata: { ip: req.ip } })
  res.json({ ok: true })
})

authRouter.post('/register', tenantAuthLimiter, async (req, res) => {
  const parsed = registerSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'Dados invalidos' })
  }
  const passwordError = validateStrongPassword(parsed.data.password)
  if (passwordError) return res.status(400).json({ message: passwordError })

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
    passwordHash: hashUserPassword(parsed.data.password),
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
    passwordHash: hashUserPassword(parsed.data.password),
    mustChangePassword: false,
    emailVerifiedAt: new Date().toISOString(),
    createdAt: now,
    updatedAt: now,
  }
  await writeAllUsersAsync([...users, user])
  logAudit({ userId: user.id, action: 'invite_accepted', resource: 'auth', metadata: { tenantId: invite.tenantId } })
  res.status(201).json({ ok: true, user: { id: user.id, name: user.name, email: user.email, role: user.role } })
})

authRouter.post('/forgot-password', tenantAuthLimiter, async (req, res) => {
  const parsed = forgotPasswordSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'Dados invalidos' })
  }
  const tenantId = resolveTenantId(req)
  const user = (await readAllUsersAsync()).find(
    (u) => u.tenantId === tenantId && u.email.toLowerCase() === parsed.data.email && u.status === 'active',
  )
  if (!user) return res.json({ ok: true })
  const reset = await createAuthActionToken({
    tenantId,
    userId: user.id,
    email: user.email,
    type: 'password_reset',
    ttlMs: 60 * 60 * 1000,
  })
  await sendTransactionalEmail(user.email, resetPasswordTemplate({
    resetUrl: buildPublicUrl(`/reset-password?tenant=${tenantUrlParam(tenantId)}&token=${reset.token}`),
  }))
  logAudit({ userId: user.id, action: 'password_reset_requested', resource: 'auth', metadata: { tenantId } })
  res.json({ ok: true, ...devTokenPayload(reset.token) })
})

authRouter.post('/reset-password', tenantAuthLimiter, async (req, res) => {
  const parsed = resetPasswordSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'Dados invalidos' })
  }
  const passwordError = validateStrongPassword(parsed.data.password)
  if (passwordError) return res.status(400).json({ message: passwordError })
  const reset = await consumeAuthActionToken('password_reset', parsed.data.token)
  if (!reset?.userId) return res.status(400).json({ message: 'Token invalido ou expirado' })
  const users = await readAllUsersAsync()
  const idx = users.findIndex((u) => u.id === reset.userId && u.tenantId === reset.tenantId)
  if (idx < 0) return res.status(400).json({ message: 'Token invalido ou expirado' })
  users[idx] = {
    ...users[idx],
    passwordHash: hashUserPassword(parsed.data.password),
    mustChangePassword: false,
    updatedAt: new Date().toISOString(),
  }
  await writeAllUsersAsync(users)
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
  logAudit({ userId: authReq.userId, action: 'logout_all', resource: 'auth', metadata: { ip: req.ip, sessionsRevoked: revoked } })
  res.setHeader('Set-Cookie', clearSessionCookie())
  res.json({ ok: true, sessionsRevoked: revoked })
})
