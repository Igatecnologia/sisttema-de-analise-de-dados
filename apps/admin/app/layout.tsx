import type { Metadata } from 'next'
import './globals.css'
import { AntdProvider } from '@/components/AntdProvider'
import { ThemeProvider } from '@/components/ThemeProvider'

export const metadata: Metadata = {
  title: 'IGA Super Admin',
  description: 'Painel cross-tenant — uso restrito',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <ThemeProvider>
          <AntdProvider>{children}</AntdProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
