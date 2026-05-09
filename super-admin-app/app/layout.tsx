import type { Metadata } from 'next'
import './globals.css'
import { AntdProvider } from '@/components/AntdProvider'

export const metadata: Metadata = {
  title: 'IGA Super Admin',
  description: 'Painel de operação cross-tenant — uso restrito',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <AntdProvider>{children}</AntdProvider>
      </body>
    </html>
  )
}
