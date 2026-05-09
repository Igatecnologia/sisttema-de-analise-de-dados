import { useEffect, useId, useRef } from 'react'

/**
 * Cloudflare Turnstile widget. Carrega o script global na primeira render.
 *
 * Para habilitar, defina `VITE_TURNSTILE_SITE_KEY` no .env.local. Sem esta
 * variavel, o componente renderiza nada (transparente em dev).
 */

declare global {
  interface Window {
    turnstile?: {
      render: (container: HTMLElement, opts: {
        sitekey: string
        callback?: (token: string) => void
        'error-callback'?: () => void
        'expired-callback'?: () => void
        theme?: 'light' | 'dark' | 'auto'
      }) => string
      reset: (widgetId?: string) => void
      remove: (widgetId?: string) => void
    }
  }
}

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
let scriptPromise: Promise<void> | null = null

function loadScript(): Promise<void> {
  if (scriptPromise) return scriptPromise
  scriptPromise = new Promise<void>((resolve, reject) => {
    if (typeof document === 'undefined') return resolve()
    if (window.turnstile) return resolve()
    const script = document.createElement('script')
    script.src = SCRIPT_SRC
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Falha ao carregar Turnstile'))
    document.head.appendChild(script)
  })
  return scriptPromise
}

type Props = {
  onToken: (token: string) => void
  theme?: 'light' | 'dark' | 'auto'
}

export function TurnstileWidget({ onToken, theme = 'auto' }: Props) {
  const containerId = useId()
  const widgetIdRef = useRef<string | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined

  useEffect(() => {
    if (!siteKey) return
    let cancelled = false
    loadScript()
      .then(() => {
        if (cancelled || !containerRef.current || !window.turnstile) return
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          theme,
          callback: (token) => onToken(token),
          'expired-callback': () => onToken(''),
          'error-callback': () => onToken(''),
        })
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current)
      }
    }
  }, [siteKey, theme, onToken])

  if (!siteKey) return null
  return <div id={containerId} ref={containerRef} style={{ minHeight: 65 }} />
}
