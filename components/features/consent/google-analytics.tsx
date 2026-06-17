/**
 * Mounts the GA4 tag. Advanced Consent Mode: the tag loads on every page (not
 * gated on consent), and the `consent default` denied state set in <head> by
 * <ConsentModeBootstrap /> — which runs before this afterInteractive script —
 * guarantees no cookies until the user grants `analytics_storage`. Denied
 * (cookieless) pings still flow, feeding GA4's behavioral/conversion modeling.
 *
 * Renders nothing when `NEXT_PUBLIC_GA_ID` is unset (preview / dev).
 */

import Script from 'next/script'

export function GoogleAnalytics() {
  const gaId = process.env.NEXT_PUBLIC_GA_ID

  if (!gaId) return null

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
            gtag('config', '${gaId}');
          `,
        }}
      />
    </>
  )
}
