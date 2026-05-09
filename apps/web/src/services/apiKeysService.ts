import { z } from 'zod'
import { getValidated, postValidated } from '../api/validatedHttp'
import { http } from './http'

const apiKeySchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  userId: z.string(),
  name: z.string(),
  prefix: z.string(),
  scopes: z.array(z.string()),
  status: z.enum(['active', 'revoked']),
  lastUsedAt: z.string().nullable(),
  createdAt: z.string(),
  revokedAt: z.string().nullable(),
})

const createdApiKeySchema = z.object({
  key: apiKeySchema,
  secret: z.string(),
})

export type ApiKey = z.infer<typeof apiKeySchema>

export async function listApiKeys() {
  return getValidated(http, '/api/v1/api-keys', z.array(apiKeySchema))
}

export async function createApiKey(input: { name: string; scopes: string[] }) {
  return postValidated(http, '/api/v1/api-keys', input, createdApiKeySchema)
}

export async function revokeApiKey(id: string) {
  await http.post(`/api/v1/api-keys/${id}/revoke`)
}
