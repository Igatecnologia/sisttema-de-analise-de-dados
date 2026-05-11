import { Router } from 'express'
import { z } from 'zod'
import {
  readAllUsersAsync,
  writeAllUsersAsync,
  genUserId,
  hashUserPassword,
  type UserRecord,
} from '../userStorage.js'
import { isValidPermission } from '../permissions.js'
import type { AuthenticatedRequest } from '../middleware/auth.js'
import { redisRateLimit } from '../middleware/redisRateLimit.js'
import { evaluatePlanLimit } from '../services/planLimits.js'
import { findTenantById } from '../tenantStorage.js'
import { buildPublicUrl, sendTransactionalEmail } from '../services/transactionalEmail.js'
import { welcomeUserTemplate } from '../services/emailTemplates.js'

export const usersRouter = Router()

const createUserLimiter = redisRateLimit({
  namespace: 'users:create',
  windowMs: 60 * 60 * 1000,
  max: 20,
})

const permissionsArraySchema = z
  .array(z.string())
  .min(1, 'Selecione ao menos uma permissao')
  .refine((arr) => arr.every((p) => isValidPermission(p)), 'Permissao invalida')

const createUserSchema = z.object({
  name: z.string().min(1, 'Nome obrigatorio').max(200),
  email: z.string().email('Email invalido'),
  password: z.string().min(6, 'Senha deve ter no minimo 6 caracteres'),
  role: z.enum(['admin', 'manager', 'viewer']).default('viewer'),
  status: z.enum(['active', 'inactive']).default('active'),
  permissions: permissionsArraySchema.optional(),
})

const updateUserSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  email: z.string().email().optional(),
  password: z.string().min(6).optional(),
  role: z.enum(['admin', 'manager', 'viewer']).optional(),
  status: z.enum(['active', 'inactive']).optional(),
  /** `null` remove personalizacao e volta ao padrao do perfil */
  permissions: z.union([permissionsArraySchema, z.null()]).optional(),
})

function sanitize(u: UserRecord) {
  const { passwordHash: _, ...safe } = u
  return {
    ...safe,
    permissions: u.permissions ?? null,
  }
}

// GET /
usersRouter.get('/', async (req, res) => {
  const authReq = req as unknown as AuthenticatedRequest
  res.json((await readAllUsersAsync()).filter((u) => u.tenantId === authReq.tenantId).map(sanitize))
})

// POST /
usersRouter.post('/', createUserLimiter, async (req, res) => {
  const parsed = createUserSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'Dados invalidos' })
  }

  const { name, email, password, role, status, permissions } = parsed.data
  const authReq = req as unknown as AuthenticatedRequest
  const all = await readAllUsersAsync()
  const tenantUsers = all.filter((u) => u.tenantId === authReq.tenantId)
  const limit = await evaluatePlanLimit(authReq.tenantId, 'users')
  if (!limit.allowed) {
    return res.status(402).json({
      message: limit.message,
      reason: 'plan_limit_reached',
      resource: limit.key,
      plan: limit.plan,
      used: limit.used,
      limit: limit.limit,
    })
  }

  if (tenantUsers.some((u) => u.email.toLowerCase() === email.trim().toLowerCase())) {
    return res.status(409).json({ message: 'Ja existe um usuario com este email' })
  }

  const now = new Date().toISOString()
  const user: UserRecord = {
    id: genUserId(),
    tenantId: authReq.tenantId,
    name: name.trim(),
    email: email.trim().toLowerCase(),
    role,
    status,
    passwordHash: hashUserPassword(password),
    createdAt: now,
    updatedAt: now,
    ...(permissions && {
      permissions: [...new Set(permissions)].sort(),
    }),
  }

  await writeAllUsersAsync([...all, user])

  /** Welcome email — fire-and-forget; falha de SMTP não bloqueia criação. */
  void (async () => {
    try {
      const tenant = await findTenantById(authReq.tenantId)
      const creator = tenantUsers.find((u) => u.id === authReq.userId)
      await sendTransactionalEmail(user.email, welcomeUserTemplate({
        companyName: tenant?.name ?? 'IGA Gestao',
        loginUrl: buildPublicUrl('/login'),
        userName: user.name,
        createdByName: creator?.name,
      }))
    } catch {
      /** swallow — email é best-effort */
    }
  })()

  res.status(201).json(sanitize(user))
})

// PUT /:id
usersRouter.put('/:id', async (req, res) => {
  const parsed = updateUserSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'Dados invalidos' })
  }

  const authReq = req as unknown as AuthenticatedRequest
  const all = await readAllUsersAsync()
  const idx = all.findIndex((u) => u.id === req.params.id && u.tenantId === authReq.tenantId)
  if (idx < 0) return res.status(404).json({ message: 'Usuario nao encontrado' })

  const { name, email, password, role, status, permissions } = parsed.data

  if (email) {
    const duplicate = all.find(
      (u, i) => i !== idx && u.tenantId === authReq.tenantId && u.email.toLowerCase() === email.trim().toLowerCase(),
    )
    if (duplicate) {
      return res.status(409).json({ message: 'Ja existe um usuario com este email' })
    }
  }

  const next: UserRecord = {
    ...all[idx],
    ...(name != null && { name: name.trim() }),
    ...(email != null && { email: email.trim().toLowerCase() }),
    ...(role != null && { role }),
    ...(status != null && { status }),
    /** Reset de senha por admin força o usuário a trocar no próximo login. */
    ...(password && { passwordHash: hashUserPassword(password), mustChangePassword: true }),
    updatedAt: new Date().toISOString(),
  }

  if (permissions !== undefined) {
    if (permissions === null) {
      delete next.permissions
    } else {
      next.permissions = [...new Set(permissions)].sort()
    }
  }

  all[idx] = next

  await writeAllUsersAsync(all)
  res.json(sanitize(all[idx]))
})

// DELETE /:id
usersRouter.delete('/:id', async (req, res) => {
  const authReq = req as unknown as AuthenticatedRequest

  // Impedir admin de deletar a si mesmo
  if (authReq.userId === req.params.id) {
    return res.status(400).json({ message: 'Voce nao pode excluir sua propria conta' })
  }

  const all = await readAllUsersAsync()
  const target = all.find((u) => u.id === req.params.id && u.tenantId === authReq.tenantId)
  const filtered = target ? all.filter((u) => u.id !== req.params.id) : all
  if (filtered.length === all.length) {
    return res.status(404).json({ message: 'Usuario nao encontrado' })
  }

  // Impedir exclusão do último admin
  if (target?.role === 'admin') {
    const remainingAdmins = filtered.filter((u) => u.tenantId === authReq.tenantId && u.role === 'admin' && u.status === 'active')
    if (remainingAdmins.length === 0) {
      return res.status(400).json({ message: 'Nao e possivel excluir o ultimo administrador ativo' })
    }
  }

  await writeAllUsersAsync(filtered)
  res.json({ ok: true })
})
