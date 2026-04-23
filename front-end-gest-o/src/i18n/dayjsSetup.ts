/**
 * Setup global do dayjs — importado ANTES de qualquer outro módulo no `main.tsx`.
 * Garante que DatePicker/RangePicker/Calendar do AntD renderizem nomes de dias e
 * meses em português do Brasil e formato `DD/MM/YYYY` por padrão.
 *
 * Ordem importante:
 *   1. import dayjs
 *   2. import locale pt-br (registra)
 *   3. plugins (week, weekday, localizedFormat, updateLocale)
 *   4. dayjs.locale('pt-br') ativa globalmente
 *
 * Sem este arquivo, o calendário aparecia com `Sun Mon Tue...` em builds onde
 * a ordem de avaliação dos imports descobria o dayjs antes do locale.
 */
import dayjs from 'dayjs'
import 'dayjs/locale/pt-br'
import weekday from 'dayjs/plugin/weekday'
import localeData from 'dayjs/plugin/localeData'
import localizedFormat from 'dayjs/plugin/localizedFormat'
import updateLocale from 'dayjs/plugin/updateLocale'
import customParseFormat from 'dayjs/plugin/customParseFormat'

dayjs.extend(weekday)
dayjs.extend(localeData)
dayjs.extend(localizedFormat)
dayjs.extend(updateLocale)
dayjs.extend(customParseFormat)

/** Padrão Brasil: domingo é dia 0, mas calendários BR começam na segunda.
 *  Configuramos explicitamente para evitar surpresas em diferentes ambientes. */
dayjs.updateLocale('pt-br', {
  weekStart: 0,
})

dayjs.locale('pt-br')

export {}
