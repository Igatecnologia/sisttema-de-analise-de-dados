import { http } from './http'

export type UserPreferences = {
  theme?: 'light' | 'dark'
  sidebarCollapsed?: boolean
  defaultDateRange?: string
  favoriteReports?: string[]
  alertSubscriptions?: string[]
  /** @deprecated usar pageLayouts['dashboard'] — mantido para compatibilidade */
  dashboardLayout?: string[]
  /** Ordenação de widgets por página (ex.: { dashboard: ['a','b'], operacional: [...] }) */
  pageLayouts?: Record<string, string[]>
}

export async function getUserPreferences() {
  const { data } = await http.get<UserPreferences>('/api/v1/users/me/preferences')
  return data
}

export async function saveUserPreferences(payload: UserPreferences) {
  const { data } = await http.put<UserPreferences>('/api/v1/users/me/preferences', payload)
  return data
}
