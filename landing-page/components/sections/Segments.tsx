'use client'

import { motion } from 'motion/react'
import { Container, Reveal } from '../primitives'

const ease = [0.22, 1, 0.36, 1] as const

const segments = [
  { name: 'Espumas & Colchões', detail: 'Blocos, densidade, M³', grad: 'grad-violet' },
  { name: 'Produtos de Limpeza', detail: 'Lotes, validade', grad: 'grad-cyan' },
  { name: 'Metalurgia', detail: 'Rastreabilidade', grad: 'grad-orange' },
  { name: 'Alimentos', detail: 'HACCP, validade', grad: 'grad-green' },
  { name: 'Têxtil', detail: 'Grade, tamanhos', grad: 'grad-pink' },
  { name: 'Logística', detail: 'Rotas, expedição', grad: 'grad-blue' },
]

export function Segments() {
  return (
    <section className="py-28 md:py-36 bg-[var(--color-bg-alt)]">
      <Container>
        <div className="max-w-[44ch] mb-16 md:mb-20">
          <Reveal>
            <p className="text-[var(--color-brand)] text-sm font-medium mb-4">Para qual indústria?</p>
            <h2 className="text-display-lg">
              A sua. <br />
              <span className="text-[var(--color-fg-muted)]">Independente de tamanho.</span>
            </h2>
            <p className="mt-6 text-lg text-[var(--color-fg-muted)] leading-relaxed">
              Cada segmento tem suas particularidades — densidade de espuma, lote de alimento, grade
              de tamanho. A gente cuida disso por baixo dos panos. Você só vê o número certo.
            </p>
          </Reveal>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {segments.map((s, i) => (
            <motion.div
              key={s.name}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.6, ease, delay: i * 0.05 }}
              className="rounded-3xl bg-white border border-[var(--color-line)] p-7 md:p-8 hover:shadow-lg hover:shadow-black/5 transition-shadow group"
            >
              <div className={`size-14 rounded-2xl ${s.grad} mb-6 group-hover:scale-105 transition-transform duration-500`} />
              <h3 className="text-xl font-semibold tracking-tight mb-1.5">{s.name}</h3>
              <p className="text-sm text-[var(--color-fg-muted)]">{s.detail}</p>
            </motion.div>
          ))}
        </div>
      </Container>
    </section>
  )
}
