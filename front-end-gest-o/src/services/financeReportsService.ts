import type { ConciliacaoRow, ContaPagar, ContaReceber, EstoqueMateriaPrima, EstoqueEspuma, EstoqueProdutoFinal, VendaEspuma } from '../types/models'
import { getValidated } from '../api/validatedHttp'
import { fetchContasPagasFromSgbr, hasContasPagasSgbrSource } from './contasPagasService'
import {
  conciliacaoResponseSchema,
  contasPagarResponseSchema,
  contasReceberResponseSchema,
  estoqueMateriaPrimaResponseSchema,
  estoqueEspumaResponseSchema,
  estoqueProdutoFinalResponseSchema,
  vendasEspumaResponseSchema,
} from '../api/schemas'
import { http } from './http'

export async function getConciliacao(): Promise<ConciliacaoRow[]> {
  return getValidated(http, '/finance/conciliacao', conciliacaoResponseSchema) as Promise<ConciliacaoRow[]>
}

export async function getContasPagar(params?: { dtDe: string; dtAte: string }): Promise<ContaPagar[]> {
  if (hasContasPagasSgbrSource()) {
    return fetchContasPagasFromSgbr(params)
  }
  return getValidated(http, '/finance/contas-pagar', contasPagarResponseSchema) as Promise<ContaPagar[]>
}

export async function getContasReceber(): Promise<ContaReceber[]> {
  return getValidated(http, '/finance/contas-receber', contasReceberResponseSchema) as Promise<ContaReceber[]>
}

export async function getEstoqueMateriaPrima(): Promise<EstoqueMateriaPrima[]> {
  return getValidated(http, '/finance/estoque-materia-prima', estoqueMateriaPrimaResponseSchema) as Promise<EstoqueMateriaPrima[]>
}

export async function getEstoqueEspuma(): Promise<EstoqueEspuma[]> {
  return getValidated(http, '/finance/estoque-espuma', estoqueEspumaResponseSchema) as Promise<EstoqueEspuma[]>
}

export async function getEstoqueProdutoFinal(): Promise<EstoqueProdutoFinal[]> {
  return getValidated(http, '/finance/estoque-produto-final', estoqueProdutoFinalResponseSchema) as Promise<EstoqueProdutoFinal[]>
}

export async function getVendasEspuma(): Promise<VendaEspuma[]> {
  return getValidated(http, '/finance/vendas-espuma', vendasEspumaResponseSchema) as Promise<VendaEspuma[]>
}
