'use client'

/**
 * Epic 21 Story 21.16 — Compact item strip (State 3 header).
 *
 * Thin contextual bar shown when the AI chat is in fullscreen mode. Keeps the
 * law's identity visible while the rest of the modal body is hidden.
 */

import { ChevronLeft, Scale, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { useSplitPanelModal } from '@/components/shared/split-panel-modal/context'
import { getBedomningOption } from '@/components/features/compliance-audit/bedomning-copy'
import type { CycleItemRow } from '@/app/actions/compliance-audit-item'

interface CompactItemStripProps {
  item: CycleItemRow
}

const BEDOMNING_DOT: Record<string, string> = {
  UPPFYLLD: 'bg-green-500',
  DELVIS: 'bg-blue-500',
  EJ_UPPFYLLD: 'bg-red-500',
  EJ_TILLAMPLIG: 'bg-gray-400',
}

export function CompactItemStrip({ item }: CompactItemStripProps) {
  const { toggleExpand, closeModal } = useSplitPanelModal()
  const bedomning = item.efterlevnadsbedomning
  const bedomningOption = getBedomningOption(bedomning)
  const bedomningLabel = bedomningOption?.label ?? null
  const dotClass = bedomning
    ? BEDOMNING_DOT[bedomning]
    : 'bg-muted-foreground/40'

  return (
    <div className="flex items-center gap-3 bg-muted/30 px-6 py-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border/60 bg-background text-muted-foreground">
        <Scale className="h-4 w-4" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="truncate">{item.lawDocumentNumber}</span>
          {bedomningLabel ? (
            <>
              <span className="text-border">·</span>
              <span className="inline-flex items-center gap-1">
                <span className={cn('h-2 w-2 rounded-full', dotClass)} />
                {bedomningLabel}
              </span>
            </>
          ) : null}
        </div>
        <div
          className="truncate text-sm font-medium leading-tight text-foreground"
          title={item.lawTitle}
        >
          {item.lawTitle}
        </div>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={toggleExpand}
        className="h-8 shrink-0 px-2.5"
      >
        <ChevronLeft className="mr-1 h-3.5 w-3.5" />
        Tillbaka till lagen
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={closeModal}
        className="h-8 w-8 shrink-0 p-0"
        aria-label="Stäng"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  )
}
