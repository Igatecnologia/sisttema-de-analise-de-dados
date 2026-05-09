import { describe, expect, it } from 'vitest'
import dayjs from 'dayjs'
import { currentMonthRange, financeRangeDefault } from './vendasAnaliticoAggregates'

describe('currentMonthRange', () => {
  it('retorna dtDe no dia 1 do mês atual', () => {
    const range = currentMonthRange()
    const start = dayjs(range.dtDe)
    expect(start.date()).toBe(1)
  })

  it('retorna dtAte hoje ou mais recente', () => {
    const range = currentMonthRange()
    const end = dayjs(range.dtAte)
    const today = dayjs()
    // dtAte deve ser hoje (ou no mesmo dia pela comparação isSame/isBefore)
    expect(end.format('YYYY-MM-DD')).toBe(today.format('YYYY-MM-DD'))
  })

  it('dtAte é igual ou depois de dtDe', () => {
    const { dtDe, dtAte } = currentMonthRange()
    expect(dayjs(dtAte).isBefore(dayjs(dtDe))).toBe(false)
  })

  it('retorna datas no formato YYYY-MM-DD', () => {
    const { dtDe, dtAte } = currentMonthRange()
    expect(dtDe).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(dtAte).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

describe('financeRangeDefault', () => {
  it('retorna range de 6 meses', () => {
    const { dtDe, dtAte } = financeRangeDefault()
    const months = dayjs(dtAte).diff(dayjs(dtDe), 'month')
    expect(months).toBeGreaterThanOrEqual(5)
    expect(months).toBeLessThanOrEqual(6)
  })

  it('formato das datas é YYYY-MM-DD', () => {
    const { dtDe, dtAte } = financeRangeDefault()
    expect(dtDe).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(dtAte).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})
