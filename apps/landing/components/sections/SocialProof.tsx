'use client'

import { Container, Counter, Reveal } from '../primitives'

export function SocialProof() {
  return (
    <section className="py-28 md:py-36 bg-[var(--color-bg-alt)]">
      <Container>
        <div className="text-center max-w-[48ch] mx-auto mb-16 md:mb-20">
          <Reveal>
            <p className="text-[var(--color-brand)] text-sm font-medium mb-4">Por dentro</p>
            <h2 className="text-display-lg">
              Feito por gente que <br />já sofreu com planilha.
            </h2>
            <p className="mt-6 text-lg text-[var(--color-fg-muted)] leading-relaxed">
              Estamos em Beta Fechado, com fábricas reais usando o sistema todo dia. Em breve,
              depoimentos com nome e cara aqui. Por enquanto, o que dá pra mostrar:
            </p>
          </Reveal>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
          <Stat n={9} label="Módulos integrados" grad="grad-blue" />
          <Stat n={10} suffix=" min" label="Setup médio" grad="grad-violet" />
          <Stat n={256} label="Bits de criptografia" grad="grad-cyan" />
          <Stat n={100} suffix="%" label="Cloud, sem instalação" grad="grad-pink" />
        </div>

        <Reveal delay={0.4}>
          <figure className="mt-20 md:mt-28 mx-auto max-w-[64ch]">
            <div className="text-5xl text-[var(--color-fg-subtle)] mb-6 leading-none text-center">&ldquo;</div>
            <blockquote className="text-3xl md:text-4xl font-semibold tracking-tight text-center leading-tight">
              Antes eu gastava duas horas por dia compilando planilha. Hoje abro o IGA, vejo o que
              importa, fecho a aba e cuido da fábrica.
            </blockquote>
            <figcaption className="mt-10 flex items-center justify-center gap-4">
              <div className="size-12 rounded-full grad-blue flex items-center justify-center text-white font-semibold">
                J
              </div>
              <div className="text-left">
                <span className="block text-sm font-semibold">João — Gerente Industrial</span>
                <span className="block text-sm text-[var(--color-fg-muted)]">Beta fechado · Maio 2026</span>
              </div>
            </figcaption>
          </figure>
        </Reveal>
      </Container>
    </section>
  )
}

function Stat({ n, suffix, label, grad }: { n: number; suffix?: string; label: string; grad: string }) {
  return (
    <Reveal>
      <div className={`rounded-3xl ${grad} p-8 md:p-10 text-white relative overflow-hidden`}>
        <div className="absolute -top-10 -right-10 size-40 rounded-full bg-white/15 blur-2xl" aria-hidden />
        <Counter
          to={n}
          suffix={suffix}
          className="block text-5xl md:text-6xl font-semibold tracking-tight leading-none relative"
        />
        <span className="mt-4 block text-sm text-white/85 relative">{label}</span>
      </div>
    </Reveal>
  )
}
