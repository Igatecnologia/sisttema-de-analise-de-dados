type LogoProps = {
  size?: 'sm' | 'md' | 'lg'
  variant?: 'color' | 'mono' | 'inverse'
  animated?: boolean
}

const SIZE_MAP: Record<NonNullable<LogoProps['size']>, number> = {
  sm: 32,
  md: 44,
  lg: 62,
}

export function Logo({ size = 'md', variant = 'color', animated = false }: LogoProps) {
  const pixel = SIZE_MAP[size]
  const primary = variant === 'inverse' ? '#F8FAFC' : '#0B5FFF'
  const secondary = variant === 'inverse' ? '#BFDBFE' : '#2563EB'
  const accent = variant === 'mono' ? primary : '#10B981'

  return (
    <svg
      width={pixel}
      height={pixel}
      viewBox="0 0 64 64"
      fill="none"
      aria-label="IGA logo"
      role="img"
      className={animated ? 'iga-logo iga-logo--animated' : 'iga-logo'}
    >
      <rect x="6" y="6" width="52" height="52" rx="14" fill={primary} />
      <path d="M20 34L28 26L34 32L44 22" stroke={accent} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M20 42H44" stroke={secondary} strokeWidth="3.5" strokeLinecap="round" />
      <circle cx="44" cy="22" r="3" fill={accent} />
    </svg>
  )
}
