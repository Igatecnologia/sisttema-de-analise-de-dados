import { useEffect, useMemo, useState } from 'react'
import { TenantContext, DEFAULT_TENANT, defaultBrandLogoUrl, type TenantConfig } from './TenantContext'
import { setCurrentTenantId } from './tenantStorage'

function resolveTenantId(): string {
  const envTenant = import.meta.env.VITE_TENANT_ID?.toString().trim()
  if (envTenant) return envTenant
  const host = window.location.hostname
  const parts = host.split('.')
  if (parts.length >= 3 && parts[0] !== 'www') return parts[0]
  return 'default'
}

function loadTenantFromEnv(tenantId: string): TenantConfig {
  const companyName = import.meta.env.VITE_COMPANY_NAME?.toString().trim() || DEFAULT_TENANT.companyName
  const explicitLogoUrl = import.meta.env.VITE_LOGO_URL?.toString().trim()

  return {
    tenantId,
    companyName,
    logoUrl: explicitLogoUrl || defaultBrandLogoUrl(),
    subtitle: import.meta.env.VITE_COMPANY_SUBTITLE?.toString().trim() || DEFAULT_TENANT.subtitle,
    primaryColor: import.meta.env.VITE_PRIMARY_COLOR?.toString().trim() || undefined,
  }
}

/**
 * Tenta buscar config do tenant via API.
 * Se falhar, usa env vars / defaults.
 */
async function fetchTenantConfig(tenantId: string): Promise<TenantConfig | null> {
  if (tenantId === 'default') return null
  try {
    const res = await fetch(`/api/v1/tenants/${tenantId}/config`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) return null
    const data = await res.json()
    const companyName = data.companyName ?? DEFAULT_TENANT.companyName
    return {
      tenantId,
      companyName,
      logoUrl: data.logoUrl || defaultBrandLogoUrl(),
      subtitle: data.subtitle ?? DEFAULT_TENANT.subtitle,
      primaryColor: data.primaryColor ?? undefined,
    }
  } catch {
    return null
  }
}

/** Valida que a cor é um hex seguro */
function isValidHexColor(color: string): boolean {
  return /^#[0-9a-fA-F]{3,8}$/.test(color)
}

/** Aplica a cor primária do tenant como CSS custom property */
function applyTenantColors(config: TenantConfig) {
  if (config.primaryColor && isValidHexColor(config.primaryColor)) {
    document.documentElement.style.setProperty('--qc-primary', config.primaryColor)
  }
  document.title = `${config.companyName} — Gestão e Análise`
}

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const tenantId = useMemo(() => resolveTenantId(), [])
  const envConfig = useMemo(() => loadTenantFromEnv(tenantId), [tenantId])
  const [tenant, setTenant] = useState<TenantConfig>(envConfig)

  useEffect(() => {
    setCurrentTenantId(tenantId)
    applyTenantColors(envConfig)

    // Tenta buscar config atualizada da API (non-blocking)
    fetchTenantConfig(tenantId).then((remote) => {
      if (remote) {
        setTenant(remote)
        applyTenantColors(remote)
      }
    })
  }, [tenantId, envConfig])

  const value = useMemo(() => ({ tenant }), [tenant])

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>
}
