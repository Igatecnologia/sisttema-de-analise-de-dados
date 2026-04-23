import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      /** Dados de ERP/BI mudam devagar; 15min alinhado com cache do backend. */
      staleTime: 1000 * 60 * 15,
      /** 1h em GC permite voltar pra tela depois de algum tempo e reaproveitar cache. */
      gcTime: 1000 * 60 * 60,
      retry: (failureCount, error) => {
        const status = (error as { response?: { status?: number } })?.response?.status
        if (status === 401 || status === 403) return false
        return failureCount < 1
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 15_000),
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      refetchOnMount: false,
    },
  },
})
