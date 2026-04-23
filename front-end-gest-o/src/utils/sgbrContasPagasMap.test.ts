import { describe, expect, it } from 'vitest'
import { mapSgbrContasPagasRow } from './sgbrContasPagasMap'

describe('mapSgbrContasPagasRow', () => {
  it('mapeia nomes comuns do BI', () => {
    const row = {
      codtitulo: '99',
      nome_fornecedor: 'Forn X',
      historico: 'Compra teste',
      valor: 150.5,
      data_emissao: '2025-09-15',
      dtvencto: '2025-10-15',
      datapagamento: '2025-10-10',
      tipo: 'imposto federal',
    }
    const out = mapSgbrContasPagasRow(row, 0)
    expect(out.id).toBe('99')
    expect(out.fornecedor).toBe('Forn X')
    expect(out.valor).toBe(150.5)
    expect(out.status).toBe('Pago')
    expect(out.categoria).toBe('Impostos')
  })
})
