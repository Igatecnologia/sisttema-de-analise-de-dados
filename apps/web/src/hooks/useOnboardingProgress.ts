/**
 * UX-Q4 (audit 2026-05-12): hook que expõe o progresso do onboarding pra
 * widgets como badge no avatar / checklist persistente. Sem ele, o admin
 * não sabia o que faltava configurar.
 *
 * Etapas consideradas (todas opcionais — admin pode pular o wizard):
 *  1. Perfil da empresa preenchido (companyProfile.name)
 *  2. Pelo menos 1 datasource conectado (datasource_count > 0)
 *  3. Pelo menos 1 convite enviado (teamInvites.length > 0)
 *
 * Status retornado:
 *  - completedSteps: número de etapas feitas (0-3)
 *  - totalSteps: 3
 *  - pct: 0-100
 *  - missing: lista das etapas ainda não feitas (pro checklist)
 *  - isComplete: true se status='completed' no backend
 */
import { useQuery } from '@tanstack/react-query'
import { getOnboardingStatus } from '../services/onboardingService'
import { listDataSources } from '../services/dataSourceService'

export type OnboardingStep = {
  key: 'profile' | 'datasource' | 'team'
  label: string
  done: boolean
}

export type OnboardingProgress = {
  completedSteps: number
  totalSteps: number
  pct: number
  steps: OnboardingStep[]
  missing: OnboardingStep[]
  isComplete: boolean
  isLoading: boolean
}

export function useOnboardingProgress(): OnboardingProgress {
  const { data: onbData, isLoading: onbLoading } = useQuery({
    queryKey: ['onboarding-progress'],
    queryFn: getOnboardingStatus,
    /** Revalida quando user volta à aba — pode ter completado algo em outra. */
    refetchOnWindowFocus: true,
    /** Não polling agressivo: 1 min é OK pra essa info. */
    staleTime: 60 * 1000,
  })
  const { data: dsList, isLoading: dsLoading } = useQuery({
    queryKey: ['onboarding-progress:datasources'],
    queryFn: listDataSources,
    refetchOnWindowFocus: true,
    staleTime: 60 * 1000,
  })

  const profile = onbData?.onboarding?.companyProfile as { name?: string } | undefined
  const teamInvites = onbData?.onboarding?.teamInvites ?? []

  const steps: OnboardingStep[] = [
    {
      key: 'profile',
      label: 'Perfil da empresa preenchido',
      done: Boolean(profile?.name && profile.name.trim().length > 0),
    },
    {
      key: 'datasource',
      label: 'Primeira fonte de dados conectada',
      done: (dsList ?? []).length > 0,
    },
    {
      key: 'team',
      label: 'Time convidado',
      done: teamInvites.length > 0,
    },
  ]

  const completedSteps = steps.filter((s) => s.done).length
  const totalSteps = steps.length
  return {
    completedSteps,
    totalSteps,
    pct: Math.round((completedSteps / totalSteps) * 100),
    steps,
    missing: steps.filter((s) => !s.done),
    isComplete: onbData?.onboarding?.status === 'completed' || completedSteps === totalSteps,
    isLoading: onbLoading || dsLoading,
  }
}
