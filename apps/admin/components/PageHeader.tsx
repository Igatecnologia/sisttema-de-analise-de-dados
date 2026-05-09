type Crumb = { label: string; href?: string }

type Props = {
  title: string
  subtitle?: string
  breadcrumbs?: Crumb[]
  actions?: React.ReactNode
}

export function PageHeader({ title, subtitle, breadcrumbs, actions }: Props) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4 mb-6">
      <div className="min-w-0">
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav aria-label="breadcrumbs" className="flex items-center gap-1.5 text-xs mb-2" style={{ color: 'var(--text-muted)' }}>
            {breadcrumbs.map((c, i) => (
              <span key={i} className="flex items-center gap-1.5">
                {i > 0 && <span style={{ color: 'var(--text-faint)' }}>/</span>}
                {c.href ? (
                  <a href={c.href} className="hover:underline">
                    {c.label}
                  </a>
                ) : (
                  <span>{c.label}</span>
                )}
              </span>
            ))}
          </nav>
        )}
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        {subtitle && (
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            {subtitle}
          </p>
        )}
      </div>
      {actions && <div className="flex flex-wrap gap-2 items-center">{actions}</div>}
    </header>
  )
}
