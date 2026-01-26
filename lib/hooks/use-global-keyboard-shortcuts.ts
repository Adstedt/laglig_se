'use client'

/**
 * Story 6.7: Global Keyboard Shortcuts Hook
 * Handles global keyboard shortcuts like Ctrl+Shift+T for quick task creation
 */

import { useEffect } from 'react'

interface GlobalKeyboardShortcutHandlers {
  onQuickTaskCreate?: () => void
}

/**
 * Hook to register global keyboard shortcuts
 * @param handlers - Object containing handler functions for each shortcut
 */
export function useGlobalKeyboardShortcuts(
  handlers: GlobalKeyboardShortcutHandlers
) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Ignore if user is typing in an input/textarea/contenteditable
      const target = e.target as HTMLElement
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return
      }

      // Ctrl+Shift+T (Windows) or Cmd+Shift+T (Mac) - Quick task create
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'T') {
        e.preventDefault() // Prevent browser re-open tab behavior
        handlers.onQuickTaskCreate?.()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handlers])
}
