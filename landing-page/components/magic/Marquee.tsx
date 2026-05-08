'use client'

import type { ReactNode } from 'react'

/**
 * Marquee — infinite horizontal scroll with pause on hover.
 * Duplicates children so the animation loops seamlessly.
 */
export function Marquee({
  children,
  speed = 40,
  reverse = false,
  pauseOnHover = true,
  className = '',
  fade = true,
}: {
  children: ReactNode
  speed?: number
  reverse?: boolean
  pauseOnHover?: boolean
  className?: string
  fade?: boolean
}) {
  return (
    <div
      className={`group relative flex overflow-hidden ${className}`}
      style={fade ? {
        maskImage: 'linear-gradient(to right, transparent, black 8%, black 92%, transparent)',
        WebkitMaskImage: 'linear-gradient(to right, transparent, black 8%, black 92%, transparent)',
      } : undefined}
    >
      <div
        className={`flex shrink-0 items-center gap-12 pr-12 ${pauseOnHover ? 'group-hover:[animation-play-state:paused]' : ''}`}
        style={{
          animation: `marquee ${speed}s linear infinite${reverse ? ' reverse' : ''}`,
        }}
      >
        {children}
      </div>
      <div
        aria-hidden
        className={`flex shrink-0 items-center gap-12 pr-12 ${pauseOnHover ? 'group-hover:[animation-play-state:paused]' : ''}`}
        style={{
          animation: `marquee ${speed}s linear infinite${reverse ? ' reverse' : ''}`,
        }}
      >
        {children}
      </div>
      <style>{`
        @keyframes marquee {
          from { transform: translateX(0); }
          to { transform: translateX(-100%); }
        }
      `}</style>
    </div>
  )
}
