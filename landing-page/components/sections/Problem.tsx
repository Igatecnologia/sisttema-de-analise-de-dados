'use client'

import { motion } from 'motion/react'
import { Container, Reveal } from '../primitives'

const ease = [0.22, 1, 0.36, 1] as const

const cards = [
  {
    type: 'bad' as const,
    title: 'Planilhas',
    desc: 'Manuais, desatualizadas, sem versionamento. Cada gestor tem a sua e nenhuma fala com a outra.',
  },
  {
    type: 'bad' as const,
    title: 'ERP pesado',
    desc: 'Caro, lento, com 500 telas. Você usa 10% das funcionalidades e paga por 100% delas.',
  },
  {
    type: 'good' as const,
    title: 'IGA Gestão',
    desc: 'Conecta no ERP que você já tem. Dashboard de classe mundial em 10 minutos. IA Copilot inclusa.',
  },
]

export function Problem() {
  return (
    <section className="py-28 md:py-36 bg-[var(--color-bg-alt)]">
      <Container>
        <div className="max-w-[40ch] mb-16 md:mb-20">
          <Reveal>
            <h2 className="text-display-lg">
              Você já tem ERP. <br />
              <span className="text-[var(--color-fg-muted)]">O problema é usar os dados.</span>
            </h2>
          </Reveal>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {cards.map((card, i) => (
            <motion.div
              key={card.title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.7, ease, delay: i * 0.08 }}
              className={`rounded-3xl p-8 md:p-10 ${
                card.type === 'good'
                  ? 'bg-[var(--color-fg)] text-white'
                  : 'bg-white border border-[var(--color-line)]'
              }`}
            >
              <div className="mb-12">
                {card.type === 'good' ? (
                  <div className="size-12 rounded-2xl grad-blue flex items-center justify-center">
                    <svg className="size-6 text-white" viewBox="0 0 24 24" fill="none">
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
                  <div className="size-12 rounded-2xl bg-[var(--color-bg-alt)] flex items-center justify-center">
                    <svg className="size-6 text-[var(--color-fg-muted)]" viewBox="0 0 24 24" fill="none">
                      <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </div>
                )}
              </div>

              <h3
                className={`text-2xl md:text-3xl font-semibold tracking-tight mb-4 ${
                  card.type === 'good' ? 'text-white' : ''
                }`}
              >
                {card.title}
              </h3>
              <p
                className={`text-base leading-relaxed ${
                  card.type === 'good' ? 'text-white/70' : 'text-[var(--color-fg-muted)]'
                }`}
              >
                {card.desc}
              </p>
            </motion.div>
          ))}
        </div>
      </Container>
    </section>
  )
}
