'use client'

import { useEffect, useState } from 'react'

const links = [
  { label: 'Produto', href: '#features' },
  { label: 'Como funciona', href: '#how' },
  { label: 'Integrações', href: '#integrations' },
  { label: 'Planos', href: '#pricing' },
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
      className={`fixed top-0 inset-x-0 z-50 transition-all duration-400 ${
        scrolled
          ? 'bg-white/85 backdrop-blur-xl border-b border-[var(--color-line)]'
          : 'bg-transparent'
      }`}
    >
      <div className="mx-auto flex max-w-[1440px] items-center justify-between px-6 md:px-8 lg:px-10 py-4 md:py-5">
        <a href="#top" className="flex items-center gap-2 group">
          <div className="size-8 rounded-lg grad-blue flex items-center justify-center font-bold text-white text-sm">
            I
          </div>
          <span className="font-semibold text-lg tracking-tight">IGA</span>
        </a>

        <nav className="hidden md:flex items-center gap-1">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="px-4 py-2 text-sm font-medium text-[var(--color-fg-soft)] hover:text-[var(--color-fg)] hover:bg-[var(--color-bg-alt)] rounded-full transition-colors"
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <a
            href="https://app.igagestao.com.br/login"
            className="hidden sm:inline-flex px-4 py-2 text-sm font-medium text-[var(--color-fg)] hover:text-[var(--color-brand)] transition-colors"
          >
            Entrar
          </a>
          <a href="#cta" className="btn-primary text-sm">
            Começar grátis
          </a>
        </div>
      </div>
    </header>
  )
}
