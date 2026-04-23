import { type AuditAction, type AuditLog } from '../types/models'
import { hasAnySources } from '../services/dataSourceService'
import { http } from './http'
import { getValidated } from '../api/validatedHttp'
import { auditResponseSchema } from '../api/schemas'

type ListAuditParams = {
  q?: string
  action?: AuditAction | 'all'
}

export async function listAuditLogs(params: ListAuditParams = {}) {
  if (hasAnySources()) return []
  return getValidated(http, '/audit', auditResponseSchema, {
    params: { q: params.q, action: params.action },
  })
}

export type { AuditLog, AuditAction }

