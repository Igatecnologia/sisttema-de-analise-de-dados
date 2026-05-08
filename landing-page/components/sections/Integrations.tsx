'use client'

import { motion } from 'motion/react'
import { Container, Eyebrow, Hairline, Reveal } from '../primitives'

const ease = [0.22, 1, 0.36, 1] as const

const integrations = [
  { name: 'SGBR BI', status: 'ready', mono: 'SGBR' },
  { name: 'Bling', status: 'soon', mono: 'BLNG' },
  { name: 'Tiny ERP', status: 'soon', mono: 'TINY' },
  { name: 'Omie', status: 'soon', mono: 'OMIE' },
  { name: 'CSV / Excel', status: 'ready', mono: 'CSV' },
  { name: 'Custom API', status: 'ready', mono: 'API' },
  { name: 'Sankhya', status: 'roadmap', mono: 'SKHY' },
  { name: 'TOTVS', status: 'roadmap', mono: 'TVS' },
] as const

const statusMap = {
  ready: { label: 'Pronto', dot: 'bg-emerald-base', text: 'text-emerald-soft' },
  soon: { label: 'Em breve', dot: 'bg-gold-base', text: 'text-gold-soft' },
  roadmap: { label: 'Roadmap', dot: 'bg-ink-400', text: 'text-ink-300' },
}

export function Integrations() {
  return (
    <section id="integrations" className="relative py-32 md:py-40">
      <Container>
        <Hairline className="mb-20 opacity-40" />

        <div className="grid grid-cols-12 gap-x-4 md:gap-x-8 mb-16 md:mb-20 items-end">
          <div className="col-span-12 md:col-span-5">
            <Reveal>
              <Eyebrow number="04" accent="emerald">
                Integrações
              </Eyebrow>
            </Reveal>
          </div>
          <div className="col-span-12 md:col-span-7 mt-8 md:mt-0">
            <Reveal delay={0.1}>
              <h2 className="text-display-lg font-display text-ink-50">
                Conecta no ERP que <span className="italic-accent">você já</span> tem.
              </h2>
            </Reveal>
            <Reveal delay={0.2}>
              <p className="mt-6 text-lg text-ink-200 max-w-[58ch]">
                Cinco connectors prontos. Qualquer API REST integrada em até 48h. Você não migra de
                ERP — você só ganha o BI que faltava.
              </p>
            </Reveal>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-px bg-ink-600/40 border border-ink-600/40 rounded-xl overflow-hidden">
          {integrations.map((i, idx) => {
            const s = statusMap[i.status]
            return (
              <motion.div
                key={i.name}
                initial={{ opacity: 0, scale: 0.96 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ duration: 0.5, ease, delay: idx * 0.04 }}
                className="group relative bg-ink-900 p-6 md:p-7 transition-colors duration-400 hover:bg-ink-800"
              >
                {/* Faux logo monogram */}
                <div className="mb-5 flex h-14 items-center">
                  <span className="font-display text-3xl tracking-tight text-ink-100 group-hover:text-ink-50 transition-colors">
                    {i.mono}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-ink-100">{i.name}</span>
                  <span className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.18em]">
                    <span className={`size-1 rounded-full ${s.dot}`} />
                    <span className={s.text}>{s.label}</span>
                  </span>
                </div>
              </motion.div>
            )
          })}
        </div>

        <Reveal delay={0.3}>
          <p className="mt-10 text-center text-ink-200">
            Não encontrou o seu? <a href="#cta" className="link-underline text-emerald-soft">Fale conosco</a>
            {' '}— integramos qualquer API REST em até 48h.
          </p>
        </Reveal>
      </Container>
    </section>
  )
}
