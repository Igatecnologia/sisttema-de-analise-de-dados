import { describe, expect, it } from 'vitest'
import {
  createReportSchedule,
  deleteReportSchedule,
  listReportSchedules,
} from './reportSchedulesService'

describe('reportSchedulesService', () => {
  it('cria e lista agendamento', () => {
    const created = createReportSchedule({
      reportId: 'REP-001',
      reportName: 'Relatório A',
      frequency: 'weekly',
      format: 'pdf',
      nextRunAt: new Date().toISOString(),
    })
    const list = listReportSchedules()
    expect(list.length).toBe(1)
    expect(list[0].id).toBe(created.id)
  })

  it('remove agendamento', () => {
    const created = createReportSchedule({
      reportId: 'REP-002',
      reportName: 'Relatório B',
      frequency: 'daily',
      format: 'csv',
      nextRunAt: new Date().toISOString(),
    })
    deleteReportSchedule(created.id)
    expect(listReportSchedules().find((x) => x.id === created.id)).toBeUndefined()
  })
})
