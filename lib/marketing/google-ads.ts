/**
 * Google Ads conversion tracking.
 *
 * A single Google Ads gtag.js tag (`AW-…`) is loaded by <GoogleAds /> once the
 * visitor grants the `marketing` consent category. Conversions are then fired
 * imperatively at the moment they happen (e.g. account creation) via
 * `trackAdsConversion()` — they occur on client-side state transitions, not
 * full page loads, so we can't rely on a page-view conversion.
 *
 * The Google Ads tag, loaded on landing, captures the ad click id (gclid) into
 * the `_gcl_*` cookies automatically, so a fired conversion attributes back to
 * the campaign with no manual gclid handling. (Enhanced Conversions — sending a
 * hashed email for better match rates — is a later upgrade.)
 *
 * ── Adding another conversion ──
 * 1. Create the conversion action in Google Ads → copy its conversion label.
 * 2. Add a `NEXT_PUBLIC_GOOGLE_ADS_<NAME>_LABEL` env var.
 * 3. Add the key to `AdsConversion` + `CONVERSION_LABELS`.
 * 4. Call `trackAdsConversion('<name>')` at the moment it fires.
 * Nothing else changes.
 */

/** The Google Ads account tag, e.g. "AW-1234567890". Unset in dev/preview. */
export const GOOGLE_ADS_ID = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID

/** Conversions we currently track. `signup` = account creation. */
export type AdsConversion = 'signup'

/**
 * Per-conversion labels from env. A conversion only fires if its label is set,
 * so shipping the code without configuring a label is a safe no-op.
 */
const CONVERSION_LABELS: Record<AdsConversion, string | undefined> = {
  signup: process.env.NEXT_PUBLIC_GOOGLE_ADS_SIGNUP_LABEL,
}

interface AdsConversionParams {
  /** Optional conversion value (e.g. trial → expected MRR). */
  value?: number
  /** ISO currency code; required by Google Ads if `value` is set. */
  currency?: string
  /** Dedup key — Google Ads ignores repeat conversions with the same id. */
  transactionId?: string
}

/**
 * Fires a Google Ads conversion. No-ops safely when run server-side, before
 * gtag has loaded (no marketing consent), or when the account/label env vars
 * are unset.
 */
export function trackAdsConversion(
  conversion: AdsConversion,
  params?: AdsConversionParams
): void {
  if (typeof window === 'undefined') return
  if (typeof window.gtag !== 'function') return
  if (!GOOGLE_ADS_ID) return

  const label = CONVERSION_LABELS[conversion]
  if (!label) return

  window.gtag('event', 'conversion', {
    send_to: `${GOOGLE_ADS_ID}/${label}`,
    ...(params?.value != null ? { value: params.value } : {}),
    ...(params?.currency ? { currency: params.currency } : {}),
    ...(params?.transactionId ? { transaction_id: params.transactionId } : {}),
  })
}

/**
 * Remarketing audience events. Unlike conversions, these don't need a per-event
 * label — they fire a named gtag event to the Ads account, and an audience is
 * then defined in Google Ads → Audience Manager from the event (+ its params).
 * Use for high-intent moments worth retargeting (e.g. completing the org-number
 * preview) — a tighter list than the default all-visitors remarketing audience.
 *
 * Requires the visitor to have granted `marketing` consent (which now also
 * grants ad_personalization); no-ops safely otherwise, so it's always safe to
 * call on the success path.
 */
export type AdsRemarketingEvent = 'org_preview_completed'

export function trackAdsRemarketingEvent(
  event: AdsRemarketingEvent,
  params?: Record<string, string | number>
): void {
  if (typeof window === 'undefined') return
  if (typeof window.gtag !== 'function') return
  if (!GOOGLE_ADS_ID) return

  window.gtag('event', event, {
    send_to: GOOGLE_ADS_ID,
    ...params,
  })
}
