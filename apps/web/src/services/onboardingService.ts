import { http } from './http'

export type TenantOnboardingRecord = {
  tenantId: string
  status: 'pending' | 'completed'
  companyProfile: Record<string, unknown>
  dataSetup: Record<string, unknown>
  teamInvites: string[]
  importStatus: 'idle' | 'running' | 'completed' | 'failed'
  importProgress: number
  updatedAt: string
}

export type OnboardingInput = {
  companyProfile: Record<string, unknown>
  dataSetup: Record<string, unknown>
  teamInvites: string[]
}

export async function getOnboardingStatus() {
  const { data } = await http.get('/api/v1/onboarding')
  return data as { onboarding: TenantOnboardingRecord | null }
}

export async function saveOnboarding(input: OnboardingInput) {
  const { data } = await http.post('/api/v1/onboarding', input)
  return data as { onboarding: TenantOnboardingRecord }
}

export async function startOnboardingImport() {
  const { data } = await http.post('/api/v1/onboarding/start-import')
  return data as { onboarding: TenantOnboardingRecord }
}

export async function getOnboardingImportStatus() {
  const { data } = await http.get('/api/v1/onboarding/import-status')
  return data as { onboarding: TenantOnboardingRecord | null }
}
