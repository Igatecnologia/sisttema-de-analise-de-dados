'use client'

import { motion } from 'motion/react'
import { Container, Reveal } from '../primitives'

const ease = [0.22, 1, 0.36, 1] as const

export function FinalCta() {
  return (
    <section id="cta" className="py-16 md:py-24 bg-white">
      <Container>
        <div className="relative overflow-hidden rounded-[2.5rem] bg-[var(--color-fg)] px-8 py-16 md:p-20 lg:p-24">
          {/* Decorative blobs */}
          <div className="blob size-[500px] -top-32 -left-32 grad-violet opacity-40" aria-hidden />
          <div className="blob size-[400px] -bottom-32 -right-20 grad-blue opacity-40" aria-hidden />
          <div className="blob size-[300px] top-1/2 right-1/3 grad-pink opacity-30" aria-hidden />

          <div className="relative text-center max-w-[22ch] mx-auto">
            <Reveal>
              <p className="text-white/70 text-sm font-medium mb-6">Vamos conversar</p>
            </Reveal>
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.9, ease }}
              className="text-display-xl text-white"
            >
              Sua próxima segunda começa aqui.
            </motion.h2>
          </div>

          <Reveal delay={0.2}>
            <p className="relative mt-8 mx-auto max-w-[54ch] text-center text-lg text-white/75 leading-relaxed">
              Catorze dias com Copilot IA, todos os módulos e suporte de gente. Sem cartão. Se não
              ajudar, é só fechar a aba — não cobramos nem importunamos.
            </p>
          </Reveal>

          <Reveal delay={0.3}>
            <div className="relative mt-12 flex flex-wrap items-center justify-center gap-3">
              <a
                href="https://app.igagestao.com.br/registrar"
                className="inline-flex items-center gap-2 bg-white text-[var(--color-fg)] px-7 py-3.5 rounded-full font-medium hover:bg-white/90 transition-colors"
              >
                Começar trial grátis
                <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14M13 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </a>
              <a
                href="#demo"
                className="inline-flex items-center gap-2 border border-white/25 text-white px-7 py-3.5 rounded-full font-medium hover:bg-white/10 transition-colors"
              >
                Agendar demo
              </a>
              <a
                href="https://wa.me/5511999999999"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-white/70 px-5 py-3.5 hover:text-white transition-colors"
              >
                <svg className="size-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.5 14.4c-.3-.1-1.7-.8-1.9-.9-.3-.1-.5-.1-.7.1l-.9 1.2c-.2.2-.4.2-.7.1-.3-.1-1.3-.5-2.4-1.5-.9-.8-1.5-1.8-1.7-2.1-.2-.3 0-.5.1-.6l.4-.5c.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5-.1-.1-.7-1.7-1-2.4-.3-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1.1 1.1-1.1 2.6 0 1.6 1.1 3.1 1.3 3.3.2.2 2.2 3.4 5.4 4.7.7.3 1.3.5 1.7.6.7.2 1.4.2 1.9.1.6-.1 1.7-.7 2-1.4.2-.7.2-1.3.2-1.4-.1-.1-.3-.2-.5-.3z" />
                  <path d="M20.5 3.5C18.2 1.2 15.2 0 12 0 5.4 0 0 5.4 0 12c0 2.1.5 4.1 1.6 5.9L0 24l6.3-1.6c1.7 1 3.7 1.4 5.7 1.4 6.6 0 12-5.4 12-12 0-3.2-1.2-6.2-3.5-8.3z" />
                </svg>
                WhatsApp
              </a>
            </div>
          </Reveal>

          <Reveal delay={0.4}>
            <p className="relative mt-12 text-center text-sm text-white/50">
              suporte@igagestao.com.br · (11) 99999-9999
            </p>
          </Reveal>
        </div>
      </Container>
    </section>
  )
}
