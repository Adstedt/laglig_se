/**
 * Story 7.4 (Task 3b): personnummer display formatting — pure, display-only.
 */
import { describe, test, expect } from 'vitest'
import { formatPersonnummerDisplay } from '@/components/features/personalregister/format-personnummer'

describe('formatPersonnummerDisplay', () => {
  test('10 digits → ÅÅMMDD-XXXX', () => {
    expect(formatPersonnummerDisplay('8905032556')).toBe('890503-2556')
  })

  test('12 digits → century dropped for display', () => {
    expect(formatPersonnummerDisplay('198905032556')).toBe('890503-2556')
    expect(formatPersonnummerDisplay('200103129876')).toBe('010312-9876')
  })

  test('values already carrying a separator pass through verbatim', () => {
    expect(formatPersonnummerDisplay('890503-2556')).toBe('890503-2556')
    expect(formatPersonnummerDisplay('19890503-2556')).toBe('19890503-2556')
    // '+' marks 100+ age — a meaningful separator, never rewritten.
    expect(formatPersonnummerDisplay('890503+2556')).toBe('890503+2556')
  })

  test('unrecognized shapes pass through unchanged', () => {
    expect(formatPersonnummerDisplay('890503255')).toBe('890503255') // 9 digits
    expect(formatPersonnummerDisplay('89050325567')).toBe('89050325567') // 11
    expect(formatPersonnummerDisplay('abc123')).toBe('abc123')
    expect(formatPersonnummerDisplay('')).toBe('')
    // The view-role mask contains no digits — verbatim by construction.
    expect(formatPersonnummerDisplay('••••••-••••')).toBe('••••••-••••')
  })
})
