'use client'

import type { ReactNode, ComponentPropsWithoutRef } from 'react'

/**
 * ShimmerButton — solid button with a slow shine traveling across.
 * Used for primary CTAs. CSS-only animation.
 */
type ShimmerButtonProps = ComponentPropsWithoutRef<'a'> & {
  children: ReactNode
  shimmerColor?: string
}

export function ShimmerButton({
  children,
  shimmerColor = 'rgba(255,255,255,0.35)',
  className = '',
  ...rest
}: ShimmerButtonProps) {
  return (
    <a
      {...rest}
      className={`group relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-full bg-[var(--color-fg)] px-7 py-3.5 text-sm font-medium text-white transition-transform duration-200 hover:-translate-y-0.5 ${className}`}
    >
      {/* Shimmer */}
      <span
        aria-hidden
        className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-[var(--shimmer-color)] to-transparent group-hover:animate-[shimmer_1.2s_ease-out]"
        style={{ ['--shimmer-color' as string]: shimmerColor }}
      />
      {/* Content */}
      <span className="relative z-10 inline-flex items-center gap-2">{children}</span>
      <style>{`
        @keyframes shimmer {
          from { transform: translateX(-100%); }
          to { transform: translateX(200%); }
        }
      `}</style>
    </a>
  )
}
