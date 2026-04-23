import { z } from 'zod'

const savedViewSchema = z.object({
  id: z.string(),
  name: z.string(),
  params: z.string(),
  createdAt: z.string(),
})

const storeSchema = z.record(z.string(), z.array(savedViewSchema))

export type SavedView = z.infer<typeof savedViewSchema>

type Store = z.infer<typeof storeSchema>

const KEY = 'app.savedViews.v1'

function readStore(): Store {
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return {}
    const parsed = storeSchema.safeParse(JSON.parse(raw))
    return parsed.success ? parsed.data : {}
  } catch {
    return {}
  }
}

function writeStore(store: Store) {
  window.localStorage.setItem(KEY, JSON.stringify(store))
}

function uid() {
  return `sv_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`
}

export function listSavedViews(pageKey: string): SavedView[] {
  const store = readStore()
  return store[pageKey] ?? []
}

export function saveView(pageKey: string, name: string, params: URLSearchParams): SavedView {
  const store = readStore()
  const next: SavedView = {
    id: uid(),
    name: name.trim(),
    params: params.toString(),
    createdAt: new Date().toISOString(),
  }
  const current = store[pageKey] ?? []
  store[pageKey] = [next, ...current]
  writeStore(store)
  return next
}

export function deleteView(pageKey: string, id: string) {
  const store = readStore()
  store[pageKey] = (store[pageKey] ?? []).filter((v) => v.id !== id)
  writeStore(store)
}

