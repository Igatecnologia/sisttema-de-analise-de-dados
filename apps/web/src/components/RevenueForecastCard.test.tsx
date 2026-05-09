import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'
import type { RevenueForecastResponse } from '../services/forecastService'

let mockResponse: RevenueForecastResponse = {
  ok: false,
  reason: 'no_sales_source',
  message: 'sem fonte',
}

vi.mock('../services/forecastService', () => ({
  getRevenueForecast: vi.fn(async () => mockResponse),
}))

import { RevenueForecastCard } from './RevenueForecastCard'

function renderWithProviders(ui: React.ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } },
  })
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
}

const okResponseBase: Extract<RevenueForecastResponse, { ok: true }> = {
  ok: true,
  method: 'moving_average_90d',
  confidence: 'medium',
  daysWithData: 60,
  currentMonthSoFar: 100_000,
  dailyAverage: 5_000,
  projectedEndOfMonth: 150_000,
  projectionLowerBound: 130_000,
  projectionUpperBound: 170_000,
  daysElapsed: 9,
  daysRemaining: 21,
}

describe('RevenueForecastCard', () => {
  it('não renderiza quando ok=false (sem fonte)', async () => {
    mockResponse = { ok: false, reason: 'no_sales_source', message: 'sem fonte' }
    const { container } = renderWithProviders(<RevenueForecastCard />)
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(container.firstChild).toBeNull()
  })

  it('não renderiza quando ok=false (histórico insuficiente)', async () => {
    mockResponse = { ok: false, reason: 'insufficient_history', message: 'histórico insuficiente', daysWithData: 3 }
    const { container } = renderWithProviders(<RevenueForecastCard />)
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(container.firstChild).toBeNull()
  })

  it('renderiza projeção quando ok=true', async () => {
    mockResponse = { ...okResponseBase }
    renderWithProviders(<RevenueForecastCard />)
    /** R$ 150.000,00 — formato BRL. */
    expect(await screen.findByText(/R\$\s?150\.000,00/)).toBeInTheDocument()
    expect(screen.getByText(/21 dias restantes/i)).toBeInTheDocument()
    expect(screen.getByText(/Confiança média/i)).toBeInTheDocument()
  })

  it('mostra status de meta quando monthlyGoal informado e abaixo', async () => {
    mockResponse = { ...okResponseBase }
    renderWithProviders(<RevenueForecastCard monthlyGoal={200_000} />)
    /** projecao 150k / meta 200k = 75%, abaixo */
    const tag = await screen.findByText(/75%\s+da meta/)
    expect(tag).toBeInTheDocument()
    expect(tag.textContent).toMatch(/↓/)
  })

  it('mostra status de meta atingida quando projecao >= meta', async () => {
    mockResponse = { ...okResponseBase, projectedEndOfMonth: 220_000 }
    renderWithProviders(<RevenueForecastCard monthlyGoal={200_000} />)
    const tag = await screen.findByText(/110%\s+da meta/)
    expect(tag.textContent).toMatch(/↑/)
  })

  it('aplica cor da confiança correta', async () => {
    mockResponse = { ...okResponseBase, confidence: 'high' }
    renderWithProviders(<RevenueForecastCard />)
    expect(await screen.findByText(/Alta confiança/i)).toBeInTheDocument()
  })
})
