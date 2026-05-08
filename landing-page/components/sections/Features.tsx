'use client'

import Image from 'next/image'
import { motion } from 'motion/react'
import { Container, Reveal } from '../primitives'

const ease = [0.22, 1, 0.36, 1] as const

const featureSummary = [
  { t: 'Compras & Fornecedores', d: 'Histórico, ticket médio, top por volume.', icon: 'truck' },
  { t: 'Relatórios agendados', d: 'PDF/Excel automático no e-mail da liderança.', icon: 'mail' },
  { t: 'Webhooks & API', d: 'Integração enterprise com retry exponencial.', icon: 'plug' },
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
              Cada módulo conversa com os outros. Você abre o sistema e está olhando para a verdade
              da sua fábrica — agregada, normalizada e atualizada em tempo real.
            </p>
          </Reveal>
        </div>

        {/* Bento com prints reais */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Hero card — Dashboard */}
          <FeatureCardWithImage
            className="lg:col-span-7"
            grad="grad-blue"
            icon="chart"
            title="Visão executiva do dia"
            desc="Faturamento, margem, top clientes, KPIs em tempo real. Você abre e em 3 segundos sabe se hoje está bom ou não."
            image="/screenshots/dashboard-desktop.png"
            imageAlt="Tela de visão do gestor com indicadores e atalhos"
            delay={0}
          />

          {/* Copilot */}
          <FeatureCardWithImage
            className="lg:col-span-5"
            grad="grad-mesh"
            icon="sparkles"
            title="Pergunte. O Copilot responde."
            desc="IA com tool-calling: busca seus dados reais e responde em português. Sem alucinação — se não achou, ele diz."
            image={null}
            imageAlt=""
            delay={0.1}
            renderExtra={
              <div className="mt-6 rounded-2xl bg-white/10 backdrop-blur p-4 border border-white/15">
                <p className="text-sm text-white/85 mb-2">
                  &ldquo;Quem foi o cliente que mais cresceu este mês?&rdquo;
                </p>
                <p className="text-sm text-white">
                  <span className="font-medium">Tex Norte</span> cresceu{' '}
                  <span className="font-semibold text-emerald-300">+34%</span> em faturamento.
                </p>
              </div>
            }
          />

          {/* Produção */}
          <FeatureCardWithImage
            className="lg:col-span-4"
            grad="grad-orange"
            icon="factory"
            title="Produção em tempo real"
            desc="O que foi produzido, consumo de matéria-prima, OEE por linha — sem ligar pra fábrica."
            image="/screenshots/producao-desktop.png"
            imageAlt="Tela de produção do IGA Gestão"
            delay={0.15}
          />

          {/* Estoque */}
          <FeatureCardWithImage
            className="lg:col-span-4"
            grad="grad-cyan"
            icon="box"
            title="Estoque que avisa"
            desc="Crítico em destaque. Você não descobre que faltou matéria-prima quando o pedido travou."
            image="/screenshots/estoque-desktop.png"
            imageAlt="Tela de estoque com itens críticos"
            delay={0.2}
          />

          {/* Financeiro */}
          <FeatureCardWithImage
            className="lg:col-span-4"
            grad="grad-violet"
            icon="cash"
            title="Financeiro conciliado"
            desc="Contas a pagar, superávit/déficit, notas fiscais. Sem aquela conferência manual de sexta."
            image="/screenshots/financeiro-desktop.png"
            imageAlt="Tela de financeiro com contas e indicadores"
            delay={0.25}
          />
        </div>

        {/* Linha bonus */}
        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          {featureSummary.map((f, i) => (
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

function FeatureCardWithImage({
  className,
  grad,
  icon,
  title,
  desc,
  image,
  imageAlt,
  delay,
  renderExtra,
}: {
  className: string
  grad: string
  icon: string
  title: string
  desc: string
  image: string | null
  imageAlt: string
  delay: number
  renderExtra?: React.ReactNode
}) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 32 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.7, ease, delay }}
      className={`group relative ${className} rounded-3xl ${grad} overflow-hidden text-white`}
    >
      <div
        aria-hidden
        className="absolute -bottom-20 -right-20 size-72 rounded-full bg-white/10 blur-3xl group-hover:scale-110 transition-transform duration-700 ease-out"
      />

      <div className="relative p-8 md:p-10">
        <div className="size-12 rounded-2xl bg-white/15 backdrop-blur flex items-center justify-center text-white mb-6">
          <FeatureIcon name={icon} />
        </div>
        <h3 className="text-2xl md:text-3xl font-semibold tracking-tight mb-3 max-w-[18ch]">
          {title}
        </h3>
        <p className="text-white/85 text-base leading-relaxed max-w-[36ch]">{desc}</p>
        {renderExtra}
      </div>

      {image && (
        <div className="relative mx-8 md:mx-10 mb-0 mt-2 rounded-t-2xl border border-white/15 overflow-hidden bg-white">
          <div className="relative aspect-[16/9] md:aspect-[16/8]">
            <Image
              src={image}
              alt={imageAlt}
              fill
              sizes="(max-width: 1024px) 100vw, 600px"
              className="object-cover object-top"
            />
          </div>
        </div>
      )}
    </motion.article>
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
