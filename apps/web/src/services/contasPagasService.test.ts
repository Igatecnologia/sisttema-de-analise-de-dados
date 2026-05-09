import { describe, expect, it } from 'vitest'
import dayjs from 'dayjs'
import {
  contasPagarRangeDefault,
  getContasPagarClampInfo,
  MAX_CONTAS_PAGAR_MONTHS,
} from './contasPagasService'

describe('contasPagarRangeDefault', () => {
  it('retorna range do mês atual (dia 1 até hoje)', () => {
    const { dtDe, dtAte } = contasPagarRangeDefault()
    expect(dayjs(dtDe).date()).toBe(1)
    expect(dayjs(dtAte).format('YYYY-MM-DD')).toBe(dayjs().format('YYYY-MM-DD'))
  })

  it('datas em YYYY-MM-DD', () => {
    const { dtDe, dtAte } = contasPagarRangeDefault()
    expect(dtDe).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(dtAte).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

describe('getContasPagarClampInfo', () => {
  it('sem range → usa default do mês atual, não clamped', () => {
    const info = getContasPagarClampInfo(undefined)
    expect(info.clamped).toBe(false)
    expect(info.requested).toBeNull()
    expect(info.effective.dtDe).toBe(contasPagarRangeDefault().dtDe)
  })

  it('range dentro do limite → não clamped', () => {
    const end = dayjs().format('YYYY-MM-DD')
    const start = dayjs().subtract(2, 'month').format('YYYY-MM-DD')
    const info = getContasPagarClampInfo({ dtDe: start, dtAte: end })
    expect(info.clamped).toBe(false)
    expect(info.effective.dtDe).toBe(start)
  })

  it(`range > ${MAX_CONTAS_PAGAR_MONTHS} meses → clamped`, () => {
    const end = dayjs().format('YYYY-MM-DD')
    const start = dayjs().subtract(12, 'month').format('YYYY-MM-DD')
    const info = getContasPagarClampInfo({ dtDe: start, dtAte: end })
    expect(info.clamped).toBe(true)
    // O effective.dtDe deve ser max 6 meses antes de dtAte
    const months = dayjs(info.effective.dtAte).diff(dayjs(info.effective.dtDe), 'month')
    expect(months).toBeLessThanOrEqual(MAX_CONTAS_PAGAR_MONTHS)
  })
})
