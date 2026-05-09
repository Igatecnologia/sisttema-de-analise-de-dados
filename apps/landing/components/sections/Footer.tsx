'use client'

import Image from 'next/image'
import { Container } from '../primitives'

export function Footer() {
  return (
    <footer className="bg-white border-t border-[var(--color-line)] pt-20 pb-12">
      <Container>
        <div className="grid grid-cols-12 gap-8 lg:gap-12 mb-16">
          <div className="col-span-12 md:col-span-4">
            <Image
              src="/iga-logo.png"
              alt="IGA Automação & Tecnologia"
              width={150}
              height={48}
              className="h-10 w-auto"
            />
            <p className="mt-5 max-w-[36ch] text-sm leading-relaxed text-[var(--color-fg-muted)]">
              Dashboard industrial com IA. Conecte seu ERP e tenha visão completa em minutos.
            </p>
            <div className="mt-6 flex items-center gap-2">
              <SocialLink href="#" label="LinkedIn">
                <svg className="size-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <path d="M19 3a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2zM8.34 17V10H6.5v7zm-.92-7.95a1.06 1.06 0 100-2.12 1.06 1.06 0 000 2.12zM18 17v-3.83c0-1.95-1.04-2.86-2.43-2.86-1.12 0-1.62.62-1.9 1.05V10h-1.84v7h1.84v-3.91c0-.17.01-.34.06-.46.14-.34.45-.7.97-.7.69 0 .96.52.96 1.29V17z" />
                </svg>
              </SocialLink>
              <SocialLink href="#" label="Instagram">
                <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                  <rect x="3" y="3" width="18" height="18" rx="5" />
                  <circle cx="12" cy="12" r="4" />
                  <circle cx="17.5" cy="6.5" r="0.6" fill="currentColor" />
                </svg>
              </SocialLink>
              <SocialLink href="https://github.com/Maykesantos98/gest-o-Analisededados" label="GitHub">
                <svg className="size-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.1.79-.25.79-.55v-1.92c-3.2.7-3.87-1.54-3.87-1.54-.52-1.34-1.28-1.7-1.28-1.7-1.05-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.23-1.27-5.23-5.66 0-1.25.45-2.27 1.18-3.07-.12-.29-.51-1.46.11-3.05 0 0 .96-.31 3.15 1.17.92-.26 1.9-.38 2.88-.39.98 0 1.96.13 2.88.39 2.19-1.48 3.15-1.17 3.15-1.17.62 1.59.23 2.76.11 3.05.74.8 1.18 1.82 1.18 3.07 0 4.4-2.69 5.36-5.25 5.65.41.36.78 1.06.78 2.13v3.16c0 .31.21.66.8.55C20.21 21.39 23.5 17.08 23.5 12 23.5 5.65 18.35.5 12 .5z" />
                </svg>
              </SocialLink>
            </div>
          </div>

          <Column title="Produto">
            <Link href="#features">Features</Link>
            <Link href="#pricing">Planos</Link>
            <Link href="#integrations">Integrações</Link>
            <Link href="#how">Como funciona</Link>
            <Link href="#cta">Demo</Link>
          </Column>
          <Column title="Empresa">
            <Link href="#">Blog</Link>
            <Link href="#">Carreiras</Link>
            <Link href="#">Contato</Link>
            <Link href="https://app.igagestao.com.br/security">Segurança</Link>
          </Column>
          <Column title="Legal">
            <Link href="https://app.igagestao.com.br/legal/termos">Termos</Link>
            <Link href="https://app.igagestao.com.br/legal/privacidade">Privacidade</Link>
            <Link href="https://app.igagestao.com.br/legal/cookies">Cookies</Link>
            <Link href="https://app.igagestao.com.br/legal/sub-processors">Sub-processadores</Link>
            <Link href="mailto:lgpd@igagestao.com.br">DPO/LGPD</Link>
          </Column>
          <Column title="Contato">
            <Link href="mailto:suporte@igagestao.com.br">suporte@igagestao.com.br</Link>
            <Link href="https://wa.me/5511999999999">WhatsApp</Link>
            <span className="text-sm text-[var(--color-fg-subtle)]">São Paulo · Brasil</span>
          </Column>
        </div>

        <div className="border-t border-[var(--color-line)] pt-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-sm text-[var(--color-fg-muted)]">
          <p>© {new Date().getFullYear()} IGA Automação & Tecnologia · Todos os direitos reservados</p>
          <p>v1.2.0 · Construído no Brasil</p>
        </div>
      </Container>
    </footer>
  )
}

function Column({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="col-span-6 md:col-span-2">
      <h4 className="mb-5 text-xs font-semibold uppercase tracking-wider text-[var(--color-fg-subtle)]">
        {title}
      </h4>
      <ul className="space-y-3 flex flex-col">{children}</ul>
    </div>
  )
}

function Link({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <li>
      <a
        href={href}
        className="text-sm text-[var(--color-fg-soft)] hover:text-[var(--color-brand)] transition-colors"
      >
        {children}
      </a>
    </li>
  )
}

function SocialLink({ href, label, children }: { href: string; label: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      aria-label={label}
      target={href.startsWith('http') ? '_blank' : undefined}
      rel={href.startsWith('http') ? 'noopener noreferrer' : undefined}
      className="flex size-9 items-center justify-center rounded-full bg-[var(--color-bg-alt)] text-[var(--color-fg-soft)] hover:bg-[var(--color-fg)] hover:text-white transition-colors"
    >
      {children}
    </a>
  )
}
