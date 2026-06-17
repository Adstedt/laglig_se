'use client'

/**
 * Loads the Google Ads gtag.js tag (`AW-…`) once the visitor grants the
 * `marketing` consent category. Mirrors <GoogleAnalytics /> — the shared
 * `window.gtag` stub and Consent Mode v2 default-denied state are already set
 * in <head> by <ConsentModeBootstrap />, so loading here only adds the Ads
 * config; conversions are fired imperatively via `trackAdsConversion()`.
 *
 * Renders nothing when `NEXT_PUBLIC_GOOGLE_ADS_ID` is unset (dev / preview) or
 * when marketing consent hasn't been granted.
 */

import Script from 'next/script'
import { useConsent } from '@/components/providers/consent-provider'
import { GOOGLE_ADS_ID } from '@/lib/marketing/google-ads'

export function GoogleAds() {
  const { hydrated, categories } = useConsent()

  if (!GOOGLE_ADS_ID) return null
  if (!hydrated) return null
  if (!categories.marketing) return null

  return (
    <>
      <Script
        id="google-ads-loader"
        strategy="afterInteractive"
        src={`https://www.googletagmanager.com/gtag/js?id=${GOOGLE_ADS_ID}`}
      />
      <Script
        id="google-ads-init"
        strategy="afterInteractive"
        // eslint-disable-next-line react/no-danger -- documented gtag init pattern
        dangerouslySetInnerHTML={{
          __html: `
            gtag('js', new Date());
            gtag('config', '${GOOGLE_ADS_ID}');
          `,
        }}
      />
    </>
  )
}
