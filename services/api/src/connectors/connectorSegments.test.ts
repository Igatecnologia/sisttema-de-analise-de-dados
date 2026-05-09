import { describe, expect, it } from 'vitest'
import { ConnectorRegistry } from './connectorRegistry.js'
import { BUSINESS_SEGMENTS } from '../segments.js'

describe('connector ↔ segment compatibility', () => {
  it('todos os connectors built-in declaram pelo menos um segmento', () => {
    for (const c of ConnectorRegistry.list()) {
      expect(c.segments.length, `${c.id} sem segments`).toBeGreaterThan(0)
    }
  })

  it('cada segmento tem pelo menos um connector compatível', () => {
    for (const segment of BUSINESS_SEGMENTS) {
      const list = ConnectorRegistry.listBySegment(segment)
      expect(list.length, `nenhum connector para ${segment}`).toBeGreaterThan(0)
    }
  })

  it('SGBR Espuma é só industry — não atende comércio/serviços/distribuição', () => {
    const sgbr = ConnectorRegistry.get('sgbr-espuma')
    expect(sgbr.segments).toEqual(['industry'])
    expect(sgbr.segments).not.toContain('commerce')
    expect(sgbr.segments).not.toContain('services')
  })

  it('IGA Custom API e Generic atendem todos os segmentos', () => {
    const custom = ConnectorRegistry.get('iga-custom-api')
    for (const segment of BUSINESS_SEGMENTS) {
      expect(custom.segments).toContain(segment)
    }
    const generic = ConnectorRegistry.get('generic')
    for (const segment of BUSINESS_SEGMENTS) {
      expect(generic.segments).toContain(segment)
    }
  })

  it('listBySegment(industry) inclui SGBR e IGA Custom', () => {
    const ids = ConnectorRegistry.listBySegment('industry').map((c) => c.id)
    expect(ids).toContain('sgbr-espuma')
    expect(ids).toContain('iga-custom-api')
    expect(ids).toContain('generic')
  })

  it('listBySegment(commerce) NÃO inclui SGBR Espuma', () => {
    const ids = ConnectorRegistry.listBySegment('commerce').map((c) => c.id)
    expect(ids).not.toContain('sgbr-espuma')
  })
})
