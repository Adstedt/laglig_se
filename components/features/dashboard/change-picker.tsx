'use client'

/**
 * Story 14.10: Change Picker Dialog for Hem page
 * Lists pending changes. Selecting one enters the assessment view.
 */

import { useState, useEffect } from 'react'
import {
  BookOpen,
  ChevronRight,
  ExternalLink,
  FileText,
  FileWarning,
} from 'lucide-react'
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

/**
 * Distinguish laws (SFS) from föreskrifter (AFS, BFS, NFS, etc.) via the
 * documentNumber prefix. BookOpen matches the icon convention used in
 * components/features/changes/law-list-tabs-strip.tsx for laws; FileText is
 * the generic document fallback for everything else.
 */
function DocumentIcon({ documentNumber }: { documentNumber: string }) {
  const isLaw = documentNumber.toUpperCase().startsWith('SFS')
  const Icon = isLaw ? BookOpen : FileText
  return <Icon className="h-4 w-4" />
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
      <DialogContent className="max-w-[624px] gap-0 overflow-hidden p-0">
        {/* pr-12 reserves room on the title row for the close × that
            DialogContent absolutely-positions at top-right. */}
        <DialogHeader className="px-6 pt-6 pr-12 pb-4">
          <div className="flex items-baseline justify-between gap-3">
            <DialogTitle className="text-lg font-semibold tracking-tight">
              Välj en ändring att granska
            </DialogTitle>
            {/* Count sits on the title row, baseline-aligned, as plain muted
                text — no pill chrome, no separator, no awkward mid-sentence
                interruption. Reads like a section count (e.g. "Files (12)"). */}
            {itemCount > 0 && (
              <span className="shrink-0 text-xs font-medium text-muted-foreground tabular-nums">
                {itemCount} {itemCount === 1 ? 'ändring' : 'ändringar'}
              </span>
            )}
          </div>
          <p className="mt-1.5 text-[13px] text-muted-foreground">
            Vi hjälper dig tolka ändringen och bedöma dess påverkan.
          </p>
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
            changes.map((change) => {
              const select = () => {
                onSelect(change)
                onOpenChange(false)
              }
              return (
                // Using a div with role=button (instead of a real <button>)
                // because the row contains a nested <a> (the list-name link),
                // which is invalid HTML inside <button>. Keyboard activation
                // is preserved via the Enter/Space handler.
                <div
                  key={`${change.id}-${change.listId}`}
                  role="button"
                  tabIndex={0}
                  onClick={select}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      select()
                    }
                  }}
                  className="group flex w-full cursor-pointer items-center gap-3 border-b px-6 py-4 text-left transition-colors last:border-b-0 hover:bg-accent/60 focus-visible:bg-accent/60 focus-visible:outline-none"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-amber-100 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-400">
                    <DocumentIcon documentNumber={change.documentNumber} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {change.amendmentSfs
                        ? `${change.amendmentSfs} — Ändring i ${change.documentTitle}`
                        : change.documentTitle}
                    </p>
                    {/* Meta row uses uniform plain-text styling so no element
                        creates a vertical jump. The list-name is a real link
                        that opens the specific laglista in a new tab; the
                        document-number + change-type stay as plain spans. */}
                    <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span className="tabular-nums">
                        {change.documentNumber}
                      </span>
                      <span
                        className="text-muted-foreground/40"
                        aria-hidden="true"
                      >
                        ·
                      </span>
                      <span>{CHANGE_TYPE_LABELS[change.changeType]}</span>
                      <span
                        className="text-muted-foreground/40"
                        aria-hidden="true"
                      >
                        ·
                      </span>
                      <a
                        href={`/laglistor?list=${change.listId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-0.5 truncate underline-offset-2 hover:text-foreground hover:underline focus-visible:text-foreground focus-visible:underline focus-visible:outline-none"
                      >
                        {change.listName}
                        <ExternalLink
                          className="h-3 w-3 shrink-0 opacity-60"
                          aria-hidden="true"
                        />
                      </a>
                    </div>
                  </div>
                  <ChevronRight
                    className="h-4 w-4 shrink-0 text-muted-foreground/40 transition-colors group-hover:text-muted-foreground"
                    aria-hidden="true"
                  />
                </div>
              )
            })
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
