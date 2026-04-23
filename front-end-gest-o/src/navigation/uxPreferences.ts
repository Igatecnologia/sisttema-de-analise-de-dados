import type { AuthSession } from '../auth/authStorage'
import type { Permission } from '../auth/permissions'
import { tenantStorage } from '../tenant/tenantStorage'

export type NavRouteItem = {
  key: string
  path: string
  title: string
  permission?: Permission
}

export const NAV_ROUTES: NavRouteItem[] = [
  { key: 'gestao', path: '/gestao', title: 'Visão do gestor', permission: 'dashboard:view' },
  { key: 'dashboard', path: '/dashboard', title: 'Dashboard', permission: 'dashboard:view' },
  { key: 'dashboard-analises', path: '/dashboard/analises', title: 'Análises BI', permission: 'dashboard:view' },
  { key: 'dashboard-vendas-analitico', path: '/dashboard/vendas-analitico', title: 'Vendas', permission: 'dashboard:view' },
  { key: 'alertas', path: '/alertas', title: 'Alertas', permission: 'alertas:view' },
  { key: 'financeiro', path: '/financeiro', title: 'Financeiro', permission: 'reports:view' },
  { key: 'relatorios', path: '/relatorios', title: 'Relatórios', permission: 'reports:view' },
  { key: 'usuarios', path: '/usuarios', title: 'Funcionários', permission: 'users:view' },
  { key: 'auditoria', path: '/auditoria', title: 'Auditoria', permission: 'audit:view' },
  { key: 'producao', path: '/producao', title: 'Produção', permission: 'producao:view' },
  { key: 'ficha-tecnica', path: '/ficha-tecnica', title: 'Ficha técnica', permission: 'fichatecnica:view' },
  { key: 'comercial', path: '/comercial', title: 'Comercial', permission: 'comercial:view' },
  { key: 'estoque', path: '/estoque', title: 'Estoque', permission: 'estoque:view' },
  { key: 'suporte-fale-conosco', path: '/suporte/fale-conosco', title: 'Fale conosco' },
  { key: 'suporte', path: '/suporte', title: 'Área técnica', permission: 'support:view' },
  { key: 'tokens', path: '/tokens', title: 'Design Tokens', permission: 'support:view' },
  { key: 'fontes-de-dados', path: '/fontes-de-dados', title: 'Fontes de dados', permission: 'datasources:view' },
  { key: 'admin-operacao', path: '/admin/operacao', title: 'Operação', permission: 'operations:view' },
]

export type WorkspaceId = 'financeiro' | 'comercial' | 'operacional'

export type WorkspaceDefinition = {
  id: WorkspaceId
  label: string
  suggestedPaths: string[]
  defaultHomePath: string
}

export const WORKSPACES: WorkspaceDefinition[] = [
  {
    id: 'financeiro',
    label: 'Financeiro',
    suggestedPaths: ['/financeiro', '/relatorios', '/dashboard/vendas-analitico'],
    defaultHomePath: '/financeiro',
  },
  {
    id: 'comercial',
    label: 'Comercial',
    suggestedPaths: ['/comercial', '/dashboard/vendas-analitico', '/relatorios'],
    defaultHomePath: '/comercial',
  },
  {
    id: 'operacional',
    label: 'Operacional',
    suggestedPaths: ['/producao', '/estoque', '/alertas'],
    defaultHomePath: '/gestao',
  },
]

type UserUxPreferences = {
  favoritePaths: string[]
  homePath: string | null
  workspaceId: WorkspaceId
}

type FilterStateRecord = {
  value: string
  updatedAt: number
}

const UX_PREFERENCES_KEY = 'ux.preferences'
const FILTER_STATE_KEY = 'ux.filter-state'

function getUserScope(session: AuthSession | null): string {
  return session?.user.id ?? 'anonymous'
}

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

function getAllUxPreferences(): Record<string, UserUxPreferences> {
  return safeParse<Record<string, UserUxPreferences>>(tenantStorage.getItem(UX_PREFERENCES_KEY)) ?? {}
}

function saveAllUxPreferences(next: Record<string, UserUxPreferences>) {
  tenantStorage.setItem(UX_PREFERENCES_KEY, JSON.stringify(next))
}

export function getUserUxPreferences(session: AuthSession | null): UserUxPreferences {
  const all = getAllUxPreferences()
  const key = getUserScope(session)
  const current = all[key]
  return {
    favoritePaths: current?.favoritePaths ?? [],
    homePath: current?.homePath ?? null,
    workspaceId:
      current?.workspaceId === 'financeiro' ||
      current?.workspaceId === 'comercial' ||
      current?.workspaceId === 'operacional'
        ? current.workspaceId
        : 'operacional',
  }
}

export function saveUserUxPreferences(
  session: AuthSession | null,
  updater: (previous: UserUxPreferences) => UserUxPreferences,
) {
  const all = getAllUxPreferences()
  const key = getUserScope(session)
  all[key] = updater(getUserUxPreferences(session))
  saveAllUxPreferences(all)
}

export function getAllowedRoutes(session: AuthSession | null): NavRouteItem[] {
  return NAV_ROUTES.filter((route) =>
    route.permission ? session?.permissions.includes(route.permission) : true,
  )
}

export function getWorkspaceDefinition(
  workspaceId: WorkspaceId,
): WorkspaceDefinition {
  return WORKSPACES.find((workspace) => workspace.id === workspaceId) ?? WORKSPACES[0]
}

type AllFilterStates = Record<string, FilterStateRecord>

function getAllFilterStates(): AllFilterStates {
  return safeParse<AllFilterStates>(tenantStorage.getItem(FILTER_STATE_KEY)) ?? {}
}

function saveAllFilterStates(next: AllFilterStates) {
  tenantStorage.setItem(FILTER_STATE_KEY, JSON.stringify(next))
}

function makeFilterStorageKey(session: AuthSession | null, filterKey: string): string {
  return `${getUserScope(session)}:${filterKey}`
}

export function getPersistedFilterState(
  session: AuthSession | null,
  filterKey: string,
  ttlMs: number,
): string | null {
  const all = getAllFilterStates()
  const key = makeFilterStorageKey(session, filterKey)
  const record = all[key]
  if (!record) return null
  if (Date.now() - record.updatedAt > ttlMs) {
    delete all[key]
    saveAllFilterStates(all)
    return null
  }
  return record.value
}

export function savePersistedFilterState(
  session: AuthSession | null,
  filterKey: string,
  value: string,
) {
  const all = getAllFilterStates()
  const key = makeFilterStorageKey(session, filterKey)
  all[key] = { value, updatedAt: Date.now() }
  saveAllFilterStates(all)
}

export function resetPersistedFilterState(session: AuthSession | null, filterKey: string) {
  const all = getAllFilterStates()
  delete all[makeFilterStorageKey(session, filterKey)]
  saveAllFilterStates(all)
}
