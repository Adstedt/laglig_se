'use client'

import { createContext, useContext } from 'react'

export interface SplitPanelModalContextValue {
  aiChatOpen: boolean
  chatExpanded: boolean
  openChat: () => void
  closeChat: () => void
  closeModal: () => void
  toggleChat: () => void
  toggleExpand: () => void
  hasChat: boolean
}

export const SplitPanelModalContext =
  createContext<SplitPanelModalContextValue | null>(null)

export function useSplitPanelModal(): SplitPanelModalContextValue {
  const ctx = useContext(SplitPanelModalContext)
  if (!ctx) {
    throw new Error(
      'useSplitPanelModal must be used inside a <SplitPanelModal>'
    )
  }
  return ctx
}

export function useSplitPanelModalOptional(): SplitPanelModalContextValue | null {
  return useContext(SplitPanelModalContext)
}
