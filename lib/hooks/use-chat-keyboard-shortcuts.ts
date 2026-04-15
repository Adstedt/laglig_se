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
      // Detect typing context robustly. The naive `target.isContentEditable`
      // check can fail on Tiptap/ProseMirror editors (event target may be a
      // child node, or the HTMLElement cast can mask non-HTMLElement targets).
      // We check both `event.target` and `document.activeElement`, and use
      // `closest('[contenteditable]')` to catch any descendant of an editable
      // region.
      const isEditableContext = (el: unknown): boolean => {
        if (!el || typeof el !== 'object') return false
        const element = el as HTMLElement
        if (!element.tagName) return false
        if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
          return true
        }
        if (element.isContentEditable) return true
        if (
          typeof element.closest === 'function' &&
          element.closest('[contenteditable="true"], [contenteditable=""]') !==
            null
        ) {
          return true
        }
        return false
      }

      const isInputFocused =
        isEditableContext(event.target) ||
        isEditableContext(document.activeElement)

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
