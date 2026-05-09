import { describe, expect, it } from 'vitest'
import {
  BUSINESS_SEGMENTS,
  SEGMENT_DEFINITIONS,
  defaultModulesForSegment,
  defaultSegment,
  inferSegmentFromConnectorId,
  isBusinessSegment,
  recommendedConnectorForSegment,
} from './segments.js'

describe('segments', () => {
  describe('BUSINESS_SEGMENTS', () => {
    it('contém os 4 segmentos esperados', () => {
      expect(BUSINESS_SEGMENTS).toEqual(['industry', 'commerce', 'services', 'distribution'])
    })

    it('todo segmento tem definição completa', () => {
      for (const id of BUSINESS_SEGMENTS) {
        const def = SEGMENT_DEFINITIONS[id]
        expect(def, `definição ausente para ${id}`).toBeDefined()
        expect(def.id).toBe(id)
        expect(def.name).toBeTruthy()
        expect(def.description).toBeTruthy()
        expect(def.defaultModules.length).toBeGreaterThan(0)
        expect(def.recommendedConnectorId).toBeTruthy()
      }
    })
  })

  describe('isBusinessSegment', () => {
    it('valida strings conhecidas', () => {
      expect(isBusinessSegment('industry')).toBe(true)
      expect(isBusinessSegment('commerce')).toBe(true)
      expect(isBusinessSegment('services')).toBe(true)
      expect(isBusinessSegment('distribution')).toBe(true)
    })

    it('rejeita strings desconhecidas e tipos errados', () => {
      expect(isBusinessSegment('industria')).toBe(false)
      expect(isBusinessSegment('')).toBe(false)
      expect(isBusinessSegment(null)).toBe(false)
      expect(isBusinessSegment(undefined)).toBe(false)
      expect(isBusinessSegment(123)).toBe(false)
    })
  })

  describe('defaultSegment', () => {
    it('retorna industry como default por compatibilidade', () => {
      expect(defaultSegment()).toBe('industry')
    })
  })

  describe('defaultModulesForSegment', () => {
    it('retorna módulos do segmento solicitado', () => {
      expect(defaultModulesForSegment('industry')).toContain('producao')
      expect(defaultModulesForSegment('industry')).toContain('ficha_tecnica')
    })

    it('comércio não inclui ficha técnica', () => {
      expect(defaultModulesForSegment('commerce')).not.toContain('ficha_tecnica')
      expect(defaultModulesForSegment('commerce')).not.toContain('producao')
    })

    it('serviços não inclui módulos de produção/estoque-físico', () => {
      const modules = defaultModulesForSegment('services')
      expect(modules).not.toContain('producao')
      expect(modules).not.toContain('estoque')
      expect(modules).not.toContain('ficha_tecnica')
    })

    it('todos os segmentos retornam pelo menos dashboard, financeiro e usuarios', () => {
      for (const id of BUSINESS_SEGMENTS) {
        const modules = defaultModulesForSegment(id)
        expect(modules).toContain('dashboard')
        expect(modules).toContain('financeiro')
        expect(modules).toContain('usuarios')
      }
    })
  })

  describe('recommendedConnectorForSegment', () => {
    it('cada segmento tem um connector recomendado', () => {
      for (const id of BUSINESS_SEGMENTS) {
        expect(recommendedConnectorForSegment(id)).toBeTruthy()
      }
    })
  })

  describe('inferSegmentFromConnectorId', () => {
    it('connectores conhecidos mapeiam para segmento esperado', () => {
      expect(inferSegmentFromConnectorId('sgbr-espuma')).toBe('industry')
      expect(inferSegmentFromConnectorId('iga-custom-api')).toBe('industry')
      expect(inferSegmentFromConnectorId('bling')).toBe('commerce')
      expect(inferSegmentFromConnectorId('tiny')).toBe('commerce')
    })

    it('unknown / null caem em industry (compatibilidade)', () => {
      expect(inferSegmentFromConnectorId(null)).toBe('industry')
      expect(inferSegmentFromConnectorId(undefined)).toBe('industry')
      expect(inferSegmentFromConnectorId('xpto-erp')).toBe('industry')
      expect(inferSegmentFromConnectorId('')).toBe('industry')
    })
  })
})
