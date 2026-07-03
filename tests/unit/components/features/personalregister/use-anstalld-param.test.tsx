/**
 * Story 7.2 (QA TEST-001): `?anstalld=` URL-param hook — the AC8 contract.
 *
 * Covers: open → state set + pushState; close → param removed + state
 * cleared; URL → state sync (browser back/forward, simulated by changing the
 * mocked searchParams); the `'ny'` create-mode sentinel stored verbatim; and
 * that the sync effect never writes the URL back.
 */
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import {
  useAnstalldParam,
  NEW_EMPLOYEE_SENTINEL,
} from '@/components/features/personalregister/use-anstalld-param'

// Controllable useSearchParams (repo convention: mock next/navigation).
let mockSearchParams = new URLSearchParams()
vi.mock('next/navigation', () => ({
  useSearchParams: () => mockSearchParams,
}))

let pushStateSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  mockSearchParams = new URLSearchParams()
  window.history.replaceState(null, '', '/personalregister')
  pushStateSpy = vi.spyOn(window.history, 'pushState')
})

afterEach(() => {
  pushStateSpy.mockRestore()
})

describe('useAnstalldParam', () => {
  test('openEmployee sets state and pushes ?anstalld=<id> via the History API', () => {
    const { result } = renderHook(() => useAnstalldParam())
    expect(result.current.selectedEmployeeId).toBeNull()

    act(() => {
      result.current.openEmployee('emp-1')
    })

    expect(result.current.selectedEmployeeId).toBe('emp-1')
    expect(pushStateSpy).toHaveBeenCalledTimes(1)
    expect(pushStateSpy).toHaveBeenCalledWith(null, '', '?anstalld=emp-1')
    // happy-dom applies pushState to the location.
    expect(window.location.search).toBe('?anstalld=emp-1')
  })

  test('openEmployee preserves unrelated query params', () => {
    window.history.replaceState(null, '', '/personalregister?tab=aktiva')
    const { result } = renderHook(() => useAnstalldParam())

    act(() => {
      result.current.openEmployee('emp-2')
    })

    const params = new URLSearchParams(window.location.search)
    expect(params.get('tab')).toBe('aktiva')
    expect(params.get('anstalld')).toBe('emp-2')
  })

  test('closeEmployee removes the param and clears state', () => {
    const { result } = renderHook(() => useAnstalldParam())

    act(() => {
      result.current.openEmployee('emp-1')
    })
    act(() => {
      result.current.closeEmployee()
    })

    expect(result.current.selectedEmployeeId).toBeNull()
    expect(
      new URLSearchParams(window.location.search).get('anstalld')
    ).toBeNull()
  })

  test('closeEmployee keeps unrelated params in the URL', () => {
    window.history.replaceState(
      null,
      '',
      '/personalregister?tab=aktiva&anstalld=emp-1'
    )
    const { result } = renderHook(() => useAnstalldParam())

    act(() => {
      result.current.closeEmployee()
    })

    const params = new URLSearchParams(window.location.search)
    expect(params.get('anstalld')).toBeNull()
    expect(params.get('tab')).toBe('aktiva')
  })

  test('URL → state sync: back/forward (changed searchParams) updates state without rewriting the URL', () => {
    const { result, rerender } = renderHook(() => useAnstalldParam())
    expect(result.current.selectedEmployeeId).toBeNull()

    // Simulate the browser navigating forward to ?anstalld=emp-3: Next.js
    // re-renders with new searchParams.
    mockSearchParams = new URLSearchParams('anstalld=emp-3')
    rerender()
    expect(result.current.selectedEmployeeId).toBe('emp-3')

    // Simulate back to a URL without the param.
    mockSearchParams = new URLSearchParams()
    rerender()
    expect(result.current.selectedEmployeeId).toBeNull()

    // The sync effect must never write the URL back (would corrupt history).
    expect(pushStateSpy).not.toHaveBeenCalled()
  })

  test("the 'ny' create-mode sentinel is stored verbatim (never treated as an id)", () => {
    const { result, rerender } = renderHook(() => useAnstalldParam())

    act(() => {
      result.current.openEmployee(NEW_EMPLOYEE_SENTINEL)
    })
    expect(result.current.selectedEmployeeId).toBe('ny')
    expect(window.location.search).toBe('?anstalld=ny')

    // Also verbatim when arriving via the URL (deep link / back button).
    mockSearchParams = new URLSearchParams('anstalld=ny')
    rerender()
    expect(result.current.selectedEmployeeId).toBe('ny')
  })
})
