/**
 * Validação fail-fast de variáveis de ambiente em produção.
 *
 * Em desenvolvimento, defaults razoáveis cobrem tudo. Em produção, queremos
 * que o processo aborte CEDO se algo crítico estiver ausente — melhor crashar
 * no boot do que rodar com encryption desligada / billing bypassed / sessões
 * com secret efêmero.
 */

type EnvCheck = {
  /** Nome da env var. */
  name: string
  /** Mensagem do que ela faz, mostrada no erro. */
  description: string
  /** Quando NODE_ENV=production, é obrigatória? */
  requiredInProd: boolean
  /** Validador opcional (formato, comprimento mínimo). */
  validate?: (value: string) => string | null
}

/**
 * Variáveis cuja PRESENÇA é proibida em produção (dev-only bypasses).
 * Se definidas com valor não-vazio em NODE_ENV=production, o boot aborta.
 */
const PROD_FORBIDDEN: Array<{ name: string; description: string; forbiddenValues?: string[] }> = [
  {
    name: 'BILLING_GATE_DISABLED',
    description: 'Bypass do subscription gate. Bloqueado em produção para evitar acesso sem assinatura.',
    forbiddenValues: ['1', 'true', 'yes'],
  },
  {
    name: 'ALLOW_PRIVATE_HOSTS',
    description: 'Permite proxy para IPs internos/localhost (SSRF mitigation override). Bloqueado em produção.',
  },
]

/**
 * Variáveis RECOMENDADAS em produção. Ausência gera warning no boot, mas não aborta.
 */
const PROD_RECOMMENDED: Array<{ name: string; description: string }> = [
  {
    name: 'SENTRY_DSN',
    description: 'DSN do projeto Sentry para captura de exceções e alertas em produção.',
  },
]

function minLength(min: number) {
  return (value: string): string | null =>
    value.length >= min ? null : `deve ter ao menos ${min} caracteres (atual: ${value.length})`
}

function urlPrefix(prefixes: string[]) {
  return (value: string): string | null =>
    prefixes.some((p) => value.startsWith(p)) ? null : `deve começar com ${prefixes.join(' ou ')}`
}

function nonEmptyCsv(value: string): string | null {
  const items = value.split(',').map((s) => s.trim()).filter(Boolean)
  return items.length > 0 ? null : 'deve conter ao menos 1 valor separado por vírgula'
}

const CHECKS: EnvCheck[] = [
  {
    name: 'IGA_SESSION_JWT_SECRET',
    description: 'Segredo HS256 para assinar sessões. Sem isso, sessões usam segredo efêmero (recriadas a cada deploy = logout massa).',
    requiredInProd: true,
    validate: minLength(32),
  },
  {
    name: 'IGA_SECRETS_KEY',
    description: 'Chave AES-256-GCM (base64 32 bytes) para criptografar credenciais de datasources at rest.',
    requiredInProd: true,
    validate: minLength(32),
  },
  {
    name: 'FRONTEND_URL',
    description: 'URL do frontend para CORS e links em emails transacionais (ex.: https://app.igagestao.com.br).',
    requiredInProd: true,
    validate: urlPrefix(['https://']),
  },
  {
    name: 'DATABASE_URL',
    description: 'String de conexão Postgres. Obrigatória se IGA_STORAGE_DRIVER=postgres.',
    requiredInProd: process.env.IGA_STORAGE_DRIVER === 'postgres',
    validate: urlPrefix(['postgres://', 'postgresql://']),
  },
  {
    name: 'STRIPE_SECRET_KEY',
    description: 'Chave secreta Stripe (sk_live_... em prod, sk_test_... em staging).',
    requiredInProd: true,
    validate: urlPrefix(['sk_']),
  },
  {
    name: 'STRIPE_WEBHOOK_SECRET',
    description: 'Segredo para validar assinatura dos webhooks do Stripe (whsec_...).',
    requiredInProd: true,
    validate: urlPrefix(['whsec_']),
  },
  {
    name: 'SUPER_ADMIN_EMAILS',
    description: 'Lista CSV de emails que podem entrar em /api/v1/super-admin. Sem isso, ninguém entra mesmo sendo admin do tenant.',
    requiredInProd: true,
    validate: nonEmptyCsv,
  },
  {
    name: 'SMTP_HOST',
    description: 'Host SMTP para envio de emails transacionais (welcome, password reset, scheduled reports, trial expiry). Sem isso, emails falham silenciosos.',
    requiredInProd: true,
  },
  {
    name: 'SMTP_FROM',
    description: 'Endereço remetente dos emails transacionais (ex.: no-reply@igagestao.com.br).',
    requiredInProd: true,
  },
]

export type EnvValidationResult =
  | { ok: true; warnings: string[] }
  | { ok: false; missing: string[]; invalid: Array<{ name: string; reason: string }>; forbidden: Array<{ name: string; reason: string }>; warnings: string[] }

export function validateEnv(): EnvValidationResult {
  const isProduction = process.env.NODE_ENV === 'production'
  if (!isProduction) return { ok: true, warnings: [] }

  const missing: string[] = []
  const invalid: Array<{ name: string; reason: string }> = []
  const forbidden: Array<{ name: string; reason: string }> = []
  const warnings: string[] = []

  for (const check of CHECKS) {
    if (!check.requiredInProd) continue
    const value = process.env[check.name]?.trim() ?? ''
    if (!value) {
      missing.push(check.name)
      continue
    }
    const reason = check.validate?.(value)
    if (reason) invalid.push({ name: check.name, reason })
  }

  for (const item of PROD_FORBIDDEN) {
    const value = process.env[item.name]?.trim() ?? ''
    if (!value) continue
    if (item.forbiddenValues && !item.forbiddenValues.includes(value.toLowerCase())) continue
    forbidden.push({ name: item.name, reason: item.description })
  }

  for (const item of PROD_RECOMMENDED) {
    const value = process.env[item.name]?.trim() ?? ''
    if (!value) warnings.push(`${item.name} ausente — ${item.description}`)
  }

  if (missing.length === 0 && invalid.length === 0 && forbidden.length === 0) {
    return { ok: true, warnings }
  }
  return { ok: false, missing, invalid, forbidden, warnings }
}

/**
 * Roda a validação e aborta o processo se falhar em produção.
 * Chamado uma vez no bootstrap, antes de createApp().
 */
export function assertEnvValid(): void {
  const result = validateEnv()

  if (result.warnings.length > 0) {
    console.warn('⚠️  [IGA Backend] Avisos de configuração de produção:')
    for (const w of result.warnings) console.warn(`  • ${w}`)
  }

  if (result.ok) return

  const lines = ['❌ [IGA Backend] Configuração de produção incompleta:', '']

  if (result.missing.length > 0) {
    lines.push('Variáveis OBRIGATÓRIAS ausentes:')
    for (const name of result.missing) {
      const check = CHECKS.find((c) => c.name === name)
      lines.push(`  • ${name}`)
      if (check) lines.push(`      ${check.description}`)
    }
    lines.push('')
  }

  if (result.invalid.length > 0) {
    lines.push('Variáveis com formato inválido:')
    for (const { name, reason } of result.invalid) {
      lines.push(`  • ${name}: ${reason}`)
    }
    lines.push('')
  }

  if (result.forbidden.length > 0) {
    lines.push('Variáveis PROIBIDAS em produção (apenas dev):')
    for (const { name, reason } of result.forbidden) {
      lines.push(`  • ${name}: ${reason}`)
    }
    lines.push('')
  }

  lines.push('Defina-as no Render Dashboard → Environment e faça redeploy.')
  lines.push('Ver docs/DEPLOY-TODAY.md para o checklist completo.')

  console.error(lines.join('\n'))
  process.exit(1)
}
