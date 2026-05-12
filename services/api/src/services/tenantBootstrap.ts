/**
 * Bootstrap de tenant (empresa) novo — cria tenant + subscription + onboarding
 * + admin user em uma operação idempotente. Substitui os 4-5 INSERTs manuais
 * que toda nova empresa exigia, garantindo consistência (nome obrigatório,
 * subscription compatível com o plano, admin único por tenant).
 *
 * Modelo (CLAUDE.md): cada empresa = 1 tenant; usuários pertencem a 1 tenant.
 * Não exporta SQL inline — todas as escritas vão pelos helpers async já
 * auditados (upsertTenant, upsertSubscription, upsertUserAsync).
 */
import { z } from 'zod'
import { randomBytes } from 'node:crypto'
import { BUSINESS_SEGMENTS, type BusinessSegment } from '../segments.js'
import { findTenantBySlug, genTenantId, upsertTenant, type TenantRecord } from '../tenantStorage.js'
import { upsertSubscription, type SubscriptionStatus } from './subscriptionStore.js'
import {
  genUserId,
  hashUserPasswordAsync,
  readUsersForTenantAsync,
  upsertUserAsync,
  type UserRecord,
} from '../userStorage.js'
import { hasPostgresConfig, queryPostgres } from '../db/postgres.js'
import { getDb } from '../db/sqlite.js'

const sqlite = getDb()
function usePostgresStorage(): boolean {
  return process.env.IGA_STORAGE_DRIVER === 'postgres' && hasPostgresConfig()
}

const DEFAULT_MODULES = [
  'dashboard',
  'financeiro',
  'relatorios',
  'usuarios',
  'auditoria',
  'datasources',
  'operations',
] as const

/** Plano enterprise não usa trial; demais plans podem ter trialEndsAt explícito. */
function defaultSubscriptionStatus(plan: TenantRecord['plan']): SubscriptionStatus {
  if (plan === 'enterprise' || plan === 'pro' || plan === 'starter') return 'active'
  return 'trialing'
}

/**
 * Senha forte: mínimo 12 chars, maiúscula + minúscula + dígito + especial.
 * Replica `strongPasswordSchema` de auth.ts pra não importar de routes/.
 */
const strongPasswordSchema = z
  .string()
  .min(12, 'Senha do admin deve ter no minimo 12 caracteres')
  .regex(/[a-z]/, 'Senha do admin precisa de letra minuscula')
  .regex(/[A-Z]/, 'Senha do admin precisa de letra maiuscula')
  .regex(/\d/, 'Senha do admin precisa de digito')
  .regex(/[^A-Za-z0-9]/, 'Senha do admin precisa de caractere especial')

export const createTenantWithAdminSchema = z.object({
  /** Nome da empresa — OBRIGATÓRIO. Vira tenants.name e aparece em emails/UI. */
  name: z.string().min(1, 'Nome da empresa obrigatorio').max(160, 'Nome muito longo'),
  /** Slug do tenant. Se ausente, derivado do nome. */
  slug: z.string().min(2).max(64).regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/, 'Slug invalido').optional(),
  /** CNPJ apenas dígitos (14). Opcional para empresas internacionais ou MEI sem CNPJ. */
  cnpj: z.string().regex(/^\d{14}$/, 'CNPJ deve ter 14 digitos').nullable().optional(),
  /** Segmento de negocio. Define connector recomendado e templates de dashboard. */
  segment: z.enum(BUSINESS_SEGMENTS as [string, ...string[]]).default('industry'),
  /** Plano contratado. Enterprise/Pro/Starter ativos imediatos; trial limita. */
  plan: z.enum(['trial', 'starter', 'pro', 'enterprise']).default('enterprise'),
  /** Connector padrão. Default = generic; tenants industry geralmente sgbr-espuma. */
  connectorId: z.string().min(2).max(64).default('iga-custom-api'),
  /** Texto curto de hero/header (default amigavel). */
  subtitle: z.string().min(1).max(160).default('Gestao e Analise de Dados'),
  /** Branding opcional. */
  logoUrl: z.string().url().max(600).nullable().optional(),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{3,8}$/).nullable().optional(),
  /** Modulos habilitados por default (UI). */
  enabledModules: z.array(z.string().min(1).max(80)).default([...DEFAULT_MODULES]),
  /** Trial encerra em (ISO). Default null para planos pagos. */
  trialEndsAt: z.string().datetime().nullable().optional(),
  /** Pula o wizard de onboarding (status='completed' em tenant_onboarding). */
  skipOnboarding: z.boolean().default(true),

  /** Dados do admin inicial. Email + senha obrigatórios; nome default = "Administrador". */
  adminEmail: z.string().email('Email do admin invalido').max(254),
  adminPassword: strongPasswordSchema,
  adminName: z.string().min(1).max(120).default('Administrador'),

  /** Contato comercial — preenchido pelo super-admin (Beta Fechada). */
  contactEmail: z.string().email().max(254).nullable().optional(),
  contactPhone: z.string().max(40).nullable().optional(),
  betaNotes: z.string().max(2000).nullable().optional(),
})

export type CreateTenantWithAdminInput = z.input<typeof createTenantWithAdminSchema>

export type CreateTenantWithAdminResult = {
  tenant: TenantRecord
  admin: { id: string; email: string; name: string; role: 'admin' }
  /** True se o tenant já existia (idempotente — não criou de novo). */
  alreadyExisted: boolean
}

function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

async function upsertTenantOnboardingCompleted(tenantId: string): Promise<void> {
  const now = new Date().toISOString()
  if (usePostgresStorage()) {
    await queryPostgres(
      `INSERT INTO tenant_onboarding (
         tenant_id, status, company_profile_json, data_setup_json, team_invites_json,
         import_status, import_progress, updated_at
       ) VALUES ($1, 'completed', '{}'::jsonb, '{}'::jsonb, '[]'::jsonb, 'completed', 100, $2)
       ON CONFLICT (tenant_id) DO UPDATE SET
         status = 'completed',
         import_status = 'completed',
         import_progress = 100,
         updated_at = $2`,
      [tenantId, now],
    )
    return
  }
  // SQLite (dev)
  sqlite.prepare(`
    INSERT INTO tenant_onboarding (
      tenant_id, status, company_profile_json, data_setup_json, team_invites_json,
      import_status, import_progress, updated_at
    ) VALUES (?, 'completed', '{}', '{}', '[]', 'completed', 100, ?)
    ON CONFLICT(tenant_id) DO UPDATE SET
      status = 'completed',
      import_status = 'completed',
      import_progress = 100,
      updated_at = excluded.updated_at
  `).run(tenantId, now)
}

/**
 * Cria (ou atualiza) uma empresa nova com seu admin inicial.
 *
 * Comportamento:
 *  - Se o slug já existe, retorna `alreadyExisted: true` SEM sobrescrever o
 *    tenant — só garante que subscription + onboarding + admin estão lá.
 *    Útil pra ser idempotente em scripts de seed/migração.
 *  - Se o admin email já existe NO MESMO tenant, atualiza a senha/nome.
 *  - Cria sempre subscription compatível com o plano (active pra pago,
 *    trialing pra trial) — evita o bug "Trial expirado" visto em 12/05/2026.
 *  - tenant_onboarding marcado como completed por default (`skipOnboarding`)
 *    pra empresa nova entrar direto no dashboard.
 */
export async function createTenantWithAdmin(
  raw: CreateTenantWithAdminInput,
): Promise<CreateTenantWithAdminResult> {
  const parsed = createTenantWithAdminSchema.parse(raw)
  const slug = (parsed.slug ?? slugify(parsed.name)) || slugify(parsed.name)
  if (!slug) throw new Error('Nao foi possivel derivar slug a partir do nome')

  const existing = await findTenantBySlug(slug)
  const tenantId = existing?.id ?? genTenantId(slug)
  const now = new Date().toISOString()

  // 1) tenant — só cria novo se não existe; preserva dados se já existia.
  const tenant = existing
    ? existing
    : await upsertTenant({
        id: tenantId,
        slug,
        name: parsed.name.trim(),
        subtitle: parsed.subtitle.trim(),
        logoUrl: parsed.logoUrl ?? null,
        primaryColor: parsed.primaryColor ?? null,
        enabledModules: [...new Set(parsed.enabledModules)].sort(),
        connectorId: parsed.connectorId,
        segment: parsed.segment as BusinessSegment,
        plan: parsed.plan,
        trialEndsAt: parsed.trialEndsAt ?? null,
        status: 'active',
        cnpj: parsed.cnpj ?? null,
        contactEmail: parsed.contactEmail ?? null,
        contactPhone: parsed.contactPhone ?? null,
        betaNotes: parsed.betaNotes ?? null,
      })

  // 2) subscription — sempre garante uma compatível com o plano.
  await upsertSubscription({
    tenantId: tenant.id,
    plan: tenant.plan,
    status: defaultSubscriptionStatus(tenant.plan),
  })

  // 3) onboarding — pula wizard por default; pode ser configurado depois.
  if (parsed.skipOnboarding) {
    await upsertTenantOnboardingCompleted(tenant.id)
  }

  // 4) admin user — cria ou atualiza senha/nome do admin existente.
  const normalizedEmail = parsed.adminEmail.trim().toLowerCase()
  const usersInTenant = await readUsersForTenantAsync(tenant.id)
  const existingAdmin = usersInTenant.find((u) => u.email.toLowerCase() === normalizedEmail)
  const passwordHash = await hashUserPasswordAsync(parsed.adminPassword)

  const adminRecord: UserRecord = existingAdmin
    ? {
        ...existingAdmin,
        name: parsed.adminName.trim(),
        role: 'admin',
        status: 'active',
        passwordHash,
        mustChangePassword: false,
        updatedAt: now,
      }
    : {
        id: genUserId(),
        tenantId: tenant.id,
        name: parsed.adminName.trim(),
        email: normalizedEmail,
        role: 'admin',
        status: 'active',
        passwordHash,
        mustChangePassword: false,
        emailVerifiedAt: now,
        createdAt: now,
        updatedAt: now,
      }
  await upsertUserAsync(adminRecord)

  return {
    tenant,
    admin: {
      id: adminRecord.id,
      email: adminRecord.email,
      name: adminRecord.name,
      role: 'admin',
    },
    alreadyExisted: Boolean(existing),
  }
}

/** Gera senha temporária para entrega ao admin (usar com mustChangePassword=true). */
export function generateTempPassword(): string {
  /** 16 bytes base64url → 22 chars sem '/', '+', '='. Já tem letras+dígitos.
   *  Adiciona '!' pra satisfazer o regex de caractere especial. */
  return `${randomBytes(16).toString('base64url').slice(0, 20)}!A1`
}

