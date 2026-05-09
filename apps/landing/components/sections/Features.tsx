'use client'

import Image from 'next/image'
import { motion } from 'motion/react'
import {
  BarChart3,
  Factory,
  Boxes,
  Banknote,
  Sparkles,
  Truck,
  Mail,
  Plug,
  type LucideIcon,
} from 'lucide-react'
import { Container, Reveal } from '../primitives'
import { SpotlightCard } from '../magic/SpotlightCard'

const ease = [0.22, 1, 0.36, 1] as const

const featureSummary = [
  { t: 'Compras & Fornecedores', d: 'Histórico, ticket médio, top por volume.', Icon: Truck },
  { t: 'Relatórios agendados', d: 'PDF/Excel automático no e-mail da liderança.', Icon: Mail },
  { t: 'Webhooks & API', d: 'Integração enterprise com retry exponencial.', Icon: Plug },
] as const

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
          <FeatureCardWithImage
            className="lg:col-span-7"
            grad="grad-blue"
            Icon={BarChart3}
            title="Visão executiva do dia"
            desc="Faturamento, margem, top clientes, KPIs em tempo real. Você abre e em 3 segundos sabe se hoje está bom ou não."
            image="/screenshots/dashboard-desktop.png"
            imageAlt="Tela de visão do gestor com indicadores e atalhos"
            delay={0}
          />

          <FeatureCardWithImage
            className="lg:col-span-5"
            grad="grad-mesh"
            Icon={Sparkles}
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

          <FeatureCardWithImage
            className="lg:col-span-4"
            grad="grad-orange"
            Icon={Factory}
            title="Produção em tempo real"
            desc="O que foi produzido, consumo de matéria-prima, OEE por linha — sem ligar pra fábrica."
            image="/screenshots/producao-desktop.png"
            imageAlt="Tela de produção do IGA Gestão"
            delay={0.15}
          />

          <FeatureCardWithImage
            className="lg:col-span-4"
            grad="grad-cyan"
            Icon={Boxes}
            title="Estoque que avisa"
            desc="Crítico em destaque. Você não descobre que faltou matéria-prima quando o pedido travou."
            image="/screenshots/estoque-desktop.png"
            imageAlt="Tela de estoque com itens críticos"
            delay={0.2}
          />

          <FeatureCardWithImage
            className="lg:col-span-4"
            grad="grad-violet"
            Icon={Banknote}
            title="Financeiro conciliado"
            desc="Contas a pagar, superávit/déficit, notas fiscais. Sem aquela conferência manual de sexta."
            image="/screenshots/financeiro-desktop.png"
            imageAlt="Tela de financeiro com contas e indicadores"
            delay={0.25}
          />
        </div>

        {/* Linha bonus — agora com SpotlightCard */}
        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          {featureSummary.map((f, i) => (
            <motion.div
              key={f.t}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.6, ease, delay: i * 0.05 }}
            >
              <SpotlightCard
                glow="#0052ff"
                size={320}
                className="card-flat group p-7 md:p-8 h-full"
              >
                <div className="size-10 rounded-xl bg-[var(--color-bg-alt)] flex items-center justify-center text-[var(--color-fg)] mb-5">
                  <f.Icon className="size-5" strokeWidth={1.75} />
                </div>
                <h4 className="text-lg font-semibold tracking-tight mb-2">{f.t}</h4>
                <p className="text-sm text-[var(--color-fg-muted)] leading-relaxed">{f.d}</p>
              </SpotlightCard>
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
  Icon,
  title,
  desc,
  image,
  imageAlt,
  delay,
  renderExtra,
}: {
  className: string
  grad: string
  Icon: LucideIcon
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
          <Icon className="size-5" strokeWidth={1.75} />
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
