import { useEffect, useState } from 'react'

export function useRealtimeHeartbeat(enabled: boolean, intervalMs: number) {
  const [lastPulseAt, setLastPulseAt] = useState<number | null>(null)
  const transport: 'polling' | 'sse' =
    typeof window !== 'undefined' && 'EventSource' in window ? 'sse' : 'polling'

  useEffect(() => {
    if (!enabled || intervalMs <= 0) return
    const id = window.setInterval(() => {
      setLastPulseAt(Date.now())
    }, intervalMs)
    return () => window.clearInterval(id)
  }, [enabled, intervalMs])

  return { lastPulseAt, transport }
}
