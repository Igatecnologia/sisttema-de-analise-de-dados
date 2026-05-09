'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'

type Theme = 'dark' | 'light'

type ThemeContextValue = {
  theme: Theme
  toggle: () => void
  setTheme: (t: Theme) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

const STORAGE_KEY = 'iga.admin.theme'

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('dark')

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as Theme | null
      if (saved === 'dark' || saved === 'light') {
        setThemeState(saved)
        document.documentElement.dataset.theme = saved
      } else {
        // Detecta preferencia do sistema
        const prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches
        const initial: Theme = prefersLight ? 'light' : 'dark'
        setThemeState(initial)
        document.documentElement.dataset.theme = initial
      }
    } catch {
      /* noop */
    }
  }, [])

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t)
    try {
      localStorage.setItem(STORAGE_KEY, t)
      document.documentElement.dataset.theme = t
    } catch {
      /* noop */
    }
  }, [])

  const toggle = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark')
  }, [theme, setTheme])

  return <ThemeContext.Provider value={{ theme, toggle, setTheme }}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme deve estar dentro de ThemeProvider')
  return ctx
}
