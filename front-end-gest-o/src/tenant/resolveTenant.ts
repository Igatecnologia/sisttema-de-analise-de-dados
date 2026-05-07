export function normalizeTenantSlug(value: string | null | undefined): string | null {
  const slug = value?.trim().toLowerCase()
  if (!slug || !/^[a-z0-9][a-z0-9-]{0,62}[a-z0-9]$/.test(slug)) return null
  return slug
}

export function resolveTenantIdFromLocation(location: Pick<Location, 'hostname' | 'pathname' | 'search'>): string {
  const envTenant = normalizeTenantSlug(import.meta.env.VITE_TENANT_ID?.toString())
  if (envTenant) return envTenant

  const params = new URLSearchParams(location.search)
  const queryTenant = normalizeTenantSlug(params.get('tenant') ?? params.get('tenantId'))
  if (queryTenant) return queryTenant

  const pathParts = location.pathname.split('/').filter(Boolean)
  if ((pathParts[0] === 't' || pathParts[0] === 'tenant') && pathParts[1]) {
    const pathTenant = normalizeTenantSlug(pathParts[1])
    if (pathTenant) return pathTenant
  }

  const host = location.hostname
  const parts = host.split('.')
  if (parts.length >= 3 && parts[0] !== 'www') {
    return normalizeTenantSlug(parts[0]) ?? 'default'
  }

  return 'default'
}
