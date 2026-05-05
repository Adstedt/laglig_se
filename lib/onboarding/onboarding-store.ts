const STORAGE_KEY = 'laglig_onboarding_data'
const TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

export interface OnboardingData {
  orgNumber?: string
  companyName?: string
  websiteUrl?: string
  companySummary?: string
  inferredFlags?: Record<string, boolean>
  legalForm?: string
  municipality?: string
  sniCode?: string
  industryLabel?: string
  employeeCount?: string
  streetAddress?: string
  postalCode?: string
  city?: string
  foundedYear?: string
  businessDescription?: string
  taxStatus?: string
  foreignOwned?: boolean
  activeStatus?: string
  // Story 5.12: tier pre-pick from marketing CTA `?plan=solo|team|enterprise`.
  // Wizard reads this on mount to pre-select a tile in TierPickerStep.
  pickedTier?: 'SOLO' | 'TEAM' | 'ENTERPRISE'
}

interface StoredData {
  data: OnboardingData
  timestamp: number
}

export function saveOnboardingData(data: Partial<OnboardingData>): void {
  try {
    const existing = readRaw()
    const merged: StoredData = {
      data: { ...(existing?.data ?? {}), ...data },
      timestamp: Date.now(),
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged))
  } catch {
    // Graceful degradation: private browsing or storage full
  }
}

export function getOnboardingData(): OnboardingData | null {
  try {
    const stored = readRaw()
    if (!stored) return null

    if (Date.now() - stored.timestamp > TTL_MS) {
      localStorage.removeItem(STORAGE_KEY)
      return null
    }

    return stored.data
  } catch {
    return null
  }
}

export function clearOnboardingData(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Graceful degradation
  }
}

export function parseFlags(
  flagsParam: string | null
): Record<string, boolean> | undefined {
  if (!flagsParam) return undefined

  const flags = flagsParam
    .split(',')
    .map((f) => f.trim())
    .filter((f) => f.length > 0)

  if (flags.length === 0) return undefined

  return Object.fromEntries(flags.map((f) => [f, true]))
}

/**
 * Story 5.12: parse the `?plan=` marketing query param into a SubscriptionTier.
 * Case-insensitive; rejects values outside the SOLO|TEAM|ENTERPRISE union.
 */
export function parsePickedTier(
  planParam: string | null
): 'SOLO' | 'TEAM' | 'ENTERPRISE' | undefined {
  if (!planParam) return undefined
  const normalized = planParam.trim().toUpperCase()
  if (
    normalized === 'SOLO' ||
    normalized === 'TEAM' ||
    normalized === 'ENTERPRISE'
  ) {
    return normalized
  }
  return undefined
}

function readRaw(): StoredData | null {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return null
  return JSON.parse(raw) as StoredData
}
