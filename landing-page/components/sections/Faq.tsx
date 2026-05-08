'use client'

import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'
import { Container, Reveal } from '../primitives'

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
    a: 'O Copilot usa LLM via Groq com tool-calling: ele só responde com dados reais do seu tenant, buscados em tempo de execução. Sem alucinação — se a tool retorna vazio, o Copilot diz "não encontrei". Plano Pro tem 20 mensagens/dia, Enterprise tem ilimitado.',
  },
  {
    q: 'Como vocês cobram?',
    a: 'Mensalmente via Stripe (cartão internacional ou boleto Brasil) ou anualmente com 20% de desconto. Trial de 14 dias do plano Pro sem cartão. Upgrade/downgrade self-service no portal de billing.',
  },
]

export function Faq() {
  const [open, setOpen] = useState<number | null>(0)

  return (
    <section id="faq" className="py-28 md:py-36 bg-white">
      <Container>
        <div className="grid lg:grid-cols-12 gap-12 lg:gap-16">
          <div className="lg:col-span-5">
            <Reveal>
              <p className="text-[var(--color-brand)] text-sm font-medium mb-4">Perguntas frequentes</p>
              <h2 className="text-display-lg">
                Antes de você <br />
                <span className="text-[var(--color-fg-muted)]">perguntar.</span>
              </h2>
              <p className="mt-6 text-[var(--color-fg-muted)]">
                Não achou o que procurava?{' '}
                <a href="#cta" className="text-[var(--color-brand)] font-medium hover:underline">
                  Fale conosco
                </a>
                .
              </p>
            </Reveal>
          </div>

          <div className="lg:col-span-7">
            <ul className="divide-y divide-[var(--color-line)]">
              {faqs.map((f, i) => {
                const isOpen = open === i
                return (
                  <li key={f.q}>
                    <button
                      onClick={() => setOpen(isOpen ? null : i)}
                      aria-expanded={isOpen}
                      className="flex w-full items-start justify-between gap-6 py-6 text-left group"
                    >
                      <span className="text-lg md:text-xl font-semibold tracking-tight pr-4 group-hover:text-[var(--color-brand)] transition-colors">
                        {f.q}
                      </span>
                      <motion.span
                        animate={{ rotate: isOpen ? 45 : 0 }}
                        transition={{ duration: 0.4, ease }}
                        className={`mt-1.5 size-6 shrink-0 rounded-full flex items-center justify-center ${
                          isOpen
                            ? 'bg-[var(--color-fg)] text-white'
                            : 'bg-[var(--color-bg-alt)] text-[var(--color-fg)]'
                        }`}
                      >
                        <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
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
                          <p className="pb-6 pr-12 text-[var(--color-fg-muted)] leading-relaxed">
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
