'use client'

import { motion } from 'motion/react'
import { Container, Eyebrow, Hairline, Reveal } from '../primitives'

const ease = [0.22, 1, 0.36, 1] as const

const features = [
  {
    n: '01',
    title: 'Dashboard Executivo',
    desc: 'Faturamento, margem, clientes, top produtos — tudo em uma tela.',
    icon: 'chart',
    color: 'emerald' as const,
  },
  {
    n: '02',
    title: 'Produção em Tempo Real',
    desc: 'O que foi produzido, consumo de matéria-prima, OEE por linha.',
    icon: 'factory',
    color: 'gold' as const,
  },
  {
    n: '03',
    title: 'Estoque Inteligente',
    desc: 'Matéria-prima e produto final, com alerta automático de criticidade.',
    icon: 'box',
    color: 'cobalt' as const,
  },
  {
    n: '04',
    title: 'Financeiro Completo',
    desc: 'Contas a pagar, superávit/déficit, notas fiscais conciliadas.',
    icon: 'cash',
    color: 'emerald' as const,
  },
  {
    n: '05',
    title: 'Compras & Fornecedores',
    desc: 'Histórico de compras, ticket médio, top fornecedores por volume.',
    icon: 'truck',
    color: 'gold' as const,
  },
  {
    n: '06',
    title: 'IA Copilot',
    desc: 'Pergunte qualquer coisa. O copiloto busca os dados e responde.',
    icon: 'sparkles',
    color: 'cobalt' as const,
  },
]

const colorClass = {
  emerald: { bg: 'bg-emerald-base/10', text: 'text-emerald-soft', dot: 'bg-emerald-base' },
  gold: { bg: 'bg-gold-base/10', text: 'text-gold-soft', dot: 'bg-gold-base' },
  cobalt: { bg: 'bg-cobalt-base/10', text: 'text-cobalt-soft', dot: 'bg-cobalt-base' },
}

export function Features() {
  return (
    <section id="features" className="relative py-32 md:py-40">
      <Container>
        <Hairline className="mb-20 opacity-40" />

        <div className="grid grid-cols-12 gap-x-4 md:gap-x-8 mb-16 md:mb-24 items-end">
          <div className="col-span-12 md:col-span-5">
            <Reveal>
              <Eyebrow number="02" accent="emerald">
                O produto
              </Eyebrow>
            </Reveal>
          </div>
          <div className="col-span-12 md:col-span-7 mt-8 md:mt-0">
            <Reveal delay={0.1}>
              <h2 className="text-display-lg font-display text-ink-50">
                Nove módulos. <span className="italic-accent">Uma</span> superfície.
              </h2>
            </Reveal>
            <Reveal delay={0.2}>
              <p className="mt-6 text-lg text-ink-200 max-w-[60ch]">
                Cada módulo conversa com os outros. Quando você abre o dashboard, está olhando para
                a verdade do seu ERP — agregada, normalizada e atualizada.
              </p>
            </Reveal>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
          {features.map((f, i) => {
            const c = colorClass[f.color]
            return (
              <motion.article
                key={f.title}
                initial={{ opacity: 0, y: 32 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 0.6, ease, delay: i * 0.06 }}
                className="card-lift group relative overflow-hidden rounded-2xl border border-ink-600/60 bg-ink-800/70 p-7 md:p-8"
              >
                {/* Decorative number */}
                <span
                  className={`absolute right-4 top-4 font-display text-7xl ${c.text} opacity-15 transition-opacity duration-500 group-hover:opacity-30`}
                >
                  {f.n}
                </span>

                <div
                  className={`mb-6 flex size-11 items-center justify-center rounded-xl ${c.bg} ${c.text}`}
                >
                  <FeatureIcon name={f.icon} />
                </div>

                <h3 className="text-2xl font-display text-ink-50 mb-2.5">{f.title}</h3>
                <p className="text-sm leading-relaxed text-ink-200">{f.desc}</p>

                <div className="mt-6 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-300">
                  <span className={`size-1 rounded-full ${c.dot}`} />
                  Disponível agora
                </div>
              </motion.article>
            )
          })}
        </div>
      </Container>
    </section>
  )
}

function FeatureIcon({ name }: { name: string }) {
  const cls = 'size-5'
  switch (name) {
    case 'chart':
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" strokeLinecap="round" />
        </svg>
      )
    case 'factory':
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 21V9l5 3V9l5 3V9l5 3v9z" strokeLinejoin="round" />
          <path d="M9 21v-4M14 21v-4M3 21h18" strokeLinecap="round" />
        </svg>
      )
    case 'box':
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 8L12 3 3 8v8l9 5 9-5z" strokeLinejoin="round" />
          <path d="M3 8l9 5 9-5M12 13v8" />
        </svg>
      )
    case 'cash':
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="2" y="6" width="20" height="12" rx="2" />
          <circle cx="12" cy="12" r="2.5" />
          <path d="M6 12h.01M18 12h.01" strokeLinecap="round" />
        </svg>
      )
    case 'truck':
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 7h12v10H3zM15 11h4l3 4v2h-7" strokeLinejoin="round" />
          <circle cx="7" cy="18" r="2" />
          <circle cx="18" cy="18" r="2" />
        </svg>
      )
    case 'sparkles':
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 3l2 5 5 2-5 2-2 5-2-5-5-2 5-2zM19 14l1 2 2 1-2 1-1 2-1-2-2-1 2-1zM5 14l1 2 2 1-2 1-1 2-1-2-2-1 2-1z" strokeLinejoin="round" />
        </svg>
      )
    default:
      return null
  }
}
