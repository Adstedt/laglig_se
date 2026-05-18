/**
 * Story 25.3 (Epic 25, B.3): barrel contract test for the tutorial-tabs map.
 * Story 25.5 (Epic 25, B.5): map extended with `'feedback'` → <FeedbackStep>;
 * expected count bumped from 6 → 7.
 *
 * Asserts TUTORIAL_TAB_COMPONENTS has exactly 7 entries with the canonical
 * TutorialTabId keys. Catches accidental empty/undefined exports or key drift
 * that would otherwise show up as a runtime "undefined is not a component"
 * crash inside <TutorialStep>.
 */

import { describe, it, expect } from 'vitest'

import { TUTORIAL_TAB_COMPONENTS } from '@/components/features/onboarding-modal/tutorial-tabs'

const EXPECTED_KEYS = [
  'laglista',
  'kravpunkter',
  'uppgifter',
  'kontroller',
  'lagandringar',
  'ai-agent',
  'feedback',
] as const

describe('TUTORIAL_TAB_COMPONENTS', () => {
  it('has exactly 7 entries', () => {
    expect(Object.keys(TUTORIAL_TAB_COMPONENTS)).toHaveLength(7)
  })

  it('keys match the TutorialTabId union (sorted comparison)', () => {
    const keys = Object.keys(TUTORIAL_TAB_COMPONENTS).sort()
    const expected = [...EXPECTED_KEYS].sort()
    expect(keys).toEqual(expected)
  })

  // Per AC 30: accept function components AND memo/forwardRef-wrapped objects.
  it('every value is truthy and a function-or-object (component)', () => {
    for (const [key, comp] of Object.entries(TUTORIAL_TAB_COMPONENTS)) {
      expect(comp, `${key} should be truthy`).toBeTruthy()
      const typeOk = typeof comp === 'function' || typeof comp === 'object'
      expect(typeOk, `${key} should be a function or object`).toBe(true)
    }
  })
})
