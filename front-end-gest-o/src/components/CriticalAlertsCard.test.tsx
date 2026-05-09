import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import type { AlertaOperacional } from '../types/models'

vi.mock('../services/erpService', () => ({
  getAlertasOperacionais: vi.fn(async () => mockAlerts),
}))

let mockAlerts: AlertaOperacional[] = []

import { CriticalAlertsCard } from './CriticalAlertsCard'

function renderWithProviders(ui: React.ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } },
  })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  )
}

const baseAlert: Omit<AlertaOperacional, 'id' | 'tipo' | 'severidade' | 'titulo'> = {
  data: '2026-05-09',
  descricao: '',
  referenciaId: 'ref-1',
  lido: false,
}

describe('CriticalAlertsCard', () => {
  it('não renderiza nada quando não há alertas abertos (zero noise)', async () => {
    mockAlerts = []
    const { container } = renderWithProviders(<CriticalAlertsCard />)
    /** Espera React Query resolver e checa que nada foi renderizado. */
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(container.firstChild).toBeNull()
  })

  it('não renderiza alertas que já foram lidos', async () => {
    mockAlerts = [
      { ...baseAlert, id: '1', tipo: 'margem_baixa', severidade: 'alta', titulo: 'Margem alta crítica', lido: true },
    ]
    const { container } = renderWithProviders(<CriticalAlertsCard />)
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(container.firstChild).toBeNull()
  })

  it('mostra contagem total e por severidade quando há alertas abertos', async () => {
    mockAlerts = [
      { ...baseAlert, id: '1', tipo: 'margem_baixa', severidade: 'alta', titulo: 'Crítico A' },
      { ...baseAlert, id: '2', tipo: 'estoque_critico', severidade: 'alta', titulo: 'Crítico B' },
      { ...baseAlert, id: '3', tipo: 'inadimplencia', severidade: 'media', titulo: 'Médio A' },
    ]
    renderWithProviders(<CriticalAlertsCard />)
    expect(await screen.findByText(/3 alertas abertos/i)).toBeInTheDocument()
    expect(screen.getByText(/2 alta/i)).toBeInTheDocument()
    expect(screen.getByText(/1 média/i)).toBeInTheDocument()
  })

  it('ordena por severidade desc (críticos primeiro)', async () => {
    mockAlerts = [
      { ...baseAlert, id: '1', tipo: 'margem_baixa', severidade: 'baixa', titulo: 'BAIXO' },
      { ...baseAlert, id: '2', tipo: 'estoque_critico', severidade: 'alta', titulo: 'CRITICO' },
      { ...baseAlert, id: '3', tipo: 'inadimplencia', severidade: 'media', titulo: 'MEDIO' },
    ]
    renderWithProviders(<CriticalAlertsCard />)
    const titles = await screen.findAllByText(/CRITICO|MEDIO|BAIXO/)
    expect(titles[0].textContent).toBe('CRITICO')
    expect(titles[1].textContent).toBe('MEDIO')
    expect(titles[2].textContent).toBe('BAIXO')
  })

  it('limita a top 5 alertas exibidos', async () => {
    mockAlerts = Array.from({ length: 8 }, (_, i) => ({
      ...baseAlert,
      id: String(i),
      tipo: 'margem_baixa',
      severidade: 'alta' as const,
      titulo: `Alerta ${i}`,
    }))
    renderWithProviders(<CriticalAlertsCard />)
    /** Header diz 8, mas só 5 títulos aparecem na lista. */
    expect(await screen.findByText(/8 alertas abertos/i)).toBeInTheDocument()
    expect(screen.getByText('Alerta 0')).toBeInTheDocument()
    expect(screen.getByText('Alerta 4')).toBeInTheDocument()
    expect(screen.queryByText('Alerta 5')).not.toBeInTheDocument()
  })

  it('inclui link para ver todos em /alertas', async () => {
    mockAlerts = [
      { ...baseAlert, id: '1', tipo: 'margem_baixa', severidade: 'alta', titulo: 'X' },
    ]
    renderWithProviders(<CriticalAlertsCard />)
    const link = await screen.findByRole('link', { name: /ver todos/i })
    expect(link).toHaveAttribute('href', '/alertas')
  })
})
