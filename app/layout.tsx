import type { Metadata } from 'next'
import './globals.css'
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/next'

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
    <html lang="sv">
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">
        {children}
        {/* Vercel Analytics - Cookieless, GDPR-compliant tracking */}
        <Analytics />
        {/* Speed Insights - Tracks Core Web Vitals: LCP, FID, CLS, TTFB */}
        <SpeedInsights />
      </body>
    </html>
  )
}
