import type { Metadata } from 'next'
import './globals.css'
import 'streamdown/styles.css' // per-word fade-in animation keyframes for chat streaming
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/next'
import { ThemeProvider } from '@/components/providers/theme-provider'
import { AuthHashRedirect } from '@/components/features/auth/auth-hash-redirect'
import { ConsentProvider } from '@/components/providers/consent-provider'
import { ConsentModeBootstrap } from '@/components/features/consent/consent-mode-bootstrap'
import { CookieBanner } from '@/components/features/consent/cookie-banner'
import { ConsentSettingsDialog } from '@/components/features/consent/consent-settings-dialog'
import { GoogleAnalytics } from '@/components/features/consent/google-analytics'

// react-pdf styles for PDF preview component
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'

export const metadata: Metadata = {
  title: {
    default: 'Laglig.se – Lagefterlevnad & compliance för svenska företag',
    template: '%s | Laglig.se',
  },
  description:
    'Med Laglig.se får svenska företag full koll på sin lagefterlevnad. Bevaka lagändringar, bygg laglistor och säkerställ compliance – kom igång gratis.',
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
    <html lang="sv" suppressHydrationWarning>
      <head>
        {/* Consent Mode v2 default-denied — must fire before any analytics. */}
        <ConsentModeBootstrap />
      </head>
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">
        <ConsentProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <AuthHashRedirect />
            {children}
            <CookieBanner />
            <ConsentSettingsDialog />
          </ThemeProvider>
          {/* GA4 — mounts only when analytics consent is granted. */}
          <GoogleAnalytics />
        </ConsentProvider>
        {/* Vercel Analytics - Cookieless, GDPR-compliant tracking */}
        <Analytics />
        {/* Speed Insights - Tracks Core Web Vitals: LCP, FID, CLS, TTFB */}
        <SpeedInsights />
      </body>
    </html>
  )
}
