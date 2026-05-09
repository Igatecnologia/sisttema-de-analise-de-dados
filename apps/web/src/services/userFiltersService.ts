import { z } from 'zod'

const userSavedFilterSchema = z.object({
  id: z.string(),
  userId: z.string(),
  page: z.literal('reports'),
  name: z.string(),
  params: z.string(),
  createdAt: z.string(),
})

const storeSchema = z.array(userSavedFilterSchema)

export type UserSavedFilter = z.infer<typeof userSavedFilterSchema>

const KEY = 'app.user.savedFilters.v1'

function uid() {
  return `flt_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`
}

function readAll(): UserSavedFilter[] {
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return []
    const parsed = storeSchema.safeParse(JSON.parse(raw))
    return parsed.success ? parsed.data : []
  } catch {
    return []
  }
}

function writeAll(filters: UserSavedFilter[]) {
  window.localStorage.setItem(KEY, JSON.stringify(filters))
}

export function listUserSavedFilters(userId: string, page: UserSavedFilter['page']) {
  return readAll()
    .filter((x) => x.userId === userId && x.page === page)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function createUserSavedFilter(input: Omit<UserSavedFilter, 'id' | 'createdAt'>) {
  const current = readAll()
  const next: UserSavedFilter = {
    id: uid(),
    createdAt: new Date().toISOString(),
    ...input,
  }
  writeAll([next, ...current])
  return next
}

export function deleteUserSavedFilter(id: string) {
  writeAll(readAll().filter((x) => x.id !== id))
}
