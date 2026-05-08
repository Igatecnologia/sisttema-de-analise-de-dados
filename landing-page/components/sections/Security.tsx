'use client'

import { motion } from 'motion/react'
import { Container, Reveal } from '../primitives'

const ease = [0.22, 1, 0.36, 1] as const

const items = [
  { icon: 'lock', title: 'AES-256-GCM', desc: 'Criptografia at-rest em segredos sensíveis e credenciais ERP.' },
  { icon: 'shield', title: 'LGPD compliant', desc: 'Direitos do titular: acesso, portabilidade, anonimização, exclusão.' },
  { icon: 'cloud', title: 'Backup diário', desc: 'pg_dump cifrado com retenção de 30 dias e restore testado.' },
  { icon: 'https', title: 'HTTPS obrigatório', desc: 'TLS 1.3, HSTS preload, CSP dinâmico multi-tenant.' },
  { icon: 'users', title: 'RBAC granular', desc: '19 permissões por usuário, 3 perfis + custom.' },
  { icon: 'eye', title: 'Audit trail', desc: 'Hash chain SHA-256 — auditoria imutável com verificação online.' },
]

export function Security() {
  return (
    <section className="py-28 md:py-36 bg-white">
      <Container>
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-start mb-16 md:mb-20">
          <Reveal>
            <p className="text-[var(--color-brand)] text-sm font-medium mb-4">Segurança</p>
            <h2 className="text-display-lg">
              Seus dados <br />
              protegidos. <span className="text-[var(--color-fg-muted)]">Sempre.</span>
            </h2>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="text-lg text-[var(--color-fg-muted)] leading-relaxed">
              Construído com OWASP ASVS Level 2 em mente. Audit log com hash chain, RLS multi-tenant,
              MFA, refresh tokens com rotation. <a href="https://app.igagestao.com.br/security" className="text-[var(--color-brand)] font-medium hover:underline">Ver controles públicos</a>.
            </p>
            <div className="mt-8 flex flex-wrap gap-2">
              {['ISO 27001 ready', 'SOC 2 prep', 'SBOM público', 'Pentest anual'].map((b) => (
                <span key={b} className="px-3.5 py-1.5 rounded-full bg-[var(--color-bg-alt)] text-sm font-medium">
                  {b}
                </span>
              ))}
            </div>
          </Reveal>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((item, i) => (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.6, ease, delay: i * 0.05 }}
              className="card-flat p-7 md:p-8"
            >
              <div className="size-12 rounded-xl bg-[var(--color-brand)]/10 text-[var(--color-brand)] flex items-center justify-center mb-5">
                <SecurityIcon name={item.icon} />
              </div>
              <h3 className="text-lg font-semibold tracking-tight mb-2">{item.title}</h3>
              <p className="text-sm text-[var(--color-fg-muted)] leading-relaxed">{item.desc}</p>
            </motion.div>
          ))}
        </div>
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
