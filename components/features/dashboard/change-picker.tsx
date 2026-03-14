'use client'

/**
 * Story 14.10: Change Picker Dialog for Hem page
 * Lists pending changes. Selecting one enters the assessment view.
 */

import { useState, useEffect } from 'react'
import { FileWarning, ChevronRight, Loader2 } from 'lucide-react'
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[480px] p-0 gap-0">
        <DialogHeader className="px-5 pt-5 pb-3">
          <DialogTitle className="text-base">
            Välj en ändring att granska
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Lexa hjälper dig förstå ändringen och bedöma dess påverkan.
          </p>
        </DialogHeader>

        <div className="max-h-[400px] overflow-y-auto border-t">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : changes && changes.length > 0 ? (
            changes.map((change) => (
              <button
                key={`${change.id}-${change.listId}`}
                onClick={() => {
                  onSelect(change)
                  onOpenChange(false)
                }}
                className="w-full flex items-center gap-3 px-5 py-3.5 text-left hover:bg-accent transition-colors border-b last:border-b-0 group"
              >
                <FileWarning className="h-4 w-4 text-amber-500 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">
                    {change.documentTitle}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-muted-foreground">
                      {change.documentNumber}
                    </span>
                    <Badge
                      variant="secondary"
                      className="text-[10px] px-1.5 py-0"
                    >
                      {CHANGE_TYPE_LABELS[change.changeType]}
                    </Badge>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-foreground shrink-0" />
              </button>
            ))
          ) : (
            <div className="py-12 text-center">
              <p className="text-sm text-muted-foreground">
                Inga ändringar att granska
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
