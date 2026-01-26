'use client'

/**
 * Story 6.6: Task Modal Header
 * Breadcrumb navigation, AI toggle, and close button
 */

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  X,
  ChevronRight,
  Share2,
  MoreHorizontal,
  Copy,
  Printer,
  Sparkles,
} from 'lucide-react'
import { toast } from 'sonner'

interface ModalHeaderProps {
  taskTitle: string
  onClose: () => void
  aiChatOpen: boolean
  onAiChatToggle: () => void
}

export function ModalHeader({
  taskTitle,
  onClose,
  aiChatOpen,
  onAiChatToggle,
}: ModalHeaderProps) {
  const handleShare = async () => {
    const url = window.location.href
    try {
      await navigator.clipboard.writeText(url)
      toast.success('Länk kopierad till urklipp')
    } catch {
      toast.error('Kunde inte kopiera länk')
    }
  }

  const handleCopyTitle = async () => {
    try {
      await navigator.clipboard.writeText(taskTitle)
      toast.success('Titel kopierad')
    } catch {
      toast.error('Kunde inte kopiera')
    }
  }

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="flex items-center justify-between border-b px-6 py-3 bg-background shrink-0">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 text-sm min-w-0">
        <span className="text-muted-foreground">Uppgifter</span>
        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="font-medium truncate max-w-[300px]">{taskTitle}</span>
      </nav>

      {/* Action buttons */}
      <div className="flex items-center gap-1 shrink-0 ml-4">
        {/* AI Chat toggle - hidden on mobile */}
        <Button
          variant={aiChatOpen ? 'secondary' : 'ghost'}
          size="sm"
          onClick={onAiChatToggle}
          className="h-8 px-2 hidden lg:flex"
          title={aiChatOpen ? 'Stäng AI Chat' : 'Öppna AI Chat'}
          data-testid="ai-chat-toggle"
        >
          <Sparkles className="h-4 w-4" />
        </Button>

        {/* Share button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleShare}
          className="h-8 px-2"
          title="Dela"
        >
          <Share2 className="h-4 w-4" />
        </Button>

        {/* Actions dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2"
              title="Fler åtgärder"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={handleCopyTitle}>
              <Copy className="h-4 w-4 mr-2" />
              Kopiera titel
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-2" />
              Skriv ut
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Close button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="h-8 px-2"
          aria-label="Stäng"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
