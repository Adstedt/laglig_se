'use client'

/**
 * Shipped state-adapter helpers. Persistence is always the caller's concern;
 * these cover the two homes that don't already have infrastructure (local
 * state and per-key localStorage). Zustand/URL consumers build adapters
 * from their own selectors.
 */
import { useCallback, useMemo, useRef, useState } from 'react'
import type {
  ColumnOrderState,
  ColumnSizingState,
  OnChangeFn,
  SortingState,
  Updater,
  VisibilityState,
} from '@tanstack/react-table'
import type { ColumnStateAdapter, SortingAdapter } from './types'

export function useLocalSorting(initial: SortingState = []): SortingAdapter {
  const [sorting, setSorting] = useState<SortingState>(initial)
  return useMemo(() => ({ sorting, onSortingChange: setSorting }), [sorting])
}

interface PersistedColumnState {
  visibility?: VisibilityState
  order?: ColumnOrderState
  sizing?: ColumnSizingState
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Sanitize-on-read: localStorage is user-editable and schema-drifts across
 * deploys, so anything malformed degrades to defaults instead of throwing
 * (contract adopted from personalregister's employee-column-state).
 */
function sanitizeColumnState(raw: unknown): PersistedColumnState {
  if (!isRecord(raw)) return {}
  const state: PersistedColumnState = {}

  if (isRecord(raw.visibility)) {
    const visibility: VisibilityState = {}
    for (const [id, v] of Object.entries(raw.visibility)) {
      if (typeof v === 'boolean') visibility[id] = v
    }
    state.visibility = visibility
  }
  if (
    Array.isArray(raw.order) &&
    raw.order.every((id) => typeof id === 'string')
  ) {
    state.order = raw.order as ColumnOrderState
  }
  if (isRecord(raw.sizing)) {
    const sizing: ColumnSizingState = {}
    for (const [id, v] of Object.entries(raw.sizing)) {
      if (typeof v === 'number' && Number.isFinite(v) && v > 0) sizing[id] = v
    }
    state.sizing = sizing
  }
  return state
}

function loadColumnState(key: string): PersistedColumnState {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return {}
    return sanitizeColumnState(JSON.parse(raw))
  } catch {
    return {}
  }
}

export function useLocalStorageColumnState(opts: {
  key: string
  defaults?: PersistedColumnState
}): ColumnStateAdapter {
  const { key, defaults } = opts
  const [state, setState] = useState<PersistedColumnState>(() => {
    const loaded = loadColumnState(key)
    return {
      visibility: { ...defaults?.visibility, ...loaded.visibility },
      order: loaded.order ?? defaults?.order ?? [],
      sizing: { ...defaults?.sizing, ...loaded.sizing },
    }
  })
  const stateRef = useRef(state)
  stateRef.current = state

  const persist = useCallback(
    (next: PersistedColumnState) => {
      setState(next)
      try {
        window.localStorage.setItem(key, JSON.stringify(next))
      } catch {
        // Quota/private-mode failures degrade to session-only state.
      }
    },
    [key]
  )

  const resolve = <T>(updater: Updater<T>, current: T): T =>
    typeof updater === 'function'
      ? (updater as (_old: T) => T)(current)
      : updater

  const onVisibilityChange: OnChangeFn<VisibilityState> = useCallback(
    (updater) => {
      const current = stateRef.current
      persist({
        ...current,
        visibility: resolve(updater, current.visibility ?? {}),
      })
    },
    [persist]
  )
  const onOrderChange: OnChangeFn<ColumnOrderState> = useCallback(
    (updater) => {
      const current = stateRef.current
      persist({ ...current, order: resolve(updater, current.order ?? []) })
    },
    [persist]
  )
  const onSizingChange: OnChangeFn<ColumnSizingState> = useCallback(
    (updater) => {
      const current = stateRef.current
      persist({ ...current, sizing: resolve(updater, current.sizing ?? {}) })
    },
    [persist]
  )

  return useMemo(
    () => ({
      visibility: state.visibility ?? {},
      onVisibilityChange,
      order: state.order ?? [],
      onOrderChange,
      sizing: state.sizing ?? {},
      onSizingChange,
    }),
    [state, onVisibilityChange, onOrderChange, onSizingChange]
  )
}
