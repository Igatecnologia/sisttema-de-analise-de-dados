import { readAll, type DataSource } from '../storage.js'
import type { ConnectorArea, IndustryConnector } from './industryConnector.js'

function normalize(ep: string | undefined): string {
  if (!ep) return ''
  let s = ep.trim()
  const q = s.indexOf('?')
  if (q >= 0) s = s.slice(0, q)
  return s.toLowerCase()
}

/**
 * Resolve um datasource para a area logica solicitada usando os hints do connector
 * do tenant. Caminho de match:
 *  1) `erpEndpoints` do datasource contem o nome canonico da area
 *  2) `dataEndpoint` contem alguma das substrings declaradas em `connector.areaHints[area]`
 *
 * Retorna `null` se nenhum datasource bater — caller decide se faz fallback.
 */
export function findDsIdForArea(
  tenantId: string,
  area: ConnectorArea,
  connector: IndustryConnector,
): string | null {
  const all = readAll().filter((d) => d.tenantId === tenantId)
  return findDsIdForAreaIn(all, area, connector)
}

export function findDsIdForAreaIn(
  sources: DataSource[],
  area: ConnectorArea,
  connector: IndustryConnector,
): string | null {
  const byArea = sources.find((d) => (d.erpEndpoints ?? []).includes(area))
  if (byArea?.id) return byArea.id

  const hints = connector.areaHints[area] ?? []
  for (const hint of hints) {
    const lower = hint.toLowerCase()
    const match = sources.find((d) => normalize(d.dataEndpoint).includes(lower))
    if (match?.id) return match.id
  }
  return null
}
