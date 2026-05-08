import { readAllForTenantAsync } from '../storage.js'
import { findTenantBySlug } from '../tenantStorage.js'
import { readUsersForTenantAsync } from '../userStorage.js'

export async function buildTenantExport(tenantId: string) {
  const [users, datasources, tenant] = await Promise.all([
    readUsersForTenantAsync(tenantId),
    readAllForTenantAsync(tenantId),
    findTenantBySlug(tenantId),
  ])

  const sanitizedUsers = users.map((u) => ({
    id: u.id,
    tenantId: u.tenantId,
    name: u.name,
    email: u.email,
    role: u.role,
    status: u.status,
    permissions: u.permissions,
    mustChangePassword: u.mustChangePassword,
    emailVerifiedAt: u.emailVerifiedAt,
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
  }))

  const sanitizedDataSources = datasources.map((d) => ({
    id: d.id,
    tenantId: d.tenantId,
    name: d.name,
    type: d.type,
    apiUrl: d.apiUrl,
    authMethod: d.authMethod,
    status: d.status,
    lastCheckedAt: d.lastCheckedAt,
    lastError: d.lastError,
    fieldMappings: d.fieldMappings,
    erpEndpoints: d.erpEndpoints,
    isAuthSource: d.isAuthSource,
    loginEndpoint: d.loginEndpoint,
    dataEndpoint: d.dataEndpoint,
    passwordMode: d.passwordMode,
    loginFieldUser: d.loginFieldUser,
    loginFieldPassword: d.loginFieldPassword,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  }))

  return {
    exportedAt: new Date().toISOString(),
    tenant,
    users: sanitizedUsers,
    datasources: sanitizedDataSources,
    counts: {
      users: sanitizedUsers.length,
      datasources: sanitizedDataSources.length,
    },
    note: 'Credenciais de datasources e hashes de senha sao omitidos por seguranca. Para portabilidade real, recadastre credenciais no novo provedor.',
  }
}
