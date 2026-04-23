import { getAllVendasAnaliticoDataSources } from './dataSourceService'

/**
 * Política atual: **sempre** usar TODAS as fontes compatíveis com vendas analítico.
 * O usuário não escolhe mais; o sistema concatena as linhas de cada API.
 *
 * Antes existia uma seleção persistida em `tenantStorage` + um picker no header.
 * Removidos por decisão de produto ("ler todos os dados das APIs instaladas sem
 * o usuário precisar escolher"). As funções legadas viraram no-op para manter
 * compat com chamadas já existentes.
 */

/** IDs efetivos para `GET /api/proxy/data` — sempre todas as fontes cadastradas. */
export function resolveVendasAnaliticoDataSourceIds(): string[] {
  return getAllVendasAnaliticoDataSources().map((d) => d.id)
}

/** Chave estável para React Query — muda automaticamente se o conjunto de fontes mudar. */
export function getVendasAnaliticoQuerySourceKey(): string {
  const ids = resolveVendasAnaliticoDataSourceIds()
  return ids.length ? ids.slice().sort().join('+') : 'none'
}

/** @deprecated mantido só para não quebrar imports legados; sempre retorna 'all'. */
export function getVendasAnaliticoSelectionStored(): 'all' {
  return 'all'
}

/** @deprecated no-op; a seleção foi removida do produto. */
export function setVendasAnaliticoSelection(_selection: 'all' | string): void {
  /* intencionalmente vazio — seleção sempre 'all'. */
}

/** Rótulo para tags de página. */
export function getVendasAnaliticoDataSourceLabel(): string {
  const all = getAllVendasAnaliticoDataSources()
  if (all.length === 0) return 'Fonte não identificada'
  if (all.length === 1) {
    const ds = all[0]
    return `${ds.name} (${ds.id.slice(0, 8)})`
  }
  return `${all.length} fontes unidas`
}
