'use client'

import { motion } from 'motion/react'
import { Container, Reveal } from '../primitives'

const ease = [0.22, 1, 0.36, 1] as const

const features = [
  {
    title: 'Dashboard Executivo',
    desc: 'Faturamento, margem, clientes, top produtos — tudo em uma tela viva.',
    grad: 'grad-blue',
    icon: 'chart',
    span: 'lg:col-span-7',
    height: 'lg:h-[420px]',
  },
  {
    title: 'Copilot IA',
    desc: 'Pergunte em português. O copiloto consulta seus dados reais e responde.',
    grad: 'grad-mesh',
    icon: 'sparkles',
    span: 'lg:col-span-5',
    height: 'lg:h-[420px]',
  },
  {
    title: 'Produção em tempo real',
    desc: 'O que foi produzido, consumo de matéria-prima, OEE por linha.',
    grad: 'grad-orange',
    icon: 'factory',
    span: 'lg:col-span-4',
    height: 'lg:h-[380px]',
  },
  {
    title: 'Estoque inteligente',
    desc: 'Crítico em destaque. Matéria-prima e produto final, alerta automático.',
    grad: 'grad-cyan',
    icon: 'box',
    span: 'lg:col-span-4',
    height: 'lg:h-[380px]',
  },
  {
    title: 'Financeiro completo',
    desc: 'Contas a pagar, superávit/déficit, notas fiscais conciliadas.',
    grad: 'grad-violet',
    icon: 'cash',
    span: 'lg:col-span-4',
    height: 'lg:h-[380px]',
  },
]

export function Features() {
  return (
    <section id="features" className="py-28 md:py-36 bg-white">
      <Container>
        <div className="max-w-[44ch] mb-16 md:mb-20">
          <Reveal>
            <p className="text-[var(--color-brand)] text-sm font-medium mb-4">O produto</p>
            <h2 className="text-display-lg">
              Nove módulos.{' '}
              <span className="text-[var(--color-fg-muted)]">Uma superfície.</span>
            </h2>
            <p className="mt-6 text-lg text-[var(--color-fg-muted)] leading-relaxed">
              Cada módulo conversa com os outros. Quando você abre o dashboard, está olhando para
              a verdade do seu ERP — agregada, normalizada e atualizada.
            </p>
          </Reveal>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {features.map((f, i) => (
            <motion.article
              key={f.title}
              initial={{ opacity: 0, y: 32 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.7, ease, delay: i * 0.06 }}
              className={`relative ${f.span} ${f.height} rounded-3xl ${f.grad} overflow-hidden p-8 md:p-10 text-white group`}
            >
              {/* Decorative shape */}
              <div
                aria-hidden
                className="absolute -bottom-20 -right-20 size-72 rounded-full bg-white/10 blur-3xl group-hover:scale-110 transition-transform duration-700 ease-out"
              />

              <div className="relative flex flex-col h-full">
                <div className="size-12 rounded-2xl bg-white/15 backdrop-blur flex items-center justify-center text-white mb-6">
                  <FeatureIcon name={f.icon} />
                </div>

                <h3 className="text-2xl md:text-3xl font-semibold tracking-tight mb-3 max-w-[16ch]">
                  {f.title}
                </h3>
                <p className="text-white/85 text-base leading-relaxed max-w-[34ch]">{f.desc}</p>

                <div className="mt-auto pt-6">
                  <a
                    href="#cta"
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-white hover:gap-2.5 transition-all"
                  >
                    Saiba mais
                    <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M5 12h14M13 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </a>
                </div>
              </div>
            </motion.article>
          ))}
        </div>

        {/* Compras + Relatórios + Vendas linha bonus */}
        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { t: 'Compras & Fornecedores', d: 'Histórico, ticket médio, top por volume.', icon: 'truck' },
            { t: 'Relatórios agendados', d: 'PDF/Excel automático no e-mail da liderança.', icon: 'mail' },
            { t: 'Webhooks & API', d: 'Integração enterprise com retry exponencial.', icon: 'plug' },
          ].map((f, i) => (
            <motion.div
              key={f.t}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.6, ease, delay: i * 0.05 }}
              className="card-flat p-7 md:p-8"
            >
              <div className="size-10 rounded-xl bg-[var(--color-bg-alt)] flex items-center justify-center text-[var(--color-fg)] mb-5">
                <FeatureIcon name={f.icon} />
              </div>
              <h4 className="text-lg font-semibold tracking-tight mb-2">{f.t}</h4>
              <p className="text-sm text-[var(--color-fg-muted)] leading-relaxed">{f.d}</p>
            </motion.div>
          ))}
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
          <path d="M3 21h18" strokeLinecap="round" />
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
        </svg>
      )
    case 'sparkles':
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 3l2 5 5 2-5 2-2 5-2-5-5-2 5-2zM19 14l1 2 2 1-2 1-1 2-1-2-2-1 2-1z" strokeLinejoin="round" />
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
    case 'mail':
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="M3 7l9 6 9-6" strokeLinejoin="round" />
        </svg>
      )
    case 'plug':
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M9 2v6M15 2v6M6 8h12v3a6 6 0 01-12 0zM12 17v5" strokeLinecap="round" />
        </svg>
      )
    default:
      return null
  }
}
