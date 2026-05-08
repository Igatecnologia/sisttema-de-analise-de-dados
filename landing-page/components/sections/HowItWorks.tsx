'use client'

import Image from 'next/image'
import { motion } from 'motion/react'
import { Container, Reveal } from '../primitives'

const ease = [0.22, 1, 0.36, 1] as const

const steps = [
  {
    n: '01',
    title: 'Conecte seu ERP',
    desc: 'Cole a URL e as credenciais. A gente testa a conexão na sua frente. Funcionou? Próximo.',
    badge: '~3 min',
    grad: 'grad-blue',
  },
  {
    n: '02',
    title: 'Escolha o que importa',
    desc: 'Marque os módulos que sua operação usa. Pulamos o resto. Templates prontos por segmento.',
    badge: '~5 min',
    grad: 'grad-violet',
  },
  {
    n: '03',
    title: 'Comece a usar',
    desc: 'Dashboards populados, Copilot ativo, equipe convidada. Pronto para a próxima reunião.',
    badge: '~2 min',
    grad: 'grad-pink',
  },
]

export function HowItWorks() {
  return (
    <section id="how" className="py-28 md:py-36 bg-[var(--color-bg-alt)]">
      <Container>
        <div className="max-w-[44ch] mb-16 md:mb-20">
          <Reveal>
            <p className="text-[var(--color-brand)] text-sm font-medium mb-4">Onboarding</p>
            <h2 className="text-display-lg">
              Dez minutos. <br />
              <span className="text-[var(--color-fg-muted)]">Sem TI envolvida.</span>
            </h2>
            <p className="mt-6 text-lg text-[var(--color-fg-muted)] leading-relaxed">
              Sem reunião de implantação. Sem pacote de horas. Você loga e configura sozinho — ou
              chama a gente no WhatsApp.
            </p>
          </Reveal>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5">
          {steps.map((step, i) => (
            <motion.div
              key={step.n}
              initial={{ opacity: 0, y: 32 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.7, ease, delay: i * 0.1 }}
              className="rounded-3xl bg-white border border-[var(--color-line)] p-8 md:p-10 flex flex-col"
            >
              <div className={`size-16 rounded-2xl ${step.grad} flex items-center justify-center mb-8`}>
                <span className="text-2xl font-semibold text-white tnum">{step.n}</span>
              </div>

              <h3 className="text-2xl md:text-3xl font-semibold tracking-tight mb-3">{step.title}</h3>
              <p className="text-[var(--color-fg-muted)] leading-relaxed mb-6">{step.desc}</p>

              <div className="mt-auto inline-flex self-start items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--color-bg-alt)] text-xs font-medium text-[var(--color-fg-muted)]">
                <svg className="size-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 6v6l4 2" strokeLinecap="round" />
                </svg>
                {step.badge}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Showcase de tela: Configurações */}
        <Reveal delay={0.4}>
          <div className="mt-12 rounded-3xl bg-[var(--color-fg)] p-8 md:p-10 lg:p-14 text-white grid lg:grid-cols-2 items-center gap-10">
            <div>
              <p className="text-white/60 text-sm mb-3">Configuração visual</p>
              <h3 className="text-display-md text-white mb-5">
                Sem código. <br /> Sem reunião de implantação.
              </h3>
              <p className="text-white/75 leading-relaxed mb-8">
                Você escolhe o connector, cola as credenciais, mapeia os campos com auto-sugestão
                e testa a conexão na tela. Se travar, o time de suporte assume.
              </p>
              <a href="#cta" className="inline-flex items-center gap-2 bg-white text-[var(--color-fg)] px-6 py-3 rounded-full font-medium hover:bg-white/90 transition-colors">
                Começar agora
                <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14M13 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </a>
            </div>
            <div className="rounded-2xl border border-white/10 overflow-hidden bg-white">
              <div className="relative aspect-[16/10]">
                <Image
                  src="/screenshots/configuracoes-desktop.png"
                  alt="Tela de configurações do IGA Gestão"
                  fill
                  sizes="(max-width: 1024px) 100vw, 600px"
                  className="object-cover object-top"
                />
              </div>
            </div>
          </div>
        </Reveal>
      </Container>
    </section>
  )
}
