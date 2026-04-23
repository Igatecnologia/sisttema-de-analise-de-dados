import { describe, expect, it } from 'vitest'
import { vendasAnaliticoResponseSchema, vendasAnaliticoRawResponseSchema } from './schemas'
import { normalizeVendaAnaliticaRow } from '../utils/sgbrVendaAnaliticoNormalize'

describe('vendas analitico contract', () => {
  it('aceita payload minimo compativel com SGBR', () => {
    const sample = [
      {
        data: '2026-01-15',
        datafec: '2026-01-15',
        codvendedor: 1,
        nomevendedor: 'Vendedor',
        codprod: 10,
        decprod: 'Produto',
        qtdevendida: 2,
        und: 'UN',
        qtdeconvertidavd: 2,
        precocustoitem: 10,
        valorunit: 25,
        total: 50,
        codcliente: 99,
        nomecliente: 'Cliente',
        cepcliente: '00000-000',
        totalprodutos: 50,
        statuspedido: 'F',
      },
    ]
    const parsed = vendasAnaliticoResponseSchema.safeParse(sample)
    expect(parsed.success).toBe(true)
  })

  it('aceita resposta bruta vendanfe com aliases e normaliza', () => {
    const raw = [
      {
        dt_emissao: '2026-02-15',
        cod_prod: 77,
        descr_produto: 'Item NF',
        quantidade: 1,
        vl_total: '150,50',
        cod_cliente: 100,
        razao: 'Cliente X',
        situacao: 'F',
      },
    ]
    expect(vendasAnaliticoRawResponseSchema.safeParse(raw).success).toBe(true)
    const n = normalizeVendaAnaliticaRow(raw[0] as Record<string, unknown>)
    expect(n.total).toBeCloseTo(150.5, 2)
    expect(n.qtdevendida).toBe(1)
    expect(n.decprod).toBe('Item NF')
  })
})
