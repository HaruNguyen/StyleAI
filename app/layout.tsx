import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'StyleAI — Your AI Fashion Photographer',
  description: 'Generate fashion photos of yourself anywhere in the world',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'StyleAI',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#7c3aed',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans">{children}</body>
    </html>
  )
}
