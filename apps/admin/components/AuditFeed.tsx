import type { AuditEvent } from '@/lib/api'

export function AuditFeed({ events }: { events: AuditEvent[] }) {
  return (
    <div className="rounded-xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <table className="w-full text-sm">
        <thead>
          <tr style={{ background: 'var(--surface-2)' }}>
            <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--text-muted)' }}>Quando</th>
            <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--text-muted)' }}>Ação</th>
            <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--text-muted)' }}>Tenant</th>
            <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--text-muted)' }}>Detalhes</th>
          </tr>
        </thead>
        <tbody>
          {events.map((e) => (
            <tr key={e.id} className="border-t" style={{ borderColor: 'var(--border)' }}>
              <td className="px-4 py-3 whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>
                {new Date(e.createdAt).toLocaleString('pt-BR')}
              </td>
              <td className="px-4 py-3">
                <code className="text-xs px-2 py-0.5 rounded" style={{ background: 'var(--surface-2)' }}>
                  {e.action}
                </code>
              </td>
              <td className="px-4 py-3" style={{ color: 'var(--text-muted)' }}>
                {e.tenantId ?? '—'}
              </td>
              <td className="px-4 py-3 max-w-md truncate" style={{ color: 'var(--text-muted)' }}>
                {e.metadata ? <code className="text-xs">{JSON.stringify(e.metadata)}</code> : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
