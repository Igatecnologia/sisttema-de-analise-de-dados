import { http } from './http'

export type BillingStatus = {
  plan: string
  status: string
  trialEndsAt: string | null
  currentPeriodEnd: string | null
  cancelAtPeriodEnd: boolean
  access: { allowed: boolean; reason: string; trialEndsAt?: string | null; status?: string }
  stripeEnabled: boolean
}

export async function getBillingStatus(): Promise<BillingStatus> {
  const { data } = await http.get<BillingStatus>('/api/v1/billing/status')
  return data
}

export async function startCheckout(plan: 'pro' | 'enterprise'): Promise<{ url: string }> {
  const { data } = await http.post<{ url: string; sessionId: string }>('/api/v1/billing/checkout-session', { plan })
  return { url: data.url }
}

export async function openBillingPortal(): Promise<{ url: string }> {
  const { data } = await http.post<{ url: string }>('/api/v1/billing/portal-link', {})
  return data
}
