import type { DashboardData } from '../types/models'
import { hasAnySources } from '../services/dataSourceService'
import { getValidated } from '../api/validatedHttp'
import { dashboardResponseSchema } from '../api/schemas'
import { http } from './http'
import { getVendasAnalitico } from './vendasAnaliticoService'
import {
  buildDashboardFromVendasRows,
  dashboardRangeFromPeriod,
  type DashboardPeriod,
} from '../utils/vendasAnaliticoAggregates'

type GetDashboardOptions = {
  /** Recorte enviado à API SGBR `vendas/analitico` (padrão 30 dias). */
  period?: DashboardPeriod
  /** Datas customizadas — se informadas, ignoram o period. */
  startDate?: string
  endDate?: string
}

export async function getDashboardData(options: GetDashboardOptions = {}): Promise<DashboardData> {
  const { period = '30d', startDate, endDate } = options

  if (hasAnySources()) {
    // Datas customizadas têm prioridade sobre o period
    const range = startDate && endDate
      ? { dtDe: startDate, dtAte: endDate }
      : dashboardRangeFromPeriod(period)
    const { rows } = await getVendasAnalitico(range)
    return buildDashboardFromVendasRows(rows)
  }
  return getValidated(http, '/dashboard', dashboardResponseSchema, {
    params: { period },
  })
}
