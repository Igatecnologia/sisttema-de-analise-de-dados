import type { Faturamento, FormaPagamento, TipoDocumentoFiscal } from '../types/models'
import { normalizeVendaAnaliticaRow, pickRaw, toNum, toStr } from './sgbrVendaAnaliticoNormalize'

function mapFormaPagamento(v: unknown): FormaPagamento {
  const s = toStr(v, '').toLowerCase()
  if (/pix|instant/.test(s)) return 'PIX'
  if (/cart|credito|debito|card|visa|master/.test(s)) return 'Cartão'
  if (/dinheiro|esp[eé]cie|cash/.test(s)) return 'Dinheiro'
  if (/boleto/.test(s)) return 'Boleto'
  return 'Prazo'
}

function inferTipoDocumento(row: Record<string, unknown>): TipoDocumentoFiscal {
  const tipo = toStr(pickRaw(row, ['tipodocumento', 'tipo_documento', 'tipo_nf', 'tiponf', 'tipo']), '').toUpperCase()
  if (/NFS-?E|SERVI[cÇ]O|RPS/.test(tipo)) return 'NFS-e'
  if (/NFC-?E|CONSUMIDOR/.test(tipo)) return 'NFC-e'
  if (/CT-?E|CONHECIMENTO|TRANSPORTE/.test(tipo)) return 'CT-e'
  const mod = toStr(pickRaw(row, ['modelo', 'mod', 'modelodoc', 'modelo_doc']), '')
  if (mod === '65') return 'NFC-e'
  if (mod === '57') return 'CT-e'
  if (mod === '55' || mod === '') return 'NF-e'
  return 'Outro'
}

function inferStatus(row: Record<string, unknown>): Faturamento['status'] {
  const s = toStr(
    pickRaw(row, ['status', 'situacao', 'situacao_nfe', 'sit_nf', 'cstat', 'desc_situacao']),
    '',
  ).toLowerCase()
  if (/cancel|deneg|inutil|135|102/.test(s)) return 'Cancelada'
  if (/pend|denied|rejeit/.test(s)) return 'Pendente'
  return 'Emitida'
}

/**
 * Converte uma linha bruta do SGBR (`notasfiscais/*`) para o modelo de tela `Faturamento`.
 */
export function normalizeNotaFiscalRow(row: Record<string, unknown>, index: number): Faturamento {
  const numeroNF = toStr(
    pickRaw(row, ['numeronf', 'numero_nf', 'nnf', 'nr_nota', 'nronota', 'nota', 'nf', 'numero', 'nfe', 'nrnf']),
    '',
  ).trim()

  const dataRaw = toStr(
    pickRaw(row, ['data', 'dt_emissao', 'data_emissao', 'emissao', 'dataemi', 'dtemi', 'dta']),
    '',
  )
  const data = dataRaw.length >= 10 ? dataRaw.slice(0, 10) : dataRaw || '1970-01-01'

  const pedidoId = toStr(
    pickRaw(row, ['numpedido', 'num_pedido', 'pedido', 'codpedido', 'cod_pedido', 'id_pedido', 'pedidoid']),
    '',
  )

  const cliente = toStr(
    pickRaw(row, [
      'nomecliente',
      'nome_cliente',
      'cliente',
      'destinatario',
      'razao',
      'razaosocial',
      'nm_cliente',
    ]),
    '—',
  )

  const valorTotal = toNum(pickRaw(row, ['valor_total', 'vltotal', 'total', 'vl_total', 'valor', 'vltot', 'totalnf']), 0)
  const valorFrete = toNum(pickRaw(row, ['valor_frete', 'vl_frete', 'frete', 'vlfrete']), 0)
  const valorProdutos = toNum(
    pickRaw(row, ['valor_produtos', 'vl_produtos', 'totalprodutos', 'vl_prod', 'valor_mercadoria']),
    Math.max(0, valorTotal - valorFrete),
  )
  const valorImpostos = toNum(
    pickRaw(row, ['valor_impostos', 'vl_impostos', 'impostos', 'total_imposto', 'v_icms', 'tributos']),
    Math.max(0, valorTotal - valorProdutos - valorFrete),
  )

  const id =
    toStr(pickRaw(row, ['id', 'chave', 'chavenfe', 'chave_nfe', 'chaveacesso']), '') ||
    `nf-${numeroNF || index}-${data}-${index}`

  return {
    id: id.length > 120 ? `${id.slice(0, 80)}-${index}` : id,
    data,
    pedidoId,
    cliente: cliente || '—',
    numeroNF,
    tipoDocumento: inferTipoDocumento(row),
    valorProdutos,
    valorFrete,
    valorImpostos,
    valorTotal: valorTotal || valorProdutos + valorFrete + valorImpostos,
    formaPagamento: mapFormaPagamento(pickRaw(row, ['forma_pagamento', 'formapagamento', 'pagamento', 'condpgto'])),
    status: inferStatus(row),
  }
}

/**
 * Converte linha de `vendanfe/analitico` (itens de NF) para exibição na grade de notas fiscais.
 * Uma nota pode gerar várias linhas (produtos); o id é único por linha.
 */
export function faturamentoFromVendaAnaliticaRow(row: Record<string, unknown>, index: number): Faturamento {
  const v = normalizeVendaAnaliticaRow(row)
  const numeroNF = toStr(
    pickRaw(row, ['numeronf', 'numero_nf', 'nnf', 'nr_nf', 'nfe', 'nota', 'nrnota', 'numero_nfe']),
    '',
  ).trim()
  const data = (v.datafec || v.data || '1970-01-01').slice(0, 10)
  const pedidoId = toStr(pickRaw(row, ['numpedido', 'pedido', 'num_pedido', 'cod_pedido']), '')
  const valorFrete = toNum(pickRaw(row, ['valor_frete', 'vl_frete', 'frete', 'vlfrete']), 0)
  const valorImpostos = toNum(pickRaw(row, ['valor_impostos', 'vl_impostos', 'impostos', 'vl_icms']), 0)
  const st = v.statuspedido.toUpperCase()
  const status: Faturamento['status'] = /CANCEL|DENEG|INUT/.test(st)
    ? 'Cancelada'
    : /PEND|REJE/.test(st)
      ? 'Pendente'
      : 'Emitida'

  return {
    id: `vna-${String(v.codcliente)}-${String(v.codprod)}-${data}-${index}`,
    data,
    pedidoId: pedidoId || '—',
    cliente: v.nomecliente || '—',
    numeroNF: numeroNF || '—',
    tipoDocumento: 'NF-e',
    valorProdutos: v.totalprodutos > 0 ? v.totalprodutos : v.total,
    valorFrete,
    valorImpostos,
    valorTotal: v.total,
    formaPagamento: mapFormaPagamento(pickRaw(row, ['forma_pagamento', 'formapagamento', 'pagamento', 'condpgto'])),
    status,
  }
}
