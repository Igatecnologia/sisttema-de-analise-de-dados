import { z } from 'zod'
import { getValidated, postValidated } from '../api/validatedHttp'
import { http } from './http'

const organizationSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  subtitle: z.string(),
  logoUrl: z.string().nullable(),
  plan: z.enum(['trial', 'starter', 'pro', 'enterprise']),
  status: z.enum(['active', 'inactive']),
  current: z.boolean(),
  createdAt: z.string(),
})

export type Organization = z.infer<typeof organizationSchema>

export async function listOrganizations() {
  return getValidated(http, '/api/v1/orgs', z.array(organizationSchema))
}

export async function switchOrganization(slug: string) {
  return postValidated(
    http,
    `/api/v1/orgs/${slug}/switch`,
    {},
    z.object({ tenantId: z.string(), slug: z.string(), message: z.string() }),
  )
}
