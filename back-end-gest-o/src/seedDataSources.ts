import { readAll, writeAll, genId, type DataSource } from './storage.js'

/**
 * Seed de datasources padrão — APIs Tiete Espumas (SGBR/BI).
 * Só cria se não existir nenhum datasource no banco (primeiro boot)
 * E somente se as variaveis SGBR_API_URL + SGBR_CREDENTIALS estiverem setadas.
 *
 * Em multi-tenant, cada cliente cadastra suas credenciais via UI; nao deve
 * existir credencial global hardcoded no codigo.
 */
export function seedDefaultDataSources() {
  const existing = readAll()
  if (existing.length > 0) return

  const baseUrl = process.env.SGBR_API_URL?.trim()
  const credentials = process.env.SGBR_CREDENTIALS?.trim()
  if (!baseUrl || !credentials) {
    console.log('[IGA][SEED] SGBR_API_URL/SGBR_CREDENTIALS nao definidos — pulando seed de datasources.')
    return
  }
  const tenantId = process.env.SGBR_SEED_TENANT_ID?.trim() || 'default'
  const now = new Date().toISOString()

  const endpoints = [
    { name: 'Vendas', endpoint: '/sgbrbi/vendas/analitico', isAuth: true },
    { name: 'Notas Fiscais', endpoint: '/sgbrbi/vendanfe/analitico', isAuth: false },
    { name: 'Contas Pagas', endpoint: '/sgbrbi/contas/pagas', isAuth: false },
    { name: 'Produção', endpoint: '/sgbrbi/produzido', isAuth: false },
    { name: 'Estoque', endpoint: '/sgbrbi/estoque', isAuth: false },
    { name: 'Compras', endpoint: '/sgbrbi/compras', isAuth: false },
  ]

  const sources: DataSource[] = endpoints.map((ep) => ({
    id: genId(),
    tenantId,
    name: `${ep.name} - Tiete Espumas`,
    type: 'sgbr_bi',
    apiUrl: baseUrl,
    authMethod: 'jwt',
    authCredentials: credentials,
    status: 'active',
    lastCheckedAt: null,
    lastError: null,
    fieldMappings: [],
    erpEndpoints: [ep.endpoint],
    isAuthSource: ep.isAuth,
    loginEndpoint: '/sgbrbi/usuario/login',
    dataEndpoint: ep.endpoint,
    passwordMode: 'sha256',
    loginFieldUser: 'login',
    loginFieldPassword: 'senha',
    createdAt: now,
    updatedAt: now,
  }))

  writeAll(sources)

  console.log(`[IGA][SEED] ${sources.length} datasources criados (Tiete Espumas):`)
  for (const s of sources) {
    console.log(`  + ${s.name} → ${s.dataEndpoint}`)
  }
}
