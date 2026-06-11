'use client'

/**
 * Batch selection mode for the agent approval cards.
 *
 * When the AgentActionBatchCard wraps its rows in this provider, each
 * ActionRendererFrame compact row hides its inline Godkänn/Avvisa buttons —
 * approval is driven by a selection checkbox (rendered by the batch card) plus
 * a single consolidating "Godkänn markerade" action. The single-action
 * AgentActionCard never provides this context, so its instant approve/reject
 * UX is unchanged (default `selectionMode: false`).
 */

import { createContext, useContext } from 'react'

interface BatchSelectionContextValue {
  selectionMode: boolean
}

const BatchSelectionContext = createContext<BatchSelectionContextValue>({
  selectionMode: false,
})

export const BatchSelectionProvider = BatchSelectionContext.Provider

export function useBatchSelection(): BatchSelectionContextValue {
  return useContext(BatchSelectionContext)
}
