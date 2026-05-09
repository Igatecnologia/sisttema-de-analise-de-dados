/**
 * CNPJ lookup — BrasilAPI publica (https://brasilapi.com.br/api/cnpj/v1).
 * Sem auth, CORS publico. Mesmo cliente do apps/web/services/cnpjLookupService.ts
 * adaptado para o super-admin Next app.
 */

export type CnpjData = {
  cnpj: string
  razaoSocial: string
  nomeFantasia: string | null
  email: string | null
  telefone: string | null
  cep: string | null
  logradouro: string | null
  numero: string | null
  bairro: string | null
  municipio: string | null
  uf: string | null
  complemento: string | null
  situacao: string | null
  porte: string | null
  cnaePrincipal: string | null
  dataInicioAtividade: string | null
}

const BRASIL_API = 'https://brasilapi.com.br/api/cnpj/v1'

export function sanitizeCnpj(input: string): string {
  return input.replace(/\D/g, '').slice(0, 14)
}

export function isValidCnpj(input: string): boolean {
  const digits = sanitizeCnpj(input)
  if (digits.length !== 14) return false
  if (/^(\d)\1+$/.test(digits)) return false
  const calcDigit = (slice: string, weights: number[]): number => {
    const sum = slice.split('').reduce((acc, d, i) => acc + Number(d) * weights[i], 0)
    const mod = sum % 11
    return mod < 2 ? 0 : 11 - mod
  }
  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
  const d1 = calcDigit(digits.slice(0, 12), w1)
  const d2 = calcDigit(digits.slice(0, 12) + d1, w2)
  return d1 === Number(digits[12]) && d2 === Number(digits[13])
}

export function formatCnpj(input: string): string {
  const digits = sanitizeCnpj(input)
  if (digits.length <= 2) return digits
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`
  if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`
  if (digits.length <= 12) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12, 14)}`
}

type BrasilApiResponse = {
  cnpj: string
  razao_social: string
  nome_fantasia?: string | null
  email?: string | null
  ddd_telefone_1?: string | null
  cep?: string | null
  logradouro?: string | null
  numero?: string | null
  bairro?: string | null
  municipio?: string | null
  uf?: string | null
  complemento?: string | null
  descricao_situacao_cadastral?: string | null
  porte?: string | null
  cnae_fiscal_descricao?: string | null
  data_inicio_atividade?: string | null
  message?: string
  type?: string
}

export class CnpjNotFoundError extends Error {}
export class CnpjNetworkError extends Error {}

export async function lookupCnpj(cnpj: string): Promise<CnpjData> {
  const digits = sanitizeCnpj(cnpj)
  if (!isValidCnpj(digits)) throw new Error('CNPJ inválido. Verifique os dígitos.')
  let response: Response
  try {
    response = await fetch(`${BRASIL_API}/${digits}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    })
  } catch (err) {
    throw new CnpjNetworkError(`Não foi possível conectar à BrasilAPI: ${(err as Error).message}`)
  }
  if (response.status === 404) throw new CnpjNotFoundError('CNPJ não encontrado na base da Receita.')
  if (!response.ok) throw new CnpjNetworkError(`BrasilAPI HTTP ${response.status}`)
  const data = (await response.json()) as BrasilApiResponse
  if (data.type === 'not_found') throw new CnpjNotFoundError(data.message || 'CNPJ não encontrado.')
  return {
    cnpj: digits,
    razaoSocial: data.razao_social,
    nomeFantasia: data.nome_fantasia ?? null,
    email: data.email ?? null,
    telefone: data.ddd_telefone_1 ?? null,
    cep: data.cep ?? null,
    logradouro: data.logradouro ?? null,
    numero: data.numero ?? null,
    bairro: data.bairro ?? null,
    municipio: data.municipio ?? null,
    uf: data.uf ?? null,
    complemento: data.complemento ?? null,
    situacao: data.descricao_situacao_cadastral ?? null,
    porte: data.porte ?? null,
    cnaePrincipal: data.cnae_fiscal_descricao ?? null,
    dataInicioAtividade: data.data_inicio_atividade ?? null,
  }
}

/**
 * Slug ASCII a partir do nome/razao social. Usa Unicode Mn (combining marks)
 * para remover acentos depois de NFD, sem precisar literal de caracteres.
 */
export function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}
