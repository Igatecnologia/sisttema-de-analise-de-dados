import { describe, expect, it } from 'vitest'
import { validateToolArgs } from './toolSchemas.js'

describe('validateToolArgs', () => {
  describe('args válidos', () => {
    it('aceita get_overview sem args', () => {
      const r = validateToolArgs('get_overview', {})
      expect(r.ok).toBe(true)
    })

    it('aceita get_faturamento_mes com year+month válidos', () => {
      const r = validateToolArgs('get_faturamento_mes', { year: 2026, month: 3 })
      expect(r.ok).toBe(true)
    })

    it('aceita get_compras_periodo com datas em YYYY-MM-DD', () => {
      const r = validateToolArgs('get_compras_periodo', { dtDe: '2026-01-01', dtAte: '2026-01-31' })
      expect(r.ok).toBe(true)
    })

    it('aceita get_compras_periodo com datas em YYYY.MM.DD (formato SGBR)', () => {
      const r = validateToolArgs('get_compras_periodo', { dtDe: '2026.01.01', dtAte: '2026.01.31' })
      expect(r.ok).toBe(true)
    })
  })

  describe('args inválidos', () => {
    it('rejeita tool desconhecida', () => {
      const r = validateToolArgs('tool_inexistente', {})
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.error).toContain('Tool desconhecida')
    })

    it('rejeita month fora do range 1-12', () => {
      const r = validateToolArgs('get_faturamento_mes', { year: 2026, month: 13 })
      expect(r.ok).toBe(false)
    })

    it('rejeita year não-numérico', () => {
      const r = validateToolArgs('get_faturamento_mes', { year: 'dois mil', month: 3 })
      expect(r.ok).toBe(false)
    })

    it('rejeita data em formato livre', () => {
      const r = validateToolArgs('get_compras_periodo', { dtDe: 'janeiro de 2026', dtAte: '2026-01-31' })
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.error).toContain('dtDe')
    })

    it('rejeita campo desconhecido (strict)', () => {
      const r = validateToolArgs('get_overview', { campoExtra: 'qualquer' })
      expect(r.ok).toBe(false)
    })

    it('rejeita set_monthly_revenue_goal com valor negativo', () => {
      const r = validateToolArgs('set_monthly_revenue_goal', { value: -100 })
      expect(r.ok).toBe(false)
    })

    it('rejeita set_monthly_revenue_goal sem value', () => {
      const r = validateToolArgs('set_monthly_revenue_goal', {})
      expect(r.ok).toBe(false)
    })

    it('rejeita get_alerts com severity fora do enum', () => {
      const r = validateToolArgs('get_alerts', { severity: 'high' })
      expect(r.ok).toBe(false)
    })

    it('rejeita get_datasource_details sem id nem name', () => {
      const r = validateToolArgs('get_datasource_details', {})
      expect(r.ok).toBe(false)
    })
  })

  describe('mensagens de erro em PT-BR', () => {
    it('inclui o nome do campo problemático', () => {
      const r = validateToolArgs('get_compras_periodo', { dtDe: 'invalido', dtAte: '2026-01-01' })
      expect(r.ok).toBe(false)
      if (!r.ok) {
        expect(r.error).toMatch(/dtDe/)
        expect(r.error).toMatch(/Data deve estar/)
      }
    })
  })
})
