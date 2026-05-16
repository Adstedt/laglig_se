/**
 * Story 25.0 (Epic 25) — QA TEST-001: matrix coverage for the
 * FIRST_RUN_MODAL_V0 emergency-disable flag predicate. This is the production
 * incident-response lever (AC 30 + AC 36); a regression here would silently
 * break the ability to disable the modal without a code deploy.
 */

import { describe, it, expect } from 'vitest'
import { isFirstRunModalEnabled } from '@/lib/onboarding/first-run-modal-flag'

describe('isFirstRunModalEnabled', () => {
  it('unset (undefined) → enabled (default-on)', () => {
    expect(isFirstRunModalEnabled(undefined)).toBe(true)
  })

  it('empty string → enabled (default-on)', () => {
    expect(isFirstRunModalEnabled('')).toBe(true)
  })

  it("'false' → disabled", () => {
    expect(isFirstRunModalEnabled('false')).toBe(false)
  })

  it("'0' → disabled", () => {
    expect(isFirstRunModalEnabled('0')).toBe(false)
  })

  it("'FALSE' / 'False' (any casing) → disabled", () => {
    expect(isFirstRunModalEnabled('FALSE')).toBe(false)
    expect(isFirstRunModalEnabled('False')).toBe(false)
  })

  it("'true' → enabled", () => {
    expect(isFirstRunModalEnabled('true')).toBe(true)
  })

  it("'1' → enabled", () => {
    expect(isFirstRunModalEnabled('1')).toBe(true)
  })

  it('any other value (typo, garbage) → enabled (default-on)', () => {
    expect(isFirstRunModalEnabled('flase')).toBe(true)
    expect(isFirstRunModalEnabled('off')).toBe(true)
    expect(isFirstRunModalEnabled('no')).toBe(true)
    expect(isFirstRunModalEnabled('disabled')).toBe(true)
  })
})
