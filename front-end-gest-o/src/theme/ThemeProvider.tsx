import { App, ConfigProvider, theme as antdTheme } from 'antd'
import ptBR from 'antd/es/locale/pt_BR'
import dayjs from 'dayjs'
import { useCallback, useEffect, useMemo, useState } from 'react'
/** Setup do dayjs (locale + plugins) vive em `i18n/dayjsSetup.ts` e é importado
 *  primeiro em `main.tsx`. Aqui sincronizamos ConfigProvider + dayjs com o I18n. */
import { ThemeContext, type ThemeContextValue } from './ThemeContext'
import {
  getStoredThemeMode,
  setStoredThemeMode,
  type AppThemeMode,
} from './theme'
import { appDesignTokens, getThemeTokens } from './tokens'

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<AppThemeMode>(() => getStoredThemeMode())

  const setMode = useCallback((next: AppThemeMode) => {
    setModeState(next)
    setStoredThemeMode(next)
  }, [])

  const toggle = useCallback(() => {
    setModeState((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark'
      setStoredThemeMode(next)
      return next
    })
  }, [])

  const algorithm =
    mode === 'dark' ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm

  const value: ThemeContextValue = { mode, setMode, toggle }
  const palette = getThemeTokens(mode)

  useEffect(() => {
    document.documentElement.dataset.theme = mode

    // Injetar CSS de alta prioridade para popups do DatePicker/Select
    const styleId = 'iga-popup-theme'
    let styleEl = document.getElementById(styleId) as HTMLStyleElement | null
    if (!styleEl) {
      styleEl = document.createElement('style')
      styleEl.id = styleId
      document.head.appendChild(styleEl)
    }
    const isDark = mode === 'dark'
    styleEl.textContent = isDark ? `
      .ant-picker-dropdown .ant-picker-panel-container {
        background: #111920 !important;
        border: 1px solid #243344 !important;
        border-radius: 14px !important;
        box-shadow: 0 20px 60px rgba(0,0,0,0.55) !important;
        overflow: hidden !important;
      }
      .ant-picker-dropdown .ant-picker-panel {
        background: #111920 !important;
        border-color: #243344 !important;
      }
      .ant-picker-dropdown .ant-picker-header {
        background: #111920 !important;
        border-bottom-color: #243344 !important;
        color: #e8eef4 !important;
      }
      .ant-picker-dropdown .ant-picker-header button { color: #8a9bb0 !important; }
      .ant-picker-dropdown .ant-picker-header button:hover { color: #4aabe0 !important; }
      .ant-picker-dropdown .ant-picker-body { background: #111920 !important; }
      .ant-picker-dropdown .ant-picker-content th {
        color: #8a9bb0 !important;
        font-size: 0.6875rem !important;
        font-weight: 600 !important;
      }
      .ant-picker-dropdown .ant-picker-cell .ant-picker-cell-inner {
        color: #e8eef4 !important;
        border-radius: 8px !important;
      }
      .ant-picker-dropdown .ant-picker-cell:not(.ant-picker-cell-in-view) .ant-picker-cell-inner {
        color: rgba(138,155,176,0.4) !important;
      }
      .ant-picker-dropdown .ant-picker-cell:hover:not(.ant-picker-cell-selected):not(.ant-picker-cell-range-start):not(.ant-picker-cell-range-end) .ant-picker-cell-inner {
        background: rgba(74,171,224,0.18) !important;
      }
      .ant-picker-dropdown .ant-picker-cell-selected .ant-picker-cell-inner,
      .ant-picker-dropdown .ant-picker-cell-range-start .ant-picker-cell-inner,
      .ant-picker-dropdown .ant-picker-cell-range-end .ant-picker-cell-inner {
        background: #4aabe0 !important;
        color: #fff !important;
        border-radius: 8px !important;
        box-shadow: 0 4px 14px rgba(74,171,224,0.35) !important;
      }
      .ant-picker-dropdown .ant-picker-cell-in-range::before {
        background: rgba(74,171,224,0.14) !important;
      }
      .ant-picker-dropdown .ant-picker-cell-today .ant-picker-cell-inner::before {
        border-color: #4aabe0 !important;
        border-radius: 8px !important;
      }
      .ant-picker-dropdown .ant-picker-footer {
        background: #111920 !important;
        border-top-color: #243344 !important;
      }
      .ant-picker-dropdown .ant-picker-panel + .ant-picker-panel {
        border-left-color: #243344 !important;
      }
      .ant-picker-dropdown .ant-picker-date-panel,
      .ant-picker-dropdown .ant-picker-month-panel,
      .ant-picker-dropdown .ant-picker-year-panel,
      .ant-picker-dropdown .ant-picker-decade-panel {
        background: #111920 !important;
      }
    ` : `
      .ant-picker-dropdown .ant-picker-panel-container {
        border-radius: 14px !important;
        box-shadow: 0 20px 60px rgba(15,23,42,0.14) !important;
        overflow: hidden !important;
      }
      .ant-picker-dropdown .ant-picker-content th {
        font-size: 0.6875rem !important;
        font-weight: 600 !important;
      }
      .ant-picker-dropdown .ant-picker-cell .ant-picker-cell-inner { border-radius: 8px !important; }
      .ant-picker-dropdown .ant-picker-cell-selected .ant-picker-cell-inner,
      .ant-picker-dropdown .ant-picker-cell-range-start .ant-picker-cell-inner,
      .ant-picker-dropdown .ant-picker-cell-range-end .ant-picker-cell-inner {
        background: #1a7ab5 !important;
        color: #fff !important;
        border-radius: 8px !important;
        box-shadow: 0 4px 12px rgba(26,122,181,0.3) !important;
      }
      .ant-picker-dropdown .ant-picker-cell-in-range::before {
        background: rgba(26,122,181,0.10) !important;
      }
      .ant-picker-dropdown .ant-picker-cell-today .ant-picker-cell-inner::before {
        border-color: #1a7ab5 !important;
        border-radius: 8px !important;
      }
    `
  }, [mode])

  const themeConfig = useMemo(() => {
    const isLight = mode === 'light'

    return {
      algorithm,
      token: {
        fontFamily: appDesignTokens.scale.font.body,
        fontSize: appDesignTokens.scale.typography.sm,
        borderRadius: appDesignTokens.scale.radius.lg,
        controlHeight: 40,
        controlHeightLG: 44,

        colorPrimary: palette.brand500,
        colorInfo: palette.brand500,
        colorBorder: palette.borderDefault,
        colorBorderSecondary: palette.borderSubtle,
        colorSplit: isLight ? '#e8f0f7' : palette.borderDefault,

        colorText: palette.textPrimary,
        colorTextSecondary: palette.textMuted,
        ...(isLight
          ? {
              colorTextTertiary: '#8b9bab',
              colorFillAlter: '#f6f9fc',
              colorFillSecondary: '#eef3f8',
              colorFillTertiary: '#e4ecf4',
              colorPrimaryBg: palette.brand50,
              colorPrimaryBgHover: '#d4e8f4',
              colorPrimaryBorder: '#9cc4e0',
              controlOutline: 'rgba(11, 95, 255, 0.2)',
              boxShadow:
                '0 1px 2px rgba(15, 28, 42, 0.04), 0 4px 14px rgba(15, 28, 42, 0.06)',
              boxShadowSecondary:
                '0 8px 24px rgba(15, 28, 42, 0.08)',
            }
          : {}),

        colorBgBase: palette.bgPrimary,
        colorBgLayout: palette.bgPrimary,
        colorBgContainer: palette.bgSecondary,
        colorBgElevated: palette.surfaceElevated,

        colorLink: palette.brand500,
        colorLinkHover: palette.brand600,
      },
      components: {
        Layout: {
          headerHeight: 64,
          headerBg: palette.bgSecondary,
          siderBg: palette.bgSecondary,
          bodyBg: palette.bgPrimary,
        },
        Card: { paddingLG: 20 },
        Table: {
          headerBorderRadius: 12,
          headerBg: mode === 'dark' ? palette.surfaceElevated : '#e6eef6',
          borderColor: palette.borderDefault,
          rowHoverBg: mode === 'dark' ? '#1a2a38' : '#f2f7fb',
          rowSelectedBg: mode === 'dark' ? '#1a2a38' : '#e8f2fa',
          rowSelectedHoverBg: mode === 'dark' ? '#1f3142' : '#ddeef8',
        },
        Button: { borderRadius: 8, controlHeight: 40, fontWeight: 500 },
        Input: {
          activeBorderColor: palette.brand500,
          hoverBorderColor: palette.brand500,
          ...(isLight
            ? {
                activeShadow: '0 0 0 2px rgba(11, 95, 255, 0.12)',
              }
            : {}),
        },
        Select: {
          optionSelectedBg: mode === 'dark' ? '#1a2a38' : '#e4f0f8',
        },
        Menu: {
          itemSelectedBg:
            mode === 'dark'
              ? 'rgba(74, 171, 224, 0.16)'
              : 'rgba(11, 95, 255, 0.12)',
          itemSelectedColor: palette.brand500,
          itemHoverBg:
            mode === 'dark'
              ? 'rgba(74, 171, 224, 0.08)'
              : 'rgba(11, 95, 255, 0.06)',
        },
        Modal: isLight
          ? {
              contentBg: getThemeTokens('light').bgSecondary,
              headerBg: getThemeTokens('light').bgSecondary,
              footerBg: getThemeTokens('light').bgSecondary,
            }
          : {},
        DatePicker: {
          cellHeight: 28,
          cellWidth: 36,
          cellRangeBorderColor: palette.brand500,
          cellActiveWithRangeBg: mode === 'dark'
            ? 'rgba(74, 171, 224, 0.14)'
            : 'rgba(26, 122, 181, 0.10)',
          cellHoverBg: mode === 'dark'
            ? 'rgba(74, 171, 224, 0.18)'
            : 'rgba(26, 122, 181, 0.08)',
          activeBorderColor: palette.brand500,
          hoverBorderColor: palette.brand500,
        },
      },
    }
  }, [algorithm, mode, palette])

  // dayjs locale — sempre pt-br para calendários e formatação
  useEffect(() => {
    dayjs.locale('pt-br')
  }, [])

  return (
    <ThemeContext.Provider value={value}>
      <ConfigProvider
        theme={themeConfig}
        locale={ptBR}
      >
        <App>{children}</App>
      </ConfigProvider>
    </ThemeContext.Provider>
  )
}

