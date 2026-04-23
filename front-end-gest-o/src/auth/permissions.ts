import type { AuthSession } from './authStorage'
import type { UserRole } from '../types/models'

export type Permission =
  | 'dashboard:view'
  | 'reports:view'
  | 'reports:export'
  | 'audit:view'
  | 'audit:export'
  | 'users:view'
  | 'users:write'
  | 'producao:view'
  | 'producao:write'
  | 'fichatecnica:view'
  | 'fichatecnica:write'
  | 'comercial:view'
  | 'comercial:write'
  | 'estoque:view'
  | 'estoque:write'
  | 'alertas:view'
  | 'support:view'
  | 'datasources:view'
  | 'operations:view'

export const ALL_PERMISSIONS: Permission[] = [
  'dashboard:view',
  'reports:view',
  'reports:export',
  'audit:view',
  'audit:export',
  'users:view',
  'users:write',
  'producao:view',
  'producao:write',
  'fichatecnica:view',
  'fichatecnica:write',
  'comercial:view',
  'comercial:write',
  'estoque:view',
  'estoque:write',
  'alertas:view',
  'support:view',
  'datasources:view',
  'operations:view',
]

/** Infra / suporte: não entram no perfil padrão de gerente nem visualizador. */
export const SUPPORT_EXCLUSIVE_PERMISSIONS: Permission[] = [
  'support:view',
  'datasources:view',
  'operations:view',
]

export function defaultPermissionsForRole(role: UserRole): Permission[] {
  if (role === 'admin') return [...ALL_PERMISSIONS]
  if (role === 'manager')
    return ALL_PERMISSIONS.filter(
      (p) => !p.startsWith('users:') && !SUPPORT_EXCLUSIVE_PERMISSIONS.includes(p),
    )
  return ALL_PERMISSIONS.filter(
    (p) => p.endsWith(':view') && !SUPPORT_EXCLUSIVE_PERMISSIONS.includes(p),
  )
}

/** Rótulos para checkboxes em Funcionários (agrupamento visual). */
export const PERMISSION_GROUPS: { title: string; items: { value: Permission; label: string }[] }[] =
  [
    {
      title: 'Geral',
      items: [
        { value: 'dashboard:view', label: 'Dashboard' },
        { value: 'alertas:view', label: 'Alertas' },
      ],
    },
    {
      title: 'Relatórios e auditoria',
      items: [
        { value: 'reports:view', label: 'Relatórios (ver)' },
        { value: 'reports:export', label: 'Relatórios (exportar)' },
        { value: 'audit:view', label: 'Auditoria (ver)' },
        { value: 'audit:export', label: 'Auditoria (exportar)' },
      ],
    },
    {
      title: 'Usuários',
      items: [
        { value: 'users:view', label: 'Funcionários (ver)' },
        { value: 'users:write', label: 'Funcionários (editar)' },
      ],
    },
    {
      title: 'Operação',
      items: [
        { value: 'producao:view', label: 'Produção (ver)' },
        { value: 'producao:write', label: 'Produção (editar)' },
        { value: 'fichatecnica:view', label: 'Ficha técnica (ver)' },
        { value: 'fichatecnica:write', label: 'Ficha técnica (editar)' },
        { value: 'comercial:view', label: 'Comercial (ver)' },
        { value: 'comercial:write', label: 'Comercial (editar)' },
        { value: 'estoque:view', label: 'Estoque (ver)' },
        { value: 'estoque:write', label: 'Estoque (editar)' },
      ],
    },
    {
      title: 'Suporte e infraestrutura',
      items: [
        { value: 'support:view', label: 'Suporte técnico — área técnica' },
        { value: 'datasources:view', label: 'Fontes de dados' },
        {
          value: 'operations:view',
          label: 'Operação (status / sistema — exclusivo suporte)',
        },
      ],
    },
  ]

export function hasPermission(
  session: AuthSession | null,
  permission: Permission,
) {
  return !!session?.permissions?.includes(permission)
}

