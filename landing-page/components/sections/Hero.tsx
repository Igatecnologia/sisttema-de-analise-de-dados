'use client'

import { motion } from 'motion/react'
import { Container } from '../primitives'

const ease = [0.22, 1, 0.36, 1] as const

export function Hero() {
  return (
    <section
      id="top"
      className="grain spotlight relative min-h-screen overflow-hidden pt-32 pb-24 md:pt-40 md:pb-32"
    >
      {/* Blueprint grid de fundo */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(to right, var(--color-ink-200) 1px, transparent 1px), linear-gradient(to bottom, var(--color-ink-200) 1px, transparent 1px)',
          backgroundSize: '64px 64px',
          maskImage: 'radial-gradient(ellipse 70% 50% at 50% 30%, black 30%, transparent 70%)',
        }}
      />

      <Container className="relative z-10">
        {/* Eyebrow */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease }}
          className="mb-10 flex items-center gap-3 text-eyebrow"
        >
          <span className="relative flex size-1.5">
            <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-base opacity-60 pulse-ring" />
            <span className="relative inline-flex size-1.5 rounded-full bg-emerald-base" />
          </span>
          <span>Beta · Maio 2026</span>
          <span className="text-ink-500">/</span>
          <span className="text-ink-300">v1.2</span>
        </motion.div>

        {/* Headline editorial — assimétrica */}
        <div className="grid grid-cols-12 gap-x-4 md:gap-x-8">
          <motion.h1
            initial="hidden"
            animate="visible"
            variants={{ visible: { transition: { staggerChildren: 0.08 } } }}
            className="col-span-12 text-display-xxl font-display text-ink-50"
          >
            <motion.span
              variants={{ hidden: { y: '110%', opacity: 0 }, visible: { y: 0, opacity: 1 } }}
              transition={{ duration: 0.9, ease }}
              className="block overflow-hidden"
            >
              <span className="block">Sua indústria.</span>
            </motion.span>
            <motion.span
              variants={{ hidden: { y: '110%', opacity: 0 }, visible: { y: 0, opacity: 1 } }}
              transition={{ duration: 0.9, ease }}
              className="block overflow-hidden"
            >
              <span className="block pl-[8vw] md:pl-[12vw]">
                <span>Seus </span>
                <span className="italic-accent">dados</span>
                <span>.</span>
              </span>
            </motion.span>
            <motion.span
              variants={{ hidden: { y: '110%', opacity: 0 }, visible: { y: 0, opacity: 1 } }}
              transition={{ duration: 0.9, ease }}
              className="block overflow-hidden"
            >
              <span className="block">Uma visão completa.</span>
            </motion.span>
          </motion.h1>
        </div>

        {/* Subheadline + CTA — desalinhados de propósito */}
        <div className="mt-14 grid grid-cols-12 gap-x-4 md:gap-x-8">
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease, delay: 0.5 }}
            className="col-span-12 md:col-span-7 text-balance text-lg md:text-xl leading-relaxed text-ink-100 max-w-[52ch]"
          >
            Conecte seu ERP e tenha dashboard de gestão, produção, estoque, financeiro e
            <span className="text-ink-50"> IA Copilot</span> — em minutos. Sem cartão, sem instalação.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease, delay: 0.6 }}
            className="col-span-12 md:col-span-5 mt-8 md:mt-0 flex flex-col items-start md:items-end gap-3"
          >
            <div className="flex flex-wrap gap-3">
              <a
                href="#cta"
                className="btn-emerald-glow group inline-flex items-center gap-2 rounded-full bg-emerald-base px-7 py-3.5 text-sm font-medium text-ink-950"
              >
                Testar grátis 14 dias
                <span className="inline-block transition-transform duration-300 group-hover:translate-x-1">→</span>
              </a>
              <a
                href="#demo"
                className="link-underline inline-flex items-center gap-2 rounded-full border border-ink-500 px-7 py-3.5 text-sm text-ink-100 hover:border-ink-300"
              >
                <span className="size-2 rounded-full bg-gold-base" />
                Ver demo (2min)
              </a>
            </div>
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-300">
              Sem cartão · Cancele quando quiser
            </p>
          </motion.div>
        </div>

        {/* Mockup do dashboard */}
        <motion.div
          initial={{ opacity: 0, y: 60, rotateX: 8 }}
          animate={{ opacity: 1, y: 0, rotateX: 0 }}
          transition={{ duration: 1.2, ease, delay: 0.7 }}
          className="mt-24 perspective-[2000px]"
          style={{ perspective: '2000px' }}
        >
          <DashboardMockup />
        </motion.div>

        {/* Logos parceiros / hosts */}
        <div className="mt-24 grid grid-cols-12 gap-x-4 md:gap-x-8 items-end">
          <p className="col-span-12 md:col-span-4 text-eyebrow text-ink-300">
            Funciona com qualquer ERP REST
          </p>
          <ul className="col-span-12 md:col-span-8 mt-6 md:mt-0 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-6 items-center">
            {['SGBR BI', 'Bling', 'Tiny', 'Omie', 'Custom API'].map((p) => (
              <li
                key={p}
                className="font-mono text-sm tracking-wider text-ink-300/70 hover:text-ink-100 transition-colors"
              >
                {p}
              </li>
            ))}
          </ul>
        </div>
      </Container>
    </section>
  )
}

/** Mockup do dashboard com cards e mini-charts SVG. Pure CSS+SVG, sem screenshots. */
function DashboardMockup() {
  return (
    <div className="relative mx-auto w-full max-w-[1080px] rounded-2xl border border-ink-500/60 bg-ink-800/80 backdrop-blur-xl shadow-2xl">
      {/* Top bar */}
      <div className="flex items-center justify-between border-b border-ink-600/60 px-5 py-3.5">
        <div className="flex items-center gap-2">
          <span className="size-2.5 rounded-full bg-ink-500" />
          <span className="size-2.5 rounded-full bg-ink-500" />
          <span className="size-2.5 rounded-full bg-ink-500" />
        </div>
        <div className="font-mono text-[11px] tracking-wider text-ink-300">
          app.igagestao.com.br/dashboard
        </div>
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-emerald-base">
          <span className="size-1.5 rounded-full bg-emerald-base" />
          Live
        </div>
      </div>

      {/* Conteúdo */}
      <div className="grid grid-cols-12 gap-4 p-5 md:p-7">
        {/* Sidebar */}
        <div className="col-span-2 hidden md:block space-y-2 text-[11px] font-mono text-ink-300">
          {['Dashboard', 'Produção', 'Estoque', 'Financeiro', 'Vendas', 'Compras', 'Copilot'].map(
            (item, i) => (
              <div
                key={item}
                className={`px-2 py-1.5 rounded ${
                  i === 0 ? 'bg-emerald-base/10 text-emerald-soft' : 'hover:bg-ink-700/60'
                }`}
              >
                {item}
              </div>
            ),
          )}
        </div>

        {/* Main */}
        <div className="col-span-12 md:col-span-10 space-y-4">
          {/* KPIs */}
          <div className="grid grid-cols-4 gap-3">
            <KpiCard label="Faturamento" value="R$ 2.4M" delta="+12%" trend="up" />
            <KpiCard label="Margem" value="38.2%" delta="+1.4pp" trend="up" />
            <KpiCard label="Pedidos" value="1.842" delta="-3%" trend="down" />
            <KpiCard label="Estoque crítico" value="14" delta="alerta" trend="warn" />
          </div>

          {/* Chart faux */}
          <div className="rounded-lg border border-ink-600/60 bg-ink-900/60 p-4">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-300">
                  Faturamento mensal
                </div>
                <div className="mt-1 font-display text-2xl text-ink-50">R$ 2.412.508</div>
              </div>
              <div className="flex gap-2 font-mono text-[10px] text-ink-300">
                <span>7d</span>
                <span>30d</span>
                <span className="text-emerald-soft">90d</span>
                <span>1y</span>
              </div>
            </div>
            <ChartSvg />
          </div>

          {/* Bottom row: small list + copilot */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="rounded-lg border border-ink-600/60 bg-ink-900/60 p-4">
              <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-300">
                Top clientes
              </div>
              <ul className="space-y-1.5 text-sm">
                {[
                  ['Indústria Alvorada', 'R$ 412.5k'],
                  ['Espumas Reais', 'R$ 287.1k'],
                  ['Tex Norte', 'R$ 198.4k'],
                  ['MetalForma', 'R$ 142.3k'],
                ].map(([n, v]) => (
                  <li key={n} className="flex justify-between text-ink-100">
                    <span>{n}</span>
                    <span className="font-mono text-ink-200">{v}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-lg border border-emerald-base/30 bg-gradient-to-br from-emerald-base/10 to-transparent p-4">
              <div className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-emerald-soft">
                <span className="size-1.5 rounded-full bg-emerald-base" />
                Copilot · IA
              </div>
              <p className="text-sm text-ink-100 leading-relaxed">
                <span className="text-ink-300">&ldquo;Qual o cliente que mais cresceu este mês?&rdquo;</span>
                <br />
                <span>
                  Tex Norte cresceu <strong className="text-emerald-soft">+34%</strong> em
                  faturamento este mês versus o anterior.
                </span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Scan line decoration */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px overflow-hidden">
        <div className="scan-line h-full w-1/3 bg-gradient-to-r from-transparent via-emerald-base/60 to-transparent" />
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
    trend === 'up' ? 'text-emerald-soft' : trend === 'down' ? 'text-ink-200' : 'text-gold-base'
  return (
    <div className="rounded-lg border border-ink-600/60 bg-ink-900/60 p-3.5">
      <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-ink-300">{label}</div>
      <div className="mt-1.5 font-display text-2xl text-ink-50 leading-none">{value}</div>
      <div className={`mt-1 font-mono text-[10px] ${trendColor}`}>{delta}</div>
    </div>
  )
}

function ChartSvg() {
  return (
    <svg viewBox="0 0 600 120" className="h-32 w-full" aria-hidden>
      <defs>
        <linearGradient id="chart-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#10b981" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* grid lines */}
      {[0, 30, 60, 90].map((y) => (
        <line key={y} x1="0" y1={y} x2="600" y2={y} stroke="#1a232f" strokeWidth="1" />
      ))}
      <motion.path
        d="M0,90 C60,80 120,40 180,50 C240,60 300,30 360,35 C420,40 480,15 540,25 L600,20 L600,120 L0,120 Z"
        fill="url(#chart-fill)"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 1.6, ease: [0.22, 1, 0.36, 1], delay: 1.0 }}
      />
      <motion.path
        d="M0,90 C60,80 120,40 180,50 C240,60 300,30 360,35 C420,40 480,15 540,25 L600,20"
        fill="none"
        stroke="#34d399"
        strokeWidth="2"
        strokeLinecap="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1.8, ease: [0.22, 1, 0.36, 1], delay: 0.9 }}
      />
    </svg>
  )
}
