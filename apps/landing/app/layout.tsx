import type { Metadata, Viewport } from 'next'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import './globals.css'

export const metadata: Metadata = {
  metadataBase: new URL('https://igagestao.com.br'),
  title: {
    default: 'IGA Gestão — Dashboard industrial com IA',
    template: '%s · IGA Gestão',
  },
  description:
    'Conecte seu ERP e tenha visão completa da produção, estoque, financeiro e vendas em minutos. Trial grátis de 14 dias, sem cartão.',
  applicationName: 'IGA Gestão',
  keywords: [
    'sistema de gestão industrial',
    'dashboard de produção',
    'ERP para indústria',
    'BI industrial',
    'controle de produção online',
    'copiloto IA',
  ],
  authors: [{ name: 'IGA Automação & Tecnologia' }],
  openGraph: {
    type: 'website',
    locale: 'pt_BR',
    url: 'https://igagestao.com.br',
    title: 'IGA Gestão — Dashboard industrial com IA',
    description:
      'Conecte seu ERP e tenha visão completa da produção, estoque, financeiro e vendas em minutos.',
    siteName: 'IGA Gestão',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'IGA Gestão — Dashboard industrial com IA',
    description:
      'Conecte seu ERP e tenha visão completa da produção, estoque, financeiro e vendas em minutos.',
  },
  robots: { index: true, follow: true },
}

export const viewport: Viewport = {
  themeColor: '#ffffff',
  colorScheme: 'light',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="bg-white text-[#0a0b0d] antialiased">{children}</body>
    </html>
  )
}
