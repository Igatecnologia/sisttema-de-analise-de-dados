import type { BusinessSegment } from '../tenant/TenantContext'

/**
 * Configuração de dashboard por segmento de negócio.
 *
 * Hoje o DashboardPage tem layout único (foco comercial: KPIs + top clientes +
 * vendas por dia). Cada segmento tem ênfases diferentes:
 *  - industry: produção/OEE + ficha técnica + estoque intermediário
 *  - commerce: vendas + margem + top produtos
 *  - services: contratos recorrentes + clientes ativos + ticket médio
 *  - distribution: pedidos por filial + logística + estoque multi-local
 *
 * Esta config define HEADLINE, SUBTITLE, KPIs em destaque e PRÓXIMAS AÇÕES
 * sugeridas. Os widgets em si (gráficos) são compartilhados — diferenciação
 * fica em texto + ordem + sugestões de drill-down.
 *
 * Quando criarmos widgets segmento-específicos (OEE Card, Funil de Vendas,
 * Recorrência Trend), este arquivo declara quais aparecem em cada layout.
 */

export type DashboardKpiKey = 'faturamento' | 'ticket' | 'clientes' | 'margem' | 'producao' | 'estoque' | 'recorrencia' | 'pedidos'

export type DashboardActionHint = {
  label: string
  /** Path interno (com search params se aplicável). */
  href: string
  /** Ícone Lucide ou Ant Design — opcional, renderizado no card. */
  icon?: 'rocket' | 'compass' | 'target' | 'package' | 'users' | 'trending-up'
}

export type DashboardSegmentConfig = {
  /** Headline curto exibido no topo. */
  headline: string
  /** Subtítulo descritivo (1 linha). */
  subtitle: string
  /** Ordem dos KPIs em destaque (4 cards principais). */
  kpiOrder: DashboardKpiKey[]
  /** Sugestões contextuais para o admin daquele segmento. */
  actions: DashboardActionHint[]
}

export const DASHBOARD_LAYOUTS: Record<BusinessSegment, DashboardSegmentConfig> = {
  industry: {
    headline: 'Painel da indústria',
    subtitle: 'Produção, estoque, vendas e margem em tempo real.',
    kpiOrder: ['faturamento', 'producao', 'margem', 'estoque'],
    actions: [
      { label: 'Configurar metas de produção (OEE)', href: '/producao?tab=oee', icon: 'target' },
      { label: 'Ver ficha técnica dos produtos', href: '/ficha-tecnica', icon: 'compass' },
      { label: 'Estoque de matéria-prima', href: '/estoque?tab=materia-prima', icon: 'package' },
    ],
  },
  commerce: {
    headline: 'Painel do comércio',
    subtitle: 'Vendas, margem, clientes e estoque do varejo/atacado.',
    kpiOrder: ['faturamento', 'ticket', 'clientes', 'margem'],
    actions: [
      { label: 'Cadastrar clientes (segmentação A/B/C)', href: '/clientes?tab=abc', icon: 'users' },
      { label: 'Ver curva ABC de produtos', href: '/vendas-analitico?tab=abc', icon: 'trending-up' },
      { label: 'Configurar metas mensais de venda', href: '/relatorios?tipo=meta-mensal', icon: 'target' },
    ],
  },
  services: {
    headline: 'Painel de serviços',
    subtitle: 'Contratos, recorrência, cobrança e acompanhamento operacional.',
    kpiOrder: ['faturamento', 'recorrencia', 'clientes', 'ticket'],
    actions: [
      { label: 'Cadastrar clientes recorrentes', href: '/clientes', icon: 'users' },
      { label: 'Acompanhar contas a receber', href: '/financeiro?tab=contas-receber', icon: 'trending-up' },
      { label: 'Configurar relatórios automáticos', href: '/relatorios-agendados', icon: 'compass' },
    ],
  },
  distribution: {
    headline: 'Painel da distribuição',
    subtitle: 'Pedidos por filial, logística, estoque multifilial e compras.',
    kpiOrder: ['faturamento', 'pedidos', 'estoque', 'margem'],
    actions: [
      { label: 'Acompanhar pedidos em aberto', href: '/comercial', icon: 'rocket' },
      { label: 'Estoque por SKU + ruptura', href: '/estoque', icon: 'package' },
      { label: 'Gestão de compras estratégicas', href: '/compras', icon: 'compass' },
    ],
  },
}

/** Resolve config com fallback seguro para industry (compatibilidade legada). */
export function getDashboardConfig(segment: BusinessSegment | undefined): DashboardSegmentConfig {
  return DASHBOARD_LAYOUTS[segment ?? 'industry'] ?? DASHBOARD_LAYOUTS.industry
}
