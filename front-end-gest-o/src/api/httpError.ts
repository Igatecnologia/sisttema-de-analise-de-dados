import axios from 'axios'
import { ZodError } from 'zod'
import { ApiContractError } from './validatedHttp'

const statusMessages: Record<number, string> = {
  400: 'Requisicao invalida. Revise os filtros e tente novamente.',
  401: 'Sua sessao expirou. Faca login novamente.',
  403: 'Voce nao tem permissao para executar esta acao.',
  404: 'Recurso nao encontrado.',
  409: 'Conflito de dados. Atualize a pagina e tente novamente.',
  422: 'Dados invalidos. Corrija os campos informados.',
  429: 'Muitas requisicoes. Aguarde alguns segundos.',
  500: 'Erro interno do servidor. Tente novamente em instantes.',
  502: 'Servico temporariamente indisponivel.',
  503: 'Servico em manutencao. Tente novamente mais tarde.',
}

export function getHttpStatusMessage(status?: number): string {
  if (!status) return 'Falha de conexao com o servidor.'
  return statusMessages[status] ?? `Erro HTTP ${status}.`
}

export function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiContractError) {
    return 'Resposta da API fora do contrato esperado.'
  }

  if (axios.isAxiosError(error)) {
    const status = error.response?.status
    const data = error.response?.data as { message?: string } | undefined
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      return 'Tempo limite da requisição esgotado. O servidor pode estar lento ou o período consultado muito grande. Tente de novo ou reduza o intervalo de datas.'
    }
    if (data?.message?.trim()) return data.message.trim()
    if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
      return 'Sem resposta do servidor (rede ou CORS). Verifique se o backend está online e se a fonte está configurada nas telas de Data Source.'
    }
    return getHttpStatusMessage(status)
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message
  }

  return fallback
}

/** Só em desenvolvimento: detalhe de contrato Zod para suporte. */
export function getTechnicalErrorDetail(error: unknown): string | null {
  if (!import.meta.env.DEV) return null
  if (error instanceof ApiContractError && error.details instanceof ZodError) {
    return JSON.stringify(error.details.issues, null, 2)
  }
  if (error instanceof ApiContractError && error.details != null) {
    try {
      return JSON.stringify(error.details, null, 2).slice(0, 8000)
    } catch {
      return String(error.details)
    }
  }
  return null
}
