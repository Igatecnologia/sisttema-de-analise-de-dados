import { http } from './http'

export type RevenueForecastOk = {
  ok: true
  method: string
  confidence: 'high' | 'medium' | 'low'
  daysWithData: number
  currentMonthSoFar: number
  dailyAverage: number
  projectedEndOfMonth: number
  projectionLowerBound: number
  projectionUpperBound: number
  daysElapsed: number
  daysRemaining: number
}

export type RevenueForecastError = {
  ok: false
  reason: 'no_sales_source' | 'insufficient_history' | string
  message: string
  daysWithData?: number
}

export type RevenueForecastResponse = RevenueForecastOk | RevenueForecastError

export async function getRevenueForecast(): Promise<RevenueForecastResponse> {
  const { data } = await http.get<RevenueForecastResponse>('/forecast/revenue')
  return data
}

export type StockRuptureItem = {
  sku: string
  name: string
  saldo: number
  custoUnitario: number
  valorEmEstoque: number
  consumoDiarioMedio: number
  diasAteRuptura: number | null
  risco: 'critico' | 'atencao' | 'ok' | 'sem-consumo'
}

export type StockRuptureOk = {
  ok: true
  method: string
  daysWindow: number
  items: StockRuptureItem[]
  totalSkus: number
  skusComConsumo: number
}

export type StockRuptureError = {
  ok: false
  reason: 'no_stock_source' | 'stock_fetch_failed' | 'no_stock_balances' | string
  message?: string
}

export type StockRuptureResponse = StockRuptureOk | StockRuptureError

export async function getStockRupture(topN = 10): Promise<StockRuptureResponse> {
  const { data } = await http.get<StockRuptureResponse>(`/forecast/stock-rupture?topN=${topN}`)
  return data
}
