/**
 * UX-M3 (audit 2026-05-12): convites pendentes da empresa.
 */
import { http } from './http'

export type InviteRecord = {
  id: string
  email: string
  role: string
  name: string | null
  createdAt: string
  expiresAt: string
  usedAt: string | null
  status: 'pending' | 'accepted' | 'expired'
}

export async function listInvites(options?: {
  includeUsed?: boolean
  includeExpired?: boolean
}): Promise<InviteRecord[]> {
  const params = new URLSearchParams()
  if (options?.includeUsed) params.set('includeUsed', '1')
  if (options?.includeExpired) params.set('includeExpired', '1')
  const qs = params.toString() ? `?${params.toString()}` : ''
  const { data } = await http.get<{ invites: InviteRecord[] }>(`/api/v1/auth/invites${qs}`)
  return data.invites
}

export async function revokeInvite(id: string): Promise<void> {
  await http.delete(`/api/v1/auth/invites/${id}`)
}
