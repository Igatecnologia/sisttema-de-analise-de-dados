import type { ReactNode } from 'react'

type Props = {
  /** Titulo do painel — opcional */
  title?: string
  /** Subtitulo / hint */
  subtitle?: string
  /** Acoes a direita do header (botoes, filtros, etc) */
  actions?: ReactNode
  /** Conteudo principal — tabela, lista, etc */
  children: ReactNode
  /** Remove padding interno (util quando o filho tem proprio padding) */
  flush?: boolean
  /** Estilo extra */
  style?: React.CSSProperties
  /** Sticky header ao scroll */
  stickyHeader?: boolean
}

/**
 * Container padrao para tabelas, listas e blocos de dados.
 * Visual moderno: borda sutil, bg surface, header opcional com action area.
 */
export function DataPanel({
  title,
  subtitle,
  actions,
  children,
  flush,
  style,
  stickyHeader,
}: Props) {
  const hasHeader = title || subtitle || actions
  return (
    <section
      className="data-panel"
      style={{
        background: 'var(--qc-surface, #ffffff)',
        border: '1px solid var(--qc-border, rgba(0,0,0,0.06))',
        borderRadius: 14,
        overflow: 'hidden',
        boxShadow: 'var(--qc-shadow-sm, 0 1px 2px rgba(15,23,42,0.04))',
        ...style,
      }}
    >
      {hasHeader && (
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            padding: '16px 20px',
            borderBottom: '1px solid var(--qc-border-subtle, rgba(0,0,0,0.05))',
            flexWrap: 'wrap',
            position: stickyHeader ? 'sticky' : undefined,
            top: stickyHeader ? 0 : undefined,
            zIndex: stickyHeader ? 1 : undefined,
            background: 'var(--qc-surface, #ffffff)',
          }}
        >
          <div style={{ minWidth: 0 }}>
            {title && (
              <h3
                style={{
                  margin: 0,
                  fontSize: 15,
                  fontWeight: 600,
                  color: 'var(--qc-text, #0f172a)',
                  letterSpacing: '-0.01em',
                }}
              >
                {title}
              </h3>
            )}
            {subtitle && (
              <div
                style={{
                  fontSize: 12,
                  color: 'var(--qc-text-muted, #64748b)',
                  marginTop: 2,
                }}
              >
                {subtitle}
              </div>
            )}
          </div>
          {actions && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              {actions}
            </div>
          )}
        </header>
      )}
      <div style={{ padding: flush ? 0 : 20 }}>{children}</div>
    </section>
  )
}
