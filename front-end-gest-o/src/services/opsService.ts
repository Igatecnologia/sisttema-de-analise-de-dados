import { http } from './http'

export type OpsStatusResponse = {
  timestamp: string
  uptimeSec: number
  nodeEnv: string
  storage: { users: boolean; datasources: boolean }
  proxy: {
    stats: Record<string, number | string | null>
    reconcileAlert: Record<string, unknown>
    tokenCacheSize: number
  }
}

/** GET /api/v1/ops/status — painel operacional (backend, admin). */
export async function getOpsStatus(): Promise<OpsStatusResponse> {
  const { data } = await http.get<OpsStatusResponse>('/api/v1/ops/status')
  return data
}
