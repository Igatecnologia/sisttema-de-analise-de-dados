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
  themeColor: '#080d12',
  colorScheme: 'dark',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-ink-900 text-ink-50 antialiased">{children}</body>
    </html>
  )
}
