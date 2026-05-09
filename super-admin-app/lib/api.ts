/**
 * Cliente HTTP usado pelo super-admin app. As requisições passam por
 * /api/* que o Next reescreve pra o backend Express (vide next.config.ts).
 * Cookies HttpOnly viajam automaticamente pois compartilhamos origem.
 */

export class ApiError extends Error {
  constructor(public status: number, message: string, public body?: unknown) {
    super(message)
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method,
    credentials: 'include',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let data: unknown = null
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = text
    }
  }
  if (!res.ok) {
    const message =
      data && typeof data === 'object' && 'message' in data && typeof (data as { message: string }).message === 'string'
        ? (data as { message: string }).message
        : `HTTP ${res.status}`
    throw new ApiError(res.status, message, data)
  }
  return data as T
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body),
  delete: <T>(path: string) => request<T>('DELETE', path),
}

export type Tenant = {
  id: string
  slug: string
  name: string
  subtitle: string
  logoUrl: string | null
  primaryColor: string | null
  connectorId: string
  enabledModules: string[]
  plan: 'trial' | 'starter' | 'pro' | 'enterprise'
  status: 'active' | 'inactive' | 'suspended'
  trialEndsAt: string | null
  createdAt: string
  updatedAt: string | null
  userCount: number
  datasourceCount: number
  subscriptionStatus: string
  mrrBrlCents: number
}

export type TenantsResponse = {
  total: number
  tenants: Tenant[]
  metrics: { byPlan: Record<string, number>; byStatus: Record<string, number> }
}

export type Metrics = {
  mrrBrlFormatted: string
  activeSubscriptions: number
  trialingTenants: number
  suspendedTenants: number
  canceledSubscriptions: number
  churnRatePct: number
}

export type AuditEvent = {
  id: string
  action: string
  resource: string
  createdAt: string
  userId: string | null
  tenantId: string | null
  metadata: unknown
}

export type Me = {
  user: { id: string; name: string; email: string; role: string }
  permissions: string[]
  isSuperAdmin?: boolean
}

export type TenantInput = {
  slug?: string
  name: string
  subtitle?: string
  logoUrl?: string | null
  primaryColor?: string | null
  plan: 'trial' | 'starter' | 'pro' | 'enterprise'
  status: 'active' | 'inactive'
  connectorId?: string
  trialEndsAt?: string | null
  enabledModules?: string[]
}

export type TenantDetail = {
  tenant: Tenant
  users: Array<{ id: string; name: string; email: string; role: string; status: string }>
  datasources: Array<{ id: string; name: string }>
  recentAudit: Array<{ id: string; action: string; resource: string; createdAt: string; userId: string | null; metadata: unknown }>
}

export const ALL_MODULES = [
  'dashboard',
  'financeiro',
  'relatorios',
  'usuarios',
  'auditoria',
  'datasources',
  'operations',
  'producao',
  'ficha_tecnica',
  'compras',
  'comercial',
  'estoque',
  'alertas',
  'suporte',
] as const
