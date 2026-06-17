/**
 * Mounts the Google Ads gtag.js tag (`AW-…`). Advanced Consent Mode: the tag
 * loads on every page (not gated on consent), with the `consent default` denied
 * state set in <head> by <ConsentModeBootstrap /> ensuring no ad cookies until
 * the user grants `ad_storage`. Conversions are fired imperatively via
 * `trackAdsConversion()`.
 *
 * Renders nothing when `NEXT_PUBLIC_GOOGLE_ADS_ID` is unset (dev / preview).
 */

import Script from 'next/script'
import { GOOGLE_ADS_ID } from '@/lib/marketing/google-ads'

export function GoogleAds() {
  if (!GOOGLE_ADS_ID) return null

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
