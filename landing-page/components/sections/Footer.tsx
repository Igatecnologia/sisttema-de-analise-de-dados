'use client'

import { Container, Hairline } from '../primitives'

export function Footer() {
  return (
    <footer className="relative pt-20 pb-12 grain border-t border-ink-600/40">
      <Container>
        <div className="grid grid-cols-12 gap-x-4 md:gap-x-8 gap-y-12">
          {/* Brand */}
          <div className="col-span-12 md:col-span-4">
            <div className="flex items-baseline gap-2">
              <span className="font-display text-3xl tracking-tight text-ink-50">IGA</span>
              <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-300">
                Gestão
              </span>
            </div>
            <p className="mt-4 max-w-[36ch] text-sm leading-relaxed text-ink-200">
              Dashboard industrial com IA. Conecte seu ERP e tenha visão completa em minutos.
            </p>
            <div className="mt-6 flex items-center gap-3">
              <a
                href="#"
                aria-label="LinkedIn"
                className="flex size-9 items-center justify-center rounded-full border border-ink-600/60 text-ink-200 transition-colors hover:border-emerald-base hover:text-emerald-soft"
              >
                <svg className="size-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19 3a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2zM8.34 17V10H6.5v7zm-.92-7.95a1.06 1.06 0 100-2.12 1.06 1.06 0 000 2.12zM18 17v-3.83c0-1.95-1.04-2.86-2.43-2.86-1.12 0-1.62.62-1.9 1.05V10h-1.84v7h1.84v-3.91c0-.17.01-.34.06-.46.14-.34.45-.7.97-.7.69 0 .96.52.96 1.29V17z" />
                </svg>
              </a>
              <a
                href="#"
                aria-label="Instagram"
                className="flex size-9 items-center justify-center rounded-full border border-ink-600/60 text-ink-200 transition-colors hover:border-emerald-base hover:text-emerald-soft"
              >
                <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="5" />
                  <circle cx="12" cy="12" r="4" />
                  <circle cx="17.5" cy="6.5" r="0.5" fill="currentColor" />
                </svg>
              </a>
              <a
                href="https://github.com/Maykesantos98/gest-o-Analisededados"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="GitHub"
                className="flex size-9 items-center justify-center rounded-full border border-ink-600/60 text-ink-200 transition-colors hover:border-emerald-base hover:text-emerald-soft"
              >
                <svg className="size-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.1.79-.25.79-.55v-1.92c-3.2.7-3.87-1.54-3.87-1.54-.52-1.34-1.28-1.7-1.28-1.7-1.05-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.23-1.27-5.23-5.66 0-1.25.45-2.27 1.18-3.07-.12-.29-.51-1.46.11-3.05 0 0 .96-.31 3.15 1.17.92-.26 1.9-.38 2.88-.39.98 0 1.96.13 2.88.39 2.19-1.48 3.15-1.17 3.15-1.17.62 1.59.23 2.76.11 3.05.74.8 1.18 1.82 1.18 3.07 0 4.4-2.69 5.36-5.25 5.65.41.36.78 1.06.78 2.13v3.16c0 .31.21.66.8.55C20.21 21.39 23.5 17.08 23.5 12 23.5 5.65 18.35.5 12 .5z" />
                </svg>
              </a>
            </div>
          </div>

          {/* Produto */}
          <div className="col-span-6 md:col-span-2">
            <h4 className="mb-4 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-300">
              Produto
            </h4>
            <ul className="space-y-2 text-sm text-ink-100">
              <li><a className="link-underline" href="#features">Features</a></li>
              <li><a className="link-underline" href="#pricing">Planos</a></li>
              <li><a className="link-underline" href="#integrations">Integrações</a></li>
              <li><a className="link-underline" href="#how">Como funciona</a></li>
              <li><a className="link-underline" href="#cta">Demo</a></li>
            </ul>
          </div>

          {/* Empresa */}
          <div className="col-span-6 md:col-span-2">
            <h4 className="mb-4 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-300">
              Empresa
            </h4>
            <ul className="space-y-2 text-sm text-ink-100">
              <li><a className="link-underline" href="#">Blog</a></li>
              <li><a className="link-underline" href="#">Carreiras</a></li>
              <li><a className="link-underline" href="#">Contato</a></li>
              <li><a className="link-underline" href="https://app.igagestao.com.br/security">Segurança</a></li>
              <li><a className="link-underline" href="#">Status</a></li>
            </ul>
          </div>

          {/* Legal */}
          <div className="col-span-6 md:col-span-2">
            <h4 className="mb-4 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-300">
              Legal
            </h4>
            <ul className="space-y-2 text-sm text-ink-100">
              <li><a className="link-underline" href="https://app.igagestao.com.br/legal/termos">Termos de Uso</a></li>
              <li><a className="link-underline" href="https://app.igagestao.com.br/legal/privacidade">Privacidade</a></li>
              <li><a className="link-underline" href="https://app.igagestao.com.br/legal/cookies">Cookies</a></li>
              <li><a className="link-underline" href="https://app.igagestao.com.br/legal/sub-processors">Sub-processadores</a></li>
              <li><a className="link-underline" href="mailto:lgpd@igagestao.com.br">DPO/LGPD</a></li>
            </ul>
          </div>

          {/* Contato */}
          <div className="col-span-6 md:col-span-2">
            <h4 className="mb-4 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-300">
              Contato
            </h4>
            <ul className="space-y-2 text-sm text-ink-100">
              <li><a className="link-underline" href="mailto:suporte@igagestao.com.br">suporte@igagestao.com.br</a></li>
              <li><a className="link-underline" href="https://wa.me/5511999999999">WhatsApp</a></li>
              <li className="text-ink-300 font-mono text-[11px]">São Paulo · Brasil</li>
            </ul>
          </div>
        </div>

        <Hairline className="mt-16 mb-8 opacity-30" />

        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-xs text-ink-300">
          <p>© {new Date().getFullYear()} IGA Automação & Tecnologia · Todos os direitos reservados</p>
          <p className="font-mono uppercase tracking-[0.18em]">
            v1.2.0 · Construído no Brasil
          </p>
        </div>
      </Container>
    </footer>
  )
}
