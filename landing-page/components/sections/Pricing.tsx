'use client'

import { motion, AnimatePresence } from 'motion/react'
import { useState } from 'react'
import { Container, Eyebrow, Hairline, Reveal } from '../primitives'

const ease = [0.22, 1, 0.36, 1] as const

type Plan = {
  name: string
  monthly: number
  annual: number
  features: string[]
  cta: string
  popular?: boolean
  custom?: boolean
}

const plans: Plan[] = [
  {
    name: 'Free',
    monthly: 0,
    annual: 0,
    features: ['1 usuário', '1 fonte de dados', 'Dashboard + Vendas', 'Documentação'],
    cta: 'Começar grátis',
  },
  {
    name: 'Starter',
    monthly: 197,
    annual: 157,
    features: ['3 usuários', '2 fontes', '+ Estoque + Compras', 'Suporte e-mail'],
    cta: 'Testar 14 dias',
  },
  {
    name: 'Pro',
    monthly: 497,
    annual: 397,
    features: ['10 usuários', '5 fontes', 'Todos os módulos', 'Copilot (20/dia)', 'Chat + e-mail'],
    cta: 'Testar 14 dias',
    popular: true,
  },
  {
    name: 'Enterprise',
    monthly: 997,
    annual: 797,
    features: ['Ilimitado', 'API + webhooks', 'Copilot Premium', 'SLA 99.5%', 'Suporte dedicado'],
    cta: 'Falar com vendas',
    custom: true,
  },
]

export function Pricing() {
  const [annual, setAnnual] = useState(false)

  return (
    <section id="pricing" className="relative py-32 md:py-40">
      <Container>
        <Hairline className="mb-20 opacity-40" />

        <div className="grid grid-cols-12 gap-x-4 md:gap-x-8 mb-16 md:mb-20 items-end">
          <div className="col-span-12 md:col-span-5">
            <Reveal>
              <Eyebrow number="07" accent="emerald">
                Planos
              </Eyebrow>
            </Reveal>
          </div>
          <div className="col-span-12 md:col-span-7 mt-8 md:mt-0">
            <Reveal delay={0.1}>
              <h2 className="text-display-lg font-display text-ink-50">
                Cabe na sua <span className="italic-accent">operação</span>.
              </h2>
            </Reveal>
            <Reveal delay={0.2}>
              <p className="mt-6 text-lg text-ink-200 max-w-[58ch]">
                Trial de 14 dias do plano Pro, sem cartão. Ao expirar, vira Free automaticamente —
                sem cobranças surpresa.
              </p>
            </Reveal>
          </div>
        </div>

        {/* Toggle pill */}
        <Reveal delay={0.25}>
          <div className="mb-12 flex justify-center">
            <div className="relative inline-flex items-center gap-1 rounded-full border border-ink-600/60 bg-ink-800/60 p-1">
              <button
                onClick={() => setAnnual(false)}
                className={`relative z-10 rounded-full px-5 py-2 text-sm font-medium transition-colors ${
                  !annual ? 'text-ink-950' : 'text-ink-200'
                }`}
              >
                Mensal
              </button>
              <button
                onClick={() => setAnnual(true)}
                className={`relative z-10 inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-medium transition-colors ${
                  annual ? 'text-ink-950' : 'text-ink-200'
                }`}
              >
                Anual
                <span className="rounded-full bg-gold-base/20 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-gold-soft">
                  -20%
                </span>
              </button>
              <motion.div
                aria-hidden
                className="absolute top-1 bottom-1 rounded-full bg-emerald-base"
                animate={{ left: annual ? '50%' : '0.25rem', right: annual ? '0.25rem' : '50%' }}
                transition={{ type: 'spring', stiffness: 280, damping: 26 }}
              />
            </div>
          </div>
        </Reveal>

        {/* Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
          {plans.map((plan, i) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 32 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.6, ease, delay: i * 0.08 }}
              className={`card-lift relative flex flex-col rounded-2xl border p-7 md:p-8 ${
                plan.popular
                  ? 'border-emerald-base/40 bg-gradient-to-br from-emerald-base/10 via-ink-800 to-ink-800'
                  : 'border-ink-600/60 bg-ink-800/50'
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gold-base px-3 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-950">
                  Mais popular
                </div>
              )}

              <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-300">
                {String(i + 1).padStart(2, '0')} · Plano
              </div>
              <h3 className="text-3xl font-display text-ink-50">{plan.name}</h3>

              <div className="mt-5 flex items-baseline gap-1 min-h-[64px]">
                <AnimatePresence mode="wait">
                  <motion.span
                    key={annual ? `${plan.name}-a` : `${plan.name}-m`}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.3 }}
                    className="font-display text-5xl text-ink-50 leading-none ticker-num"
                  >
                    {plan.monthly === 0
                      ? 'R$ 0'
                      : `R$ ${(annual ? plan.annual : plan.monthly).toLocaleString('pt-BR')}`}
                  </motion.span>
                </AnimatePresence>
                {plan.monthly > 0 && (
                  <span className="font-mono text-xs text-ink-300">/mês</span>
                )}
              </div>
              {annual && plan.annual > 0 && (
                <p className="mt-1 font-mono text-[10px] text-ink-300">
                  R$ {(plan.annual * 12).toLocaleString('pt-BR')} cobrado anualmente
                </p>
              )}

              <ul className="my-6 space-y-2.5 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-ink-100">
                    <svg
                      className={`mt-0.5 size-4 shrink-0 ${plan.popular ? 'text-emerald-soft' : 'text-ink-300'}`}
                      viewBox="0 0 24 24"
                      fill="none"
                    >
                      <path
                        d="M5 13l4 4L19 7"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>

              <a
                href="#cta"
                className={`mt-2 inline-flex items-center justify-center rounded-full px-5 py-3 text-sm font-medium transition-all ${
                  plan.popular
                    ? 'btn-emerald-glow bg-emerald-base text-ink-950'
                    : plan.custom
                      ? 'border border-ink-400 text-ink-50 hover:bg-ink-700'
                      : 'bg-ink-700 text-ink-50 hover:bg-ink-600'
                }`}
              >
                {plan.cta}
              </a>
            </motion.div>
          ))}
        </div>

        <Reveal delay={0.5}>
          <p className="mt-10 text-center text-sm text-ink-300">
            Trial inclui Copilot IA e todos os módulos do Pro. Sem cartão. Cancele a qualquer momento.
          </p>
        </Reveal>
      </Container>
    </section>
  )
}
