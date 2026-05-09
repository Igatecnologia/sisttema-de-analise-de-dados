import 'dotenv/config'
import { closePostgresPool, runPostgresMigrations } from './postgres.js'

async function main() {
  const applied = await runPostgresMigrations()
  if (applied.length === 0) {
    console.log('[IGA][DB] PostgreSQL ja estava atualizado.')
  } else {
    console.log(`[IGA][DB] Migrations aplicadas: ${applied.join(', ')}`)
  }
}

main()
  .catch((err) => {
    console.error('[IGA][DB] Falha ao aplicar migrations PostgreSQL:', err instanceof Error ? err.message : err)
    process.exitCode = 1
  })
  .finally(() => {
    void closePostgresPool()
  })
