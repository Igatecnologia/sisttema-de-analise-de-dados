import { z } from 'zod'

const dashboardShareEntrySchema = z.object({
  id: z.string(),
  target: z.string(),
  permission: z.enum(['view', 'edit']),
  createdAt: z.string(),
})

const dashboardPrefsSchema = z.object({
  favorite: z.boolean(),
  shares: z.array(dashboardShareEntrySchema),
})

export type DashboardSharePermission = z.infer<typeof dashboardShareEntrySchema>['permission']

export type DashboardShareEntry = z.infer<typeof dashboardShareEntrySchema>

export type DashboardPrefs = z.infer<typeof dashboardPrefsSchema>

const DEFAULT_PREFS: DashboardPrefs = { favorite: false, shares: [] }

const KEY = 'app.dashboard.prefs.v1'

function uid() {
  return `share_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`
}

export function getDashboardPrefs(): DashboardPrefs {
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return DEFAULT_PREFS
    const parsed = dashboardPrefsSchema.safeParse(JSON.parse(raw))
    return parsed.success ? parsed.data : DEFAULT_PREFS
  } catch {
    return DEFAULT_PREFS
  }
}

export function setDashboardFavorite(next: boolean) {
  const current = getDashboardPrefs()
  const updated: DashboardPrefs = { ...current, favorite: next }
  window.localStorage.setItem(KEY, JSON.stringify(updated))
  return updated
}

export function addDashboardShare(
  target: string,
  permission: DashboardSharePermission,
): DashboardPrefs {
  const current = getDashboardPrefs()
  const entry: DashboardShareEntry = {
    id: uid(),
    target: target.trim(),
    permission,
    createdAt: new Date().toISOString(),
  }
  const updated: DashboardPrefs = {
    ...current,
    shares: [entry, ...current.shares],
  }
  window.localStorage.setItem(KEY, JSON.stringify(updated))
  return updated
}

export function removeDashboardShare(id: string): DashboardPrefs {
  const current = getDashboardPrefs()
  const updated: DashboardPrefs = {
    ...current,
    shares: current.shares.filter((x) => x.id !== id),
  }
  window.localStorage.setItem(KEY, JSON.stringify(updated))
  return updated
}
