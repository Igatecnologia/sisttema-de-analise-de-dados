'use client'

import { useRef, type ReactNode, type MouseEvent } from 'react'

/**
 * SpotlightCard — card with a soft gradient that follows the mouse.
 * Inspired by 21st.dev / Magic UI patterns. Pure CSS, no JS for the gradient
 * (only mouse position vars are written via React).
 */
export function SpotlightCard({
  children,
  className = '',
  glow = '#0052ff',
  size = 360,
}: {
  children: ReactNode
  className?: string
  glow?: string
  size?: number
}) {
  const ref = useRef<HTMLDivElement>(null)

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (!ref.current) return
    const rect = ref.current.getBoundingClientRect()
    ref.current.style.setProperty('--spotlight-x', `${e.clientX - rect.left}px`)
    ref.current.style.setProperty('--spotlight-y', `${e.clientY - rect.top}px`)
  }

  return (
    <div
      ref={ref}
      onMouseMove={handleMouseMove}
      className={`relative overflow-hidden ${className}`}
      style={{
        ['--spotlight-color' as string]: glow,
        ['--spotlight-size' as string]: `${size}px`,
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-px opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        style={{
          background:
            'radial-gradient(var(--spotlight-size) circle at var(--spotlight-x) var(--spotlight-y), var(--spotlight-color), transparent 60%)',
          mixBlendMode: 'soft-light',
        }}
      />
      {children}
    </div>
  )
}
