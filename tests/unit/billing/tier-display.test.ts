/**
 * Story 5.12 — unit tests for lib/billing/tier-display.ts.
 *
 * Locks in the v1 SEK pricing + asserts that feature bullets are derived from
 * lib/usage/limits.ts (so display + enforcement cannot drift).
 */
import { describe, it, expect } from 'vitest'
import {
  ADDON_SEAT_MONTHLY_SEK,
  formatMonthlyPrice,
  getTierDisplay,
} from '@/lib/billing/tier-display'
import { TIER_LIMITS } from '@/lib/usage/limits'

describe('getTierDisplay', () => {
  it('returns calibrated SEK pricing for Solo / Team / Enterprise', () => {
    expect(getTierDisplay('SOLO').monthlyPriceSek).toBe(499)
    expect(getTierDisplay('TEAM').monthlyPriceSek).toBe(1299)
    expect(getTierDisplay('ENTERPRISE').monthlyPriceSek).toBeNull()
  })

  it('Solo features include the 1-user / 3M token / 1 GB limits from TIER_LIMITS', () => {
    const solo = getTierDisplay('SOLO')
    // The features list IS derived from TIER_LIMITS — verify a few load-bearing entries.
    expect(solo.features).toContain('1 användare')
    // 3M tokens at 30K/turn = ~100 frågor (matches tokensToApproxQueries)
    expect(solo.features.some((f) => f.includes('100 AI-frågor'))).toBe(true)
    expect(solo.features.some((f) => f.includes('3M tokens'))).toBe(true)
    expect(solo.features).toContain(`${TIER_LIMITS.SOLO.storageGB} GB lagring`)
  })

  it('Team features include the 3-user base + add-on note + 9M token / 5 GB limits', () => {
    const team = getTierDisplay('TEAM')
    // Team users line includes the +SEK/seat addendum
    expect(
      team.features.some(
        (f) =>
          f.includes(`${TIER_LIMITS.TEAM.users} användare`) &&
          f.includes(`${ADDON_SEAT_MONTHLY_SEK} SEK/extra plats`)
      )
    ).toBe(true)
    expect(team.features.some((f) => f.includes('300 AI-frågor'))).toBe(true)
    expect(team.features.some((f) => f.includes('9M tokens'))).toBe(true)
    expect(team.features).toContain(`${TIER_LIMITS.TEAM.storageGB} GB lagring`)
  })

  it('Enterprise features render unlimited copy for null limits', () => {
    const ent = getTierDisplay('ENTERPRISE')
    expect(ent.features).toContain('Obegränsat antal användare')
    expect(ent.features).toContain('Obegränsade AI-frågor')
    // Enterprise still has a numeric storage cap (100 GB) per TIER_LIMITS — render that.
    expect(ent.features).toContain(
      `${TIER_LIMITS.ENTERPRISE.storageGB} GB lagring`
    )
  })

  it('aiQueriesEstimate is empty for unlimited Enterprise tier', () => {
    expect(getTierDisplay('ENTERPRISE').aiQueriesEstimate).toBe('')
    expect(getTierDisplay('SOLO').aiQueriesEstimate).toMatch(/≈ \d+ AI-frågor/)
  })
})

describe('formatMonthlyPrice', () => {
  it('formats numeric prices with sv-SE thousands separator + /mån suffix', () => {
    expect(formatMonthlyPrice(499)).toBe('499 SEK/mån')
    // 1299 may render with non-breaking space ( ) as locale separator
    expect(formatMonthlyPrice(1299)).toMatch(/^1\D?299 SEK\/mån$/)
  })

  it('returns "Anpassad" when the price is null (Enterprise)', () => {
    expect(formatMonthlyPrice(null)).toBe('Anpassad')
  })
})
