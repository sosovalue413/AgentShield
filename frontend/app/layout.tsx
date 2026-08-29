import type { Metadata, Viewport } from 'next'
import { JetBrains_Mono } from 'next/font/google'
import { GeistPixelGrid } from 'geist/font/pixel'
import { ThemeProvider } from '@/components/theme-provider'

import './globals.css'

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
})

export const metadata: Metadata = {
  metadataBase: new URL('https://frontend-teal-beta-ype2l2g0md.vercel.app'),
  applicationName: 'AgentShield',
  title: 'AgentShield | Security firewall for autonomous agents',
  description:
    'AgentShield inspects agent intent, enforces spending policies, and records verifiable decisions before actions reach the 0G network.',
  keywords: [
    'AI agent security',
    '0G testnet',
    'prompt injection detection',
    'transaction firewall',
    'agent spending policies',
    'autonomous agent wallets',
    'AI trust and safety',
  ],
  authors: [{ name: 'AgentShield' }],
  creator: 'AgentShield',
  publisher: 'AgentShield',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    title: 'AgentShield | Security firewall for autonomous agents',
    description:
      'Inspect intent, enforce budgets, and keep an auditable decision trail before agents can touch a 0G wallet.',
    siteName: 'AgentShield',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AgentShield | Security firewall for autonomous agents',
    description:
      'A security firewall for autonomous AI agents on 0G.',
  },
  icons: { icon: '/icon.svg' },
  manifest: '/manifest.webmanifest',
  category: 'technology',
}

export const viewport: Viewport = {
  themeColor: '#F2F1EA',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${jetbrainsMono.variable} ${GeistPixelGrid.variable}`} suppressHydrationWarning>
      <body className="font-mono antialiased">
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange>
          <a href="#main-content" className="skip-link">Skip to main content</a>
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
