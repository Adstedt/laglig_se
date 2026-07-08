/**
 * Story 28.1: useLocalStorageColumnState — sanitize-on-read contract
 * (adopted from personalregister's employee-column-state): malformed or
 * hostile localStorage degrades to defaults, never throws.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useLocalStorageColumnState } from '@/components/ui/data-table/adapters'

const KEY = 'test:data-table:columns'

describe('useLocalStorageColumnState', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('starts from defaults when storage is empty', () => {
    const { result } = renderHook(() =>
      useLocalStorageColumnState({
        key: KEY,
        defaults: { visibility: { notes: false } },
      })
    )
    expect(result.current.visibility).toEqual({ notes: false })
    expect(result.current.order).toEqual([])
  })

  it('round-trips a visibility change through localStorage', () => {
    const { result } = renderHook(() =>
      useLocalStorageColumnState({ key: KEY })
    )
    act(() => {
      result.current.onVisibilityChange?.({ title: true, notes: false })
    })
    expect(result.current.visibility).toEqual({ title: true, notes: false })

    const persisted = JSON.parse(window.localStorage.getItem(KEY) ?? '{}')
    expect(persisted.visibility).toEqual({ title: true, notes: false })

    // Fresh mount reads it back.
    const { result: remounted } = renderHook(() =>
      useLocalStorageColumnState({ key: KEY })
    )
    expect(remounted.current.visibility).toEqual({
      title: true,
      notes: false,
    })
  })

  it('degrades corrupt JSON to defaults', () => {
    window.localStorage.setItem(KEY, '{not json')
    const { result } = renderHook(() =>
      useLocalStorageColumnState({
        key: KEY,
        defaults: { sizing: { title: 200 } },
      })
    )
    expect(result.current.sizing).toEqual({ title: 200 })
  })

  it('drops malformed fields but keeps valid ones', () => {
    window.localStorage.setItem(
      KEY,
      JSON.stringify({
        visibility: { title: true, evil: 'yes' },
        order: ['a', 42],
        sizing: { title: 300, bad: -5, worse: 'wide', nan: null },
      })
    )
    const { result } = renderHook(() =>
      useLocalStorageColumnState({ key: KEY })
    )
    expect(result.current.visibility).toEqual({ title: true })
    // order contains a non-string → rejected wholesale
    expect(result.current.order).toEqual([])
    expect(result.current.sizing).toEqual({ title: 300 })
  })

  it('functional updaters receive current state', () => {
    const { result } = renderHook(() =>
      useLocalStorageColumnState({ key: KEY })
    )
    act(() => {
      result.current.onSizingChange?.({ title: 250 })
    })
    act(() => {
      result.current.onSizingChange?.((old) => ({ ...old, notes: 60 }))
    })
    expect(result.current.sizing).toEqual({ title: 250, notes: 60 })
  })
})
