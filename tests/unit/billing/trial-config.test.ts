/**
 * Story 5.13: trial-config constants test.
 *
 * Pins the documented values so a future refactor can't silently drift the
 * trial duration / grace windows away from what the spec + UI copy claim.
 */
import { describe, expect, it } from 'vitest'
import {
  TRIAL_DURATION_DAYS,
  TRIAL_GRACE_PAUSE_DAYS,
  TRIAL_GRACE_DELETE_DAYS,
} from '@/lib/billing/trial-config'

describe('trial-config constants', () => {
  it('exports TRIAL_DURATION_DAYS = 15 (per Story 5.13 product decision 2026-05-06)', () => {
    expect(TRIAL_DURATION_DAYS).toBe(15)
  })

  it('exports TRIAL_GRACE_PAUSE_DAYS = 30 (workspace flips to PAUSED 30 days post-trial-end)', () => {
    expect(TRIAL_GRACE_PAUSE_DAYS).toBe(30)
  })

  it('exports TRIAL_GRACE_DELETE_DAYS = 60 (status flips to DELETED 60 days post-trial-end)', () => {
    expect(TRIAL_GRACE_DELETE_DAYS).toBe(60)
  })

  it('PAUSE precedes DELETE in the lifecycle', () => {
    expect(TRIAL_GRACE_PAUSE_DAYS).toBeLessThan(TRIAL_GRACE_DELETE_DAYS)
  })
})
