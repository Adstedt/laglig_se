'use client'

/**
 * Story 6.3: Modal Header
 * Breadcrumb navigation, share/actions buttons, and close button
 */

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
  ChevronRight,
  Share2,
  MoreHorizontal,
  ExternalLink,
  Copy,
  Printer,
} from 'lucide-react'
import { LexaIcon } from '@/components/ui/lexa-icon'
import { toast } from 'sonner'

interface ModalHeaderProps {
  listName: string
  documentNumber: string
  slug: string
  onClose: () => void
  aiChatOpen: boolean
  onAiChatToggle: () => void
}

export function ModalHeader({
  listName,
  documentNumber,
  slug,
  onClose,
  aiChatOpen,
  onAiChatToggle,
}: ModalHeaderProps) {
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
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 text-sm min-w-0">
        <span className="text-muted-foreground truncate max-w-[200px]">
          {listName}
        </span>
        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="font-medium font-mono">{documentNumber}</span>
      </nav>

      {/* Action buttons */}
      <div className="flex items-center gap-1 shrink-0 ml-4">
        {/* AI Chat toggle - hidden on mobile */}
        <Button
          variant={aiChatOpen ? 'secondary' : 'ghost'}
          size="sm"
          onClick={onAiChatToggle}
          className={cn('h-8 px-2 hidden lg:flex', aiChatOpen && 'bg-muted/80')}
          title={aiChatOpen ? 'Stäng Lexa' : 'Öppna Lexa'}
        >
          <LexaIcon size={16} />
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
