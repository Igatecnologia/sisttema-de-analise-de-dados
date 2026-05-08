'use client'

import { motion } from 'motion/react'
import { Container, Eyebrow, Hairline, Reveal } from '../primitives'

const ease = [0.22, 1, 0.36, 1] as const

const segments = [
  { emoji: '🏭', name: 'Espumas & Colchões', detail: 'Blocos, densidade, M³' },
  { emoji: '🧴', name: 'Produtos de Limpeza', detail: 'Lotes, validade' },
  { emoji: '🔩', name: 'Metalurgia', detail: 'Rastreabilidade' },
  { emoji: '🍞', name: 'Alimentos', detail: 'HACCP, validade' },
  { emoji: '👕', name: 'Têxtil', detail: 'Grade, tamanhos' },
  { emoji: '📦', name: 'Logística', detail: 'Rotas, expedição' },
]

export function Segments() {
  return (
    <section className="relative py-32 md:py-40 grain">
      <Container>
        <Hairline className="mb-20 opacity-40" />

        <div className="grid grid-cols-12 gap-x-4 md:gap-x-8 mb-16 md:mb-20 items-end">
          <div className="col-span-12 md:col-span-5">
            <Reveal>
              <Eyebrow number="05" accent="gold">
                Segmentos
              </Eyebrow>
            </Reveal>
          </div>
          <div className="col-span-12 md:col-span-7 mt-8 md:mt-0">
            <Reveal delay={0.1}>
              <h2 className="text-display-lg font-display text-ink-50">
                Qualquer indústria. <span className="italic-accent">Qualquer</span> tamanho.
              </h2>
            </Reveal>
            <Reveal delay={0.2}>
              <p className="mt-6 text-lg text-ink-200 max-w-[58ch]">
                O IGA se adapta ao seu segmento via connectors específicos. O que muda? As fórmulas
                de classificação, os labels e as métricas. O resto é igual.
              </p>
            </Reveal>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-5">
          {segments.map((s, i) => (
            <motion.div
              key={s.name}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.6, ease, delay: i * 0.05 }}
              className="card-lift group flex items-center gap-5 rounded-2xl border border-ink-600/60 bg-ink-800/50 p-6"
            >
              <div className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-ink-700/60 text-3xl transition-transform duration-500 group-hover:rotate-6 group-hover:scale-110">
                {s.emoji}
              </div>
              <div>
                <h3 className="font-display text-xl text-ink-50 leading-none mb-1.5">{s.name}</h3>
                <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-300">
                  {s.detail}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </Container>
    </section>
  )
}
