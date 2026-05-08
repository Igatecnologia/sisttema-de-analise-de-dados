'use client'

import { motion } from 'motion/react'
import {
  Lock,
  ShieldCheck,
  Cloud,
  Globe,
  Users,
  ScanEye,
  type LucideIcon,
} from 'lucide-react'
import { Container, Reveal } from '../primitives'
import { SpotlightCard } from '../magic/SpotlightCard'

const ease = [0.22, 1, 0.36, 1] as const

const items: { Icon: LucideIcon; title: string; desc: string }[] = [
  { Icon: Lock, title: 'AES-256-GCM', desc: 'Criptografia at-rest em segredos sensíveis e credenciais ERP.' },
  { Icon: ShieldCheck, title: 'LGPD compliant', desc: 'Direitos do titular: acesso, portabilidade, anonimização, exclusão.' },
  { Icon: Cloud, title: 'Backup diário', desc: 'pg_dump cifrado com retenção de 30 dias e restore testado.' },
  { Icon: Globe, title: 'HTTPS obrigatório', desc: 'TLS 1.3, HSTS preload, CSP dinâmico multi-tenant.' },
  { Icon: Users, title: 'RBAC granular', desc: '19 permissões por usuário, 3 perfis + custom.' },
  { Icon: ScanEye, title: 'Audit trail', desc: 'Hash chain SHA-256 — auditoria imutável com verificação online.' },
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
              MFA, refresh tokens com rotation.{' '}
              <a href="https://app.igagestao.com.br/security" className="text-[var(--color-brand)] font-medium hover:underline">
                Ver controles públicos
              </a>
              .
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
            >
              <SpotlightCard glow="#0052ff" size={280} className="card-flat group p-7 md:p-8 h-full">
                <div className="size-12 rounded-xl bg-[var(--color-brand)]/10 text-[var(--color-brand)] flex items-center justify-center mb-5">
                  <item.Icon className="size-5" strokeWidth={1.75} />
                </div>
                <h3 className="text-lg font-semibold tracking-tight mb-2">{item.title}</h3>
                <p className="text-sm text-[var(--color-fg-muted)] leading-relaxed">{item.desc}</p>
              </SpotlightCard>
            </motion.div>
          ))}
        </div>
      </Container>
    </section>
  )
}
