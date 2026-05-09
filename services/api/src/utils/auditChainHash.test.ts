import { describe, expect, it } from 'vitest'
import { computeAuditRowHash, type AuditRowForHash } from './auditChainHash.js'

const baseRow: AuditRowForHash = {
  id: 'a1b2c3',
  user_id: 'usr_x',
  tenant_id: 'default',
  action: 'login_success',
  resource: 'auth',
  metadata_json: '{"ip":"1.2.3.4"}',
  created_at: '2026-01-01T00:00:00.000Z',
  prev_hash: '',
}

describe('auditChainHash', () => {
  it('produz hash deterministico para o mesmo input', () => {
    expect(computeAuditRowHash(baseRow)).toBe(computeAuditRowHash(baseRow))
  })

  it('hash muda quando qualquer campo muda', () => {
    const original = computeAuditRowHash(baseRow)
    expect(computeAuditRowHash({ ...baseRow, action: 'login_failed' })).not.toBe(original)
    expect(computeAuditRowHash({ ...baseRow, user_id: 'usr_y' })).not.toBe(original)
    expect(computeAuditRowHash({ ...baseRow, tenant_id: 'other' })).not.toBe(original)
    expect(computeAuditRowHash({ ...baseRow, resource: 'admin' })).not.toBe(original)
    expect(computeAuditRowHash({ ...baseRow, metadata_json: '{"ip":"5.6.7.8"}' })).not.toBe(original)
    expect(computeAuditRowHash({ ...baseRow, created_at: '2026-01-01T00:00:00.001Z' })).not.toBe(original)
  })

  it('prev_hash diferente produz hash diferente (forma a chain)', () => {
    const a = computeAuditRowHash({ ...baseRow, prev_hash: '' })
    const b = computeAuditRowHash({ ...baseRow, prev_hash: 'x'.repeat(64) })
    expect(a).not.toBe(b)
  })

  it('null/undefined em campos opcionais sao tratados consistentemente', () => {
    const withNull: AuditRowForHash = { ...baseRow, user_id: null, tenant_id: null, metadata_json: null }
    expect(computeAuditRowHash(withNull)).toBe(computeAuditRowHash(withNull))
  })

  it('hash tem 64 chars hex (SHA-256)', () => {
    const h = computeAuditRowHash(baseRow)
    expect(h).toMatch(/^[0-9a-f]{64}$/)
  })
})
