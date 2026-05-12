/**
 * P0-06 (audit 2026-05-12): job que limpa refresh_tokens expirados ou
 * já usados há mais de 7 dias. Roda diariamente.
 *
 * Sem isso, a tabela cresce indefinidamente — em produção observamos 31
 * tokens válidos após 1 dia de testes; em escala = centenas/dia, vira
 * gargalo em SELECTs de rotação.
 *
 * Política de retenção:
 *  - `expires_at < now()` → expirou naturalmente, sem valor
 *  - `used_at IS NOT NULL AND used_at < now() - 7d` → consumido + janela
 *    de reuse-detection encerrada
 *  - Mantém `revoked_at IS NOT NULL` pelo mesmo prazo (forensics)
 */
import { getDb } from '../db/sqlite.js'
import { getPostgresPool, hasPostgresConfig } from '../db/postgres.js'

const INTERVAL_MS = 24 * 60 * 60 * 1000 // 24h
const REUSE_DETECTION_WINDOW_DAYS = 7

function usePostgresStorage(): boolean {
  return process.env.IGA_STORAGE_DRIVER === 'postgres' && hasPostgresConfig()
}

export async function runRefreshTokenCleanupOnce(): Promise<number> {
  const cutoff = new Date(Date.now() - REUSE_DETECTION_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString()
  let changes = 0
  if (usePostgresStorage()) {
    const result = await getPostgresPool().query(
      `DELETE FROM refresh_tokens
       WHERE expires_at < now()
          OR (used_at IS NOT NULL AND used_at < $1)
          OR (revoked_at IS NOT NULL AND revoked_at < $1)`,
      [cutoff],
    )
    changes = result.rowCount ?? 0
  } else {
    const db = getDb()
    const result = db.prepare(
      `DELETE FROM refresh_tokens
       WHERE expires_at < ?
          OR (used_at IS NOT NULL AND used_at < ?)
          OR (revoked_at IS NOT NULL AND revoked_at < ?)`,
    ).run(new Date().toISOString(), cutoff, cutoff)
    changes = result.changes
  }
  if (changes > 0) {
    console.log(`[IGA][RETENTION] ${changes} refresh_token(s) limpo(s) (expirados / consumidos > ${REUSE_DETECTION_WINDOW_DAYS}d)`)
  }
  return changes
}

export function startRefreshTokenCleanupJob() {
  // 5min após boot pra não competir com outras tarefas de startup
  setTimeout(() => {
    void runRefreshTokenCleanupOnce()
    setInterval(() => { void runRefreshTokenCleanupOnce() }, INTERVAL_MS).unref()
  }, 5 * 60_000).unref()
}
