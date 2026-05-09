import { createHmac, randomBytes } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { resolveDataDir } from '../paths.js'

export type WebhookEventType =
  | 'datasource.connected'
  | 'datasource.failed'
  | 'billing.updated'
  | 'tenant.updated'
  | 'report.generated'

export type WebhookSubscription = {
  id: string
  tenantId: string
  name: string
  url: string
  eventTypes: WebhookEventType[]
  active: boolean
  signingSecret: string
  createdAt: string
  updatedAt: string
}

export type WebhookDelivery = {
  id: string
  tenantId: string
  subscriptionId: string
  eventType: WebhookEventType
  status: 'pending' | 'success' | 'failed'
  attempts: number
  nextAttemptAt: string | null
  statusCode: number | null
  error: string | null
  createdAt: string
  updatedAt: string
}

type WebhookDb = {
  subscriptions: WebhookSubscription[]
  deliveries: WebhookDelivery[]
}

const filePath = join(resolveDataDir(), 'webhooks.json')
let lock = Promise.resolve()

function ensureFile() {
  const dir = resolveDataDir()
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  if (!existsSync(filePath)) writeFileSync(filePath, JSON.stringify({ subscriptions: [], deliveries: [] }, null, 2))
}

function readDb(): WebhookDb {
  ensureFile()
  return JSON.parse(readFileSync(filePath, 'utf8')) as WebhookDb
}

function writeDb(db: WebhookDb) {
  ensureFile()
  writeFileSync(filePath, JSON.stringify(db, null, 2))
}

async function withLock<T>(fn: () => T | Promise<T>): Promise<T> {
  const run = lock.then(fn, fn)
  lock = run.then(() => undefined, () => undefined)
  return run
}

export function genWebhookId(prefix: string): string {
  return `${prefix}_${randomBytes(8).toString('hex')}`
}

export async function listWebhookSubscriptions(tenantId: string): Promise<WebhookSubscription[]> {
  return readDb().subscriptions.filter((item) => item.tenantId === tenantId)
}

export async function listWebhookDeliveries(tenantId: string): Promise<WebhookDelivery[]> {
  return readDb().deliveries
    .filter((item) => item.tenantId === tenantId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 200)
}

export async function createWebhookSubscription(input: Omit<WebhookSubscription, 'id' | 'signingSecret' | 'createdAt' | 'updatedAt'>) {
  return withLock(() => {
    const now = new Date().toISOString()
    const db = readDb()
    const subscription: WebhookSubscription = {
      ...input,
      id: genWebhookId('whsub'),
      signingSecret: `whsec_${randomBytes(24).toString('hex')}`,
      createdAt: now,
      updatedAt: now,
    }
    db.subscriptions.push(subscription)
    writeDb(db)
    return subscription
  })
}

export async function updateWebhookSubscription(
  tenantId: string,
  id: string,
  patch: Partial<Pick<WebhookSubscription, 'name' | 'url' | 'eventTypes' | 'active'>>,
) {
  return withLock(() => {
    const db = readDb()
    const idx = db.subscriptions.findIndex((item) => item.tenantId === tenantId && item.id === id)
    if (idx < 0) return null
    db.subscriptions[idx] = { ...db.subscriptions[idx], ...patch, updatedAt: new Date().toISOString() }
    writeDb(db)
    return db.subscriptions[idx]
  })
}

export async function deleteWebhookSubscription(tenantId: string, id: string): Promise<boolean> {
  return withLock(() => {
    const db = readDb()
    const before = db.subscriptions.length
    db.subscriptions = db.subscriptions.filter((item) => !(item.tenantId === tenantId && item.id === id))
    writeDb(db)
    return db.subscriptions.length !== before
  })
}

export async function createWebhookDelivery(input: Omit<WebhookDelivery, 'id' | 'status' | 'attempts' | 'nextAttemptAt' | 'statusCode' | 'error' | 'createdAt' | 'updatedAt'>) {
  return withLock(() => {
    const now = new Date().toISOString()
    const db = readDb()
    const delivery: WebhookDelivery = {
      ...input,
      id: genWebhookId('whdel'),
      status: 'pending',
      attempts: 0,
      nextAttemptAt: now,
      statusCode: null,
      error: null,
      createdAt: now,
      updatedAt: now,
    }
    db.deliveries.push(delivery)
    writeDb(db)
    return delivery
  })
}

export async function updateWebhookDelivery(tenantId: string, id: string, patch: Partial<WebhookDelivery>) {
  return withLock(() => {
    const db = readDb()
    const idx = db.deliveries.findIndex((item) => item.tenantId === tenantId && item.id === id)
    if (idx < 0) return null
    db.deliveries[idx] = { ...db.deliveries[idx], ...patch, updatedAt: new Date().toISOString() }
    writeDb(db)
    return db.deliveries[idx]
  })
}

export async function findWebhookSubscription(tenantId: string, id: string) {
  return readDb().subscriptions.find((item) => item.tenantId === tenantId && item.id === id) ?? null
}

export async function findWebhookDelivery(tenantId: string, id: string) {
  return readDb().deliveries.find((item) => item.tenantId === tenantId && item.id === id) ?? null
}

export function signWebhookPayload(secret: string, payload: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex')
}
