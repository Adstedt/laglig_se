'use client'

/**
 * Story 17.19: Compact Law Strip (State 3 header)
 *
 * Thin contextual bar pinned above the chat when the chat is in fullscreen mode.
 * Keeps the law's identity (SFS number + title + compliance status) visible
 * while the rest of the modal body is hidden.
 */

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ChevronLeft, Scale, X } from 'lucide-react'
import { useSplitPanelModal } from '@/components/shared/split-panel-modal/context'
import type { ListItemDetails } from '@/app/actions/legal-document-modal'
import type { ComplianceStatus } from '@prisma/client'

interface CompactLawStripProps {
  listItem: ListItemDetails
}

const STATUS_LABEL: Record<ComplianceStatus, { label: string; dot: string }> = {
  EJ_PABORJAD: { label: 'Ej påbörjad', dot: 'bg-gray-400' },
  PAGAENDE: { label: 'Delvis uppfylld', dot: 'bg-blue-500' },
  UPPFYLLD: { label: 'Uppfylld', dot: 'bg-green-500' },
  EJ_UPPFYLLD: { label: 'Ej uppfylld', dot: 'bg-red-500' },
  EJ_TILLAMPLIG: { label: 'Ej tillämplig', dot: 'bg-gray-300' },
}

export function CompactLawStrip({ listItem }: CompactLawStripProps) {
  const { toggleExpand, closeModal } = useSplitPanelModal()
  const status =
    STATUS_LABEL[listItem.complianceStatus] ?? STATUS_LABEL.EJ_PABORJAD

  return (
    <div className="flex items-center gap-3 px-6 py-3 bg-muted/30">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border/60 bg-background text-muted-foreground">
        <Scale className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1 flex flex-col gap-0.5">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="truncate">
            {listItem.legalDocument.documentNumber}
          </span>
          <span className="text-border">·</span>
          <span className="inline-flex items-center gap-1">
            <span className={cn('h-2 w-2 rounded-full', status.dot)} />
            {status.label}
          </span>
        </div>
        <div
          className={cn(
            'truncate text-sm font-medium text-foreground',
            'leading-tight'
          )}
          title={listItem.legalDocument.title}
        >
          {listItem.legalDocument.title}
        </div>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={toggleExpand}
        className="h-8 px-2.5 shrink-0"
      >
        <ChevronLeft className="mr-1 h-3.5 w-3.5" />
        Tillbaka till lagen
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={closeModal}
        className="h-8 w-8 p-0 shrink-0"
        aria-label="Stäng"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  )
}
