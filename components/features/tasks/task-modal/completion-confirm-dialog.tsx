'use client'

/**
 * Story 6.7c: Task Completion → File Promotion Confirmation
 *
 * When a user marks a task with files + linked law list items as klar,
 * confirm which (file × list-item) pairs to promote from transient
 * task-attachment links to first-class direct links on the law list items.
 *
 * Strategic frame: this is one instance of a broader "promote borrowed
 * history to owned history at natural commit moments" pattern. The law
 * list item should accumulate first-class durable evidence that survives
 * the lifecycle of any particular task — feeding agent reasoning over the
 * full compliance history of an obligation per customer.
 *
 * UX: Option C from the design discussion — pre-checked confirmation.
 * All pairs default to checked; one click in the common case.
 *
 * Prototype: _prototypes/task-completion-link-files-flow.html
 */

import { useMemo, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { CheckCircle2, FileText, Scale } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface CompletionDialogFile {
  id: string
  filename: string
  size: number | null
}

export interface CompletionDialogListItem {
  id: string
  documentTitle: string
  documentNumber: string
  lawListName: string
}

interface TaskCompletionConfirmDialogProps {
  open: boolean
  onOpenChange: (_open: boolean) => void
  taskTitle: string
  files: CompletionDialogFile[]
  listItems: CompletionDialogListItem[]
  onConfirm: (
    _pairs: Array<{ fileId: string; listItemId: string }>
  ) => Promise<void>
  onSkip: () => Promise<void>
  isSubmitting?: boolean
}

function formatBytes(size: number | null): string {
  if (size === null || size === 0) return ''
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(0)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

function pairKey(fileId: string, listItemId: string): string {
  return `${fileId}::${listItemId}`
}

export function TaskCompletionConfirmDialog({
  open,
  onOpenChange,
  taskTitle,
  files,
  listItems,
  onConfirm,
  onSkip,
  isSubmitting = false,
}: TaskCompletionConfirmDialogProps) {
  // Pre-check all (file × list-item) pairs by default
  const allKeys = useMemo(() => {
    const out: string[] = []
    for (const f of files) {
      for (const li of listItems) {
        out.push(pairKey(f.id, li.id))
      }
    }
    return out
  }, [files, listItems])

  const [checked, setChecked] = useState<Set<string>>(() => new Set(allKeys))

  const togglePair = (fileId: string, listItemId: string) => {
    if (isSubmitting) return
    const key = pairKey(fileId, listItemId)
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const handleConfirm = async () => {
    const pairs = Array.from(checked).map((key) => {
      const [fileId, listItemId] = key.split('::')
      return { fileId: fileId!, listItemId: listItemId! }
    })
    await onConfirm(pairs)
  }

  const totalPairs = allKeys.length
  const isSingleListItem = listItems.length === 1
  const onlyListItem = listItems[0]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Markera &ldquo;{taskTitle}&rdquo; som klar?</DialogTitle>
          <DialogDescription>
            {isSingleListItem && onlyListItem ? (
              <>
                Vill du behålla uppgiftens{' '}
                {files.length === 1 ? 'bilaga' : `${files.length} bilagor`} som{' '}
                <strong>direktlänkad{files.length === 1 ? '' : 'e'}</strong>{' '}
                till <strong>{onlyListItem.documentTitle}</strong>? Filen
                {files.length === 1 ? '' : 'erna'} finns redan tillgänglig
                {files.length === 1 ? '' : 'a'} via uppgiften — direktlänkning
                gör att de ligger kvar på dokumentet även om uppgiften tas bort.
              </>
            ) : (
              <>
                Vill du behålla uppgiftens bilagor som{' '}
                <strong>direktlänkade</strong> till de {listItems.length}{' '}
                dokumenten? Bilagorna finns redan tillgängliga via uppgiften —
                direktlänkning gör att de ligger kvar på dokumenten även om
                uppgiften tas bort eller arkiveras.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[420px] space-y-3 overflow-y-auto pr-1">
          {isSingleListItem ? (
            <div className="space-y-1.5">
              {files.map((f) => {
                const key = pairKey(f.id, listItems[0]!.id)
                return (
                  <label
                    key={f.id}
                    className={cn(
                      'flex cursor-pointer items-center gap-2.5 rounded px-2 py-1.5 text-sm hover:bg-muted/40',
                      isSubmitting && 'cursor-not-allowed opacity-60'
                    )}
                  >
                    <Checkbox
                      checked={checked.has(key)}
                      onCheckedChange={() => togglePair(f.id, listItems[0]!.id)}
                      disabled={isSubmitting}
                    />
                    <FileText className="h-4 w-4 shrink-0 text-muted-foreground/70" />
                    <span className="flex-1 truncate">{f.filename}</span>
                    {formatBytes(f.size) && (
                      <span className="shrink-0 text-[10px] text-muted-foreground">
                        {formatBytes(f.size)}
                      </span>
                    )}
                  </label>
                )
              })}
            </div>
          ) : (
            listItems.map((li) => (
              <div
                key={li.id}
                className="rounded-lg border border-border/60 p-3"
              >
                <div className="mb-3 flex items-start gap-2">
                  <Scale className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/70" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {li.documentTitle}
                    </p>
                    <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                      {li.documentNumber} · {li.lawListName}
                    </p>
                  </div>
                </div>
                <div className="ml-6 space-y-1.5">
                  {files.map((f) => {
                    const key = pairKey(f.id, li.id)
                    return (
                      <label
                        key={f.id}
                        className={cn(
                          'flex cursor-pointer items-center gap-2.5 rounded px-1.5 py-1 text-sm hover:bg-muted/40',
                          isSubmitting && 'cursor-not-allowed opacity-60'
                        )}
                      >
                        <Checkbox
                          checked={checked.has(key)}
                          onCheckedChange={() => togglePair(f.id, li.id)}
                          disabled={isSubmitting}
                        />
                        <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
                        <span className="flex-1 truncate">{f.filename}</span>
                        {formatBytes(f.size) && (
                          <span className="shrink-0 text-[10px] text-muted-foreground">
                            {formatBytes(f.size)}
                          </span>
                        )}
                      </label>
                    )
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Avbryt
          </Button>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => onSkip()}
              disabled={isSubmitting}
            >
              Hoppa över
            </Button>
            <Button onClick={handleConfirm} disabled={isSubmitting}>
              <CheckCircle2 className="mr-1.5 h-4 w-4" />
              {isSingleListItem
                ? 'Direktlänka & markera klar'
                : `Direktlänka ${checked.size}/${totalPairs} & markera klar`}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
