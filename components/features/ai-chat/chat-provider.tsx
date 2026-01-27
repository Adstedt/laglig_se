'use client'

/**
 * Story 3.3: Chat Provider Component
 * Manages global chat state and renders appropriate UI (sidebar or modal)
 */

import { createContext, useContext, useState, useCallback } from 'react'
import { useMediaQuery } from '@/lib/hooks/use-media-query'
import { useChatKeyboardShortcuts } from '@/lib/hooks/use-chat-keyboard-shortcuts'
import { ChatSidebar } from './chat-sidebar'
import { ChatModal } from './chat-modal'

interface ChatContextValue {
  isOpen: boolean
  open: () => void
  close: () => void
  toggle: () => void
}

const ChatContext = createContext<ChatContextValue | null>(null)

export function useChatContext() {
  const context = useContext(ChatContext)
  if (!context) {
    throw new Error('useChatContext must be used within ChatProvider')
  }
  return context
}

interface ChatProviderProps {
  children: React.ReactNode
}

export function ChatProvider({ children }: ChatProviderProps) {
  const [isOpen, setIsOpen] = useState(false)
  const isMobile = useMediaQuery('(max-width: 767px)')

  const open = useCallback(() => setIsOpen(true), [])
  const close = useCallback(() => setIsOpen(false), [])
  const toggle = useCallback(() => setIsOpen((prev) => !prev), [])

  // Set up keyboard shortcuts
  useChatKeyboardShortcuts({ onToggle: toggle, isOpen })

  const contextValue: ChatContextValue = {
    isOpen,
    open,
    close,
    toggle,
  }

  return (
    <ChatContext.Provider value={contextValue}>
      {children}

      {/* Render mobile modal or desktop sidebar based on viewport */}
      {isMobile ? (
        <ChatModal isOpen={isOpen} onClose={close} />
      ) : (
        <ChatSidebar isOpen={isOpen} onClose={close} />
      )}
    </ChatContext.Provider>
  )
}
