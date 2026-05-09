/**
 * Helper para SEC-2.10: dispara alerta de novo dispositivo no login.
 *
 * Estrategia: consulta `sessions` por (user_id, ua_hash). Se nao houver match,
 * eh um dispositivo novo — envia email. Como sessions tem TTL de 8h, alguem
 * que loga uma vez por mes vai receber o alerta toda vez (aceitavel).
 *
 * Uma versao mais sofisticada usaria tabela `known_devices` com retencao maior,
 * mas isso fica para SEC-2.x futuro.
 */
import { getDb } from '../db/sqlite.js'
import { getPostgresPool, hasPostgresConfig } from '../db/postgres.js'
import { sendNewDeviceAlert, type AlertContext } from './loginAlerts.js'

const db = getDb()

function usePostgresStorage(): boolean {
  return process.env.IGA_STORAGE_DRIVER === 'postgres' && hasPostgresConfig()
}

async function isUaHashKnown(userId: string, uaHash: string): Promise<boolean> {
  if (!uaHash) return true
  if (usePostgresStorage()) {
    const result = await getPostgresPool().query<{ count: string }>(
      'SELECT COUNT(*)::text AS count FROM sessions WHERE user_id = $1 AND ua_hash = $2',
      [userId, uaHash],
    )
    return Number(result.rows[0]?.count ?? 0) > 0
  }
  const row = db
    .prepare('SELECT COUNT(*) AS c FROM sessions WHERE user_id = ? AND ua_hash = ?')
    .get(userId, uaHash) as { c: number } | undefined
  return Number(row?.c ?? 0) > 0
}

export async function sendNewDeviceAlertIfUnknown(
  ctx: AlertContext & { userId: string },
  uaHash: string,
): Promise<void> {
  try {
    const known = await isUaHashKnown(ctx.userId, uaHash)
    if (known) return
    await sendNewDeviceAlert(ctx)
  } catch {
    /** Best-effort: nunca quebra o login. */
  }
}
