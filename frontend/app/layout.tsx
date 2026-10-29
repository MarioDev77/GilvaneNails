import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Figtree } from 'next/font/google'
import './globals.css'

const figtree = Figtree({ subsets: ['latin'], variable: '--font-figtree', display: 'swap' })

export const metadata: Metadata = {
  title: 'Gilvane Nails | Gestão para manicure',
  description: 'Organize sua agenda, clientes e financeiro com delicadeza.',
  generator: 'v0.app',
  manifest: '/manifest.webmanifest',
  icons: { icon: '/icon.svg', apple: '/apple-icon.png' },
}

export const viewport: Viewport = {
  colorScheme: 'light',
  themeColor: '#c94f6c',
  viewportFit: 'cover',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body className={`${figtree.variable} antialiased`}>{children}{process.env.NODE_ENV === 'production' && <Analytics />}</body></html>
}


 
