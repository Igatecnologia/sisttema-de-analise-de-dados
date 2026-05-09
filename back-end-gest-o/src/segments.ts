/**
 * Segmentos de negócio suportados pelo SaaS. A escolha do segmento no signup
 * determina:
 *   - Conectores recomendados (filtrados por compatibilidade)
 *   - Módulos habilitados por padrão
 *   - Labels da UI (override em cima dos labels do connector)
 *   - Templates de dashboard
 *
 * Adicionar um segmento aqui exige também: novo connector recomendado,
 * tradução de UI no front, template de dashboard correspondente.
 */
export type BusinessSegment = 'industry' | 'commerce' | 'services' | 'distribution'

export const BUSINESS_SEGMENTS: BusinessSegment[] = ['industry', 'commerce', 'services', 'distribution']

export function isBusinessSegment(value: unknown): value is BusinessSegment {
  return typeof value === 'string' && (BUSINESS_SEGMENTS as string[]).includes(value)
}

export type SegmentDefinition = {
  id: BusinessSegment
  name: string
  description: string
  /** Módulos habilitados por padrão para tenants deste segmento. */
  defaultModules: string[]
  /** Connector sugerido quando o usuário ainda não conectou nada. */
  recommendedConnectorId: string
}

export const SEGMENT_DEFINITIONS: Record<BusinessSegment, SegmentDefinition> = {
  industry: {
    id: 'industry',
    name: 'Indústria',
    description: 'Manufatura, produção, ficha técnica, estoque de insumos e produto acabado.',
    defaultModules: [
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
    recommendedConnectorId: 'iga-custom-api',
  },
  commerce: {
    id: 'commerce',
    name: 'Comércio',
    description: 'Varejo e atacado: vendas, clientes, estoque, compras, margem, relatórios.',
    defaultModules: [
      'dashboard',
      'financeiro',
      'relatorios',
      'usuarios',
      'auditoria',
      'comercial',
      'compras',
      'estoque',
      'alertas',
      'suporte',
      'datasources',
    ],
    recommendedConnectorId: 'bling',
  },
  services: {
    id: 'services',
    name: 'Serviços',
    description: 'Contratos, recorrência, cobrança e acompanhamento operacional.',
    defaultModules: [
      'dashboard',
      'financeiro',
      'relatorios',
      'usuarios',
      'auditoria',
      'comercial',
      'alertas',
      'suporte',
      'datasources',
      'operations',
    ],
    recommendedConnectorId: 'omie',
  },
  distribution: {
    id: 'distribution',
    name: 'Distribuição',
    description: 'Distribuidores e atacado: pedidos, logística, estoque multifilial, compras.',
    defaultModules: [
      'dashboard',
      'financeiro',
      'relatorios',
      'usuarios',
      'auditoria',
      'comercial',
      'compras',
      'estoque',
      'alertas',
      'suporte',
      'datasources',
      'operations',
    ],
    recommendedConnectorId: 'bling',
  },
}

export function defaultSegment(): BusinessSegment {
  return 'industry'
}

export function defaultModulesForSegment(segment: BusinessSegment): string[] {
  return SEGMENT_DEFINITIONS[segment]?.defaultModules ?? SEGMENT_DEFINITIONS.industry.defaultModules
}

export function recommendedConnectorForSegment(segment: BusinessSegment): string {
  return SEGMENT_DEFINITIONS[segment]?.recommendedConnectorId ?? 'iga-custom-api'
}

/**
 * Heurística para inferir segmento a partir de tenants existentes que ainda
 * não têm segmento explícito. Usado uma vez na migração — depois disso o
 * registro/admin define explicitamente.
 */
export function inferSegmentFromConnectorId(connectorId: string | null | undefined): BusinessSegment {
  const id = (connectorId ?? '').toLowerCase()
  if (id === 'sgbr-espuma' || id === 'iga-custom-api' || id === 'generic') return 'industry'
  if (id === 'bling' || id === 'tiny') return 'commerce'
  if (id === 'omie') return 'industry'
  if (id === 'csv') return 'industry'
  return 'industry'
}
