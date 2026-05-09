import { z } from 'zod'
import { getValidated } from '../api/validatedHttp'
import { http } from './http'

const changelogEntrySchema = z.object({
  version: z.string(),
  date: z.string(),
  type: z.string(),
  title: z.string(),
  items: z.array(z.string()),
})

export type ChangelogEntry = z.infer<typeof changelogEntrySchema>

export async function listChangelog() {
  return getValidated(http, '/api/v1/changelog', z.array(changelogEntrySchema))
}
