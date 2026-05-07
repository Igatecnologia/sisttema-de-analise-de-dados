/**
 * Job de retenção: apaga mensagens do copilot com mais de 30 dias.
 * Roda diariamente.
 */
import { getDb } from '../db/sqlite.js'
import { getPostgresPool, hasPostgresConfig } from '../db/postgres.js'

const RETENTION_DAYS = 30
const INTERVAL_MS = 24 * 60 * 60 * 1000 // 24 horas

function usePostgresStorage(): boolean {
  return process.env.IGA_STORAGE_DRIVER === 'postgres' && hasPostgresConfig()
}

export async function runCopilotRetentionOnce() {
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString()
  const changes = usePostgresStorage()
    ? await (async () => {
    const result = await getPostgresPool().query(
      'DELETE FROM copilot_messages WHERE created_at < $1',
      [cutoff],
    )
    return result.rowCount ?? 0
  })()
    : (() => {
    const db = getDb()
    const result = db.prepare('DELETE FROM copilot_messages WHERE created_at < ?').run(cutoff)
    return result.changes
  })()
  if (changes > 0) {
    console.log(`[IGA][RETENTION] ${changes} mensagem(ns) do copilot removida(s) (> ${RETENTION_DAYS} dias)`)
  }
}

export function startCopilotRetentionJob() {
  // Primeira execução 2min após inicialização
  setTimeout(() => {
    void runCopilotRetentionOnce()
    setInterval(() => { void runCopilotRetentionOnce() }, INTERVAL_MS).unref()
  }, 120_000).unref()
}
