'use client'

import { motion } from 'motion/react'
import { Container, Eyebrow, Hairline, Reveal } from '../primitives'

const ease = [0.22, 1, 0.36, 1] as const

const items = [
  {
    icon: 'lock',
    title: 'AES-256-GCM',
    desc: 'Criptografia at-rest em segredos sensíveis (credenciais ERP, MFA secret).',
  },
  {
    icon: 'shield',
    title: 'LGPD compliant',
    desc: 'Direitos do titular implementados: acesso, portabilidade, anonimização, exclusão.',
  },
  {
    icon: 'cloud',
    title: 'Backup diário',
    desc: 'pg_dump cifrado com retenção de 30 dias e restore testado.',
  },
  {
    icon: 'https',
    title: 'HTTPS obrigatório',
    desc: 'TLS 1.3, HSTS preload, CSP dinâmico multi-tenant.',
  },
  {
    icon: 'users',
    title: 'RBAC granular',
    desc: '19 permissões por usuário, 3 perfis (admin, manager, viewer) + custom.',
  },
  {
    icon: 'eye',
    title: 'Audit trail',
    desc: 'Hash chain SHA-256 — auditoria de logs imutáveis com verificação online.',
  },
]

export function Security() {
  return (
    <section className="relative py-32 md:py-40">
      <Container>
        <Hairline className="mb-20 opacity-40" />

        <div className="grid grid-cols-12 gap-x-4 md:gap-x-8 mb-16 md:mb-20 items-end">
          <div className="col-span-12 md:col-span-5">
            <Reveal>
              <Eyebrow number="06" accent="cobalt">
                Segurança
              </Eyebrow>
            </Reveal>
          </div>
          <div className="col-span-12 md:col-span-7 mt-8 md:mt-0">
            <Reveal delay={0.1}>
              <h2 className="text-display-lg font-display text-ink-50">
                Seus dados <span className="italic-accent">protegidos</span>. Sempre.
              </h2>
            </Reveal>
            <Reveal delay={0.2}>
              <p className="mt-6 text-lg text-ink-200 max-w-[58ch]">
                Construído com OWASP ASVS Level 2 em mente. Audit log com hash chain, RLS
                multi-tenant, MFA, refresh tokens com rotation.
              </p>
            </Reveal>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
          {items.map((item, i) => (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.6, ease, delay: i * 0.05 }}
              className="card-lift relative overflow-hidden rounded-2xl border border-ink-600/60 bg-ink-800/50 p-7 md:p-8"
            >
              <div className="mb-5 flex size-12 items-center justify-center rounded-xl bg-cobalt-base/15 text-cobalt-soft">
                <SecurityIcon name={item.icon} />
              </div>
              <h3 className="text-xl font-display text-ink-50 mb-2">{item.title}</h3>
              <p className="text-sm leading-relaxed text-ink-200">{item.desc}</p>
            </motion.div>
          ))}
        </div>

        <Reveal delay={0.4}>
          <div className="mt-12 flex flex-wrap items-center justify-center gap-x-8 gap-y-4 font-mono text-[11px] uppercase tracking-[0.18em] text-ink-300">
            <span className="flex items-center gap-2">
              <span className="size-1 rounded-full bg-emerald-base" />
              ISO 27001 ready
            </span>
            <span className="flex items-center gap-2">
              <span className="size-1 rounded-full bg-emerald-base" />
              SOC 2 prep
            </span>
            <span className="flex items-center gap-2">
              <span className="size-1 rounded-full bg-emerald-base" />
              SBOM público
            </span>
            <span className="flex items-center gap-2">
              <span className="size-1 rounded-full bg-emerald-base" />
              Pentest anual
            </span>
          </div>
        </Reveal>
      </Container>
    </section>
  )
}

function SecurityIcon({ name }: { name: string }) {
  const cls = 'size-5'
  switch (name) {
    case 'lock':
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="4" y="11" width="16" height="10" rx="2" />
          <path d="M8 11V7a4 4 0 018 0v4" strokeLinecap="round" />
        </svg>
      )
    case 'shield':
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7z" strokeLinejoin="round" />
          <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    case 'cloud':
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 18a4 4 0 000-8 6 6 0 00-11.5 2A4 4 0 006 18z" strokeLinejoin="round" />
        </svg>
      )
    case 'https':
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <path d="M2 12h20M12 2a15 15 0 010 20M12 2a15 15 0 000 20" />
        </svg>
      )
    case 'users':
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" strokeLinecap="round" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" strokeLinecap="round" />
        </svg>
      )
    case 'eye':
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" strokeLinejoin="round" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      )
    default:
      return null
  }
}
