'use client'

/**
 * Story 3.3: Chat Keyboard Shortcuts Hook
 * Handles Cmd+K / Ctrl+K and / shortcuts to open chat
 */

import { useEffect, useCallback } from 'react'

interface UseChatKeyboardShortcutsOptions {
  onToggle: () => void
  isOpen: boolean
}

export function useChatKeyboardShortcuts({
  onToggle,
  isOpen,
}: UseChatKeyboardShortcutsOptions) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // Check if user is typing in an input/textarea
      const target = event.target as HTMLElement
      const isInputFocused =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable

      // Cmd+K / Ctrl+K - toggle chat regardless of input focus
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault()
        onToggle()
        return
      }

      // / key - only toggle if not in input and chat is closed
      if (event.key === '/' && !isInputFocused && !isOpen) {
        event.preventDefault()
        onToggle()
        return
      }

      // Escape - close chat if open
      if (event.key === 'Escape' && isOpen) {
        event.preventDefault()
        onToggle()
        return
      }
    },
    [onToggle, isOpen]
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])
}
