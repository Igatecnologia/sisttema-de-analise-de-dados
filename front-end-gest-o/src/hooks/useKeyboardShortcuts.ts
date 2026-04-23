import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

type Input = {
  onOpenSearch: () => void
  onCloseOverlays: () => void
  onOpenCopilot?: () => void
}

export function useKeyboardShortcuts({ onOpenSearch, onCloseOverlays, onOpenCopilot }: Input) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [pendingKey, setPendingKey] = useState<string | null>(null)

  useEffect(() => {
    const timer = pendingKey ? setTimeout(() => setPendingKey(null), 700) : null
    return () => {
      if (timer) clearTimeout(timer)
    }
  }, [pendingKey])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const isMeta = event.ctrlKey || event.metaKey
      const key = event.key.toLowerCase()
      if (isMeta && key === '/') {
        event.preventDefault()
        setOpen((prev) => !prev)
        return
      }
      if (event.key === 'Escape') {
        onCloseOverlays()
        setOpen(false)
        return
      }
      if (isMeta && key === 'k') {
        event.preventDefault()
        onOpenSearch()
        return
      }
      if (isMeta && key === 'i') {
        event.preventDefault()
        onOpenCopilot?.()
        return
      }
      if (pendingKey === 'g') {
        if (key === 'd') navigate('/dashboard')
        if (key === 'v') navigate('/dashboard/vendas-analitico')
        if (key === 'f') navigate('/financeiro')
        setPendingKey(null)
        return
      }
      if (!isMeta && key === 'g') {
        setPendingKey('g')
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [navigate, onCloseOverlays, onOpenCopilot, onOpenSearch, pendingKey])

  return {
    shortcutsOpen: open,
    closeShortcuts: () => setOpen(false),
  }
}
