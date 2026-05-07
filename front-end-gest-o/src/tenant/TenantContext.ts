import { createContext, useContext } from 'react'

/** Logo oficial em `public/logo.png.png` (URL absoluta ao base do Vite). */
export function defaultBrandLogoUrl(): string {
  const base = import.meta.env.BASE_URL || '/'
  return base.endsWith('/') ? `${base}logo.png.png` : `${base}/logo.png.png`
}

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
}

/** Tenant padrão — usado quando nenhum tenant é resolvido */
export const DEFAULT_TENANT: TenantConfig = {
  tenantId: 'default',
  companyName: 'IGA',
  logoUrl: defaultBrandLogoUrl(),
  subtitle: 'Automação & Tecnologia',
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
    id: 'sgbr-espuma',
    name: 'SGBR Espuma',
    labels: {
      product: 'Espuma',
      productPlural: 'Espumas',
      rawMaterial: 'Materia-prima',
      finishedProduct: 'Produto final',
      production: 'Producao de espuma',
      stock: 'Estoque de espuma',
      sales: 'Vendas SGBR',
    },
    productTypes: ['materia-prima', 'espuma', 'aglomerado', 'produto-final', 'outro'],
  },
  plan: 'trial',
  trialEndsAt: null,
}

export const TenantContext = createContext<TenantContextValue | null>(null)

export function useTenant(): TenantConfig {
  const ctx = useContext(TenantContext)
  return ctx?.tenant ?? DEFAULT_TENANT
}
