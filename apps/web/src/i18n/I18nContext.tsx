/**
 * P2-12 (audit 2026-05-12): suporte multi-locale (pt-BR / en / es).
 *
 * Antes: hardcoded pt-BR. Agora:
 *  - 3 dicionários: ptBR, en, es (mesmo shape `TranslationKeys`)
 *  - Locale resolvido na ordem: localStorage > navigator.language > 'pt-BR'
 *  - setLocale(locale) persiste e re-renderiza
 *  - Fallback automático: se chave faltar no idioma escolhido, usa pt-BR
 *    (mantém ptBR como source of truth durante migração progressiva)
 */
import { createContext, useCallback, useContext, useMemo, useState, useEffect } from 'react'
import type { TranslationKeys } from './types'
import { ptBR } from './pt-BR'
import { en } from './en'
import { es } from './es'

export type Locale = 'pt-BR' | 'en' | 'es'

const DICTIONARIES: Record<Locale, TranslationKeys> = { 'pt-BR': ptBR, en, es }
const STORAGE_KEY = 'iga.i18n.locale'

function detectInitialLocale(): Locale {
  /** localStorage tem prioridade — user já escolheu antes. */
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'pt-BR' || stored === 'en' || stored === 'es') return stored
  } catch { /* noop */ }
  /** Fallback: navigator.language ('en-US' → 'en'). */
  try {
    const nav = (typeof navigator !== 'undefined' && navigator.language) ? navigator.language.toLowerCase() : ''
    if (nav.startsWith('en')) return 'en'
    if (nav.startsWith('es')) return 'es'
  } catch { /* noop */ }
  return 'pt-BR'
}

type I18nContextValue = {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (key: keyof TranslationKeys, params?: Record<string, string | number>) => string
  availableLocales: Array<{ value: Locale; label: string }>
}

const I18nContext = createContext<I18nContextValue | null>(null)

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => detectInitialLocale())

  useEffect(() => {
    /** Sync html.lang pra acessibilidade + leitores de tela. */
    try { document.documentElement.lang = locale } catch { /* noop */ }
  }, [locale])

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale)
    try { localStorage.setItem(STORAGE_KEY, newLocale) } catch { /* noop */ }
  }, [])

  const t = useCallback(
    (key: keyof TranslationKeys, params?: Record<string, string | number>) => {
      const primary = DICTIONARIES[locale]
      /** Fallback pra pt-BR se key faltar no idioma selecionado. */
      let text = primary[key] ?? ptBR[key] ?? key
      if (params) {
        for (const [k, v] of Object.entries(params)) {
          text = text.replace(`{${k}}`, String(v))
        }
      }
      return text
    },
    [locale],
  )

  const value = useMemo<I18nContextValue>(() => ({
    locale,
    setLocale,
    t,
    availableLocales: [
      { value: 'pt-BR', label: 'Português (BR)' },
      { value: 'en', label: 'English' },
      { value: 'es', label: 'Español' },
    ],
  }), [locale, setLocale, t])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useI18n() {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used within I18nProvider')
  return ctx
}
