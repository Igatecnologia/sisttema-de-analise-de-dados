import { getDb } from '../db/sqlite.js'
import { hasPostgresConfig, queryPostgres } from '../db/postgres.js'
import { listTenants } from '../tenantStorage.js'
import { readAllUsersAsync } from '../userStorage.js'
import { buildPublicUrl, sendTransactionalEmail } from '../services/transactionalEmail.js'
import { trialExpiredTemplate, trialExpiringTemplate } from '../services/emailTemplates.js'

const db = getDb()

function usePostgresStorage(): boolean {
  return process.env.IGA_STORAGE_DRIVER === 'postgres' && hasPostgresConfig()
}

async function getMarker(key: string): Promise<boolean> {
  if (usePostgresStorage()) {
    const result = await queryPostgres('SELECT key FROM app_settings WHERE key = $1 LIMIT 1', [key])
    return Boolean(result.rowCount)
  }
  const row = db.prepare('SELECT key FROM app_settings WHERE key = ? LIMIT 1').get(key) as { key: string } | undefined
  return Boolean(row)
}

async function setMarker(key: string) {
  const now = new Date().toISOString()
  if (usePostgresStorage()) {
    await queryPostgres(
      `
      INSERT INTO app_settings (key, value_json, is_secret, updated_at, updated_by)
      VALUES ($1, $2::jsonb, false, $3, NULL)
      ON CONFLICT (key) DO UPDATE SET value_json = EXCLUDED.value_json, updated_at = EXCLUDED.updated_at
      `,
      [key, JSON.stringify({ sentAt: now }), now],
    )
    return
  }
  db.prepare(`
    INSERT INTO app_settings (key, value_json, is_secret, updated_at, updated_by)
    VALUES (?, ?, 0, ?, NULL)
    ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at
  `).run(key, JSON.stringify({ sentAt: now }), now)
}

export async function runTrialLifecycleOnce() {
  const tenants = await listTenants()
  const users = await readAllUsersAsync()
  const now = Date.now()
  const billingUrl = buildPublicUrl('/billing')

  for (const tenant of tenants) {
    if (tenant.plan !== 'trial' || !tenant.trialEndsAt || tenant.status !== 'active') continue
    const endsAt = new Date(tenant.trialEndsAt).getTime()
    if (!Number.isFinite(endsAt)) continue
    const daysLeft = Math.ceil((endsAt - now) / (24 * 60 * 60 * 1000))
    const admins = users.filter((user) => user.tenantId === tenant.id && user.role === 'admin' && user.status === 'active')
    if (!admins.length) continue

    if (daysLeft <= 3 && daysLeft >= 0) {
      const marker = `trial:${tenant.id}:expiring:${new Date(tenant.trialEndsAt).toISOString().slice(0, 10)}`
      if (await getMarker(marker)) continue
      await Promise.all(admins.map((admin) => sendTransactionalEmail(admin.email, trialExpiringTemplate({
        companyName: tenant.name,
        daysLeft,
        billingUrl,
      }))))
      await setMarker(marker)
    }

    if (daysLeft < 0) {
      const marker = `trial:${tenant.id}:expired`
      if (await getMarker(marker)) continue
      await Promise.all(admins.map((admin) => sendTransactionalEmail(admin.email, trialExpiredTemplate({
        companyName: tenant.name,
        billingUrl,
      }))))
      await setMarker(marker)
    }
  }
}

let timer: NodeJS.Timeout | null = null

export function startTrialLifecycleJob() {
  if (timer) return
  timer = setInterval(() => { void runTrialLifecycleOnce() }, 6 * 60 * 60_000)
  timer.unref()
  void runTrialLifecycleOnce()
}

