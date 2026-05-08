'use client'

import { motion, useInView, useMotionValue, useSpring, useTransform } from 'motion/react'
import { useEffect, useRef, type ReactNode } from 'react'

/** Wrapper de seção com max-width consistente e padding fluido. */
export function Container({
  children,
  className = '',
  size = 'default',
}: {
  children: ReactNode
  className?: string
  size?: 'default' | 'narrow' | 'wide'
}) {
  const max = size === 'narrow' ? 'max-w-[1080px]' : size === 'wide' ? 'max-w-[1440px]' : 'max-w-[1280px]'
  return <div className={`mx-auto w-full ${max} px-6 md:px-8 lg:px-10 ${className}`}>{children}</div>
}

/** Reveal Coinbase-style — fade up suave. */
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
      viewport={{ once, margin: '-60px' }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

/** Counter spring-based para stats. */
export function Counter({
  to,
  prefix = '',
  suffix = '',
  className = '',
  format = 'pt-BR',
  decimals = 0,
}: {
  to: number
  prefix?: string
  suffix?: string
  className?: string
  format?: string
  decimals?: number
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, margin: '-40px' })
  const motionValue = useMotionValue(0)
  const spring = useSpring(motionValue, { stiffness: 80, damping: 22, mass: 1.2 })
  const display = useTransform(spring, (v) =>
    new Intl.NumberFormat(format, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(v),
  )

  useEffect(() => {
    if (inView) motionValue.set(to)
  }, [inView, to, motionValue])

  useEffect(() => {
    if (!ref.current) return
    return display.on('change', (v) => {
      if (ref.current) ref.current.textContent = `${prefix}${v}${suffix}`
    })
  }, [display, prefix, suffix])

  return (
    <span ref={ref} className={`tnum ${className}`}>
      {prefix}0{suffix}
    </span>
  )
}

/** Eyebrow simples. */
export function Eyebrow({ children, color = 'muted' }: { children: ReactNode; color?: 'muted' | 'brand' }) {
  return (
    <span
      className={`text-eyebrow ${color === 'brand' ? 'text-[var(--color-brand)]' : 'text-[var(--color-fg-muted)]'}`}
    >
      {children}
    </span>
  )
}
