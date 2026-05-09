import dayjs from 'dayjs'

export function shiftRange(start?: string, end?: string) {
  if (!start || !end) return null
  const startDay = dayjs(start).startOf('day')
  const endDay = dayjs(end).endOf('day')
  if (!startDay.isValid() || !endDay.isValid()) return null
  const spanDays = Math.max(1, endDay.diff(startDay, 'day') + 1)
  const prevEnd = startDay.subtract(1, 'day').endOf('day')
  const prevStart = prevEnd.subtract(spanDays - 1, 'day').startOf('day')
  return {
    prevStart: prevStart.format('YYYY-MM-DD'),
    prevEnd: prevEnd.format('YYYY-MM-DD'),
    spanDays,
  }
}

export function pctDelta(current: number, previous: number) {
  if (previous === 0) return current === 0 ? 0 : 100
  return ((current - previous) / Math.abs(previous)) * 100
}
