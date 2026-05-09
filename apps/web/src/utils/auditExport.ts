import { http } from '../services/http'
import { getStoredSession } from '../auth/authStorage'
import { getCurrentTenantId } from '../tenant/tenantStorage'
import { addBreadcrumb } from '../monitoring/errorTracker'

type ExportAuditPayload = {
  reportName: string
  format: 'pdf' | 'excel' | 'csv' | 'png' | 'svg'
  rowCount: number
  filters?: Record<string, unknown>
}

/**
 * Registra uma exportação no audit trail do backend.
 * Fire-and-forget — não bloqueia a exportação.
 */
export function logExportAudit(payload: ExportAuditPayload) {
  const session = getStoredSession()

  const auditEntry = {
    action: 'reports.export',
    actor: session?.user.id ?? 'anonymous',
    tenantId: getCurrentTenantId(),
    timestamp: new Date().toISOString(),
    details: {
      reportName: payload.reportName,
      format: payload.format,
      rowCount: payload.rowCount,
      filters: payload.filters,
    },
  }

  addBreadcrumb(`Export: ${payload.reportName} (${payload.format}, ${payload.rowCount} rows)`, 'export')

  // Fire-and-forget
  http.post('/api/v1/audit/exports', auditEntry).catch(() => {
    // Se o endpoint não existir, falha silenciosamente
  })
}
