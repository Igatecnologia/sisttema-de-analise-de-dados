'use client'

import { motion } from 'motion/react'
import { ArrowRight, Calendar, MessageCircle } from 'lucide-react'
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
                className="group inline-flex items-center gap-2 bg-white text-[var(--color-fg)] px-7 py-3.5 rounded-full font-medium hover:bg-white/90 transition-colors"
              >
                Começar trial grátis
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </a>
              <a
                href="#demo"
                className="inline-flex items-center gap-2 border border-white/25 text-white px-7 py-3.5 rounded-full font-medium hover:bg-white/10 transition-colors"
              >
                <Calendar className="size-4" />
                Agendar demo
              </a>
              <a
                href="https://wa.me/5511999999999"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-white/70 px-5 py-3.5 hover:text-white transition-colors"
              >
                <MessageCircle className="size-4" />
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
