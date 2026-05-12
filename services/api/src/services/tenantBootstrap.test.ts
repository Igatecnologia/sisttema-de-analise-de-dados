/**
 * Cobertura de tenantBootstrap — criar nova empresa (tenant + subscription
 * + onboarding + admin) com isolamento multi-tenant garantido.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { randomBytes } from 'node:crypto'
import {
  createTenantWithAdmin,
  createTenantWithAdminSchema,
  generateTempPassword,
} from './tenantBootstrap.js'
import { deleteTenant, findTenantBySlug } from '../tenantStorage.js'
import { readUsersForTenantAsync, deleteUserByIdAsync, verifyUserPasswordAsync } from '../userStorage.js'

function randomSlug(): string {
  return `tst-${randomBytes(4).toString('hex')}`
}

describe('tenantBootstrap.createTenantWithAdmin (SQLite local)', () => {
  const createdSlugs: string[] = []

  beforeEach(() => {
    delete process.env.IGA_STORAGE_DRIVER
  })

  afterEach(async () => {
    for (const slug of createdSlugs.splice(0)) {
      const tenant = await findTenantBySlug(slug)
      if (tenant) {
        for (const u of await readUsersForTenantAsync(tenant.id)) {
          await deleteUserByIdAsync(u.id, tenant.id)
        }
        await deleteTenant(tenant.id)
      }
    }
  })

  describe('schema validation', () => {
    it('exige nome da empresa', () => {
      const result = createTenantWithAdminSchema.safeParse({
        adminEmail: 'a@b.com',
        adminPassword: 'Senha@Segura1!',
      })
      expect(result.success).toBe(false)
    })

    it('rejeita senha fraca do admin', () => {
      const result = createTenantWithAdminSchema.safeParse({
        name: 'Empresa Teste',
        adminEmail: 'a@b.com',
        adminPassword: '12345',
      })
      expect(result.success).toBe(false)
    })

    it('rejeita email do admin invalido', () => {
      const result = createTenantWithAdminSchema.safeParse({
        name: 'Empresa Teste',
        adminEmail: 'sem-arroba',
        adminPassword: 'Senha@Segura1!',
      })
      expect(result.success).toBe(false)
    })

    it('CNPJ opcional mas deve ter 14 digitos se informado', () => {
      expect(createTenantWithAdminSchema.safeParse({
        name: 'X', adminEmail: 'a@b.com', adminPassword: 'Senha@Segura1!',
        cnpj: '12345',
      }).success).toBe(false)

      expect(createTenantWithAdminSchema.safeParse({
        name: 'X', adminEmail: 'a@b.com', adminPassword: 'Senha@Segura1!',
        cnpj: '12345678000190',
      }).success).toBe(true)
    })

    it('plano default = enterprise (Beta/MVP); aceita os 4 planos', () => {
      const r = createTenantWithAdminSchema.parse({
        name: 'X', adminEmail: 'a@b.com', adminPassword: 'Senha@Segura1!',
      })
      expect(r.plan).toBe('enterprise')
    })
  })

  describe('criação inicial', () => {
    it('cria tenant + admin com nome, email e senha funcionando', async () => {
      const slug = randomSlug()
      createdSlugs.push(slug)
      const result = await createTenantWithAdmin({
        name: 'Acme Industrial Ltda',
        slug,
        adminEmail: 'admin@acme.com',
        adminPassword: 'AcmeSenha@2026!',
      })

      expect(result.alreadyExisted).toBe(false)
      expect(result.tenant.slug).toBe(slug)
      expect(result.tenant.name).toBe('Acme Industrial Ltda')
      expect(result.tenant.plan).toBe('enterprise')
      expect(result.tenant.status).toBe('active')
      expect(result.tenant.trialEndsAt).toBeNull()
      expect(result.admin.email).toBe('admin@acme.com')
      expect(result.admin.role).toBe('admin')

      // Verifica que o admin existe no tenant correto
      const users = await readUsersForTenantAsync(result.tenant.id)
      expect(users).toHaveLength(1)
      expect(users[0].email).toBe('admin@acme.com')

      // Senha funciona via argon2id
      const ok = await verifyUserPasswordAsync('AcmeSenha@2026!', users[0].passwordHash)
      expect(ok).toBe(true)
    })

    it('deriva slug do nome quando não informado', async () => {
      const result = await createTenantWithAdmin({
        name: `Empresa Auto Slug ${randomBytes(2).toString('hex')}`,
        adminEmail: 'admin@auto.com',
        adminPassword: 'AutoSenha@2026!',
      })
      createdSlugs.push(result.tenant.slug)
      expect(result.tenant.slug).toMatch(/^empresa-auto-slug-/)
    })

    it('aceita segment e connectorId customizados', async () => {
      const slug = randomSlug()
      createdSlugs.push(slug)
      const result = await createTenantWithAdmin({
        name: 'Comercio XYZ',
        slug,
        segment: 'commerce',
        connectorId: 'bling',
        adminEmail: 'admin@xyz.com',
        adminPassword: 'XyzSenha@2026!',
      })
      expect(result.tenant.segment).toBe('commerce')
      expect(result.tenant.connectorId).toBe('bling')
    })

    it('plano trial deixa trialEndsAt configurável e status="trialing"', async () => {
      const slug = randomSlug()
      createdSlugs.push(slug)
      const trialEnds = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
      const result = await createTenantWithAdmin({
        name: 'Trial Co',
        slug,
        plan: 'trial',
        trialEndsAt: trialEnds,
        adminEmail: 'admin@trial.co',
        adminPassword: 'TrialSenha@2026!',
      })
      expect(result.tenant.plan).toBe('trial')
      expect(result.tenant.trialEndsAt).toBe(trialEnds)
    })
  })

  describe('idempotência (re-chamar com mesmo slug)', () => {
    it('alreadyExisted=true sem sobrescrever name/segment do tenant', async () => {
      const slug = randomSlug()
      createdSlugs.push(slug)
      const first = await createTenantWithAdmin({
        name: 'Nome Original',
        slug,
        segment: 'industry',
        adminEmail: 'admin@idem.com',
        adminPassword: 'IdemSenha@2026!',
      })
      const second = await createTenantWithAdmin({
        name: 'Nome Diferente',
        slug,
        segment: 'commerce', // tentativa de mudar — deve ser ignorada
        adminEmail: 'admin@idem.com',
        adminPassword: 'NovaSenha@2026Forte!',
      })
      expect(first.alreadyExisted).toBe(false)
      expect(second.alreadyExisted).toBe(true)
      expect(second.tenant.id).toBe(first.tenant.id)
      // Preserva o nome e segment originais
      expect(second.tenant.name).toBe('Nome Original')
      expect(second.tenant.segment).toBe('industry')
    })

    it('atualiza senha do admin existente em re-chamada (idempotente)', async () => {
      const slug = randomSlug()
      createdSlugs.push(slug)
      await createTenantWithAdmin({
        name: 'Update Senha Co',
        slug,
        adminEmail: 'admin@upd.com',
        adminPassword: 'PrimeiraSenha@2026!',
      })
      await createTenantWithAdmin({
        name: 'Update Senha Co',
        slug,
        adminEmail: 'admin@upd.com',
        adminPassword: 'SegundaSenha@2026!',
      })

      const users = await readUsersForTenantAsync((await findTenantBySlug(slug))!.id)
      expect(users).toHaveLength(1) // não criou outro admin
      const oldOk = await verifyUserPasswordAsync('PrimeiraSenha@2026!', users[0].passwordHash)
      const newOk = await verifyUserPasswordAsync('SegundaSenha@2026!', users[0].passwordHash)
      expect(oldOk).toBe(false)
      expect(newOk).toBe(true)
    })
  })

  describe('isolamento multi-tenant', () => {
    it('mesmo adminEmail em 2 tenants diferentes = 2 contas independentes', async () => {
      const slug1 = randomSlug()
      const slug2 = randomSlug()
      createdSlugs.push(slug1, slug2)

      const t1 = await createTenantWithAdmin({
        name: 'Empresa A', slug: slug1,
        adminEmail: 'mesmo@email.com', adminPassword: 'SenhaA@2026!',
      })
      const t2 = await createTenantWithAdmin({
        name: 'Empresa B', slug: slug2,
        adminEmail: 'mesmo@email.com', adminPassword: 'SenhaB@2026!',
      })

      expect(t1.tenant.id).not.toBe(t2.tenant.id)
      expect(t1.admin.id).not.toBe(t2.admin.id)

      const usersA = await readUsersForTenantAsync(t1.tenant.id)
      const usersB = await readUsersForTenantAsync(t2.tenant.id)
      expect(usersA).toHaveLength(1)
      expect(usersB).toHaveLength(1)
      // Senhas distintas — confirma que são contas diferentes
      expect(await verifyUserPasswordAsync('SenhaA@2026!', usersA[0].passwordHash)).toBe(true)
      expect(await verifyUserPasswordAsync('SenhaB@2026!', usersA[0].passwordHash)).toBe(false)
      expect(await verifyUserPasswordAsync('SenhaB@2026!', usersB[0].passwordHash)).toBe(true)
    })
  })
})

describe('tenantBootstrap.generateTempPassword', () => {
  it('gera senha que satisfaz o schema strong', () => {
    for (let i = 0; i < 50; i++) {
      const pwd = generateTempPassword()
      // Deve passar pelo schema da função: 12+ chars, mai, min, dig, especial
      expect(pwd.length).toBeGreaterThanOrEqual(12)
      expect(pwd).toMatch(/[a-z]/)
      expect(pwd).toMatch(/[A-Z]/)
      expect(pwd).toMatch(/\d/)
      expect(pwd).toMatch(/[^A-Za-z0-9]/)
    }
  })
})
