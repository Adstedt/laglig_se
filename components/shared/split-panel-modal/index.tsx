'use client'

/**
 * SplitPanelModal — shared shell for Jira-style two-panel workspace modals.
 *
 * Owns: Dialog primitive, overlay/animation chrome, three-state body layout,
 * and the AI chat state (open/closed, expanded). Used by LegalDocumentModal
 * and TaskModal; future workspace modals can reuse.
 *
 * Three layout states, driven by `aiChatOpen` + `chatExpanded`:
 *
 *   State 1 (aiChatOpen=false):  [ leftPanel 3fr | rightPanel 2fr ]
 *   State 2 (chatOpen, !expanded): [ leftPanel 3fr | chatPanel 3fr | rail 44px ]
 *   State 3 (chatOpen,  expanded): [ expandedHeader                              ]
 *                                  [ chatPanel (full width)                      ]
 *
 * Panels are always mounted (visibility toggled via CSS) so that optimistic
 * state, SWR caches, and stateful children survive state transitions.
 */

import { useState, useCallback, useMemo, ReactNode } from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { useMediaQuery } from '@/lib/hooks/use-media-query'
import {
  SplitPanelModalContext,
  type SplitPanelModalContextValue,
} from './context'

export interface RailRenderContext {
  /** Restore the full right-panel (closes the chat). */
  onExpandRail: () => void
}

export interface ChatRenderContext {
  /** True when the chat is in fullscreen-within-modal mode. */
  expanded: boolean
  /** Toggle between State 2 (normal) and State 3 (expanded). */
  onToggleExpand: () => void
  /** Close the chat panel (back to State 1). */
  onClose: () => void
}

export interface SplitPanelModalProps {
  open: boolean
  onClose: () => void
  /** Accessible title for screen readers (sr-only). */
  srTitle: string
  /** Rendered in place of the body while data is loading. */
  loading?: ReactNode | undefined
  /** Rendered in place of the body on error. */
  error?: ReactNode | undefined
  /** Top header (breadcrumb + actions). */
  header: ReactNode
  /** Optional strip rendered between header and body (e.g. pending-changes warning). */
  banner?: ReactNode | undefined
  /** Main content panel (left side). Always mounted. */
  leftPanel: ReactNode
  /** Right-side details panel. Always mounted; hidden via CSS in States 2/3. */
  rightPanel: ReactNode
  /**
   * Vertical icon rail rendered in State 2 only (44px wide on the far right).
   * If omitted, opening the chat hides the right-panel without showing a rail.
   */
  renderRail?: ((_ctx: RailRenderContext) => ReactNode) | undefined
  /**
   * Chat panel body. Rendered in States 2 and 3. If omitted, chat cannot open.
   */
  renderChat?: ((_ctx: ChatRenderContext) => ReactNode) | undefined
  /**
   * Compact context strip shown above the chat in State 3 (expanded).
   */
  expandedHeader?: ReactNode | undefined
  /** Initial aiChatOpen state. Defaults to false. */
  defaultChatOpen?: boolean | undefined
}

export function SplitPanelModal({
  open,
  onClose,
  srTitle,
  loading,
  error,
  header,
  banner,
  leftPanel,
  rightPanel,
  renderRail,
  renderChat,
  expandedHeader,
  defaultChatOpen = false,
}: SplitPanelModalProps) {
  const [aiChatOpen, setAiChatOpen] = useState(defaultChatOpen)
  const [chatExpanded, setChatExpanded] = useState(false)

  // States 2/3 only activate on >= lg viewports. On smaller screens we fall
  // back to the single-column current behavior with no rail.
  const isLargeScreen = useMediaQuery('(min-width: 1024px)')

  const openChat = useCallback(() => {
    if (!renderChat) return
    setAiChatOpen(true)
  }, [renderChat])

  const closeChat = useCallback(() => {
    setAiChatOpen(false)
    setChatExpanded(false)
  }, [])

  const toggleChat = useCallback(() => {
    if (!renderChat) return
    setAiChatOpen((v) => {
      if (v) setChatExpanded(false)
      return !v
    })
  }, [renderChat])

  const toggleExpand = useCallback(() => {
    setChatExpanded((v) => !v)
  }, [])

  const ctxValue = useMemo<SplitPanelModalContextValue>(
    () => ({
      aiChatOpen,
      chatExpanded,
      openChat,
      closeChat,
      closeModal: onClose,
      toggleChat,
      toggleExpand,
      hasChat: !!renderChat,
    }),
    [
      aiChatOpen,
      chatExpanded,
      openChat,
      closeChat,
      onClose,
      toggleChat,
      toggleExpand,
      renderChat,
    ]
  )

  // Effective layout state. On small screens we always render State 1 and let
  // the caller decide how to surface chat (fallback flyout, mobile sheet, etc.)
  const effectiveChatOpen = aiChatOpen && isLargeScreen && !!renderChat
  const effectiveExpanded = effectiveChatOpen && chatExpanded

  return (
    <SplitPanelModalContext.Provider value={ctxValue}>
      <DialogPrimitive.Root open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay
            className={cn(
              'fixed inset-0 z-50 bg-black/30',
              'data-[state=open]:animate-in data-[state=closed]:animate-out',
              'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0'
            )}
          />
          <DialogPrimitive.Content
            className={cn(
              'fixed top-[50%] left-[50%] z-50',
              'translate-x-[-50%] translate-y-[-50%]',
              'w-full max-h-[90vh] max-w-[min(80vw,1280px)] p-0 gap-0',
              'bg-transparent shadow-none overflow-visible',
              'focus:outline-none focus-visible:outline-none',
              'max-md:max-w-full max-md:max-h-full max-md:h-full max-md:overflow-hidden',
              'data-[state=open]:animate-in data-[state=closed]:animate-out',
              'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
              'duration-200'
            )}
            onEscapeKeyDown={onClose}
            aria-describedby={undefined}
          >
            <DialogTitle className="sr-only">{srTitle}</DialogTitle>

            {loading ? (
              loading
            ) : error ? (
              error
            ) : (
              <div
                className={cn(
                  'relative flex flex-col h-full max-h-[90vh] max-md:max-h-full overflow-hidden',
                  'bg-background border shadow-lg rounded-lg'
                )}
              >
                {/* Modal header hides in State 3 — the compact expandedHeader
                    takes over as the sole top bar so the chat fills the modal
                    without a redundant breadcrumb strip. */}
                {!effectiveExpanded && header}
                {!effectiveExpanded && banner}

                {/* Expanded-mode context strip (State 3).
                    Mount only when expanded — natural height, no max-h clamp,
                    so two-line headers aren't clipped. A border-b provides the
                    visual boundary between the strip and the chat chrome. */}
                {effectiveExpanded && expandedHeader && (
                  <div className="border-b border-border shrink-0">
                    {expandedHeader}
                  </div>
                )}

                {/* Body */}
                <div
                  className={cn(
                    'flex flex-1 min-h-0 overflow-hidden',
                    'max-md:flex-col'
                  )}
                >
                  {/* Left content panel — always mounted; hidden in State 3 */}
                  <div
                    className={cn(
                      'min-w-0 overflow-hidden transition-[flex-grow,opacity] duration-300 ease-in-out',
                      'max-md:basis-auto max-md:flex-grow-0',
                      effectiveExpanded
                        ? 'basis-0 grow-0 opacity-0 pointer-events-none'
                        : 'basis-0 grow-[3] opacity-100'
                    )}
                    aria-hidden={effectiveExpanded}
                  >
                    {leftPanel}
                  </div>

                  {/* Right details panel — always mounted; hidden in States 2/3 */}
                  <div
                    className={cn(
                      'min-w-0 overflow-hidden transition-[flex-grow,opacity] duration-300 ease-in-out',
                      'max-md:basis-auto',
                      effectiveChatOpen
                        ? 'basis-0 grow-0 opacity-0 pointer-events-none'
                        : 'basis-0 grow-[2] opacity-100'
                    )}
                    aria-hidden={effectiveChatOpen}
                  >
                    {rightPanel}
                  </div>

                  {/* Chat panel — mounted only when renderChat is provided */}
                  {renderChat && (
                    <div
                      className={cn(
                        'min-w-0 overflow-hidden border-l transition-[flex-grow,opacity] duration-300 ease-in-out',
                        'max-md:hidden',
                        effectiveChatOpen
                          ? effectiveExpanded
                            ? 'basis-0 grow-[1] opacity-100 border-l-0'
                            : 'basis-0 grow-[3] opacity-100'
                          : 'basis-0 grow-0 opacity-0 pointer-events-none border-l-0'
                      )}
                      aria-hidden={!effectiveChatOpen}
                    >
                      {renderChat({
                        expanded: effectiveExpanded,
                        onToggleExpand: toggleExpand,
                        onClose: closeChat,
                      })}
                    </div>
                  )}

                  {/* Vertical icon rail — State 2 only.
                      Cell stays in the flex row for width animation, but the
                      rail body is only rendered while visible so domain-specific
                      rails don't have to guard against hidden-state render. */}
                  {renderRail && renderChat && (
                    <div
                      className={cn(
                        'shrink-0 overflow-hidden border-l transition-[width,border-color] duration-300 ease-in-out',
                        'max-md:hidden',
                        effectiveChatOpen && !effectiveExpanded
                          ? 'w-11 border-border'
                          : 'w-0 border-transparent'
                      )}
                      aria-hidden={!effectiveChatOpen || effectiveExpanded}
                    >
                      {effectiveChatOpen && !effectiveExpanded
                        ? renderRail({ onExpandRail: closeChat })
                        : null}
                    </div>
                  )}
                </div>
              </div>
            )}
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </SplitPanelModalContext.Provider>
  )
}
