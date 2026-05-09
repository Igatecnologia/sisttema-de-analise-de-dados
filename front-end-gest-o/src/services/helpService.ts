import { z } from 'zod'
import { getValidated } from '../api/validatedHttp'
import { http } from './http'

const helpArticleSchema = z.object({
  id: z.string(),
  title: z.string(),
  category: z.string(),
  minutes: z.number(),
})

export type HelpArticle = z.infer<typeof helpArticleSchema>

export async function listHelpArticles(q?: string) {
  const params = q?.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''
  return getValidated(http, `/api/v1/help/articles${params}`, z.array(helpArticleSchema))
}
