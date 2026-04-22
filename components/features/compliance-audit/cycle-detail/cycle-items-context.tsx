'use client'

/**
 * Story 21.5 — Context bridging the CycleDetailHeader's progress cluster
 * (jump buttons) to the CycleItemsTab's internal scroll/highlight logic.
 * Lets the two surfaces stay loosely coupled — the header doesn't need to
 * know how the tab implements virtualisation or row lookup.
 */

import { createContext, useContext, useMemo, type ReactNode } from 'react'

export interface CycleItemsContextValue {
  bedomdaCount: number
  signeradeCount: number
  totalCount: number
  jumpToFirstUnbedomd: () => void
  jumpToFirstUnsigned: () => void
  /** True once the Items tab has mounted + wired its handlers. */
  ready: boolean
}

const NOOP = () => {}

const DEFAULT: CycleItemsContextValue = {
  bedomdaCount: 0,
  signeradeCount: 0,
  totalCount: 0,
  jumpToFirstUnbedomd: NOOP,
  jumpToFirstUnsigned: NOOP,
  ready: false,
}

const CycleItemsContext = createContext<CycleItemsContextValue>(DEFAULT)

interface CycleItemsProviderProps {
  value: CycleItemsContextValue
  children: ReactNode
}

export function CycleItemsProvider({
  value,
  children,
}: CycleItemsProviderProps) {
  const memoised = useMemo(() => value, [value])
  return (
    <CycleItemsContext.Provider value={memoised}>
      {children}
    </CycleItemsContext.Provider>
  )
}

export function useCycleItems(): CycleItemsContextValue {
  return useContext(CycleItemsContext)
}
