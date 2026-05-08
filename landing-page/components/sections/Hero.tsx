'use client'

import Image from 'next/image'
import { motion } from 'motion/react'
import { Container } from '../primitives'

const ease = [0.22, 1, 0.36, 1] as const

export function Hero() {
  return (
    <section
      id="top"
      className="relative overflow-hidden pt-36 md:pt-44 pb-24 md:pb-32 bg-white"
    >
      {/* Decorative blobs */}
      <div className="blob size-[600px] -top-32 -right-32 grad-violet opacity-25" aria-hidden />
      <div className="blob size-[500px] top-40 -left-40 grad-blue opacity-20" aria-hidden />

      <Container size="wide" className="relative">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease }}
          className="mb-8 inline-flex items-center gap-2 rounded-full border border-[var(--color-line)] bg-white/60 backdrop-blur px-4 py-1.5"
        >
          <span className="relative flex size-2">
            <span className="absolute inline-flex h-full w-full rounded-full bg-[var(--color-brand)] opacity-50 animate-ping" />
            <span className="relative inline-flex size-2 rounded-full bg-[var(--color-brand)]" />
          </span>
          <span className="text-sm font-medium">Beta Maio 2026 — vagas limitadas</span>
          <span className="text-[var(--color-fg-subtle)] text-sm">·</span>
          <a href="#cta" className="text-sm text-[var(--color-brand)] hover:underline">
            Pedir convite →
          </a>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease, delay: 0.1 }}
          className="text-display-2xl text-[var(--color-fg)] max-w-[18ch]"
        >
          Você não precisa de outro ERP.{' '}
          <span className="bg-gradient-to-br from-[#0052ff] via-[#6e4eff] to-[#ff3d8b] bg-clip-text text-transparent">
            Precisa entender o que já tem.
          </span>
        </motion.h1>

        <div className="mt-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-end">
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease, delay: 0.3 }}
            className="lg:col-span-7 text-xl md:text-2xl text-[var(--color-fg-muted)] max-w-[58ch] leading-relaxed"
          >
            O IGA conecta no ERP que sua fábrica já usa e devolve gestão, produção, estoque,
            financeiro e um copiloto IA — em uma tela só. Em dez minutos. Sem instalação.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease, delay: 0.4 }}
            className="lg:col-span-5 flex flex-col gap-3"
          >
            <div className="flex flex-wrap items-center gap-3">
              <a href="#cta" className="btn-primary">
                Testar 14 dias grátis
                <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14M13 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </a>
              <a href="#demo" className="btn-secondary">
                Ver demo (2 min)
              </a>
            </div>
            <p className="text-sm text-[var(--color-fg-muted)] flex items-center gap-2">
              <svg className="size-4 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Sem cartão · Cancele quando quiser
            </p>
          </motion.div>
        </div>

        {/* Mockup com screenshot real do dashboard */}
        <motion.div
          initial={{ opacity: 0, y: 60 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.1, ease, delay: 0.5 }}
          className="mt-20 md:mt-28 relative"
        >
          {/* Browser chrome wrapper */}
          <div className="mockup-ring shadow-2xl shadow-black/15">
            <div className="rounded-3xl bg-white border border-[var(--color-line)] overflow-hidden">
              {/* Top bar */}
              <div className="flex items-center justify-between border-b border-[var(--color-line)] px-5 py-3 bg-[var(--color-bg-alt)]">
                <div className="flex items-center gap-1.5">
                  <span className="size-3 rounded-full bg-[#ff5f57]" />
                  <span className="size-3 rounded-full bg-[#ffbd2e]" />
                  <span className="size-3 rounded-full bg-[#28c840]" />
                </div>
                <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-md bg-white border border-[var(--color-line)] text-xs text-[var(--color-fg-muted)]">
                  <svg className="size-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="4" y="11" width="16" height="10" rx="2" />
                    <path d="M8 11V7a4 4 0 018 0v4" strokeLinecap="round" />
                  </svg>
                  app.igagestao.com.br
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xs font-medium text-emerald-600">Live</span>
                </div>
              </div>

              {/* Real screenshot */}
              <div className="relative aspect-[1440/900] bg-white">
                <Image
                  src="/screenshots/dashboard-desktop.png"
                  alt="Dashboard IGA Gestão — visão geral da operação"
                  fill
                  priority
                  sizes="(max-width: 1024px) 100vw, 1080px"
                  className="object-cover object-top"
                />
              </div>
            </div>
          </div>

          {/* Floating badge — 'live data' */}
          <motion.div
            initial={{ opacity: 0, scale: 0.85, x: 20 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            transition={{ duration: 0.7, ease, delay: 1.2 }}
            className="hidden md:flex absolute -right-4 lg:-right-10 top-32 lg:top-40 z-10 flex-col gap-3 rounded-2xl bg-white shadow-2xl shadow-black/10 border border-[var(--color-line)] p-4 max-w-[260px]"
          >
            <div className="flex items-center gap-2">
              <div className="size-9 rounded-xl grad-mesh flex items-center justify-center">
                <svg className="size-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 3l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" strokeLinejoin="round" />
                </svg>
              </div>
              <div>
                <p className="text-xs font-semibold">Copilot</p>
                <p className="text-[11px] text-[var(--color-fg-muted)]">Pergunte em português</p>
              </div>
            </div>
            <p className="text-xs text-[var(--color-fg-muted)] leading-snug">
              <span className="text-[var(--color-fg)] font-medium">&ldquo;Cliente que mais cresceu?&rdquo;</span>
              <br />
              Tex Norte +34% MoM.
            </p>
          </motion.div>

          {/* Floating badge — 'metric' */}
          <motion.div
            initial={{ opacity: 0, scale: 0.85, x: -20 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            transition={{ duration: 0.7, ease, delay: 1.4 }}
            className="hidden lg:block absolute -left-8 bottom-24 z-10 rounded-2xl bg-white shadow-2xl shadow-black/10 border border-[var(--color-line)] p-4"
          >
            <p className="text-xs text-[var(--color-fg-muted)] mb-1">Margem do mês</p>
            <p className="text-2xl font-semibold tracking-tight tnum">38,2%</p>
            <p className="text-xs font-medium text-emerald-600 mt-0.5">+1,4 pp vs anterior</p>
          </motion.div>
        </motion.div>

        {/* Trust strip */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, ease, delay: 0.8 }}
          className="mt-20 md:mt-28"
        >
          <p className="text-center text-sm text-[var(--color-fg-muted)] mb-8">
            Funciona com o ERP que sua fábrica já tem
          </p>
          <ul className="flex flex-wrap items-center justify-center gap-x-12 gap-y-6 opacity-60">
            {['SGBR BI', 'Bling', 'Tiny', 'Omie', 'Custom API'].map((p) => (
              <li
                key={p}
                className="font-semibold tracking-tight text-lg text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] transition-colors"
              >
                {p}
              </li>
            ))}
          </ul>
        </motion.div>
      </Container>
    </section>
  )
}
