'use client'

/**
 * BorderBeam — light beam traveling along the card border (Magic UI inspired).
 * Apply as absolute child inside a relatively positioned card.
 */
export function BorderBeam({
  size = 200,
  duration = 8,
  delay = 0,
  colorFrom = '#0052ff',
  colorTo = '#ff3d8b',
  reverse = false,
}: {
  size?: number
  duration?: number
  delay?: number
  colorFrom?: string
  colorTo?: string
  reverse?: boolean
}) {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute inset-0 rounded-[inherit] [border:1px_solid_transparent] [mask-clip:padding-box,border-box] [mask-composite:intersect] [mask:linear-gradient(transparent,transparent),linear-gradient(black,black)]"
    >
      <span
        className="absolute aspect-square rounded-full"
        style={{
          width: size,
          background: `conic-gradient(from 90deg, transparent 0%, ${colorFrom} 25%, ${colorTo} 60%, transparent 100%)`,
          offsetPath: 'rect(0 auto auto 0 round 9999px)',
          offsetDistance: '0%',
          animation: `border-beam ${duration}s linear infinite${reverse ? ' reverse' : ''}`,
          animationDelay: `${-delay}s`,
        }}
      />
      <style>{`
        @keyframes border-beam {
          to { offset-distance: 100%; }
        }
      `}</style>
    </span>
  )
}
