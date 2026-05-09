import { createContext, useContext } from 'react'
import type { AppThemeMode } from './theme'

export type ThemeContextValue = {
  mode: AppThemeMode
  setMode: (mode: AppThemeMode) => void
  toggle: () => void
}

export const ThemeContext = createContext<ThemeContextValue | null>(null)

export function useAppTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useAppTheme must be used within ThemeProvider')
  return ctx
}

