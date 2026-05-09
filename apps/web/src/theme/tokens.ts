export type ThemeId = 'light' | 'dark'

export type ThemeScale = {
  spacing: Record<'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl', number>
  radius: Record<'sm' | 'md' | 'lg' | 'full', number>
  typography: Record<'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl', number>
  lineHeight: Record<'tight' | 'base' | 'relaxed', number>
  font: {
    body: string
    display: string
  }
}

export type ThemeSemanticColors = {
  brand500: string
  brand600: string
  brand50: string
  success500: string
  warning500: string
  danger500: string
  bgPrimary: string
  bgSecondary: string
  textPrimary: string
  textMuted: string
  borderSubtle: string
  borderDefault: string
  surfaceElevated: string
}

export type AppDesignTokens = {
  scale: ThemeScale
  shadow: Record<'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'glow' | 'inset', string>
  motion: {
    duration: Record<'fast' | 'base' | 'slow', string>
    easing: Record<'standard' | 'entrance' | 'exit', string>
  }
  zIndex: Record<'base' | 'dropdown' | 'sticky' | 'modal' | 'toast' | 'tooltip', number>
  gradient: Record<'brandHero' | 'premium' | 'subtle' | 'glass', string>
  accent: Record<'gold' | 'violet' | 'cyan', string>
  surface: Record<'0' | '1' | '2' | '3', string>
  blur: Record<'sm' | 'md' | 'lg', string>
  themes: Record<ThemeId, ThemeSemanticColors>
}

export const appDesignTokens: AppDesignTokens = {
  scale: {
    spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, '2xl': 48 },
    radius: { sm: 4, md: 8, lg: 12, full: 9999 },
    typography: { xs: 12, sm: 14, md: 16, lg: 20, xl: 24, '2xl': 32, '3xl': 40 },
    lineHeight: { tight: 1.2, base: 1.5, relaxed: 1.7 },
    font: {
      body: "Inter, system-ui, -apple-system, 'Segoe UI', sans-serif",
      display: "Sora, Inter, system-ui, -apple-system, 'Segoe UI', sans-serif",
    },
  },
  shadow: {
    xs: '0 1px 2px rgba(15, 28, 42, 0.04)',
    sm: '0 4px 14px rgba(15, 28, 42, 0.06)',
    md: '0 10px 30px rgba(15, 28, 42, 0.10)',
    lg: '0 18px 48px rgba(15, 28, 42, 0.14)',
    xl: '0 28px 80px rgba(15, 28, 42, 0.18)',
    glow: '0 0 0 1px rgba(26, 122, 181, 0.18), 0 20px 60px rgba(26, 122, 181, 0.18)',
    inset: 'inset 0 1px 0 rgba(255,255,255,0.35)',
  },
  motion: {
    duration: { fast: '120ms', base: '220ms', slow: '420ms' },
    easing: {
      standard: 'cubic-bezier(0.2, 0, 0, 1)',
      entrance: 'cubic-bezier(0.16, 1, 0.3, 1)',
      exit: 'cubic-bezier(0.7, 0, 0.84, 0)',
    },
  },
  zIndex: { base: 1, dropdown: 1000, sticky: 1100, modal: 1300, toast: 1400, tooltip: 1500 },
  gradient: {
    brandHero: 'linear-gradient(135deg, #0D5A8C 0%, #1A7AB5 48%, #4AABE0 100%)',
    premium: 'linear-gradient(135deg, #1A7AB5 0%, #7C3AED 58%, #D97706 100%)',
    subtle: 'linear-gradient(180deg, rgba(26,122,181,0.10) 0%, rgba(255,255,255,0) 100%)',
    glass: 'linear-gradient(180deg, rgba(255,255,255,0.82) 0%, rgba(255,255,255,0.64) 100%)',
  },
  accent: { gold: '#D97706', violet: '#7C3AED', cyan: '#0891B2' },
  surface: { '0': '#FFFFFF', '1': '#FAFCFE', '2': '#F3F7FB', '3': '#EAF1F7' },
  blur: { sm: '6px', md: '12px', lg: '20px' },
  themes: {
    light: {
      brand500: '#1A7AB5',
      brand600: '#0D5A8C',
      brand50: '#E4F0F8',
      success500: '#10B981',
      warning500: '#F59E0B',
      danger500: '#EF4444',
      bgPrimary: '#EEF3F8',
      bgSecondary: '#FFFFFF',
      textPrimary: '#0F1C28',
      textMuted: '#5A6D7D',
      borderSubtle: '#E3EDF6',
      borderDefault: '#C9D8E6',
      surfaceElevated: '#FAFCFE',
    },
    dark: {
      brand500: '#4AABE0',
      brand600: '#2196D3',
      brand50: '#142430',
      success500: '#10B981',
      warning500: '#F59E0B',
      danger500: '#EF4444',
      bgPrimary: '#080D12',
      bgSecondary: '#111920',
      textPrimary: '#E8EEF4',
      textMuted: '#8A9BB0',
      borderSubtle: '#243344',
      borderDefault: '#2D3F52',
      surfaceElevated: '#19232E',
    },
  },
}

export function getThemeTokens(mode: ThemeId): ThemeSemanticColors {
  return appDesignTokens.themes[mode]
}
