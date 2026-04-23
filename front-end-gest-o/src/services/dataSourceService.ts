import axios from 'axios'
import { z } from 'zod'
import { API_BASE_URL } from '../api/apiEnv'
import { getCurrentTenantId } from '../tenant/tenantStorage'
import {
  dataSourceSchema,
  dataSourceListSchema,
  dataSourceCreateSchema,
  dataSourceTestResultSchema,
} from '../api/schemas'
import { http } from './http'
import { getValidated, postValidated, putValidated } from '../api/validatedHttp'
import { tenantStorage } from '../tenant/tenantStorage'

const BASE = '/api/v1/datasources'
const STORAGE_KEY = 'datasources'

export type DataSource = z.infer<typeof dataSourceSchema>
export type DataSourceCreatePayload = z.infer<typeof dataSourceCreateSchema>
export type DataSourceUpdatePayload = Partial<DataSourceCreatePayload>
export type DataSourceTestResult = z.infer<typeof dataSourceTestResultSchema>

// ─── Cache local (para hasAnySources funcionar antes do fetch) ──────────────

function readCache(): DataSource[] {
  try {
    const raw = tenantStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

function writeCache(items: DataSource[]) {
  tenantStorage.setItem(STORAGE_KEY, JSON.stringify(items))
}

export function hasAnySources(): boolean {
  return readCache().length > 0
}

export function getAuthDataSource(): DataSource | null {
  return readCache().find((ds) => ds.isAuthSource) ?? null
}

/** Só o path do endpoint, sem query/hash — evita falha de match com `.../contas/pagas?dt_de=...`. */
export function normalizeDataEndpointPath(ep: string | undefined): string {
  if (!ep) return ''
  let s = ep.trim()
  const q = s.indexOf('?')
  if (q >= 0) s = s.slice(0, q)
  const h = s.indexOf('#')
  if (h >= 0) s = s.slice(0, h)
  if (s.startsWith('http')) {
    try {
      s = new URL(s).pathname
    } catch {
      /* mantém */
    }
  }
  return s.toLowerCase()
}

export function getDataSourceByEndpointHint(endpointHint: string): DataSource | null {
  const hint = normalizeDataEndpointPath(endpointHint)
  if (!hint) return null
  const all = readCache()
  const exact = all.find((ds) => normalizeDataEndpointPath(ds.dataEndpoint) === hint)
  if (exact) return exact
  const partial = all.find((ds) => normalizeDataEndpointPath(ds.dataEndpoint).includes(hint))
  if (partial) return partial
  return null
}

export function getDataSourceLabelByEndpointHint(endpointHint: string): string {
  const ds = getDataSourceByEndpointHint(endpointHint)
  if (!ds) return 'Fonte não identificada'
  return `${ds.name} (${ds.id.slice(0, 8)})`
}

/**
 * Endpoints SGBR BI para contas a pagar (Runbook oficial + variações frequentes no cadastro).
 */
export const CONTAS_PAGAR_SGBR_ENDPOINT_HINTS = [
  '/sgbrbi/contas/pagas',
  '/sgbrbi/contas/pagar',
  '/sgbrbi/contas-a-pagar',
  '/sgbrbi/contas_a_pagar',
] as const

function pathLooksLikeContasPagar(p: string): boolean {
  const s = p.toLowerCase()
  if (!s.includes('contas')) return false
  if (/receber|a-receber|areceber|contas\/receber/.test(s)) return false
  return (
    s.includes('contas/pagas') ||
    s.includes('contas/pagar') ||
    s.includes('contas-a-pagar') ||
    s.includes('contas_a_pagar') ||
    (s.includes('sgbrbi') && s.includes('contaspagas'))
  )
}

/**
 * Busca qualquer fonte taggeada com uma área específica em `erpEndpoints`.
 * `erpEndpoints` é preenchido automaticamente pelo auto-apply (`handleSave`) rodando
 * `diagnoseFields()` sobre a amostra da API — ou seja: se o conteúdo da API
 * casar com a área, a fonte é reconhecida mesmo que a URL não bata com hints.
 */
export function getDataSourcesByArea(area: string): DataSource[] {
  return readCache().filter((ds) => (ds.erpEndpoints ?? []).includes(area))
}

/**
 * Resolve a fonte para Financeiro → Contas a pagar.
 * Ordem: (1) tag de área detectada pelo diagnose; (2) URL com hint conhecido;
 * (3) heurística genérica no path. Primeiro match vence.
 */
export function getContasPagarSgbrDataSource(): DataSource | null {
  const byArea = getDataSourcesByArea('contas-a-pagar')
  if (byArea.length > 0) return byArea[0]
  for (const hint of CONTAS_PAGAR_SGBR_ENDPOINT_HINTS) {
    const ds = getDataSourceByEndpointHint(hint)
    if (ds) return ds
  }
  const match = readCache().find((ds) => {
    const p = normalizeDataEndpointPath(ds.dataEndpoint)
    return p.length > 0 && pathLooksLikeContasPagar(p)
  })
  return match ?? null
}

/**
 * Contas a receber — mesma lógica de prioridade.
 */
export function getContasReceberDataSource(): DataSource | null {
  const byArea = getDataSourcesByArea('contas-a-receber')
  if (byArea.length > 0) return byArea[0]
  const all = readCache()
  return all.find((ds) => {
    const p = normalizeDataEndpointPath(ds.dataEndpoint)
    return p.includes('receber')
  }) ?? null
}

/**
 * Caminhos SGBR equivalentes para vendas analítico / NFe (dashboard, financeiro, relatórios).
 * `vendanfe` primeiro; depois `vendas`; por fim `notasfiscais/*` (mesmo BI, para quem só cadastrou NF).
 */
export const VENDAS_ANALITICO_DATA_ENDPOINT_HINTS = [
  '/sgbrbi/vendanfe/analitico',
  '/sgbrbi/vendas/analitico',
  '/sgbrbi/notasfiscais/analitico',
  '/sgbrbi/notasfiscais/listagem',
] as const

/**
 * Todas as fontes cadastradas cujo endpoint equivale a vendas analítico / NFe (BI).
 * Ordenadas por prioridade do hint (vendanfe → vendas → notasfiscais), depois nome.
 */
export function getAllVendasAnaliticoDataSources(): DataSource[] {
  const all = readCache()
  const matches: { ds: DataSource; priority: number }[] = []
  for (const ds of all) {
    const p = normalizeDataEndpointPath(ds.dataEndpoint)
    if (!p) continue
    let priority = 999
    for (let i = 0; i < VENDAS_ANALITICO_DATA_ENDPOINT_HINTS.length; i++) {
      const h = normalizeDataEndpointPath(VENDAS_ANALITICO_DATA_ENDPOINT_HINTS[i])
      if (p === h || p.includes(h)) {
        priority = Math.min(priority, i)
      }
    }
    if (priority < 999) matches.push({ ds, priority })
  }
  matches.sort((a, b) => a.priority - b.priority || a.ds.name.localeCompare(b.ds.name))
  return matches.map((m) => m.ds)
}

/** Primeira fonte pelo critério de prioridade (compatível com comportamento anterior). */
export function getVendasAnaliticoDataSource(): DataSource | null {
  const all = getAllVendasAnaliticoDataSources()
  return all[0] ?? null
}

/**
 * Caminhos SGBR para listagem/analítico de notas fiscais (aba Comercial → Notas fiscais).
 */
export const NOTAS_FISCAIS_DATA_ENDPOINT_HINTS = [
  '/sgbrbi/notasfiscais/analitico',
  '/sgbrbi/notasfiscais/listagem',
  '/sgbrbi/notasfiscal/analitico',
  '/sgbrbi/notafiscal/analitico',
  '/sgbrbi/notasfiscais',
] as const

/** `GET /sgbrbi/produzido?dt_de=&dt_ate=` — relatório de produção no BI. */
export const PRODUZIDO_SGBR_ENDPOINT_HINTS = ['/sgbrbi/produzido'] as const

/**
 * Fonte para a aba Comercial → Notas fiscais.
 * Inclui paths `notasfiscais/*`, variações `notafiscal`, e fallback **`vendanfe/analitico`** (NF-e no BI, mesmo conjunto que o teste “40 registros”).
 */
export function getNotasFiscaisDataSource(): DataSource | null {
  for (const hint of NOTAS_FISCAIS_DATA_ENDPOINT_HINTS) {
    const ds = getDataSourceByEndpointHint(hint)
    if (ds) return ds
  }
  const loose =
    getDataSourceByEndpointHint('notasfiscais') ??
    getDataSourceByEndpointHint('notas_fiscais') ??
    getDataSourceByEndpointHint('notafiscal')
  if (loose) return loose

  const all = readCache()
  for (const ds of all) {
    const p = normalizeDataEndpointPath(ds.dataEndpoint)
    if (!p) continue
    if (/notas?fiscal|nota_fiscal|notas_fiscais|\/nfe\//.test(p)) return ds
  }
  for (const ds of all) {
    const p = normalizeDataEndpointPath(ds.dataEndpoint)
    if (p.includes('vendanfe')) return ds
  }
  return null
}

export function getNotasFiscaisDataSourceLabel(): string {
  const ds = getNotasFiscaisDataSource()
  if (!ds) return 'Fonte não identificada'
  return `${ds.name} (${ds.id.slice(0, 8)})`
}

/**
 * Fonte cuja rota de dados é `.../produzido` (tag `produzido-sgbr` no diagnose ou path).
 */
export function getProduzidoSgbrDataSource(): DataSource | null {
  const byArea = getDataSourcesByArea('produzido-sgbr')
  if (byArea.length > 0) return byArea[0]
  for (const hint of PRODUZIDO_SGBR_ENDPOINT_HINTS) {
    const ds = getDataSourceByEndpointHint(hint)
    if (ds) return ds
  }
  const match = readCache().find((ds) => {
    const p = normalizeDataEndpointPath(ds.dataEndpoint)
    return /\/produzido\b/.test(p)
  })
  return match ?? null
}

export function getProduzidoSgbrDataSourceLabel(): string {
  const ds = getProduzidoSgbrDataSource()
  if (!ds) return 'Fonte não identificada'
  return `${ds.name} (${ds.id.slice(0, 8)})`
}

// ─── CRUD via backend ───────────────────────────────────────────────────────

export async function listDataSources(): Promise<DataSource[]> {
  try {
    return await listDataSourcesFromApi()
  } catch {
    return readCache()
  }
}

export async function listDataSourcesFromApi(): Promise<DataSource[]> {
  const list = await getValidated(http, BASE, dataSourceListSchema)
  writeCache(list)
  return list
}

export async function createDataSource(payload: DataSourceCreatePayload): Promise<DataSource> {
  const ds = await postValidated(http, BASE, payload, dataSourceSchema)
  try {
    await listDataSourcesFromApi()
  } catch {
    const all = [...readCache().filter((d) => d.id !== ds.id), ds]
    writeCache(all)
  }
  return ds
}

export async function updateDataSource(id: string, payload: DataSourceUpdatePayload): Promise<DataSource> {
  const ds = await putValidated(http, `${BASE}/${id}`, payload, dataSourceSchema)
  try {
    await listDataSourcesFromApi()
  } catch {
    writeCache(readCache().map((d) => (d.id === id ? ds : d)))
  }
  return ds
}

export async function deleteDataSource(id: string): Promise<void> {
  await http.delete(`${BASE}/${id}`)
  try {
    await listDataSourcesFromApi()
  } catch {
    writeCache(readCache().filter((d) => d.id !== id))
  }
}

export async function testDataSourceConnection(id: string): Promise<DataSourceTestResult> {
  try {
    const result = await postValidated(http, `${BASE}/${id}/test`, {}, dataSourceTestResultSchema)
    /** Lista completa no servidor — evita corrida com vários POST /test em paralelo (merge local perdia status da outra fonte). */
    try {
      await listDataSourcesFromApi()
    } catch {
      const all = readCache()
      const idx = all.findIndex((d) => d.id === id)
      if (idx >= 0) {
        all[idx] = {
          ...all[idx],
          status: result.success ? 'connected' : 'error',
          lastCheckedAt: new Date().toISOString(),
          lastError: result.success ? null : result.message,
        }
        writeCache(all)
      }
    }
    return result
  } catch (e) {
    if (axios.isAxiosError(e) && e.response?.status === 404) {
      try {
        await listDataSourcesFromApi()
      } catch {
        /* mantém cache */
      }
      const body = e.response?.data as { tenantId?: string; requestedId?: string } | undefined
      const tenant = getCurrentTenantId()
      const hint = [
        'O backend não encontrou esta fonte (404).',
        `Tenant enviado: "${tenant}"${body?.requestedId ? `; id: ${body.requestedId}` : ''}.`,
        `Origem da API no app: ${API_BASE_URL} (não inclua /api/v1 em VITE_API_BASE_URL).`,
        'Se usa VITE_TENANT_ID ou subdomínio, o cadastro no servidor (data/datasources.json) precisa ser do mesmo tenant.',
        'Recarregue a página. Se continuar, exclua e crie a conexão de novo.',
      ].join(' ')
      throw new Error(hint)
    }
    throw e
  }
}

export async function testDataSourceDraft(payload: DataSourceCreatePayload): Promise<DataSourceTestResult> {
  return postValidated(http, `${BASE}/test`, payload, dataSourceTestResultSchema)
}
