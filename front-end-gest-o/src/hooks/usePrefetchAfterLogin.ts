import { useEffect, useRef } from 'react'
import { queryClient } from '../query/queryClient'
import { queryKeys } from '../query/queryKeys'
import { getDashboardData } from '../services/dashboardService'
import { getEstoqueEspuma, getEstoqueMateriaPrima, getEstoqueProdutoFinal } from '../services/financeReportsService'

/**
 * Prefetch em background apos login bem-sucedido.
 * Aquece o cache do React Query com os dados mais usados para que
 * Dashboard, Estoque e Financeiro abram instantaneamente.
 *
 * - Dashboard (7d) — primeira tela apos login
 * - Estoques — endpoints mais lentos (~22s), sem filtro de data
 *
 * Fire-and-forget: falhas sao silenciosas (o usuario vai buscar quando acessar).
 */
export function usePrefetchAfterLogin(isLoggedIn: boolean) {
  const prefetched = useRef(false)

  useEffect(() => {
    if (!isLoggedIn || prefetched.current) return
    prefetched.current = true

    // Pequeno delay para nao competir com a navegacao pos-login
    const timer = setTimeout(() => {
      // Dashboard 7d — primeira tela que o usuario ve
      queryClient.prefetchQuery({
        queryKey: queryKeys.dashboard({ period: '7d' }),
        queryFn: () => getDashboardData({ period: '7d' }),
      })

      // Estoques — os mais lentos, aquecer em background
      queryClient.prefetchQuery({
        queryKey: queryKeys.estoqueEspuma(),
        queryFn: getEstoqueEspuma,
      })
      queryClient.prefetchQuery({
        queryKey: queryKeys.estoqueMateriaPrima(),
        queryFn: getEstoqueMateriaPrima,
      })
      queryClient.prefetchQuery({
        queryKey: queryKeys.estoqueProdutoFinal(),
        queryFn: getEstoqueProdutoFinal,
      })
    }, 500)

    return () => clearTimeout(timer)
  }, [isLoggedIn])
}
