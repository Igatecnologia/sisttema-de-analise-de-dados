/**
 * DatePicker e RangePicker com locale pt-BR forçado.
 * Resolve problema onde o Ant Design 6 não propaga o locale do ConfigProvider
 * para o popup do calendário em algumas configurações.
 */
import { DatePicker } from 'antd'
import type { DatePickerProps, RangePickerProps } from 'antd/es/date-picker'
import ptBR from 'antd/es/locale/pt_BR'

const datePickerLocale = ptBR.DatePicker!

export function DatePickerBR(props: DatePickerProps) {
  return <DatePicker locale={datePickerLocale} {...props} />
}

export function RangePickerBR(props: RangePickerProps) {
  return <DatePicker.RangePicker locale={datePickerLocale} {...props} />
}
