/**
 * Wrapper de localStorage que prefixa todas as chaves com o tenantId.
 * Garante isolamento de dados entre tenants no mesmo domínio.
 */

let _tenantId = 'default'

export function setCurrentTenantId(id: string) {
  _tenantId = id
}

export function getCurrentTenantId(): string {
  return _tenantId
}

function prefixKey(key: string): string {
  return `t:${_tenantId}:${key}`
}

export const tenantStorage = {
  getItem(key: string): string | null {
    return window.localStorage.getItem(prefixKey(key))
  },

  setItem(key: string, value: string) {
    window.localStorage.setItem(prefixKey(key), value)
  },

  removeItem(key: string) {
    window.localStorage.removeItem(prefixKey(key))
  },

  /** Remove TODAS as chaves do tenant atual */
  clearTenant() {
    const prefix = `t:${_tenantId}:`
    const keys: string[] = []
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i)
      if (k?.startsWith(prefix)) keys.push(k)
    }
    keys.forEach((k) => window.localStorage.removeItem(k))
  },
}
