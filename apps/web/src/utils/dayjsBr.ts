import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'

dayjs.extend(utc)
dayjs.extend(timezone)

const TZ = 'America/Sao_Paulo'

/**
 * Datas da API SGBR: com sufixo Z ou offset, converte para Brasília; sem fuso, interpreta como horário local BR.
 */
export function parseVendaDate(raw: string) {
  const s = raw.trim()
  if (/Z$|[+-]\d{2}:?\d{2}$/.test(s)) {
    return dayjs(s).tz(TZ)
  }
  return dayjs.tz(s, TZ)
}

export function nowBr() {
  return dayjs.tz(new Date(), TZ)
}

export function formatTsBrDayMonth(ts: number) {
  return dayjs(ts).tz(TZ).format('DD/MM')
}
