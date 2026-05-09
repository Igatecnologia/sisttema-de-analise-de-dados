import { createContext, useContext } from 'react'

/** Logo oficial em `public/logo.png.png` (URL absoluta ao base do Vite). */
export function defaultBrandLogoUrl(): string {
  const base = import.meta.env.BASE_URL || '/'
  return base.endsWith('/') ? `${base}logo.png.png` : `${base}/logo.png.png`
}

/** Segmentos de negócio suportados pelo SaaS — espelha back-end/src/segments.ts. */
export type BusinessSegment = 'industry' | 'commerce' | 'services' | 'distribution'

export type TenantConfig = {
  /** Identificador único do tenant (ex: slug, UUID) */
  tenantId: string
  /** Nome de exibição da empresa */
  companyName: string
  /** URL do logo (pode ser data-url ou URL absoluta) */
  logoUrl: string
  /** Subtítulo do sistema (ex: "Gestão e Análise de Dados") */
  subtitle: string
  /** Cor primária em hex (ex: "#1A7AB5") — sobrescreve o tema padrão */
  primaryColor?: string
  /** Modulos habilitados para o tenant atual */
  enabledModules: string[]
  /** Segmento de negócio escolhido no signup. Direciona labels e módulos. */
  segment?: BusinessSegment
  connector?: {
    id: string
    name: string
    labels: {
      product: string
      productPlural: string
      rawMaterial: string
      finishedProduct: string
      production: string
      stock: string
      sales: string
    }
    /** Segmentos de negócio suportados por este connector. */
    segments?: BusinessSegment[]
    productTypes: string[]
    demoData?: {
      stockRows: Record<string, unknown>[]
      salesRows: Record<string, unknown>[]
    }
  }
  plan?: 'trial' | 'starter' | 'pro' | 'enterprise'
  trialEndsAt?: string | null
}

export type TenantContextValue = {
  tenant: TenantConfig
  refreshTenant: () => Promise<void>
}

/**
 * Tenant padrão — usado quando nenhum tenant é resolvido (ex.: tela de login,
 * primeira renderização). Labels neutros, sem amarração a um nicho específico.
 */
export const DEFAULT_TENANT: TenantConfig = {
  tenantId: 'default',
  companyName: 'IGA',
  logoUrl: defaultBrandLogoUrl(),
  subtitle: 'Gestão & Análise de Dados',
  segment: 'industry',
  enabledModules: [
    'dashboard',
    'financeiro',
    'relatorios',
    'usuarios',
    'auditoria',
    'producao',
    'ficha_tecnica',
    'comercial',
    'compras',
    'estoque',
    'alertas',
    'suporte',
    'datasources',
    'operations',
  ],
  connector: {
    id: 'iga-custom-api',
    name: 'API IGA',
    labels: {
      product: 'Produto',
      productPlural: 'Produtos',
      rawMaterial: 'Matéria-prima',
      finishedProduct: 'Produto final',
      production: 'Produção',
      stock: 'Estoque',
      sales: 'Vendas',
    },
    segments: ['industry', 'commerce', 'services', 'distribution'],
    productTypes: ['materia-prima', 'produto-final', 'outro'],
  },
  plan: 'trial',
  trialEndsAt: null,
}

export const TenantContext = createContext<TenantContextValue | null>(null)

export function useTenant(): TenantConfig {
  const ctx = useContext(TenantContext)
  return ctx?.tenant ?? DEFAULT_TENANT
}

export function useTenantRefresh(): () => Promise<void> {
  const ctx = useContext(TenantContext)
  return ctx?.refreshTenant ?? (async () => undefined)
}
