'use client'

/**
 * Story 6.3: Modal Header
 * Breadcrumb navigation, share/actions buttons, and close button
 */

import Link from 'next/link'
import { cn } from '@/lib/utils'
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
  Share2,
  MoreHorizontal,
  ExternalLink,
  Copy,
  Printer,
} from 'lucide-react'
import { LexaIcon } from '@/components/ui/lexa-icon'
import { toast } from 'sonner'
import { useSplitPanelModalOptional } from '@/components/shared/split-panel-modal/context'

interface ModalHeaderProps {
  listName: string
  listId: string
  documentNumber: string
  slug: string
  onClose: () => void
}

export function ModalHeader({
  listName,
  listId,
  documentNumber,
  slug,
  onClose,
}: ModalHeaderProps) {
  const shell = useSplitPanelModalOptional()
  const aiChatOpen = shell?.aiChatOpen ?? false
  const canToggleChat = shell?.hasChat ?? false
  const onAiChatToggle = shell?.toggleChat
  const handleShare = async () => {
    const url = `${window.location.origin}/laglistor?doc=${documentNumber}`
    try {
      await navigator.clipboard.writeText(url)
      toast.success('Länk kopierad till urklipp')
    } catch {
      toast.error('Kunde inte kopiera länk')
    }
  }

  const handleCopyDocNumber = async () => {
    try {
      await navigator.clipboard.writeText(documentNumber)
      toast.success('Dokumentnummer kopierat')
    } catch {
      toast.error('Kunde inte kopiera')
    }
  }

  const handleOpenFullPage = () => {
    window.open(`/browse/lagar/${slug}`, '_blank')
  }

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="flex items-center justify-between border-b px-6 py-3 bg-background shrink-0">
      {/* Parent link — the laglista this law belongs to. The doc number is NOT
          repeated here (it already lives in the title's parenthetical and in
          Detaljer → Dokumentnummer); this is a real "up to the list" link
          rather than a dead two-step breadcrumb. */}
      <nav className="flex min-w-0 items-center text-sm" aria-label="Brödsmula">
        <Link
          href={`/laglistor/${listId}`}
          onClick={onClose}
          className="max-w-[260px] truncate text-muted-foreground transition-colors hover:text-foreground hover:underline"
        >
          {listName}
        </Link>
      </nav>

      {/* Action buttons */}
      <div className="flex items-center gap-1 shrink-0 ml-4">
        {/* AI Chat toggle - hidden on mobile; only rendered when the shell supports chat */}
        {canToggleChat && onAiChatToggle && (
          <Button
            variant={aiChatOpen ? 'secondary' : 'ghost'}
            size="sm"
            onClick={onAiChatToggle}
            className={cn(
              'h-8 px-2 hidden lg:flex',
              aiChatOpen && 'bg-muted/80'
            )}
            title={aiChatOpen ? 'Stäng Lexa' : 'Öppna Lexa'}
          >
            <LexaIcon size={16} />
          </Button>
        )}

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
            <DropdownMenuItem onClick={handleOpenFullPage}>
              <ExternalLink className="h-4 w-4 mr-2" />
              Öppna på egen sida
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleCopyDocNumber}>
              <Copy className="h-4 w-4 mr-2" />
              Kopiera dokumentnummer
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
