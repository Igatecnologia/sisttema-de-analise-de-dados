import { z } from 'zod'

const reportScheduleSchema = z.object({
  id: z.string(),
  reportId: z.string(),
  reportName: z.string(),
  frequency: z.enum(['daily', 'weekly', 'monthly']),
  format: z.enum(['csv', 'xlsx', 'pdf']),
  nextRunAt: z.string(),
  createdAt: z.string(),
})

const storeSchema = z.array(reportScheduleSchema)

export type ReportSchedule = z.infer<typeof reportScheduleSchema>

const KEY = 'app.reports.schedules.v1'

function uid() {
  return `sch_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`
}

function readAll(): ReportSchedule[] {
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return []
    const parsed = storeSchema.safeParse(JSON.parse(raw))
    return parsed.success ? parsed.data : []
  } catch {
    return []
  }
}

function writeAll(schedules: ReportSchedule[]) {
  window.localStorage.setItem(KEY, JSON.stringify(schedules))
}

export function listReportSchedules() {
  return readAll().slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function createReportSchedule(input: Omit<ReportSchedule, 'id' | 'createdAt'>) {
  const current = readAll()
  const next: ReportSchedule = {
    id: uid(),
    createdAt: new Date().toISOString(),
    ...input,
  }
  writeAll([next, ...current])
  return next
}

export function deleteReportSchedule(id: string) {
  const current = readAll()
  writeAll(current.filter((x) => x.id !== id))
}
