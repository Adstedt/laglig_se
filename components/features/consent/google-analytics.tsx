'use client'

/**
 * Mounts the GA4 script tag once consent for analytics_storage is granted.
 * Consent Mode v2's default-denied bootstrap (set in `<head>` via
 * ConsentModeBootstrap) means GA4 will still queue + redact even if it
 * loaded with denied state — but we keep it gated here too as
 * belt-and-suspenders and to avoid the script weight when the user has
 * declined.
 *
 * Renders nothing when `NEXT_PUBLIC_GA_ID` is unset (preview / dev) or
 * when consent hasn't been granted.
 */

import Script from 'next/script'
import { useConsent } from '@/components/providers/consent-provider'

export function GoogleAnalytics() {
  const { hydrated, categories } = useConsent()
  const gaId = process.env.NEXT_PUBLIC_GA_ID

  if (!gaId) return null
  if (!hydrated) return null
  if (!categories.analytics) return null

  return (
    <>
      <Script
        id="ga4-loader"
        strategy="afterInteractive"
        src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
      />
      <Script
        id="ga4-init"
        strategy="afterInteractive"
        // eslint-disable-next-line react/no-danger -- documented gtag init pattern
        dangerouslySetInnerHTML={{
          __html: `
            gtag('js', new Date());
            gtag('config', '${gaId}', { anonymize_ip: true });
          `,
        }}
      />
    </>
  )
}
