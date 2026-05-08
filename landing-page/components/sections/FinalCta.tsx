'use client'

import { motion } from 'motion/react'
import { Container, Reveal } from '../primitives'

const ease = [0.22, 1, 0.36, 1] as const

export function FinalCta() {
  return (
    <section id="cta" className="relative overflow-hidden py-32 md:py-44">
      {/* Decorative background */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-30"
        style={{
          background:
            'radial-gradient(ellipse 70% 60% at 50% 50%, rgba(16, 185, 129, 0.18), transparent 60%)',
        }}
      />
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage:
            'linear-gradient(to right, var(--color-ink-200) 1px, transparent 1px), linear-gradient(to bottom, var(--color-ink-200) 1px, transparent 1px)',
          backgroundSize: '80px 80px',
          maskImage: 'radial-gradient(ellipse 60% 50% at 50% 50%, black, transparent 70%)',
        }}
      />

      <Container className="relative">
        <div className="text-center">
          <Reveal>
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-emerald-soft">
              · 10 · O próximo passo
            </p>
          </Reveal>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.9, ease, delay: 0.1 }}
            className="mt-8 text-display-xl font-display text-ink-50 max-w-[20ch] mx-auto"
          >
            Pronto para a <span className="italic-accent">visão</span> que faltava?
          </motion.h2>
          <Reveal delay={0.3}>
            <p className="mt-8 mx-auto max-w-[52ch] text-lg text-ink-200">
              Trial de 14 dias com Copilot IA + todos os módulos. Sem cartão, sem instalação. Você
              loga e começa a usar.
            </p>
          </Reveal>

          <Reveal delay={0.4}>
            <div className="mt-12 flex flex-wrap items-center justify-center gap-3">
              <a
                href="https://app.igagestao.com.br/registrar"
                className="btn-emerald-glow group inline-flex items-center gap-2 rounded-full bg-emerald-base px-9 py-4 text-base font-medium text-ink-950"
              >
                Começar trial grátis
                <span className="inline-block transition-transform duration-300 group-hover:translate-x-1">→</span>
              </a>
              <a
                href="#demo"
                className="link-underline inline-flex items-center gap-2 rounded-full border border-ink-500 px-9 py-4 text-base text-ink-100 hover:border-ink-300"
              >
                Agendar demonstração
              </a>
              <a
                href="https://wa.me/5511999999999"
                target="_blank"
                rel="noopener noreferrer"
                className="link-underline inline-flex items-center gap-2 rounded-full border border-emerald-base/30 bg-emerald-base/5 px-6 py-4 text-base text-emerald-soft hover:bg-emerald-base/10"
              >
                <svg className="size-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.5 14.4c-.3-.1-1.7-.8-1.9-.9-.3-.1-.5-.1-.7.1l-.9 1.2c-.2.2-.4.2-.7.1-.3-.1-1.3-.5-2.4-1.5-.9-.8-1.5-1.8-1.7-2.1-.2-.3 0-.5.1-.6l.4-.5c.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5-.1-.1-.7-1.7-1-2.4-.3-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1.1 1.1-1.1 2.6 0 1.6 1.1 3.1 1.3 3.3.2.2 2.2 3.4 5.4 4.7.7.3 1.3.5 1.7.6.7.2 1.4.2 1.9.1.6-.1 1.7-.7 2-1.4.2-.7.2-1.3.2-1.4-.1-.1-.3-.2-.5-.3z" />
                  <path d="M20.5 3.5C18.2 1.2 15.2 0 12 0 5.4 0 0 5.4 0 12c0 2.1.5 4.1 1.6 5.9L0 24l6.3-1.6c1.7 1 3.7 1.4 5.7 1.4 6.6 0 12-5.4 12-12 0-3.2-1.2-6.2-3.5-8.3zM12 21.8c-1.8 0-3.6-.5-5.1-1.4l-.4-.2-3.7 1 1-3.7-.2-.4c-1-1.6-1.5-3.4-1.5-5.2 0-5.5 4.5-10 10-10 2.7 0 5.2 1 7.1 2.9 1.9 1.9 2.9 4.4 2.9 7.1-.1 5.5-4.6 9.9-10.1 9.9z" />
                </svg>
                WhatsApp
              </a>
            </div>
          </Reveal>

          <Reveal delay={0.5}>
            <p className="mt-10 font-mono text-[11px] uppercase tracking-[0.2em] text-ink-300">
              suporte@igagestao.com.br &nbsp;·&nbsp; (11) 99999-9999
            </p>
          </Reveal>
        </div>
      </Container>
    </section>
  )
}
