/**
 * Unified client-side analytics event.
 *
 * Fans a single custom event out to BOTH sinks so we never have to remember
 * to call two libraries at every call site:
 *
 *  - Vercel Analytics — cookieless and GDPR-safe, so it's always collecting.
 *    The `track()` call is therefore unconditional.
 *  - GA4 — routed through the global `window.gtag` stub installed by
 *    <ConsentModeBootstrap /> in <head>. Consent Mode v2 keeps the event
 *    queued + redacted until the user grants `analytics_storage`, so calling
 *    gtag here is always safe; no per-call-site consent check is needed.
 *    (`window.gtag` is declared globally in `lib/consent/gtag.ts`.)
 *
 * Client-only. For server actions / route handlers use `safeTrack` /
 * `trackAsync` from `@/lib/analytics` — those reach Vercel only, since GA4
 * server-side events would require the Measurement Protocol.
 *
 * Event names are snake_case to match the existing taxonomy and GA4's
 * recommended naming convention.
 */

import { track } from '@vercel/analytics'

/** Property values accepted by both Vercel Analytics and GA4. */
export type TrackEventProps = Record<string, string | number | boolean | null>

export function trackEvent(name: string, props?: TrackEventProps): void {
  // Vercel Analytics (cookieless, always on).
  try {
    track(name, props)
  } catch {
    // Analytics must never throw into product code.
  }

  // GA4 via the consent-aware gtag stub.
  if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
    window.gtag('event', name, props ?? {})
  }
}
