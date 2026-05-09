import { useCallback, useEffect, useRef } from 'react'

const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'scroll', 'touchstart'] as const

/**
 * Auto-logout após inatividade.
 * @param timeoutMs  Tempo de inatividade em ms (padrão: 30 minutos)
 * @param onTimeout  Callback executado no timeout (normalmente signOut)
 */
export function useSessionTimeout(
  onTimeout: () => void,
  timeoutMs = 30 * 60 * 1000,
  enabled = true,
) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const resetTimer = useCallback(() => {
    if (timer.current) clearTimeout(timer.current)
    if (!enabled) return
    timer.current = setTimeout(onTimeout, timeoutMs)
  }, [onTimeout, timeoutMs, enabled])

  useEffect(() => {
    if (!enabled) return

    resetTimer()

    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, resetTimer, { passive: true })
    }

    return () => {
      if (timer.current) clearTimeout(timer.current)
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, resetTimer)
      }
    }
  }, [resetTimer, enabled])
}
