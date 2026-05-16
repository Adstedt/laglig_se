/**
 * localStorage read/write for the consent record. Pure functions; no React.
 * All reads/writes are wrapped in try/catch — localStorage can throw in
 * private browsing modes or when quota is exceeded.
 */

import {
  CONSENT_STORAGE_KEY,
  CONSENT_TTL_MS,
  CONSENT_VERSION,
  type ConsentRecord,
} from './types'

export function readConsent(): ConsentRecord | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(CONSENT_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as ConsentRecord
    if (parsed.version !== CONSENT_VERSION) return null
    const ageMs = Date.now() - new Date(parsed.acceptedAt).getTime()
    if (Number.isNaN(ageMs) || ageMs > CONSENT_TTL_MS) return null
    return parsed
  } catch {
    return null
  }
}

export function writeConsent(record: ConsentRecord): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(record))
  } catch {
    // private-mode / quota — swallow; consent will re-prompt next session
  }
}

export function clearConsent(): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(CONSENT_STORAGE_KEY)
  } catch {
    // ignore
  }
}
