'use client'

import { useState, type FormEvent } from 'react'
import { motion } from 'motion/react'
import { ArrowRight, CheckCircle2, AlertCircle } from 'lucide-react'
import { Container, Reveal } from '../primitives'

const ease = [0.22, 1, 0.36, 1] as const

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'https://iga-gestao-api.onrender.com'

type Status =
  | { state: 'idle' }
  | { state: 'submitting' }
  | { state: 'success' }
  | { state: 'error'; message: string }

export function BetaInvite() {
  const [status, setStatus] = useState<Status>({ state: 'idle' })

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (status.state === 'submitting') return

    const form = e.currentTarget
    const data = new FormData(form)
    const payload = {
      name: String(data.get('name') ?? '').trim(),
      email: String(data.get('email') ?? '').trim(),
      company: String(data.get('company') ?? '').trim(),
      erp: String(data.get('erp') ?? '').trim(),
      role: String(data.get('role') ?? '').trim(),
      message: String(data.get('message') ?? '').trim(),
      source: 'landing',
    }

    /** Honeypot — bot fill, descarta silenciosamente. */
    if (String(data.get('website') ?? '')) {
      setStatus({ state: 'success' })
      form.reset()
      return
    }

    setStatus({ state: 'submitting' })

    try {
      const res = await fetch(`${API_BASE}/api/v1/leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({ message: 'Falha ao enviar' }))
        throw new Error(body.message ?? 'Falha ao enviar')
      }
      setStatus({ state: 'success' })
      form.reset()
    } catch (err) {
      setStatus({
        state: 'error',
        message: err instanceof Error ? err.message : 'Algo deu errado. Tente novamente.',
      })
    }
  }

  return (
    <section id="cta" className="py-16 md:py-24 bg-white">
      <Container>
        <div className="relative overflow-hidden rounded-[2.5rem] bg-[var(--color-fg)] px-8 py-16 md:p-16 lg:p-20">
          <div className="blob size-[500px] -top-32 -left-32 grad-violet opacity-40" aria-hidden />
          <div className="blob size-[400px] -bottom-32 -right-20 grad-blue opacity-40" aria-hidden />
          <div className="blob size-[300px] top-1/2 right-1/3 grad-pink opacity-30" aria-hidden />

          <div className="relative grid lg:grid-cols-12 gap-10 lg:gap-16 items-start">
            {/* Lado esquerdo — copy */}
            <div className="lg:col-span-5">
              <Reveal>
                <p className="text-white/70 text-sm font-medium mb-6">Beta fechado</p>
              </Reveal>
              <motion.h2
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-80px' }}
                transition={{ duration: 0.9, ease }}
                className="text-display-lg text-white mb-6"
              >
                Sua próxima segunda começa aqui.
              </motion.h2>
              <Reveal delay={0.2}>
                <p className="text-lg text-white/75 leading-relaxed mb-8">
                  Estamos abrindo Beta gratuito para 5 indústrias selecionadas. Catorze dias com
                  Copilot IA, todos os módulos e suporte direto. Sem cartão. Sem cobrança.
                </p>
              </Reveal>
              <Reveal delay={0.3}>
                <ul className="space-y-3 text-white/85">
                  {[
                    'Setup em 10 minutos com a gente do seu lado',
                    'WhatsApp direto para suporte (não bot)',
                    'Você decide se continua ao final',
                    'Seus dados sempre exportáveis (LGPD)',
                  ].map((b) => (
                    <li key={b} className="flex items-start gap-3 text-sm">
                      <CheckCircle2 className="size-5 shrink-0 text-emerald-400 mt-0.5" strokeWidth={2} />
                      {b}
                    </li>
                  ))}
                </ul>
              </Reveal>
            </div>

            {/* Lado direito — form */}
            <div className="lg:col-span-7">
              <Reveal delay={0.15}>
                <div className="rounded-3xl bg-white/95 backdrop-blur p-7 md:p-9 shadow-2xl shadow-black/30">
                  {status.state === 'success' ? (
                    <SuccessState />
                  ) : (
                    <form onSubmit={onSubmit} className="space-y-4">
                      <h3 className="text-2xl font-semibold tracking-tight mb-1">
                        Pedir convite Beta
                      </h3>
                      <p className="text-sm text-[var(--color-fg-muted)] mb-6">
                        Respondemos em até 48h. Vagas limitadas.
                      </p>

                      <div className="grid sm:grid-cols-2 gap-4">
                        <Field label="Seu nome" name="name" required placeholder="João Silva" />
                        <Field
                          label="Email corporativo"
                          name="email"
                          type="email"
                          required
                          placeholder="joao@empresa.com.br"
                        />
                      </div>

                      <Field
                        label="Empresa"
                        name="company"
                        required
                        placeholder="Indústria Acme Ltda"
                      />

                      <div className="grid sm:grid-cols-2 gap-4">
                        <Field label="Cargo" name="role" placeholder="Diretor de Operações" />
                        <SelectField label="ERP que você usa" name="erp">
                          <option value="">Selecione…</option>
                          <option value="SGBR">SGBR BI</option>
                          <option value="Bling">Bling</option>
                          <option value="Tiny">Tiny ERP</option>
                          <option value="Omie">Omie</option>
                          <option value="Sankhya">Sankhya</option>
                          <option value="TOTVS">TOTVS / Protheus</option>
                          <option value="Custom">Outro / API própria</option>
                          <option value="Excel">Ainda usa Excel</option>
                        </SelectField>
                      </div>

                      <TextArea
                        label="Conta um pouco do seu contexto (opcional)"
                        name="message"
                        placeholder="Quantas pessoas, principal dor, urgência…"
                      />

                      {/* Honeypot — bots vão preencher */}
                      <input
                        type="text"
                        name="website"
                        tabIndex={-1}
                        autoComplete="off"
                        aria-hidden
                        className="absolute -left-[9999px] opacity-0 pointer-events-none"
                      />

                      {status.state === 'error' && (
                        <div className="flex items-start gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-700 border border-red-200">
                          <AlertCircle className="size-4 shrink-0 mt-0.5" />
                          {status.message}
                        </div>
                      )}

                      <button
                        type="submit"
                        disabled={status.state === 'submitting'}
                        className="btn-primary !w-full !py-4 disabled:opacity-60 disabled:cursor-not-allowed mt-2"
                      >
                        {status.state === 'submitting' ? 'Enviando…' : 'Pedir convite'}
                        {status.state !== 'submitting' && <ArrowRight className="size-4" />}
                      </button>

                      <p className="text-[11px] text-[var(--color-fg-subtle)] text-center mt-3">
                        Ao enviar você aceita nossa{' '}
                        <a href="https://app.igagestao.com.br/legal/privacidade" className="underline hover:text-[var(--color-brand)]">
                          Política de Privacidade
                        </a>
                        . Sem spam — palavra de gente que detesta spam.
                      </p>
                    </form>
                  )}
                </div>
              </Reveal>
            </div>
          </div>
        </div>
      </Container>
    </section>
  )
}

function Field({
  label,
  name,
  type = 'text',
  required,
  placeholder,
}: {
  label: string
  name: string
  type?: string
  required?: boolean
  placeholder?: string
}) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-[var(--color-fg-soft)] mb-1.5">
        {label}
        {required && <span className="text-[var(--color-brand)] ml-0.5">*</span>}
      </span>
      <input
        type={type}
        name={name}
        required={required}
        placeholder={placeholder}
        autoComplete={type === 'email' ? 'email' : 'on'}
        className="w-full rounded-xl border border-[var(--color-line)] bg-white px-4 py-3 text-sm placeholder:text-[var(--color-fg-subtle)] focus:outline-none focus:border-[var(--color-brand)] focus:ring-2 focus:ring-[var(--color-brand)]/15 transition-all"
      />
    </label>
  )
}

function SelectField({
  label,
  name,
  children,
}: {
  label: string
  name: string
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-[var(--color-fg-soft)] mb-1.5">{label}</span>
      <select
        name={name}
        defaultValue=""
        className="w-full rounded-xl border border-[var(--color-line)] bg-white px-4 py-3 text-sm focus:outline-none focus:border-[var(--color-brand)] focus:ring-2 focus:ring-[var(--color-brand)]/15 transition-all"
      >
        {children}
      </select>
    </label>
  )
}

function TextArea({
  label,
  name,
  placeholder,
}: {
  label: string
  name: string
  placeholder?: string
}) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-[var(--color-fg-soft)] mb-1.5">{label}</span>
      <textarea
        name={name}
        rows={3}
        placeholder={placeholder}
        className="w-full rounded-xl border border-[var(--color-line)] bg-white px-4 py-3 text-sm placeholder:text-[var(--color-fg-subtle)] focus:outline-none focus:border-[var(--color-brand)] focus:ring-2 focus:ring-[var(--color-brand)]/15 transition-all resize-none"
      />
    </label>
  )
}

function SuccessState() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, ease }}
      className="flex flex-col items-center text-center py-8"
    >
      <div className="size-16 rounded-full grad-green flex items-center justify-center mb-6">
        <CheckCircle2 className="size-8 text-white" strokeWidth={2} />
      </div>
      <h3 className="text-2xl font-semibold tracking-tight mb-3">Pedido recebido!</h3>
      <p className="text-[var(--color-fg-muted)] max-w-[40ch] mb-6">
        Em até <strong>48h úteis</strong> respondemos no email que você informou. Enquanto isso,
        confere se o nosso email não caiu em spam.
      </p>
      <p className="text-xs text-[var(--color-fg-subtle)]">
        Vagas Beta limitadas a 5 — priorizamos perfil e contexto.
      </p>
    </motion.div>
  )
}
