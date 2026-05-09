import { createContext, useCallback, useContext, useMemo } from 'react'
import type { TranslationKeys } from './types'
import { ptBR } from './pt-BR'

// Limpa locale inglês salvo de versões anteriores — qualquer key que contenha i18n.locale = 'en'
try {
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const key = localStorage.key(i)
    if (key && key.includes('i18n.locale') && localStorage.getItem(key) === 'en') {
      localStorage.removeItem(key)
    }
  }
} catch { /* noop */ }

const dictionary = ptBR

type I18nContextValue = {
  locale: 'pt-BR'
  t: (key: keyof TranslationKeys, params?: Record<string, string | number>) => string
}

const I18nContext = createContext<I18nContextValue | null>(null)

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const t = useCallback(
    (key: keyof TranslationKeys, params?: Record<string, string | number>) => {
      let text = dictionary[key] ?? key
      if (params) {
        for (const [k, v] of Object.entries(params)) {
          text = text.replace(`{${k}}`, String(v))
        }
      }
      return text
    },
    [],
  )

  const value = useMemo(() => ({ locale: 'pt-BR' as const, t }), [t])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useI18n() {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used within I18nProvider')
  return ctx
}
