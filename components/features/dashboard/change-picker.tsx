'use client'

/**
 * Story 14.10: Change Picker Dialog for Hem page
 * Lists pending changes. Selecting one enters the assessment view.
 */

import { useState, useEffect } from 'react'
import { FileWarning, ChevronRight, Sparkles } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { getUnacknowledgedChanges } from '@/app/actions/change-events'
import type { UnacknowledgedChange } from '@/lib/changes/change-utils'
import type { ChangeType } from '@prisma/client'

const CHANGE_TYPE_LABELS: Record<ChangeType, string> = {
  AMENDMENT: 'Ändring',
  REPEAL: 'Upphävande',
  NEW_LAW: 'Ny lag',
  METADATA_UPDATE: 'Metadata',
  NEW_RULING: 'Nytt avgörande',
}

interface ChangePickerProps {
  open: boolean
  onOpenChange: (_open: boolean) => void
  onSelect: (_change: UnacknowledgedChange) => void
}

export function ChangePicker({
  open,
  onOpenChange,
  onSelect,
}: ChangePickerProps) {
  const [changes, setChanges] = useState<UnacknowledgedChange[] | null>(null)
  const [loading, setLoading] = useState(false)

  // Fetch changes when dialog opens
  useEffect(() => {
    if (!open || changes !== null) return
    setLoading(true)
    getUnacknowledgedChanges()
      .then((result) => {
        if (result.success && result.data) {
          setChanges(result.data)
        }
      })
      .finally(() => setLoading(false))
  }, [open, changes])

  const itemCount = changes?.length ?? 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[520px] p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-lg font-semibold tracking-tight">
                Välj en ändring att granska
              </DialogTitle>
              <div className="mt-1.5 flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <p className="text-[13px] text-muted-foreground">
                  Vi hjälper dig tolka ändringen och bedöma dess påverkan.
                </p>
              </div>
            </div>
            {itemCount > 0 && (
              <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground tabular-nums">
                {itemCount} {itemCount === 1 ? 'ändring' : 'ändringar'}
              </span>
            )}
          </div>
        </DialogHeader>

        <div className="max-h-[440px] overflow-y-auto border-t">
          {loading ? (
            // Skeleton rows mirror the real row dimensions so the layout
            // doesn't jump when the data lands. 3 placeholders ≈ typical
            // dashboard fill without dominating the modal.
            <div className="divide-y">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 px-6 py-4"
                  aria-hidden="true"
                >
                  <div className="h-9 w-9 shrink-0 animate-pulse rounded-lg bg-muted" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3.5 w-3/4 animate-pulse rounded bg-muted" />
                    <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
                  </div>
                </div>
              ))}
            </div>
          ) : changes && changes.length > 0 ? (
            changes.map((change) => (
              <button
                key={`${change.id}-${change.listId}`}
                onClick={() => {
                  onSelect(change)
                  onOpenChange(false)
                }}
                className="group flex w-full items-center gap-3 border-b px-6 py-4 text-left transition-colors last:border-b-0 hover:bg-accent/60 focus-visible:bg-accent/60 focus-visible:outline-none"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-amber-100 bg-amber-50 text-amber-600 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-400">
                  <FileWarning className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {change.amendmentSfs
                      ? `${change.amendmentSfs} — Ändring i ${change.documentTitle}`
                      : change.documentTitle}
                  </p>
                  <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="tabular-nums">
                      {change.documentNumber}
                    </span>
                    <span className="text-muted-foreground/40">·</span>
                    <Badge
                      variant="secondary"
                      className="px-1.5 py-0 text-[10px] font-normal"
                    >
                      {CHANGE_TYPE_LABELS[change.changeType]}
                    </Badge>
                    <span className="text-muted-foreground/40">·</span>
                    <span className="truncate">{change.listName}</span>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/40 transition-colors group-hover:text-muted-foreground" />
              </button>
            ))
          ) : (
            <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <FileWarning className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium">Inga ändringar att granska</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Vi meddelar er när nya lagändringar berör er laglista.
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
