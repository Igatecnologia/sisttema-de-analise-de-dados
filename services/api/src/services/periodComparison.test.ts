/**
 * P1-09: testes da camada de comparação período-a-período (função pura).
 */
import { describe, expect, it } from 'vitest'
import { comparePeriods, computeDelta, previousRangeOf } from './periodComparison.js'

describe('computeDelta', () => {
  it('crescimento simples', () => {
    expect(computeDelta(150, 100)).toEqual({ abs: 50, pct: 50, direction: 'up' })
  })
  it('queda simples', () => {
    expect(computeDelta(80, 100)).toEqual({ abs: -20, pct: -20, direction: 'down' })
  })
  it('previous=0 → pct null (não divide por zero)', () => {
    const d = computeDelta(100, 0)
    expect(d.abs).toBe(100)
    expect(d.pct).toBeNull()
    expect(d.direction).toBe('up')
  })
  it('ambos zero → na', () => {
    expect(computeDelta(0, 0).direction).toBe('na')
  })
  it('iguais → flat', () => {
    expect(computeDelta(50, 50).direction).toBe('flat')
  })
  it('arredonda 2 casas (abs) e 1 casa (pct)', () => {
    const d = computeDelta(100.123, 99.876)
    expect(d.abs).toBe(0.25)
    expect(d.pct).toBe(0.2)
  })
})

describe('previousRangeOf', () => {
  it('janela de 7 dias volta exatamente 7 dias', () => {
    const r = previousRangeOf({ from: '2026-05-08', to: '2026-05-14' })
    expect(r.from).toBe('2026-05-01')
    expect(r.to).toBe('2026-05-07')
  })
  it('janela de 1 dia (same day) volta dia anterior', () => {
    const r = previousRangeOf({ from: '2026-05-12', to: '2026-05-12' })
    expect(r.from).toBe('2026-05-11')
    expect(r.to).toBe('2026-05-11')
  })
  it('janela mensal: 1-30 → mês anterior 1-30', () => {
    const r = previousRangeOf({ from: '2026-05-01', to: '2026-05-30' })
    expect(r.from).toBe('2026-04-01')
    expect(r.to).toBe('2026-04-30')
  })
  it('datas inválidas lançam erro', () => {
    expect(() => previousRangeOf({ from: 'xx', to: '2026-05-01' })).toThrow()
  })
})

describe('comparePeriods', () => {
  type Sale = { sku: string; produto: string; valor: number }
  const current: Sale[] = [
    { sku: 'A', produto: 'Camisa', valor: 100 },
    { sku: 'A', produto: 'Camisa', valor: 200 },
    { sku: 'B', produto: 'Calça', valor: 300 },
  ]
  const previous: Sale[] = [
    { sku: 'A', produto: 'Camisa', valor: 50 },
    { sku: 'B', produto: 'Calça', valor: 500 },
    { sku: 'C', produto: 'Sapato', valor: 100 },
  ]

  it('totais e contagem com delta', () => {
    const r = comparePeriods({ current, previous, getValue: (s) => s.valor })
    expect(r.totals.current).toBe(600)
    expect(r.totals.previous).toBe(650)
    expect(r.totals.delta.abs).toBe(-50)
    expect(r.totals.delta.direction).toBe('down')
    expect(r.count.current).toBe(3)
    expect(r.count.previous).toBe(3)
  })

  it('top gains/losses agrupado por SKU', () => {
    const r = comparePeriods({
      current,
      previous,
      getValue: (s) => s.valor,
      getGroupKey: (s) => s.sku,
      getGroupLabel: (s) => s.produto,
    })
    /** A: 50 -> 300 = +250 (top gain) */
    const topGain = r.topGains[0]
    expect(topGain.key).toBe('A')
    expect(topGain.label).toBe('Camisa')
    expect(topGain.delta.abs).toBe(250)
    /** B: 500 -> 300 = -200; C: 100 -> 0 = -100 */
    const topLoss = r.topLosses[0]
    expect(topLoss.key).toBe('B')
    expect(topLoss.delta.abs).toBe(-200)
    expect(r.topLosses[1].key).toBe('C')
  })

  it('sem grupo → topGains/topLosses vazios', () => {
    const r = comparePeriods({ current, previous, getValue: (s) => s.valor })
    expect(r.topGains).toHaveLength(0)
    expect(r.topLosses).toHaveLength(0)
  })

  it('arrays vazios não quebram', () => {
    const r = comparePeriods({ current: [], previous: [], getValue: () => 0 })
    expect(r.totals.current).toBe(0)
    expect(r.totals.delta.direction).toBe('na')
  })
})
