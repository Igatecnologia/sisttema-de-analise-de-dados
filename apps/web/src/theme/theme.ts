export type AppThemeMode = 'light' | 'dark'

const THEME_KEY = 'iga_theme_mode'

export function getStoredThemeMode(): AppThemeMode {
  if (typeof document === 'undefined') return 'light'
  const fromCookie = document.cookie
    .split('; ')
    .find((entry) => entry.startsWith(`${THEME_KEY}=`))
    ?.split('=')[1]
  if (fromCookie === 'dark' || fromCookie === 'light') return fromCookie
  if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark'
  }
  return 'light'
}

export function setStoredThemeMode(mode: AppThemeMode) {
  if (typeof document === 'undefined') return
  const maxAge = 60 * 60 * 24 * 365
  document.cookie = `${THEME_KEY}=${mode}; path=/; max-age=${maxAge}; samesite=lax`
}
