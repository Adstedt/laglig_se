'use client'

/**
 * Epic 21 Story 21.16 — Cycle Item modal header.
 *
 * Breadcrumb (kontroll name → SFS number) + actions (share + overflow menu
 * + close). Mirrors the shape of `legal-document-modal/modal-header.tsx`
 * with cycle-item-specific content.
 *
 * Note: the law title used to be the third breadcrumb crumb but that
 * duplicated the `<h2>` heading in the left-panel directly below. The
 * breadcrumb now terminates at the document number; the full title lives
 * in the content heading where it belongs.
 */

import { toast } from 'sonner'
import {
  ChevronRight,
  Copy,
  ExternalLink,
  MoreHorizontal,
  Printer,
  Share2,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { LexaIcon } from '@/components/ui/lexa-icon'
import { useSplitPanelModalOptional } from '@/components/shared/split-panel-modal/context'

interface CycleItemModalHeaderProps {
  cycleName: string
  lawDocumentNumber: string
  lawSlug: string | null
  onClose: () => void
}

export function CycleItemModalHeader({
  cycleName,
  lawDocumentNumber,
  lawSlug,
  onClose,
}: CycleItemModalHeaderProps) {
  const shell = useSplitPanelModalOptional()
  const aiChatOpen = shell?.aiChatOpen ?? false
  const canToggleChat = shell?.hasChat ?? false
  const onAiChatToggle = shell?.toggleChat

  const handleCopyDocNumber = async () => {
    try {
      await navigator.clipboard.writeText(lawDocumentNumber)
      toast.success('Dokumentnummer kopierat')
    } catch {
      toast.error('Kunde inte kopiera')
    }
  }

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      toast.success('Länk kopierad')
    } catch {
      toast.error('Kunde inte kopiera länk')
    }
  }

  const handleOpenFullPage = () => {
    if (!lawSlug) return
    window.open(`/browse/lagar/${lawSlug}`, '_blank')
  }

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="flex items-center justify-between border-b bg-background px-6 py-3 shrink-0">
      {/* Breadcrumb — terminates at document number; full title lives in
          the left-panel heading so we don't render it twice. */}
      <nav className="flex min-w-0 items-center gap-1 text-sm">
        <span className="max-w-[240px] truncate text-muted-foreground">
          {cycleName}
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="truncate font-medium text-foreground">
          {lawDocumentNumber}
        </span>
      </nav>

      <div className="ml-4 flex shrink-0 items-center gap-1">
        {canToggleChat && onAiChatToggle ? (
          <Button
            variant={aiChatOpen ? 'secondary' : 'ghost'}
            size="sm"
            onClick={onAiChatToggle}
            className={cn(
              'hidden h-8 px-2 lg:flex',
              aiChatOpen && 'bg-muted/80'
            )}
            title={aiChatOpen ? 'Stäng assistenten' : 'Öppna assistenten'}
          >
            <LexaIcon size={16} />
          </Button>
        ) : null}

        <Button
          variant="ghost"
          size="sm"
          onClick={handleShare}
          className="h-8 px-2"
          title="Dela länk till denna vy"
        >
          <Share2 className="h-4 w-4" />
        </Button>

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
            {lawSlug ? (
              <DropdownMenuItem onClick={handleOpenFullPage}>
                <ExternalLink className="mr-2 h-4 w-4" />
                Öppna i lagbok
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuItem onClick={handleCopyDocNumber}>
              <Copy className="mr-2 h-4 w-4" />
              Kopiera dokumentnummer
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handlePrint}>
              <Printer className="mr-2 h-4 w-4" />
              Skriv ut
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

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
