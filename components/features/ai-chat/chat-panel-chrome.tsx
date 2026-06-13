'use client'

/**
 * ChatPanelChrome
 *
 * Header bar rendered ABOVE <ChatPanel showHeader={false}> when the chat lives
 * inside a SplitPanelModal. Surfaces the controls needed for an in-modal chat:
 *
 *   [Lexa · title · model-chip]                [History · +New · ⊟/⊞ · ⋯ · ×]
 *
 * Intentionally stateless — the parent owns the `useChatInterface` instance
 * and passes the handlers in as props.
 */

import { ReactNode } from 'react'
import {
  X,
  Clock,
  Plus,
  Maximize2,
  Minimize2,
  MoreHorizontal,
  Download,
} from 'lucide-react'
import { LexaIcon } from '@/components/ui/lexa-icon'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

export interface ChatPanelChromeProps {
  /** Header title. Defaults to "Fråga assistenten". */
  title?: string
  /** Optional small muted chip (e.g. "Sonnet 4.6" or document number). */
  subtitle?: ReactNode
  /** True when the chat is in fullscreen-within-modal mode. */
  expanded: boolean
  /** Starts a new conversation (wired to useChatInterface().clearHistory). */
  onNewChat: () => void
  /**
   * Optional history-browser trigger. When omitted, the History button renders
   * as a disabled placeholder with a "coming soon" tooltip.
   */
  onHistoryClick?: () => void
  /** Toggle expanded mode. */
  onToggleExpand: () => void
  /** Close the chat panel entirely. */
  onClose: () => void
  /** Export current conversation to a text file. */
  onExport?: () => void
  /** Number of messages currently in the conversation (disables export when 0). */
  messageCount: number
  className?: string
}

export function ChatPanelChrome({
  title = 'Fråga assistenten',
  subtitle,
  expanded,
  onNewChat,
  onHistoryClick,
  onToggleExpand,
  onClose,
  onExport,
  messageCount,
  className,
}: ChatPanelChromeProps) {
  const ExpandIcon = expanded ? Minimize2 : Maximize2
  const expandLabel = expanded ? 'Minska' : 'Expandera'
  const hasMessages = messageCount > 0

  return (
    <TooltipProvider delayDuration={300}>
      <div
        className={cn(
          'flex items-center gap-2 border-b px-4 py-3 shrink-0 bg-background',
          className
        )}
      >
        {/* Title */}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-muted border border-border shrink-0">
            <LexaIcon size={14} />
          </div>
          <span className="text-sm font-medium truncate">{title}</span>
          {subtitle && (
            <>
              <span className="text-muted-foreground/40 shrink-0">·</span>
              <span className="text-xs text-muted-foreground truncate">
                {subtitle}
              </span>
            </>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-0.5 shrink-0">
          {/* History */}
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onHistoryClick}
                  disabled={!onHistoryClick}
                  className="h-8 w-8 p-0"
                  aria-label="Konversationshistorik"
                >
                  <Clock className="h-4 w-4" />
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>
              {onHistoryClick ? 'Historik' : 'Historik kommer snart'}
            </TooltipContent>
          </Tooltip>

          {/* New chat */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={onNewChat}
                disabled={!hasMessages}
                className="h-8 w-8 p-0"
                aria-label="Ny konversation"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Ny konversation</TooltipContent>
          </Tooltip>

          <div className="mx-1 h-4 w-px bg-border" aria-hidden />

          {/* Expand / Collapse */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={onToggleExpand}
                className="h-8 w-8 p-0"
                aria-label={expandLabel}
              >
                <ExpandIcon className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{expandLabel}</TooltipContent>
          </Tooltip>

          {/* More menu */}
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    aria-label="Fler åtgärder"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent>Mer</TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem
                onClick={onExport}
                disabled={!onExport || !hasMessages}
              >
                <Download className="h-4 w-4 mr-2" />
                Exportera konversation
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Close */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="h-8 w-8 p-0"
                aria-label="Stäng chat"
              >
                <X className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Stäng</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </TooltipProvider>
  )
}
