export function Spinner({ size = 'md' }: { size?: 'sm' | 'md' }) {
  return (
    <span className={`app-inline-spinner app-inline-spinner--${size}`} aria-hidden>
      <span />
      <span />
      <span />
    </span>
  )
}
