import { http } from './http'

export type ProductionTarget = {
  id: string
  sku: string | null
  targetType: 'daily' | 'weekly' | 'monthly'
  targetValue: number
  unit: string
  validFrom: string
  validTo: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
}

export type ProductionTargetInput = Omit<ProductionTarget, 'id' | 'createdAt' | 'updatedAt'>

const BASE = '/production'

export async function listTargets(): Promise<ProductionTarget[]> {
  const { data } = await http.get<ProductionTarget[]>(`${BASE}/targets`)
  return data
}

export async function createTarget(input: ProductionTargetInput): Promise<ProductionTarget> {
  const { data } = await http.post<ProductionTarget>(`${BASE}/targets`, input)
  return data
}

export async function deleteTarget(id: string): Promise<void> {
  await http.delete(`${BASE}/targets/${id}`)
}

export type OeeItemStatus = 'sem-meta' | 'critico' | 'atencao' | 'ok' | 'acima'

export type OeeItem = {
  sku: string
  name: string
  produced: number
  target: number | null
  unit: string
  performancePct: number | null
  status: OeeItemStatus
}

export type OeeResponseOk = {
  ok: true
  period: 'daily' | 'weekly' | 'monthly'
  periodLabel: string
  totalProduced: number
  aggregateTarget: { value: number; unit: string; performancePct: number | null } | null
  items: OeeItem[]
  counts: { withTarget: number; withoutTarget: number; critical: number }
  note: string
}

export type OeeResponseError = {
  ok: false
  reason: 'no_production_source' | 'production_fetch_failed' | string
  period: string
  message?: string
}

export type OeeResponse = OeeResponseOk | OeeResponseError

export async function getOee(period: 'daily' | 'weekly' | 'monthly' = 'monthly'): Promise<OeeResponse> {
  const { data } = await http.get<OeeResponse>(`${BASE}/oee?period=${period}`)
  return data
}
