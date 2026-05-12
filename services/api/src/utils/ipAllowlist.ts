/**
 * P2-04 (audit 2026-05-12): matching de IP contra allowlist de CIDRs.
 *
 * Aceita:
 *  - IPv4 exato:   "200.150.10.5"
 *  - CIDR IPv4:    "200.150.0.0/24"
 *  - IPv6 exato:   "2a02:6ea0::1"
 *  - CIDR IPv6:    "2a02:6ea0::/32"
 *  - IPv4-in-IPv6 (Fly/Vercel injetam ::ffff:1.2.3.4): normalizado pra IPv4
 *
 * Política:
 *  - Allowlist vazia → aceita qualquer IP (compat: sem regra = sem restrição)
 *  - Allowlist tem itens → precisa bater pelo menos 1
 *  - Entrada inválida no allowlist é ignorada (não derruba auth)
 */
import ipaddr from 'ipaddr.js'

/** Normaliza IPv4-mapped IPv6 (::ffff:1.2.3.4) pra IPv4 puro. */
function normalize(ip: string): string {
  const trimmed = ip.trim()
  if (!trimmed) return ''
  try {
    const parsed = ipaddr.parse(trimmed)
    if (parsed.kind() === 'ipv6') {
      const v6 = parsed as ipaddr.IPv6
      if (v6.isIPv4MappedAddress()) {
        return v6.toIPv4Address().toString()
      }
    }
    return parsed.toString()
  } catch {
    return ''
  }
}

/** True se `ip` casa com pelo menos uma das entradas. Lista vazia = sem restrição. */
export function ipMatchesAllowlist(ip: string, allowlist: string[]): boolean {
  if (!Array.isArray(allowlist) || allowlist.length === 0) return true
  const normalized = normalize(ip)
  if (!normalized) return false
  let parsedIp: ipaddr.IPv4 | ipaddr.IPv6
  try {
    parsedIp = ipaddr.parse(normalized)
  } catch {
    return false
  }
  for (const raw of allowlist) {
    const entry = String(raw ?? '').trim()
    if (!entry) continue
    if (entry.includes('/')) {
      /** CIDR — usa parseCIDR pra validar prefix + match cross-kind. */
      try {
        const range = ipaddr.parseCIDR(entry) as [ipaddr.IPv4 | ipaddr.IPv6, number]
        if (parsedIp.kind() !== range[0].kind()) continue
        if (parsedIp.kind() === 'ipv4') {
          if ((parsedIp as ipaddr.IPv4).match(range as [ipaddr.IPv4, number])) return true
        } else {
          if ((parsedIp as ipaddr.IPv6).match(range as [ipaddr.IPv6, number])) return true
        }
      } catch {
        /** entrada inválida — ignora */
      }
    } else {
      /** IP exato */
      try {
        const cidrIp = ipaddr.parse(entry)
        if (cidrIp.toString() === parsedIp.toString()) return true
      } catch {
        /** ignora */
      }
    }
  }
  return false
}

/** Valida sintaxe de uma entrada (IP exato ou CIDR). Retorna mensagem de erro ou null. */
export function validateAllowlistEntry(entry: string): string | null {
  const trimmed = String(entry ?? '').trim()
  if (!trimmed) return 'entrada vazia'
  if (trimmed.length > 64) return 'muito longa (máx 64 chars)'
  if (trimmed.includes('/')) {
    const [addr, prefix] = trimmed.split('/')
    if (!ipaddr.isValid(addr)) return `IP inválido em CIDR: ${addr}`
    const prefixNum = Number(prefix)
    const isV4 = ipaddr.IPv4.isIPv4(addr)
    const max = isV4 ? 32 : 128
    if (!Number.isInteger(prefixNum) || prefixNum < 0 || prefixNum > max) {
      return `prefixo CIDR inválido (use 0-${max}): ${prefix}`
    }
  } else {
    if (!ipaddr.isValid(trimmed)) return `IP inválido: ${trimmed}`
  }
  return null
}

/** Sanitiza array de entradas — devolve só as válidas (dedup, trim, lower). */
export function sanitizeAllowlist(entries: unknown): string[] {
  if (!Array.isArray(entries)) return []
  const seen = new Set<string>()
  for (const e of entries) {
    if (typeof e !== 'string') continue
    const trimmed = e.trim().toLowerCase()
    if (!trimmed) continue
    if (validateAllowlistEntry(trimmed)) continue
    seen.add(trimmed)
  }
  return Array.from(seen).slice(0, 50)
}
