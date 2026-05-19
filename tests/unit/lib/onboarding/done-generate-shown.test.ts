/**
 * Story 25.6 v1.1: unit tests for the localStorage helper that drives the
 * FAB celebrate-variant demotion.
 */

import { describe, it, expect, beforeEach } from 'vitest'

import {
  hasSeenDoneGenerate,
  markDoneGenerateShown,
} from '@/lib/onboarding/done-generate-shown'

describe('done-generate-shown', () => {
  beforeEach(() => {
    // jsdom provides a real localStorage — wipe between tests.
    window.localStorage.clear()
  })

  it('returns false when no flag is set for the workspace', () => {
    expect(hasSeenDoneGenerate('ws_1')).toBe(false)
  })

  it('write + read roundtrip — flag set for ws_1 does not affect ws_2', () => {
    markDoneGenerateShown('ws_1')

    expect(hasSeenDoneGenerate('ws_1')).toBe(true)
    expect(hasSeenDoneGenerate('ws_2')).toBe(false)
  })

  it('uses the laglig: prefix + workspace id as the storage key', () => {
    markDoneGenerateShown('ws_123')

    expect(
      window.localStorage.getItem('laglig:done-generate-shown:ws_123')
    ).toBe('1')
  })

  it('swallows storage errors (private browsing / quota) instead of throwing', () => {
    const originalSetItem = window.localStorage.setItem.bind(
      window.localStorage
    )
    window.localStorage.setItem = () => {
      throw new Error('QuotaExceededError')
    }

    // Should NOT throw
    expect(() => markDoneGenerateShown('ws_quota')).not.toThrow()

    // Restore for subsequent tests
    window.localStorage.setItem = originalSetItem
  })
})
