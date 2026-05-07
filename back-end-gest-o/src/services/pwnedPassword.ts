import { createHash } from 'node:crypto'
import { fetch as uFetch } from 'undici'

/**
 * Checa senha contra HaveIBeenPwned via k-anonymity (SEC-2.3).
 *
 * Modelo:
 *   1. Calcula SHA-1 da senha (HEX uppercase)
 *   2. Envia apenas os 5 primeiros chars para o endpoint range
 *   3. Recebe lista (sufixo:count) e procura match local
 *   4. Senha NUNCA sai do servidor
 *
 * Uso:
 *   - count > 100  -> bloquear (senha amplamente vazada)
 *   - count > 0    -> avisar (warning, opcional)
 *   - count == 0   -> ok
 *
 * Disable em ambientes air-gapped: setar HIBP_DISABLED=1 (pula a checagem).
 */

const HIBP_API = 'https://api.pwnedpasswords.com/range'
const HIBP_TIMEOUT_MS = 3_000
const BLOCK_THRESHOLD_DEFAULT = 100

function sha1Hex(text: string): string {
  return createHash('sha1').update(text, 'utf8').digest('hex').toUpperCase()
}

function isDisabled(): boolean {
  return process.env.HIBP_DISABLED === '1'
}

export type PwnedCheck =
  | { skipped: true; reason: 'disabled' | 'fetch_failed' }
  | { skipped: false; count: number; pwned: boolean; blocked: boolean }

export async function checkPwnedPassword(
  password: string,
  blockThreshold: number = BLOCK_THRESHOLD_DEFAULT,
): Promise<PwnedCheck> {
  if (isDisabled()) return { skipped: true, reason: 'disabled' }
  if (!password) return { skipped: false, count: 0, pwned: false, blocked: false }

  const hash = sha1Hex(password)
  const prefix = hash.slice(0, 5)
  const suffix = hash.slice(5)

  try {
    const res = await uFetch(`${HIBP_API}/${prefix}`, {
      method: 'GET',
      headers: { 'Add-Padding': 'true', 'User-Agent': 'iga-gestao-sec' },
      signal: AbortSignal.timeout(HIBP_TIMEOUT_MS),
    })
    if (!res.ok) return { skipped: true, reason: 'fetch_failed' }
    const text = await res.text()
    const lines = text.split('\n')
    let count = 0
    for (const line of lines) {
      const idx = line.indexOf(':')
      if (idx <= 0) continue
      const lineSuffix = line.slice(0, idx).trim().toUpperCase()
      if (lineSuffix !== suffix) continue
      const n = Number(line.slice(idx + 1).trim())
      count = Number.isFinite(n) ? n : 0
      break
    }
    return {
      skipped: false,
      count,
      pwned: count > 0,
      blocked: count >= blockThreshold,
    }
  } catch {
    /** Falha de rede nao bloqueia o usuario — degrada gracefully. */
    return { skipped: true, reason: 'fetch_failed' }
  }
}
