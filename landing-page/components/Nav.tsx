'use client'

import { motion } from 'motion/react'
import { useEffect, useState } from 'react'

const links = [
  { label: 'Produto', href: '#features' },
  { label: 'Como funciona', href: '#how' },
  { label: 'Integrações', href: '#integrations' },
  { label: 'Planos', href: '#pricing' },
  { label: 'FAQ', href: '#faq' },
]

export function Nav() {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
        scrolled ? 'backdrop-blur-md bg-ink-900/60 border-b border-ink-600/40' : ''
      }`}
    >
      <div className="mx-auto flex max-w-[1280px] items-center justify-between px-6 py-4 md:px-10 md:py-5">
        <a href="#top" className="flex items-baseline gap-2">
          <span className="font-display text-2xl tracking-tight text-ink-50">IGA</span>
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-300">Gestão</span>
        </a>

        <nav className="hidden md:flex items-center gap-8">
          {links.map((l) => (
            <motion.a
              key={l.href}
              href={l.href}
              className="link-underline text-sm text-ink-100 hover:text-ink-50 transition-colors"
              whileHover={{ y: -1 }}
              transition={{ duration: 0.2 }}
            >
              {l.label}
            </motion.a>
          ))}
        </nav>

        <a
          href="#cta"
          className="btn-emerald-glow rounded-full bg-emerald-base px-5 py-2.5 text-sm font-medium text-ink-950"
        >
          Testar grátis
        </a>
      </div>
    </header>
  )
}
