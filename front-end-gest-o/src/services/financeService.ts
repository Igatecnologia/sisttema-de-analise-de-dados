import type { FinanceOverview } from '../types/models'
import { hasAnySources } from '../services/dataSourceService'
import { getValidated } from '../api/validatedHttp'
import { financeOverviewSchema } from '../api/schemas'
import { http } from './http'
import { getVendasAnalitico } from './vendasAnaliticoService'
import { buildFinanceFromVendasRows, currentMonthRange } from '../utils/vendasAnaliticoAggregates'

type GetFinanceOverviewOpts = {
  /** Só SGBR: mesmo intervalo enviado ao analítico de vendas (vendas ou vendanfe). */
  dtDe?: string
  dtAte?: string
}

export async function getFinanceOverview(opts?: GetFinanceOverviewOpts): Promise<FinanceOverview> {
  if (hasAnySources()) {
    const { dtDe, dtAte } =
      opts?.dtDe && opts?.dtAte ? { dtDe: opts.dtDe, dtAte: opts.dtAte } : currentMonthRange()
    const { rows, meta } = await getVendasAnalitico({ dtDe, dtAte })
    return { ...buildFinanceFromVendasRows(rows), analiticoFetchMeta: meta }
  }
  return getValidated(http, '/finance', financeOverviewSchema)
}
