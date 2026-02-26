'use client'

/**
 * AI Chat Sidebar - Main app chat panel
 * 480px width (960px expanded), integrates with layout store for toggle state.
 * Story 14.11: Uses HemChat in panel mode for shared conversation state with Hem page.
 */

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { X, Maximize2, Minimize2 } from 'lucide-react'
import { LexaIcon } from '@/components/ui/lexa-icon'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { HemChat } from '@/components/features/dashboard/hem-chat'
import { track } from '@vercel/analytics'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface RightSidebarProps {
  isOpen: boolean
  onToggle: () => void
}

export function RightSidebar({ isOpen, onToggle }: RightSidebarProps) {
  const pathname = usePathname()
  const isHemPage = pathname === '/dashboard'
  const [isExpanded, setIsExpanded] = useState(false)

  // Track sidebar open
  useEffect(() => {
    if (isOpen) {
      track('ai_chat_opened', { location: 'sidebar', expanded: isExpanded })
    }
  }, [isOpen, isExpanded])

  const toggleExpanded = () => {
    setIsExpanded((prev) => !prev)
    track('ai_chat_expanded', { expanded: !isExpanded })
  }

  return (
    <>
      {/* Toggle button when sidebar is folded - hidden on mobile and on Hem page */}
      {!isOpen && !isHemPage && (
        <button
          onClick={onToggle}
          className="hidden lg:flex fixed right-0 top-1/2 z-40 h-14 w-8 -translate-y-1/2 items-center justify-center rounded-l-lg border border-r-0 bg-primary text-primary-foreground shadow-lg transition-all hover:w-10 hover:bg-primary/90"
          aria-label="Öppna AI Chat"
        >
          <LexaIcon size={16} className="invert-0" />
        </button>
      )}

      {/* Sidebar container - hidden on mobile */}
      <aside
        className={cn(
          'hidden lg:flex flex-col border-l bg-card transition-all duration-300 ease-in-out',
          isOpen
            ? isExpanded
              ? 'w-[960px]'
              : 'w-[480px]'
            : 'w-0 overflow-hidden'
        )}
      >
        {/* Header */}
        <div className="flex h-[60px] items-center justify-between border-b px-4 shrink-0 bg-card">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted border border-border">
              <LexaIcon size={16} />
            </div>
            <div>
              <h2 className="text-sm font-semibold">Lexa</h2>
              <p className="text-xs text-muted-foreground">
                Fråga om regler och efterlevnad
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {/* Expand/Collapse button */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={toggleExpanded}
                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                  >
                    {isExpanded ? (
                      <Minimize2 className="h-4 w-4" />
                    ) : (
                      <Maximize2 className="h-4 w-4" />
                    )}
                    <span className="sr-only">
                      {isExpanded ? 'Förminska' : 'Expandera'}
                    </span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p>
                    {isExpanded ? 'Förminska panel' : 'Expandera för fokusläge'}
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {/* Close button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggle}
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Stäng AI Chat</span>
            </Button>
          </div>
        </div>

        {/* Chat content — shared state with Hem via useChatInterface({ contextType: 'global' }) */}
        <div className="flex-1 flex flex-col min-h-0 bg-background/50">
          <HemChat mode="panel" />
        </div>
      </aside>
    </>
  )
}
