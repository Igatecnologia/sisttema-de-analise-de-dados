'use client'

import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'
import { Check } from 'lucide-react'
import { Container, Reveal } from '../primitives'
import { BorderBeam } from '../magic/BorderBeam'

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
    features: ['Ilimitado', 'API + webhooks', 'Copilot Premium', 'SLA 99.5%', 'Dedicado'],
    cta: 'Falar com vendas',
    custom: true,
  },
]

export function Pricing() {
  const [annual, setAnnual] = useState(false)

  return (
    <section id="pricing" className="py-28 md:py-36 bg-white">
      <Container>
        <div className="text-center mb-12 md:mb-16">
          <Reveal>
            <p className="text-[var(--color-brand)] text-sm font-medium mb-4">Planos</p>
            <h2 className="text-display-lg max-w-[20ch] mx-auto">
              Cabe na sua operação.
            </h2>
            <p className="mt-6 text-lg text-[var(--color-fg-muted)] max-w-[58ch] mx-auto">
              Trial de 14 dias do plano Pro, sem cartão. Ao expirar, vira Free automaticamente.
            </p>
          </Reveal>
        </div>

        {/* Toggle */}
        <Reveal delay={0.2}>
          <div className="mb-12 flex justify-center">
            <div className="relative inline-flex items-center gap-1 rounded-full bg-[var(--color-bg-alt)] p-1.5">
              <button
                onClick={() => setAnnual(false)}
                className={`relative z-10 rounded-full px-5 py-2 text-sm font-medium transition-colors ${
                  !annual ? 'text-white' : 'text-[var(--color-fg-muted)]'
                }`}
              >
                Mensal
              </button>
              <button
                onClick={() => setAnnual(true)}
                className={`relative z-10 inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-medium transition-colors ${
                  annual ? 'text-white' : 'text-[var(--color-fg-muted)]'
                }`}
              >
                Anual
                <span className="rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-semibold text-white">
                  -20%
                </span>
              </button>
              <motion.div
                aria-hidden
                className="absolute top-1.5 bottom-1.5 rounded-full bg-[var(--color-fg)]"
                animate={{ left: annual ? '50%' : '0.375rem', right: annual ? '0.375rem' : '50%' }}
                transition={{ type: 'spring', stiffness: 280, damping: 26 }}
              />
            </div>
          </div>
        </Reveal>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {plans.map((plan, i) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 32 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.6, ease, delay: i * 0.07 }}
              className={`relative flex flex-col rounded-3xl p-7 md:p-8 transition-all ${
                plan.popular
                  ? 'bg-[var(--color-fg)] text-white scale-[1.02] shadow-2xl shadow-black/15'
                  : 'bg-white border border-[var(--color-line)] hover:border-[var(--color-fg-subtle)]'
              }`}
            >
              {plan.popular && (
                <>
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10 rounded-full grad-blue px-3 py-1 text-[11px] font-semibold text-white">
                    Mais popular
                  </div>
                  <BorderBeam size={180} duration={9} colorFrom="#29b1ff" colorTo="#ff3d8b" />
                </>
              )}

              <p className={`text-xs font-medium mb-1 ${plan.popular ? 'text-white/60' : 'text-[var(--color-fg-muted)]'}`}>
                {plan.custom ? 'Personalizado' : 'Para começar'}
              </p>
              <h3 className="text-2xl font-semibold tracking-tight">{plan.name}</h3>

              <div className="mt-5 flex items-baseline gap-1 min-h-[60px]">
                <AnimatePresence mode="wait">
                  <motion.span
                    key={annual ? `${plan.name}-a` : `${plan.name}-m`}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.3 }}
                    className="text-4xl font-semibold tracking-tight tnum"
                  >
                    {plan.monthly === 0
                      ? 'R$ 0'
                      : `R$ ${(annual ? plan.annual : plan.monthly).toLocaleString('pt-BR')}`}
                  </motion.span>
                </AnimatePresence>
                {plan.monthly > 0 && (
                  <span className={`text-sm ${plan.popular ? 'text-white/60' : 'text-[var(--color-fg-muted)]'}`}>
                    /mês
                  </span>
                )}
              </div>
              {annual && plan.annual > 0 && (
                <p className={`mt-1 text-xs ${plan.popular ? 'text-white/60' : 'text-[var(--color-fg-muted)]'}`}>
                  R$ {(plan.annual * 12).toLocaleString('pt-BR')} cobrado anualmente
                </p>
              )}

              <ul className="my-7 space-y-3 flex-1">
                {plan.features.map((f) => (
                  <li
                    key={f}
                    className={`flex items-start gap-2.5 text-sm ${plan.popular ? 'text-white/90' : 'text-[var(--color-fg-soft)]'}`}
                  >
                    <Check
                      className={`mt-0.5 size-4 shrink-0 ${plan.popular ? 'text-emerald-400' : 'text-emerald-600'}`}
                      strokeWidth={2.5}
                    />
                    {f}
                  </li>
                ))}
              </ul>

              <a
                href="#cta"
                className={`mt-auto inline-flex items-center justify-center rounded-full px-5 py-3 text-sm font-medium transition-all ${
                  plan.popular
                    ? 'bg-white text-[var(--color-fg)] hover:bg-white/90'
                    : plan.custom
                      ? 'border border-[var(--color-fg)] text-[var(--color-fg)] hover:bg-[var(--color-fg)] hover:text-white'
                      : 'bg-[var(--color-fg)] text-white hover:bg-[var(--color-fg-soft)]'
                }`}
              >
                {plan.cta}
              </a>
            </motion.div>
          ))}
        </div>

        <Reveal delay={0.5}>
          <p className="mt-10 text-center text-sm text-[var(--color-fg-muted)]">
            Trial inclui Copilot IA e todos os módulos do Pro. Sem cartão. Cancele a qualquer momento.
          </p>
        </Reveal>
      </Container>
    </section>
  )
}
