import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/next'

// Optimized font loading with swap display for better CLS
const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
})

export const metadata: Metadata = {
  title: {
    default: 'Laglig.se - Svenska lagar och juridisk efterlevnad',
    template: '%s | Laglig.se',
  },
  description:
    'Laglig.se hjälper företag att förstå och följa svenska lagar. Utforska Svensk författningssamling (SFS) kostnadsfritt.',
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_BASE_URL || 'https://laglig.se'
  ),
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="sv" className={inter.variable}>
      <body className="min-h-screen bg-white font-sans text-gray-900 antialiased">
        {children}
        {/* Vercel Analytics - Cookieless, GDPR-compliant tracking */}
        <Analytics />
        {/* Speed Insights - Tracks Core Web Vitals: LCP, FID, CLS, TTFB */}
        <SpeedInsights />
      </body>
    </html>
  )
}
