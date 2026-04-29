import { renderHook, act } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  THINKING_PHRASES,
  useRotatingThinkingPhrase,
} from '@/lib/ai-chat/thinking-phrases'

describe('THINKING_PHRASES', () => {
  it('contains at least 10 phrases (so consecutive picks can differ)', () => {
    expect(THINKING_PHRASES.length).toBeGreaterThanOrEqual(10)
  })

  it('every phrase is a non-empty Swedish string', () => {
    for (const p of THINKING_PHRASES) {
      expect(p).toMatch(/^\S/)
      expect(p.length).toBeGreaterThan(2)
    }
  })

  it('has no duplicates', () => {
    expect(new Set(THINKING_PHRASES).size).toBe(THINKING_PHRASES.length)
  })
})

describe('useRotatingThinkingPhrase', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns a phrase from the curated list on first render', () => {
    const { result } = renderHook(() => useRotatingThinkingPhrase(true, 1000))
    expect(THINKING_PHRASES).toContain(result.current)
  })

  it('rotates to a different phrase after the interval while active', () => {
    const { result } = renderHook(() => useRotatingThinkingPhrase(true, 1000))
    const first = result.current

    act(() => {
      vi.advanceTimersByTime(1000)
    })

    expect(result.current).not.toBe(first)
    expect(THINKING_PHRASES).toContain(result.current)
  })

  it('keeps consecutive picks distinct across many rotations', () => {
    const { result } = renderHook(() => useRotatingThinkingPhrase(true, 500))
    let prev = result.current
    for (let i = 0; i < 20; i++) {
      act(() => {
        vi.advanceTimersByTime(500)
      })
      expect(result.current).not.toBe(prev)
      prev = result.current
    }
  })

  it('does not rotate when active=false', () => {
    const { result } = renderHook(() => useRotatingThinkingPhrase(false, 1000))
    const first = result.current

    act(() => {
      vi.advanceTimersByTime(5000)
    })

    expect(result.current).toBe(first)
  })

  it('stops rotating once active flips to false (freezes on last phrase)', () => {
    const { result, rerender } = renderHook(
      ({ active }: { active: boolean }) =>
        useRotatingThinkingPhrase(active, 1000),
      { initialProps: { active: true } }
    )

    act(() => {
      vi.advanceTimersByTime(1000)
    })
    const frozen = result.current

    rerender({ active: false })

    act(() => {
      vi.advanceTimersByTime(5000)
    })

    expect(result.current).toBe(frozen)
  })

  it('cleans up its interval on unmount (no leak)', () => {
    const setSpy = vi.spyOn(global, 'setInterval')
    const clearSpy = vi.spyOn(global, 'clearInterval')

    const { unmount } = renderHook(() => useRotatingThinkingPhrase(true, 1000))

    expect(setSpy).toHaveBeenCalledTimes(1)
    const intervalId = setSpy.mock.results[0]?.value

    unmount()

    expect(clearSpy).toHaveBeenCalledWith(intervalId)
  })
})
