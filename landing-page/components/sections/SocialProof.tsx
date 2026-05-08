'use client'

import { Container, Counter, Eyebrow, Hairline, Reveal } from '../primitives'

export function SocialProof() {
  return (
    <section className="relative py-32 md:py-40 grain">
      <Container>
        <Hairline className="mb-20 opacity-40" />

        <div className="grid grid-cols-12 gap-x-4 md:gap-x-8 mb-16 md:mb-20 items-end">
          <div className="col-span-12 md:col-span-5">
            <Reveal>
              <Eyebrow number="08" accent="gold">
                Por dentro
              </Eyebrow>
            </Reveal>
          </div>
          <div className="col-span-12 md:col-span-7 mt-8 md:mt-0">
            <Reveal delay={0.1}>
              <h2 className="text-display-lg font-display text-ink-50">
                Construído com <span className="italic-accent">obsessão</span> por detalhes.
              </h2>
            </Reveal>
            <Reveal delay={0.2}>
              <p className="mt-6 text-lg text-ink-200 max-w-[58ch]">
                Estamos em Beta Fechado coletando feedback. Em breve, depoimentos reais aqui. Por
                enquanto, os números do produto:
              </p>
            </Reveal>
          </div>
        </div>

        {/* Big numbers row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
          <Reveal>
            <Stat n={9} label="Módulos integrados" />
          </Reveal>
          <Reveal delay={0.08}>
            <Stat n={10} suffix=" min" label="Setup médio" />
          </Reveal>
          <Reveal delay={0.16}>
            <Stat n={256} label="AES-256-GCM" />
          </Reveal>
          <Reveal delay={0.24}>
            <Stat n={100} suffix="%" label="Cloud, sem instalação" />
          </Reveal>
        </div>

        {/* Quote editorial */}
        <Reveal delay={0.4}>
          <figure className="mt-20 md:mt-28 mx-auto max-w-[58ch]">
            <svg
              aria-hidden
              className="mx-auto mb-8 size-10 text-gold-base/40"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M9 7H4v6h3c0 2-1 3-3 3v2c4 0 6-2 6-6V7zm11 0h-5v6h3c0 2-1 3-3 3v2c4 0 6-2 6-6V7z" />
            </svg>
            <blockquote className="font-display text-3xl md:text-4xl leading-snug text-ink-50 text-center">
              Antes eu gastava 2 horas por dia compilando planilhas. Agora abro o IGA e está tudo lá.
            </blockquote>
            <figcaption className="mt-8 text-center font-mono text-[11px] uppercase tracking-[0.18em] text-ink-300">
              João · Gerente Industrial · Beta privado
            </figcaption>
          </figure>
        </Reveal>
      </Container>
    </section>
  )
}

function Stat({ n, suffix, label }: { n: number; suffix?: string; label: string }) {
  return (
    <div className="border-l border-ink-500/40 pl-5">
      <Counter
        to={n}
        suffix={suffix}
        className="font-display text-display-xl text-ink-50 block leading-none"
      />
      <span className="mt-3 block font-mono text-[11px] uppercase tracking-[0.18em] text-ink-300">
        {label}
      </span>
    </div>
  )
}
