'use client'

import { motion } from 'motion/react'
import { Container, Reveal } from '../primitives'
import { SpotlightCard } from '../magic/SpotlightCard'

const ease = [0.22, 1, 0.36, 1] as const

const integrations = [
  { name: 'SGBR BI', mono: 'SGBR', status: 'ready' },
  { name: 'Bling', mono: 'BLNG', status: 'soon' },
  { name: 'Tiny ERP', mono: 'TINY', status: 'soon' },
  { name: 'Omie', mono: 'OMIE', status: 'soon' },
  { name: 'CSV / Excel', mono: 'CSV', status: 'ready' },
  { name: 'Custom API', mono: 'API', status: 'ready' },
  { name: 'Sankhya', mono: 'SKHY', status: 'roadmap' },
  { name: 'TOTVS', mono: 'TVS', status: 'roadmap' },
] as const

const statusMap = {
  ready: { label: 'Pronto', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  soon: { label: 'Em breve', cls: 'bg-orange-50 text-orange-700 border-orange-200' },
  roadmap: { label: 'Roadmap', cls: 'bg-[var(--color-bg-alt)] text-[var(--color-fg-muted)] border-[var(--color-line)]' },
}

export function Integrations() {
  return (
    <section id="integrations" className="py-28 md:py-36 bg-white">
      <Container>
        <div className="max-w-[44ch] mb-16 md:mb-20">
          <Reveal>
            <p className="text-[var(--color-brand)] text-sm font-medium mb-4">Integrações</p>
            <h2 className="text-display-lg">
              Conecta no ERP que <br />
              <span className="text-[var(--color-fg-muted)]">você já tem.</span>
            </h2>
            <p className="mt-6 text-lg text-[var(--color-fg-muted)] leading-relaxed">
              Cinco connectors prontos. Qualquer API REST integrada em até 48h.
            </p>
          </Reveal>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
          {integrations.map((i, idx) => {
            const s = statusMap[i.status]
            return (
              <motion.div
                key={i.name}
                initial={{ opacity: 0, scale: 0.97 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ duration: 0.5, ease, delay: idx * 0.04 }}
              >
                <SpotlightCard
                  glow="#0052ff"
                  size={240}
                  className="card-flat group p-6 flex flex-col justify-between min-h-[140px] h-full"
                >
                  <span className="text-2xl font-semibold tracking-tight">{i.mono}</span>
                  <div className="flex items-center justify-between mt-4">
                    <span className="text-sm text-[var(--color-fg-muted)]">{i.name}</span>
                    <span className={`px-2.5 py-1 rounded-full text-[11px] font-medium border ${s.cls}`}>
                      {s.label}
                    </span>
                  </div>
                </SpotlightCard>
              </motion.div>
            )
          })}
        </div>

        <Reveal delay={0.3}>
          <p className="mt-10 text-center text-[var(--color-fg-muted)]">
            Não encontrou o seu?{' '}
            <a href="#cta" className="text-[var(--color-brand)] font-medium hover:underline">
              Fale conosco
            </a>{' '}
            — integramos qualquer API REST em até 48h.
          </p>
        </Reveal>
      </Container>
    </section>
  )
}
