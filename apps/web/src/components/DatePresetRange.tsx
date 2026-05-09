import { Button, Space } from 'antd'
import dayjs from 'dayjs'
import { useEffect, useRef } from 'react'

export function DatePresetRange({
  onApply,
  storageKey,
  mode = 'default',
}: {
  onApply: (start: string, end: string) => void
  storageKey?: string
  mode?: 'default' | 'finance'
}) {
  const didHydrate = useRef(false)
  const onApplyRef = useRef(onApply)
  useEffect(() => {
    onApplyRef.current = onApply
  }, [onApply])
  const presets = [
    {
      id: 'today',
      label: 'Hoje',
      getRange: () => {
        const t = dayjs()
        return [t.format('YYYY-MM-DD'), t.format('YYYY-MM-DD')] as const
      },
    },
    {
      id: '7d',
      label: '7d',
      getRange: () => {
        const t = dayjs()
        return [t.subtract(6, 'day').format('YYYY-MM-DD'), t.format('YYYY-MM-DD')] as const
      },
    },
    {
      id: '30d',
      label: '30d',
      getRange: () => {
        const t = dayjs()
        return [t.subtract(29, 'day').format('YYYY-MM-DD'), t.format('YYYY-MM-DD')] as const
      },
    },
    {
      id: 'month',
      label: 'Mês atual',
      getRange: () => {
        const t = dayjs()
        return [t.startOf('month').format('YYYY-MM-DD'), t.endOf('month').format('YYYY-MM-DD')] as const
      },
    },
    ...(mode === 'finance'
      ? [
          {
            id: 'closed-month',
            label: 'Mês fechado',
            getRange: () => {
              const prev = dayjs().subtract(1, 'month')
              return [prev.startOf('month').format('YYYY-MM-DD'), prev.endOf('month').format('YYYY-MM-DD')] as const
            },
          },
          {
            id: 'quarter',
            label: 'Trimestre',
            getRange: () => {
              const t = dayjs()
              const q = Math.floor(t.month() / 3) + 1
              const start = t.clone().month((q - 1) * 3).startOf('month')
              const end = t.clone().month(q * 3 - 1).endOf('month')
              return [start.format('YYYY-MM-DD'), end.format('YYYY-MM-DD')] as const
            },
          },
          {
            id: 'year',
            label: 'Ano',
            getRange: () => {
              const t = dayjs()
              return [t.startOf('year').format('YYYY-MM-DD'), t.endOf('year').format('YYYY-MM-DD')] as const
            },
          },
        ]
      : []),
  ] as const

  useEffect(() => {
    if (!storageKey || didHydrate.current) return
    didHydrate.current = true
    try {
      const raw = window.localStorage.getItem(storageKey)
      if (!raw) return
      const parsed = JSON.parse(raw) as { start: string; end: string }
      if (parsed.start && parsed.end) onApplyRef.current(parsed.start, parsed.end)
    } catch {
      // ignore persisted-range parsing failures
    }
  }, [storageKey])

  function applyPreset(start: string, end: string) {
    if (storageKey) {
      window.localStorage.setItem(storageKey, JSON.stringify({ start, end }))
    }
    onApply(start, end)
  }

  return (
    <Space size={6}>
      {presets.map((preset) => (
        <Button
          key={preset.id}
          size="small"
          onClick={() => {
            const [start, end] = preset.getRange()
            applyPreset(start, end)
          }}
        >
          {preset.label}
        </Button>
      ))}
    </Space>
  )
}
