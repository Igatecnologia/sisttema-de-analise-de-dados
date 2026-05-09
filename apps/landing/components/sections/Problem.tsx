'use client'

import { motion } from 'motion/react'
import { Check, X } from 'lucide-react'
import { Container, Reveal } from '../primitives'

const ease = [0.22, 1, 0.36, 1] as const

const cards = [
  {
    type: 'bad' as const,
    title: 'Planilha de toda segunda',
    desc: 'O gerente compila no Excel, manda no grupo, alguém pergunta o número, ninguém sabe se está atualizado. Toda. Santa. Segunda.',
  },
  {
    type: 'bad' as const,
    title: 'ERP que ninguém abre',
    desc: 'Você paga R$ 2 mil por mês e usa 10% das funcionalidades. As 90% restantes? Esperam alguém com 3 dias livres pra aprender.',
  },
  {
    type: 'good' as const,
    title: 'IGA — gestão que aparece pronta',
    desc: 'Conecta no seu ERP atual, normaliza os dados e te entrega dashboard, alertas e Copilot IA. Em dez minutos.',
  },
]

export function Problem() {
  return (
    <section className="py-28 md:py-36 bg-[var(--color-bg-alt)]">
      <Container>
        <div className="max-w-[44ch] mb-16 md:mb-20">
          <Reveal>
            <p className="text-[var(--color-brand)] text-sm font-medium mb-4">O dia a dia</p>
            <h2 className="text-display-lg">
              Você já paga ERP. <br />
              <span className="text-[var(--color-fg-muted)]">Mas e os dados, onde estão?</span>
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
                    <Check className="size-6 text-white" strokeWidth={2.5} />
                  </div>
                ) : (
                  <div className="size-12 rounded-2xl bg-[var(--color-bg-alt)] flex items-center justify-center">
                    <X className="size-6 text-[var(--color-fg-muted)]" strokeWidth={2} />
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
                  card.type === 'good' ? 'text-white/75' : 'text-[var(--color-fg-muted)]'
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
