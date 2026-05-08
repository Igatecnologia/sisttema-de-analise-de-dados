'use client'

import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'
import { Container, Eyebrow, Hairline, Reveal } from '../primitives'

const ease = [0.22, 1, 0.36, 1] as const

const faqs = [
  {
    q: 'Preciso trocar meu ERP?',
    a: 'Não. O IGA conecta ao ERP que você já usa via API REST. Você não precisa mudar nada no seu sistema atual. Suportamos SGBR, Bling, Tiny, Omie, CSV/Excel e qualquer API REST customizada.',
  },
  {
    q: 'Meus dados ficam seguros?',
    a: 'Sim. Criptografia AES-256-GCM em segredos sensíveis, HTTPS obrigatório com TLS 1.3, audit log com hash chain SHA-256, backups diários cifrados, multi-tenant com Row Level Security, e conformidade LGPD com endpoints de acesso/portabilidade/anonimização/eliminação.',
  },
  {
    q: 'Quanto tempo leva para configurar?',
    a: 'Em média 10 minutos. Você só precisa da URL e credenciais do seu ERP. O setup tem 3 passos guiados (conectar, mapear, usar) e templates prontos para os ERPs mais comuns.',
  },
  {
    q: 'Posso cancelar a qualquer momento?',
    a: 'Sim. Sem multa, sem fidelidade. Seus dados ficam acessíveis por 7 dias após o cancelamento via export LGPD (JSON estruturado). Backups são purgados em até 30 dias, exceto dados financeiros (5 anos por obrigação legal).',
  },
  {
    q: 'Funciona no celular?',
    a: 'O sistema é responsivo e funciona no navegador do celular com bottom navigation, pull-to-refresh e tabelas otimizadas. Aplicativo nativo está no roadmap pós-GA.',
  },
  {
    q: 'E se meu ERP não estiver na lista?',
    a: 'Integramos qualquer API REST em até 48h. Apenas precisamos da documentação da API do seu ERP. Para sistemas legados (SOAP, OData, GraphQL, SFTP), fale com a gente — temos roadmap de connectors universais.',
  },
  {
    q: 'A IA do Copilot é confiável?',
    a: 'O Copilot usa LLM via Groq (Llama 3, GPT-OSS) com tool-calling: ele só responde com dados reais do seu tenant, buscados em tempo de execução. Sem alucinação — se a tool retorna vazio, o Copilot diz "não encontrei". Plano Pro tem 20 mensagens/dia, Enterprise tem ilimitado.',
  },
  {
    q: 'Como vocês cobram?',
    a: 'Mensalmente via Stripe (cartão internacional ou boleto Brasil) ou anualmente com 20% de desconto. Trial de 14 dias do plano Pro sem cartão. Upgrade/downgrade self-service no portal de billing.',
  },
]

export function Faq() {
  const [open, setOpen] = useState<number | null>(0)

  return (
    <section id="faq" className="relative py-32 md:py-40">
      <Container>
        <Hairline className="mb-20 opacity-40" />

        <div className="grid grid-cols-12 gap-x-4 md:gap-x-8 mb-16 md:mb-20 items-end">
          <div className="col-span-12 md:col-span-5">
            <Reveal>
              <Eyebrow number="09" accent="ink">
                Perguntas frequentes
              </Eyebrow>
            </Reveal>
            <Reveal delay={0.1}>
              <h2 className="mt-6 text-display-lg font-display text-ink-50">
                Antes de você <span className="italic-accent">perguntar</span>.
              </h2>
            </Reveal>
            <Reveal delay={0.2}>
              <p className="mt-6 text-ink-200">
                Não achou o que procurava?{' '}
                <a href="#cta" className="link-underline text-emerald-soft">
                  Fale conosco
                </a>
                .
              </p>
            </Reveal>
          </div>

          <div className="col-span-12 md:col-span-7 mt-12 md:mt-0">
            <ul className="border-t border-ink-600/60">
              {faqs.map((f, i) => {
                const isOpen = open === i
                return (
                  <li
                    key={f.q}
                    className="border-b border-ink-600/60"
                  >
                    <button
                      onClick={() => setOpen(isOpen ? null : i)}
                      aria-expanded={isOpen}
                      className="group flex w-full items-start justify-between gap-6 py-6 text-left transition-colors hover:bg-ink-800/40 px-2 -mx-2 rounded"
                    >
                      <span className="flex items-baseline gap-4">
                        <span className="font-mono text-[10px] tracking-[0.2em] text-ink-400">
                          {String(i + 1).padStart(2, '0')}
                        </span>
                        <span className="font-display text-xl md:text-2xl text-ink-50">{f.q}</span>
                      </span>
                      <motion.span
                        animate={{ rotate: isOpen ? 45 : 0 }}
                        transition={{ duration: 0.4, ease }}
                        className={`mt-2 size-5 shrink-0 ${isOpen ? 'text-emerald-soft' : 'text-ink-300'}`}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M12 5v14M5 12h14" strokeLinecap="round" />
                        </svg>
                      </motion.span>
                    </button>
                    <AnimatePresence initial={false}>
                      {isOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.45, ease }}
                          className="overflow-hidden"
                        >
                          <p className="pb-6 pl-12 pr-2 text-ink-200 leading-relaxed max-w-[58ch]">
                            {f.a}
                          </p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </li>
                )
              })}
            </ul>
          </div>
        </div>
      </Container>
    </section>
  )
}
