'use client'

import { motion } from 'motion/react'
import { Container, Reveal } from '../primitives'

const ease = [0.22, 1, 0.36, 1] as const

const steps = [
  {
    n: '01',
    title: 'Conecte',
    desc: 'Informe a URL e credenciais do seu ERP. Validamos a conexão na hora.',
    badge: '~3 min',
    grad: 'grad-blue',
  },
  {
    n: '02',
    title: 'Configure',
    desc: 'Escolha módulos e mapeie campos. Templates prontos por segmento.',
    badge: '~5 min',
    grad: 'grad-violet',
  },
  {
    n: '03',
    title: 'Use',
    desc: 'Dashboards, alertas e Copilot — tudo populado em tempo real.',
    badge: '~2 min',
    grad: 'grad-pink',
  },
]

export function HowItWorks() {
  return (
    <section id="how" className="py-28 md:py-36 bg-[var(--color-bg-alt)]">
      <Container>
        <div className="max-w-[44ch] mb-16 md:mb-20">
          <Reveal>
            <p className="text-[var(--color-brand)] text-sm font-medium mb-4">Como funciona</p>
            <h2 className="text-display-lg">
              Três passos. <br />
              <span className="text-[var(--color-fg-muted)]">Dez minutos.</span>
            </h2>
          </Reveal>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5">
          {steps.map((step, i) => (
            <motion.div
              key={step.n}
              initial={{ opacity: 0, y: 32 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.7, ease, delay: i * 0.1 }}
              className="rounded-3xl bg-white border border-[var(--color-line)] p-8 md:p-10 flex flex-col"
            >
              <div className={`size-16 rounded-2xl ${step.grad} flex items-center justify-center mb-8`}>
                <span className="text-2xl font-semibold text-white tnum">{step.n}</span>
              </div>

              <h3 className="text-2xl md:text-3xl font-semibold tracking-tight mb-3">{step.title}</h3>
              <p className="text-[var(--color-fg-muted)] leading-relaxed mb-6">{step.desc}</p>

              <div className="mt-auto inline-flex self-start items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--color-bg-alt)] text-xs font-medium text-[var(--color-fg-muted)]">
                <svg className="size-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 6v6l4 2" strokeLinecap="round" />
                </svg>
                {step.badge}
              </div>
            </motion.div>
          ))}
        </div>

        <Reveal delay={0.4}>
          <div className="mt-12 rounded-3xl bg-[var(--color-fg)] p-10 md:p-14 text-white grid md:grid-cols-3 items-center gap-8">
            <div>
              <p className="text-white/60 text-sm mb-3">Tempo médio de setup</p>
              <p className="text-display-md text-white">10 min</p>
            </div>
            <p className="text-white/80 leading-relaxed md:col-span-1">
              Sem instalação. Sem migração. Sem treinamento. Você loga e está dentro — com seus
              dados reais já populando o dashboard.
            </p>
            <div className="md:text-right">
              <a href="#cta" className="inline-flex items-center gap-2 bg-white text-[var(--color-fg)] px-6 py-3 rounded-full font-medium hover:bg-white/90 transition-colors">
                Começar agora
                <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14M13 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </a>
            </div>
          </div>
        </Reveal>
      </Container>
    </section>
  )
}
