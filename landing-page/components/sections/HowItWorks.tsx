'use client'

import { motion } from 'motion/react'
import { Container, Eyebrow, Hairline, Reveal } from '../primitives'

const ease = [0.22, 1, 0.36, 1] as const

const steps = [
  {
    n: '01',
    title: 'Conecte',
    desc: 'Informe a URL e credenciais do seu ERP. Validamos a conexão na hora.',
    detail: 'Suporta REST, OAuth2, Bearer, Basic Auth.',
    duration: '~3 min',
  },
  {
    n: '02',
    title: 'Configure',
    desc: 'Escolha quais módulos usar e mapeie campos. Templates por segmento.',
    detail: 'Bling, Tiny, Omie, SGBR têm presets prontos.',
    duration: '~5 min',
  },
  {
    n: '03',
    title: 'Use',
    desc: 'Dashboards, alertas, relatórios e Copilot — tudo populado em tempo real.',
    detail: 'Convide a equipe e personalize permissões.',
    duration: '~2 min',
  },
]

export function HowItWorks() {
  return (
    <section id="how" className="relative py-32 md:py-40 grain">
      <Container>
        <Hairline className="mb-20 opacity-40" />

        <div className="grid grid-cols-12 gap-x-4 md:gap-x-8 mb-20 md:mb-28 items-end">
          <div className="col-span-12 md:col-span-5">
            <Reveal>
              <Eyebrow number="03" accent="cobalt">
                Como funciona
              </Eyebrow>
            </Reveal>
          </div>
          <div className="col-span-12 md:col-span-7 mt-8 md:mt-0">
            <Reveal delay={0.1}>
              <h2 className="text-display-lg font-display text-ink-50">
                Três passos. <span className="italic-accent">Dez</span> minutos.
              </h2>
            </Reveal>
          </div>
        </div>

        {/* Connecting line decorativa */}
        <div className="relative">
          <motion.div
            initial={{ scaleX: 0 }}
            whileInView={{ scaleX: 1 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 1.4, ease }}
            className="hidden md:block absolute top-[58px] left-[12%] right-[12%] h-px bg-gradient-to-r from-transparent via-ink-400 to-transparent origin-left"
          />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-6 relative">
            {steps.map((step, i) => (
              <motion.div
                key={step.n}
                initial={{ opacity: 0, y: 32 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-80px' }}
                transition={{ duration: 0.7, ease, delay: i * 0.15 }}
                className="relative"
              >
                {/* Big number circle */}
                <div className="relative mx-auto md:mx-0 mb-8 flex size-28 items-center justify-center">
                  <div className="absolute inset-0 rounded-full border border-ink-500/60" />
                  <div className="absolute inset-2 rounded-full border border-ink-600/40" />
                  <div
                    className="absolute inset-0 rounded-full"
                    style={{
                      background:
                        i === 0
                          ? 'radial-gradient(circle, rgba(16,185,129,0.08), transparent 65%)'
                          : i === 1
                            ? 'radial-gradient(circle, rgba(245,166,35,0.08), transparent 65%)'
                            : 'radial-gradient(circle, rgba(74,171,224,0.08), transparent 65%)',
                    }}
                  />
                  <span className="relative font-display text-5xl text-ink-50">{step.n}</span>
                </div>

                <h3 className="text-3xl font-display text-ink-50 mb-3">{step.title}</h3>
                <p className="text-ink-200 leading-relaxed mb-4 max-w-[36ch]">{step.desc}</p>

                <div className="flex items-center gap-2 font-mono text-[11px] text-ink-300">
                  <span className="size-1 rounded-full bg-ink-400" />
                  <span>{step.detail}</span>
                </div>

                <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-ink-600/60 bg-ink-800/60 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-200">
                  <svg className="size-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 6v6l4 2" strokeLinecap="round" />
                  </svg>
                  {step.duration}
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Bottom callout */}
        <Reveal delay={0.4}>
          <div className="mt-20 md:mt-28 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 rounded-2xl border border-ink-600/60 bg-ink-800/40 p-8 md:p-10">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-300 mb-3">
                Tempo médio de setup
              </div>
              <div className="text-display-lg font-display text-ink-50">
                10 <span className="italic-accent">min</span>
              </div>
            </div>
            <div className="text-ink-200 max-w-[42ch]">
              Sem instalação. Sem migração. Sem treinamento. Você loga e está dentro — com seus
              dados reais já populando o dashboard.
            </div>
            <a
              href="#cta"
              className="btn-emerald-glow inline-flex shrink-0 items-center gap-2 rounded-full bg-emerald-base px-6 py-3 text-sm font-medium text-ink-950"
            >
              Começar agora →
            </a>
          </div>
        </Reveal>
      </Container>
    </section>
  )
}
