import { describe, expect, it } from 'vitest'
import { diagnoseFields } from './dataSourceDiagnostic'

describe('dataSourceDiagnostic', () => {
  it('classifica cepcliente como localização/endereço', () => {
    const result = diagnoseFields(
      ['data', 'datafec', 'nomecliente', 'cepcliente', 'total', 'qtdevendida'],
      {
        data: 'string',
        datafec: 'string',
        nomecliente: 'string',
        cepcliente: 'string',
        total: 'number',
        qtdevendida: 'number',
      },
      [{
        data: '2026-02-15',
        datafec: '2026-02-16',
        nomecliente: 'Cliente Teste',
        cepcliente: '89000-000',
        total: 1200.5,
        qtdevendida: 3,
      }],
    )

    const cepField = result.fieldAnalysis.find((f) => f.name === 'cepcliente')
    expect(cepField?.suggestedRole).toBe('Localização/Endereço')
    expect(result.apiSummary).not.toContain('campo(s) de nome: nomecliente, cepcliente')
  })
})
