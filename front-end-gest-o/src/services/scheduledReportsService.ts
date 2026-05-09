import { http } from './http'
import { trackEvent } from './analytics'

export type ScheduledReport = {
  id: string
  name: string
  reportType: string
  frequency: 'daily' | 'weekly' | 'monthly'
  cronExpr: string
  recipients: string[]
  format: 'pdf' | 'excel'
  active: boolean
  lastSentAt: string | null
}

export type ScheduledReportInput = {
  name: string
  reportType: string
  frequency: 'daily' | 'weekly' | 'monthly'
  cronExpr: string
  recipients: string[]
  format: 'pdf' | 'excel'
  active?: boolean
}

const BASE = '/api/v1/scheduled-reports'

export async function listScheduledReports(): Promise<ScheduledReport[]> {
  const { data } = await http.get<ScheduledReport[]>(BASE)
  return data
}

export async function createScheduledReport(input: ScheduledReportInput): Promise<ScheduledReport> {
  const { data } = await http.post<ScheduledReport>(BASE, input)
  trackEvent('scheduled_report_created', { frequency: input.frequency, format: input.format, recipients: input.recipients.length })
  return data
}

export async function deleteScheduledReport(id: string): Promise<void> {
  await http.delete(`${BASE}/${id}`)
}

/**
 * Constrói cron expression a partir de inputs amigáveis.
 * Formato: "minute hour day-of-month month day-of-week".
 *
 * - daily: hora fixa todo dia → "0 H * * *"
 * - weekly: dia da semana (0=domingo, 6=sábado) → "0 H * * D"
 * - monthly: dia do mês (1-28) → "0 H D * *"
 */
export function buildCronExpr({
  frequency,
  hour,
  minute,
  weekday,
  dayOfMonth,
}: {
  frequency: 'daily' | 'weekly' | 'monthly'
  hour: number
  minute: number
  weekday?: number
  dayOfMonth?: number
}): string {
  const m = String(minute).padStart(2, '0').replace(/^0/, '') || '0'
  const h = String(hour).padStart(2, '0').replace(/^0/, '') || '0'
  if (frequency === 'daily') return `${m} ${h} * * *`
  if (frequency === 'weekly') return `${m} ${h} * * ${weekday ?? 1}`
  return `${m} ${h} ${dayOfMonth ?? 1} * *`
}

export function describeCron(cron: string): string {
  const parts = cron.trim().split(/\s+/)
  if (parts.length !== 5) return cron
  const [min, hr, dom, , dow] = parts
  const time = `${hr.padStart(2, '0')}:${min.padStart(2, '0')}`
  if (dom === '*' && dow === '*') return `Todo dia às ${time}`
  if (dow !== '*' && dom === '*') {
    const days = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']
    return `Toda ${days[Number(dow) % 7] ?? 'semana'} às ${time}`
  }
  if (dom !== '*' && dow === '*') return `Dia ${dom} de cada mês às ${time}`
  return cron
}
