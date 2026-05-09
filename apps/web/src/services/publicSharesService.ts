import { z } from 'zod'
import { getValidated, postValidated } from '../api/validatedHttp'
import { http } from './http'
import { trackEvent } from './analytics'

const publicShareSchema = z.object({
  token: z.string(),
  tenantId: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  payload: z.record(z.string(), z.unknown()).optional(),
  expiresAt: z.string().nullable(),
  revokedAt: z.string().nullable(),
  createdAt: z.string(),
})

export type PublicShare = z.infer<typeof publicShareSchema>

export async function getPublicShare(token: string) {
  return getValidated(http, `/api/v1/public-shares/public/${token}`, publicShareSchema)
}

export async function listPublicShares() {
  return getValidated(http, '/api/v1/public-shares', z.array(publicShareSchema))
}

export async function createPublicShare(input: {
  title: string
  description?: string | null
  payload?: Record<string, unknown>
  expiresAt?: string | null
}) {
  const result = await postValidated(http, '/api/v1/public-shares', input, publicShareSchema)
  trackEvent('public_share_created', { hasExpiration: Boolean(input.expiresAt) })
  return result
}

export async function revokePublicShare(token: string) {
  await http.post(`/api/v1/public-shares/${token}/revoke`)
  trackEvent('public_share_revoked')
}

export async function trackPublicShareVisited(token: string) {
  trackEvent('public_share_visited', { token: token.slice(0, 8) })
}
