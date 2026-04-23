export type ThemeId = 'light' | 'dark'

export type ThemeScale = {
  spacing: Record<'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl', number>
  radius: Record<'sm' | 'md' | 'lg' | 'full', number>
  typography: Record<'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl', number>
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
  themes: Record<ThemeId, ThemeSemanticColors>
}

export const appDesignTokens: AppDesignTokens = {
  scale: {
    spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, '2xl': 48 },
    radius: { sm: 4, md: 8, lg: 12, full: 9999 },
    typography: { xs: 12, sm: 14, md: 16, lg: 20, xl: 24, '2xl': 32, '3xl': 40 },
    font: {
      body: "Inter, system-ui, -apple-system, 'Segoe UI', sans-serif",
      display: "Sora, Inter, system-ui, -apple-system, 'Segoe UI', sans-serif",
    },
  },
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
