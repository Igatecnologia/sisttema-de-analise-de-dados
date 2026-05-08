'use client'

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
          <span className="text-sm font-medium">Beta · Maio 2026</span>
          <span className="text-[var(--color-fg-subtle)] text-sm">·</span>
          <a href="#features" className="text-sm text-[var(--color-brand)] hover:underline">
            Veja o que mudou →
          </a>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease, delay: 0.1 }}
          className="text-display-2xl text-[var(--color-fg)] max-w-[16ch]"
        >
          Sua indústria,{' '}
          <span className="bg-gradient-to-br from-[#0052ff] via-[#6e4eff] to-[#ff3d8b] bg-clip-text text-transparent">
            visualizada.
          </span>
        </motion.h1>

        <div className="mt-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-end">
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease, delay: 0.3 }}
            className="lg:col-span-7 text-xl md:text-2xl text-[var(--color-fg-muted)] max-w-[60ch] leading-relaxed"
          >
            Conecte seu ERP e tenha dashboard de gestão, produção, estoque, financeiro e IA Copilot
            — em minutos. Sem instalação. Sem cartão.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease, delay: 0.4 }}
            className="lg:col-span-5 flex flex-wrap items-center gap-3"
          >
            <a href="#cta" className="btn-primary">
              Começar grátis
              <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 12h14M13 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </a>
            <a href="#demo" className="btn-secondary">
              Ver demo (2 min)
            </a>
          </motion.div>
        </div>

        {/* Mockup */}
        <motion.div
          initial={{ opacity: 0, y: 60 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.1, ease, delay: 0.5 }}
          className="mt-20 md:mt-28"
        >
          <div className="mockup-ring shadow-2xl shadow-black/10">
            <DashboardMockup />
          </div>
        </motion.div>

        {/* Trust strip */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, ease, delay: 0.8 }}
          className="mt-20 md:mt-28"
        >
          <p className="text-center text-sm text-[var(--color-fg-muted)] mb-8">
            Funciona com qualquer ERP REST
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

function DashboardMockup() {
  return (
    <div className="rounded-3xl bg-white border border-[var(--color-line)] overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between border-b border-[var(--color-line)] px-5 py-3.5 bg-[var(--color-bg-alt)]">
        <div className="flex items-center gap-1.5">
          <span className="size-3 rounded-full bg-[#ff5f57]" />
          <span className="size-3 rounded-full bg-[#ffbd2e]" />
          <span className="size-3 rounded-full bg-[#28c840]" />
        </div>
        <div className="text-xs font-medium text-[var(--color-fg-muted)] hidden sm:block">
          app.igagestao.com.br
        </div>
        <div className="flex items-center gap-1.5">
          <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-medium text-emerald-600">Live</span>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-4 p-5 md:p-7">
        {/* Sidebar */}
        <aside className="col-span-3 hidden md:block space-y-1 text-sm">
          {[
            ['Dashboard', true],
            ['Produção', false],
            ['Estoque', false],
            ['Financeiro', false],
            ['Vendas', false],
            ['Compras', false],
            ['Copilot', false],
          ].map(([item, active]) => (
            <div
              key={item as string}
              className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                active
                  ? 'bg-[var(--color-brand)] text-white font-medium'
                  : 'text-[var(--color-fg-muted)] hover:bg-[var(--color-bg-alt)]'
              }`}
            >
              {item}
            </div>
          ))}
        </aside>

        {/* Main */}
        <div className="col-span-12 md:col-span-9 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard label="Faturamento" value="R$ 2,4M" delta="+12,4%" trend="up" />
            <KpiCard label="Margem" value="38,2%" delta="+1,4 pp" trend="up" />
            <KpiCard label="Pedidos" value="1.842" delta="-3,1%" trend="down" />
            <KpiCard label="Crítico" value="14" delta="alerta" trend="warn" />
          </div>

          <div className="rounded-2xl border border-[var(--color-line)] bg-white p-5">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-xs text-[var(--color-fg-muted)] mb-1">Faturamento mensal</p>
                <p className="text-2xl font-semibold tracking-tight tnum">R$ 2.412.508</p>
              </div>
              <div className="flex gap-1 text-xs">
                <span className="px-2.5 py-1 rounded-full text-[var(--color-fg-muted)]">7d</span>
                <span className="px-2.5 py-1 rounded-full text-[var(--color-fg-muted)]">30d</span>
                <span className="px-2.5 py-1 rounded-full bg-[var(--color-fg)] text-white">90d</span>
                <span className="px-2.5 py-1 rounded-full text-[var(--color-fg-muted)]">1A</span>
              </div>
            </div>
            <ChartSvg />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="rounded-2xl border border-[var(--color-line)] bg-white p-5">
              <p className="text-xs text-[var(--color-fg-muted)] mb-3">Top clientes</p>
              <ul className="space-y-2.5">
                {[
                  ['Indústria Alvorada', 'R$ 412,5k'],
                  ['Espumas Reais', 'R$ 287,1k'],
                  ['Tex Norte', 'R$ 198,4k'],
                ].map(([n, v]) => (
                  <li key={n} className="flex justify-between text-sm">
                    <span className="text-[var(--color-fg)]">{n}</span>
                    <span className="text-[var(--color-fg-muted)] tnum">{v}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl grad-mesh p-5 text-white">
              <div className="flex items-center gap-2 mb-3">
                <span className="size-1.5 rounded-full bg-white/80 animate-pulse" />
                <span className="text-xs font-medium">Copilot · IA</span>
              </div>
              <p className="text-sm leading-relaxed">
                <span className="text-white/70">&ldquo;Cliente que mais cresceu este mês?&rdquo;</span>
                <br />
                <span className="font-medium">Tex Norte +34% em faturamento.</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function KpiCard({
  label,
  value,
  delta,
  trend,
}: {
  label: string
  value: string
  delta: string
  trend: 'up' | 'down' | 'warn'
}) {
  const trendColor =
    trend === 'up' ? 'text-emerald-600' : trend === 'down' ? 'text-[var(--color-fg-muted)]' : 'text-orange-500'
  return (
    <div className="rounded-2xl border border-[var(--color-line)] bg-white p-4">
      <p className="text-xs text-[var(--color-fg-muted)]">{label}</p>
      <p className="mt-1.5 text-xl font-semibold tracking-tight tnum">{value}</p>
      <p className={`mt-1 text-xs font-medium ${trendColor}`}>{delta}</p>
    </div>
  )
}

function ChartSvg() {
  return (
    <svg viewBox="0 0 600 140" className="h-32 w-full" aria-hidden>
      <defs>
        <linearGradient id="chart-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0052ff" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#0052ff" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0, 35, 70, 105].map((y) => (
        <line key={y} x1="0" y1={y} x2="600" y2={y} stroke="#efefef" strokeWidth="1" />
      ))}
      <motion.path
        d="M0,100 C60,90 120,50 180,60 C240,70 300,40 360,45 C420,50 480,25 540,35 L600,30 L600,140 L0,140 Z"
        fill="url(#chart-fill)"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 1.6, ease: [0.22, 1, 0.36, 1], delay: 0.9 }}
      />
      <motion.path
        d="M0,100 C60,90 120,50 180,60 C240,70 300,40 360,45 C420,50 480,25 540,35 L600,30"
        fill="none"
        stroke="#0052ff"
        strokeWidth="2.5"
        strokeLinecap="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1.8, ease: [0.22, 1, 0.36, 1], delay: 0.8 }}
      />
    </svg>
  )
}
