'use client'

import { ConfigProvider, theme } from 'antd'
import ptBR from 'antd/locale/pt_BR'

export function AntdProvider({ children }: { children: React.ReactNode }) {
  return (
    <ConfigProvider
      locale={ptBR}
      theme={{
        algorithm: theme.darkAlgorithm,
        token: {
          colorPrimary: '#f59e0b',
          colorBgBase: '#0a0e14',
          colorBgContainer: '#0f1620',
          colorBgElevated: '#161e2c',
          colorBorder: '#1f2937',
          colorBorderSecondary: '#1f2937',
          colorText: '#e4e7eb',
          colorTextSecondary: '#94a3b8',
          colorTextTertiary: '#64748b',
          fontFamily:
            'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
          borderRadius: 10,
        },
      }}
    >
      {children}
    </ConfigProvider>
  )
}
