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
 * Ad signals stay `denied` until we actually ship ads.
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
  window.dataLayer = window.dataLayer ?? []
  window.dataLayer.push(args)
}

export function categoriesToConsentParams(
  categories: ConsentCategories
): GtagConsentParams {
  return {
    // Always denied until we run ads
    ad_storage: 'denied',
    ad_user_data: 'denied',
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
