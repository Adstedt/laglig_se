/**
 * Cookie / tracking consent state.
 *
 * Version pinned so we can re-prompt on policy changes without losing the
 * existing record (bump version → mismatched stored version → prompt again).
 */

export const CONSENT_VERSION = 1
export const CONSENT_STORAGE_KEY = 'laglig_consent_v1'
/** Per IMY guidance — re-prompt after 12 months. */
export const CONSENT_TTL_MS = 365 * 24 * 60 * 60 * 1000

/**
 * Categories the user can toggle. `necessary` is always implicitly granted
 * (workspace cookie, auth session, CSRF) and is not user-controllable.
 */
export interface ConsentCategories {
  analytics: boolean
}

export interface ConsentRecord {
  version: number
  acceptedAt: string // ISO timestamp
  categories: ConsentCategories
}

/** Default-denied state used before the user has chosen. */
export const DEFAULT_CATEGORIES: ConsentCategories = {
  analytics: false,
}

export const ACCEPT_ALL_CATEGORIES: ConsentCategories = {
  analytics: true,
}
