/**
 * Masking de dados pessoais (PII) para exibição em interfaces e logs.
 */

/** Mascara email: admin@example.com → adm***@example.com */
export function maskEmail(email: string): string {
  const [local, domain] = email.split('@')
  if (!domain) return '***'
  const visible = Math.min(3, Math.floor(local.length / 2))
  return `${local.slice(0, visible)}***@${domain}`
}

/** Mascara nome: João Silva → João S. */
export function maskName(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length <= 1) return name
  return `${parts[0]} ${parts.slice(1).map((p) => `${p[0]}.`).join(' ')}`
}

/** Mascara CPF: 123.456.789-00 → ***.456.789-** */
export function maskCpf(cpf: string): string {
  const digits = cpf.replace(/\D/g, '')
  if (digits.length !== 11) return '***.***.***-**'
  return `***.${digits.slice(3, 6)}.${digits.slice(6, 9)}-**`
}

/** Mascara telefone: (11) 99999-1234 → (11) *****-1234 */
export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.length < 8) return '****-****'
  return phone.replace(/\d(?=\d{4})/g, '*')
}
