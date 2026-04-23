import { http } from './http'

export type AppAlert = {
  id: string
  tenantId: string
  type: string
  severity: 'info' | 'warning' | 'error'
  title: string
  message: string
  createdAt: string
  readAt: string | null
}

export async function listAlerts() {
  const { data } = await http.get<AppAlert[]>('/api/v1/alerts')
  return data
}

export async function markAlertAsRead(id: string) {
  await http.post(`/api/v1/alerts/${id}/read`)
}

export function subscribeAlerts(onAlert: (alert: AppAlert) => void) {
  const source = new EventSource('/api/v1/alerts/stream', { withCredentials: true })
  const listener = (event: MessageEvent<string>) => {
    try {
      const parsed = JSON.parse(event.data) as AppAlert
      onAlert(parsed)
    } catch {
      // noop
    }
  }
  source.addEventListener('alert', listener as EventListener)
  return () => {
    source.removeEventListener('alert', listener as EventListener)
    source.close()
  }
}
