'use client'

import { motion } from 'motion/react'
import { Container, Eyebrow, Hairline, Reveal } from '../primitives'

const ease = [0.22, 1, 0.36, 1] as const

const cards = [
  {
    type: 'bad' as const,
    title: 'Planilhas',
    desc: 'Dados manuais, desatualizados, sem versionamento. Cada gestor tem a sua e nenhuma fala.',
    bullets: ['Erros de fórmula viram decisão errada', 'Sem histórico real', 'Não escala'],
  },
  {
    type: 'bad' as const,
    title: 'ERP pesado',
    desc: 'Caro, lento, com 500 telas. Você usa 10% e paga por 100%.',
    bullets: ['Implantação de 6 meses', 'Sem BI real', 'Treinamento pesado'],
  },
  {
    type: 'good' as const,
    title: 'IGA Gestão',
    desc: 'Conecta no ERP que você já tem. Dashboard de classe mundial em 10 minutos.',
    bullets: ['Setup em minutos', 'Copilot com IA', 'API agnóstica'],
  },
]

export function Problem() {
  return (
    <section className="relative py-32 md:py-40 grain">
      <Container>
        <Hairline className="mb-20 opacity-40" />

        <div className="grid grid-cols-12 gap-x-4 md:gap-x-8 mb-16 md:mb-24 items-end">
          <div className="col-span-12 md:col-span-5">
            <Reveal>
              <Eyebrow number="01" accent="gold">
                O problema
              </Eyebrow>
            </Reveal>
          </div>
          <div className="col-span-12 md:col-span-7 mt-8 md:mt-0">
            <Reveal delay={0.1}>
              <h2 className="text-display-lg font-display text-ink-50 max-w-[18ch]">
                Você já tem um ERP. O <span className="italic-accent">problema</span> é usar os dados.
              </h2>
            </Reveal>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-ink-600/40 border border-ink-600/40 rounded-xl overflow-hidden">
          {cards.map((card, i) => (
            <motion.div
              key={card.title}
              initial={{ opacity: 0, y: 32 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.7, ease, delay: i * 0.1 }}
              className={`relative p-8 md:p-10 ${
                card.type === 'good' ? 'bg-ink-800' : 'bg-ink-900'
              }`}
            >
              {/* Marker */}
              <div className="mb-8 flex items-center justify-between">
                <span
                  className={`font-mono text-[10px] uppercase tracking-[0.2em] ${
                    card.type === 'good' ? 'text-emerald-soft' : 'text-ink-300'
                  }`}
                >
                  {String(i + 1).padStart(2, '0')} · {card.type === 'good' ? 'Solução' : 'Status quo'}
                </span>
                {card.type === 'good' ? (
                  <div className="flex size-8 items-center justify-center rounded-full bg-emerald-base/15">
                    <svg className="size-4 text-emerald-soft" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M5 13l4 4L19 7"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                ) : (
                  <div className="flex size-8 items-center justify-center rounded-full bg-ink-700">
                    <svg className="size-4 text-ink-300" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M6 6l12 12M18 6L6 18"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                    </svg>
                  </div>
                )}
              </div>

              <h3
                className={`text-3xl font-display mb-4 ${
                  card.type === 'good' ? 'text-emerald-soft' : 'text-ink-100'
                }`}
              >
                {card.title}
              </h3>
              <p className="text-ink-200 leading-relaxed mb-6">{card.desc}</p>

              <ul className="space-y-2">
                {card.bullets.map((b) => (
                  <li
                    key={b}
                    className="flex items-start gap-2 text-sm text-ink-100/80 font-mono text-[12px]"
                  >
                    <span
                      className={`mt-1.5 size-1 rounded-full shrink-0 ${
                        card.type === 'good' ? 'bg-emerald-base' : 'bg-ink-400'
                      }`}
                    />
                    {b}
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>
      </Container>
    </section>
  )
}
