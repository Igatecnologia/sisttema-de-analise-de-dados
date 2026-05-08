'use client'

import { motion, useInView, useMotionValue, useSpring, useTransform } from 'motion/react'
import { useEffect, useRef, type ReactNode } from 'react'

/** Wrapper de seção com max-width consistente (1280) e padding fluido. */
export function Container({
  children,
  className = '',
  as: Tag = 'div',
}: {
  children: ReactNode
  className?: string
  as?: keyof React.JSX.IntrinsicElements
}) {
  const Component = Tag as 'div'
  return (
    <Component className={`mx-auto w-full max-w-[1280px] px-6 md:px-10 ${className}`}>
      {children}
    </Component>
  )
}

/** Reveal genérico com fade + slide ao entrar na viewport. */
export function Reveal({
  children,
  delay = 0,
  y = 24,
  className = '',
  once = true,
}: {
  children: ReactNode
  delay?: number
  y?: number
  className?: string
  once?: boolean
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once, margin: '-80px' }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

/** Stagger filho — aplica delay incremental por índice. */
export function Stagger({
  children,
  step = 0.06,
  className = '',
}: {
  children: ReactNode[]
  step?: number
  className?: string
}) {
  return (
    <>
      {children.map((c, i) => (
        <Reveal key={i} delay={i * step} className={className}>
          {c}
        </Reveal>
      ))}
    </>
  )
}

/** Counter editorial que acelera ao entrar na viewport. */
export function Counter({
  to,
  prefix = '',
  suffix = '',
  duration = 1.6,
  className = '',
  format = 'pt-BR',
  decimals = 0,
}: {
  to: number
  prefix?: string
  suffix?: string
  duration?: number
  className?: string
  format?: string
  decimals?: number
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, margin: '-40px' })
  const motionValue = useMotionValue(0)
  const spring = useSpring(motionValue, { stiffness: 80, damping: 20, mass: 1.2 })
  const display = useTransform(spring, (v) => {
    return new Intl.NumberFormat(format, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(v)
  })

  useEffect(() => {
    if (inView) motionValue.set(to)
  }, [inView, to, motionValue])

  /** Bind via subscribe — Motion não permite render direto de MotionValue em texto. */
  useEffect(() => {
    if (!ref.current) return
    return display.on('change', (v) => {
      if (ref.current) ref.current.textContent = `${prefix}${v}${suffix}`
    })
  }, [display, prefix, suffix])

  return (
    <span ref={ref} className={`ticker-num ${className}`}>
      {prefix}0{suffix}
    </span>
  )
  // duration prop reservado para futura versão sem spring
}

/** Hairline horizontal decorativo. */
export function Hairline({ className = '' }: { className?: string }) {
  return <div className={`hairline-x w-full ${className}`} aria-hidden />
}

/** Marca editorial com número grande e label. Usado em pricing e métricas. */
export function StatBlock({
  value,
  label,
  prefix,
  suffix,
  large = false,
}: {
  value: number
  label: string
  prefix?: string
  suffix?: string
  large?: boolean
}) {
  return (
    <div className="flex flex-col gap-2">
      <Counter
        to={value}
        prefix={prefix}
        suffix={suffix}
        className={
          large
            ? 'text-display-xl font-display tracking-tight text-ink-50'
            : 'text-display-lg font-display text-ink-50'
        }
      />
      <span className="text-eyebrow">{label}</span>
    </div>
  )
}

/** Eyebrow editorial — usado como tag de seção. */
export function Eyebrow({
  children,
  number,
  accent,
}: {
  children: ReactNode
  number?: string
  accent?: 'emerald' | 'gold' | 'cobalt' | 'ink'
}) {
  const dotColor = {
    emerald: 'bg-emerald-base',
    gold: 'bg-gold-base',
    cobalt: 'bg-cobalt-base',
    ink: 'bg-ink-300',
  }[accent ?? 'emerald']

  return (
    <div className="flex items-center gap-3 text-eyebrow">
      <span className={`size-1.5 rounded-full ${dotColor}`} aria-hidden />
      {number ? <span className="text-ink-300">{number}</span> : null}
      <span>{children}</span>
    </div>
  )
}
