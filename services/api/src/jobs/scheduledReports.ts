import cron from 'node-cron'
import nodemailer from 'nodemailer'
import { getDb } from '../db/sqlite.js'
import { getPostgresPool, hasPostgresConfig } from '../db/postgres.js'

const db = getDb()
let started = false

function usePostgresStorage(): boolean {
  return process.env.IGA_STORAGE_DRIVER === 'postgres' && hasPostgresConfig()
}

function getTransporter() {
  const host = process.env.SMTP_HOST?.trim()
  const port = Number(process.env.SMTP_PORT ?? 587)
  const user = process.env.SMTP_USER?.trim()
  const pass = process.env.SMTP_PASS?.trim()
  if (!host || !user || !pass) return null
  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  })
}

type ActiveReportRow = { id: string; name: string; recipients_json: string | string[]; format: string }

async function listActiveScheduledReports(): Promise<ActiveReportRow[]> {
  if (usePostgresStorage()) {
    const result = await getPostgresPool().query<ActiveReportRow>(
      'SELECT id, name, recipients_json, format FROM scheduled_reports WHERE active = TRUE',
    )
    return result.rows
  }
  return db
    .prepare('SELECT id, name, recipients_json, format FROM scheduled_reports WHERE active = 1')
    .all() as ActiveReportRow[]
}

async function markReportSent(id: string, now: string) {
  if (usePostgresStorage()) {
    await getPostgresPool().query(
      'UPDATE scheduled_reports SET last_sent_at = $1, updated_at = $2 WHERE id = $3',
      [now, now, id],
    )
    return
  }
  db.prepare('UPDATE scheduled_reports SET last_sent_at = ?, updated_at = ? WHERE id = ?').run(now, now, id)
}

export async function runScheduledReportsOnce() {
  const transporter = getTransporter()
  if (!transporter) return
  const rows = await listActiveScheduledReports()
  for (const row of rows) {
    const recipients = Array.isArray(row.recipients_json)
      ? row.recipients_json
      : (JSON.parse(row.recipients_json) as string[])
    if (!recipients.length) continue
    const now = new Date().toISOString()
    await transporter.sendMail({
      from: process.env.SMTP_FROM ?? process.env.SMTP_USER,
      to: recipients.join(','),
      subject: `[IGA] Relatorio agendado: ${row.name}`,
      text: `Relatorio ${row.name} foi executado em ${now} (formato ${row.format}).`,
    })
    await markReportSent(row.id, now)
  }
}

export function startScheduledReportsJob() {
  if (started) return
  started = true
  cron.schedule('* * * * *', () => {
    void runScheduledReportsOnce()
  })
}
