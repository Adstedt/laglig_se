/**
 * Google Consent Mode v2 helpers.
 *
 * The `default` call MUST fire before any GA4 script loads — that's why the
 * inline-script in <ConsentModeBootstrap /> runs in <head>, before any other
 * client code. The `update` call fires whenever the user changes their mind.
 *
 * Necessary-category signals (security_storage, functionality_storage,
 * personalization_storage) stay `granted` always — they map to cookies the
 * app cannot run without (auth session, workspace selection, theme prefs).
 * Ad signals (ad_storage, ad_user_data) follow the `marketing` category for
 * Google Ads conversion tracking; ad_personalization stays denied until we run
 * personalized/remarketing audiences.
 */

import type { ConsentCategories } from './types'

type GtagConsentSignal =
  | 'ad_storage'
  | 'ad_user_data'
  | 'ad_personalization'
  | 'analytics_storage'
  | 'functionality_storage'
  | 'personalization_storage'
  | 'security_storage'

type GtagConsentValue = 'granted' | 'denied'

type GtagConsentParams = Partial<Record<GtagConsentSignal, GtagConsentValue>>

declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: (..._args: unknown[]) => void
  }
}

function gtag(...args: unknown[]): void {
  if (typeof window === 'undefined') return
  // Delegate to the global stub installed in <head> by <ConsentModeBootstrap />,
  // which does `dataLayer.push(arguments)`. gtag.js only recognizes consent
  // commands pushed as an `arguments` object; pushing a plain array (as this
  // helper used to) is silently ignored, leaving consent stuck at default-denied.
  window.gtag?.(...args)
}

export function categoriesToConsentParams(
  categories: ConsentCategories
): GtagConsentParams {
  return {
    // Google Ads / conversion tracking — user-controllable via the
    // `marketing` category. ad_personalization stays denied until we
    // actually run personalized/remarketing audiences.
    ad_storage: categories.marketing ? 'granted' : 'denied',
    ad_user_data: categories.marketing ? 'granted' : 'denied',
    ad_personalization: 'denied',
    // User-controllable
    analytics_storage: categories.analytics ? 'granted' : 'denied',
    // Always granted — required for the app to function
    functionality_storage: 'granted',
    personalization_storage: 'granted',
    security_storage: 'granted',
  }
}

export function applyConsent(categories: ConsentCategories): void {
  if (typeof window === 'undefined') return
  gtag('consent', 'update', categoriesToConsentParams(categories))
}
