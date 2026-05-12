/**
 * UX-M1 (audit 2026-05-12): hint discreto após 2.5s pra avisar que o
 * servidor pode estar "acordando" (cold start do Fly.io quando 1ª request
 * do dia). Sem ele o usuário pensa "app travou" durante os ~5s iniciais.
 *
 * Uso:
 *   <ColdStartHint show={isLoading} />
 *
 * Aparece só se `show` continua true por >= 2500ms. Some assim que `show=false`.
 */
import { useEffect, useState } from 'react'
import { Alert } from 'antd'
import { ClockCircleOutlined } from '@ant-design/icons'

const DELAY_MS = 2500

type Props = {
  show: boolean
  /** Mensagem custom — default cobre cold start. */
  message?: string
}

export function ColdStartHint({ show, message }: Props) {
  /** `show=false` -> visible=false sempre (derived sem effect).
   *  `show=true` -> visible vira true só após DELAY_MS via timer. */
  const [delayedShow, setDelayedShow] = useState(false)

  useEffect(() => {
    if (!show) return
    const timer = window.setTimeout(() => setDelayedShow(true), DELAY_MS)
    return () => {
      window.clearTimeout(timer)
      setDelayedShow(false)
    }
  }, [show])

  if (!show || !delayedShow) return null

  return (
    <Alert
      type="info"
      showIcon
      icon={<ClockCircleOutlined />}
      message={message ?? 'Aguardando servidor — primeiro acesso do dia pode levar até 10 segundos.'}
      style={{ marginBottom: 12 }}
    />
  )
}
