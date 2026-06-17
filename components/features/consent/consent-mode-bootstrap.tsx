/**
 * Inlines Google Consent Mode v2 default-denied state into the HTML head
 * before any analytics script can load.
 *
 * Rendered inside the root layout's <head> as a plain <script> so it executes
 * synchronously, before any other client code — that's the contract Consent
 * Mode v2 needs (gtag default must precede every other gtag call). Using a
 * plain <script> instead of next/script's beforeInteractive avoids the
 * App-Router lint warning and keeps the bootstrap dependency-free.
 */

const BOOTSTRAP_SCRIPT = `
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  window.gtag = gtag;
  gtag('consent', 'default', {
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    analytics_storage: 'denied',
    functionality_storage: 'granted',
    personalization_storage: 'granted',
    security_storage: 'granted',
    wait_for_update: 500
  });
  // Advanced Consent Mode: redact ad identifiers while ad_storage is denied,
  // and pass the ad click id (gclid) via URL when cookies are unavailable.
  gtag('set', 'ads_data_redaction', true);
  gtag('set', 'url_passthrough', true);
`

export function ConsentModeBootstrap() {
  return (
    <script
      // eslint-disable-next-line react/no-danger -- documented gtag init pattern
      dangerouslySetInnerHTML={{ __html: BOOTSTRAP_SCRIPT }}
    />
  )
}
