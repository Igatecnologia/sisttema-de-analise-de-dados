import { redactSecrets } from '../utils/redactSecrets.js'

/**
 * Logger estruturado JSON com redaction automatica.
 * Substitua `console.log(JSON.stringify(...))` cru por estes helpers para
 * garantir que campos sensiveis (passwords, tokens, cookies, PII) nao vazem
 * para stdout/arquivo de log centralizado.
 */

type LogPayload = Record<string, unknown>

function emit(level: 'info' | 'warn' | 'error', event: string, payload: LogPayload) {
  const safe = redactSecrets(payload)
  const line = {
    t: new Date().toISOString(),
    level,
    event,
    ...safe,
  }
  const text = JSON.stringify(line)
  if (level === 'error') console.error(text)
  else if (level === 'warn') console.warn(text)
  else console.log(text)
}

export const logInfo = (event: string, payload: LogPayload = {}) => emit('info', event, payload)
export const logWarn = (event: string, payload: LogPayload = {}) => emit('warn', event, payload)
export const logError = (event: string, payload: LogPayload = {}) => emit('error', event, payload)
