'use client'

/**
 * Epic 21 follow-up — verify-step confirmation dialog.
 *
 * Opens when the auditor clicks "Verifiera" on a finding whose linked
 * corrective-action task has completed. The moment that takes "task done"
 * from "someone marked it done" to "auditor reviewed and confirmed effective"
 * — the defensible audit evidence that a sealed rapport can stand on.
 */

import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { sv } from 'date-fns/locale'
import { Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import type { FindingRow } from '@/app/actions/compliance-finding'

interface VerifyFindingDialogProps {
  open: boolean
  onOpenChange: (_open: boolean) => void
  finding: FindingRow | null
  onConfirm: (
    _findingId: string,
    _verificationNote: string | null
  ) => Promise<void>
}

const NOTE_MAX = 1000

export function VerifyFindingDialog({
  open,
  onOpenChange,
  finding,
  onConfirm,
}: VerifyFindingDialogProps) {
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Reset on open so the dialog is fresh between invocations.
  useEffect(() => {
    if (open) {
      setNote('')
      setSubmitting(false)
    }
  }, [open])

  if (!finding) return null

  const task = finding.correctiveActionTask
  const taskCompletedLabel =
    task?.completedAt != null
      ? format(task.completedAt, 'PPP', { locale: sv })
      : null

  const noteTooLong = note.length > NOTE_MAX
  const canSubmit = !submitting && !noteTooLong

  async function handleConfirm() {
    if (!canSubmit || !finding) return
    setSubmitting(true)
    try {
      const trimmed = note.trim()
      await onConfirm(finding.id, trimmed.length > 0 ? trimmed : null)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Verifiera åtgärd</DialogTitle>
          <DialogDescription>
            Bekräfta att den korrigerande åtgärden löser avvikelsen effektivt.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Read-only context block — anchors the user on WHAT they are
              verifying, not just the abstract act of verifying. */}
          <div
            className="space-y-1 rounded-md border bg-muted/40 p-3 text-xs"
            data-testid="verify-finding-context"
          >
            <p>
              <span className="font-medium">Anmärkning:</span> {finding.title}
            </p>
            {task ? (
              <p>
                <span className="font-medium">Åtgärdsuppgift:</span>{' '}
                {task.title}
                {taskCompletedLabel ? (
                  <span className="text-muted-foreground">
                    {' '}
                    — slutförd {taskCompletedLabel}
                  </span>
                ) : null}
              </p>
            ) : null}
          </div>

          <div className="space-y-1">
            <Label htmlFor="verify-note" className="text-xs">
              Verifieringskommentar (frivilligt)
            </Label>
            <Textarea
              id="verify-note"
              data-testid="verify-finding-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={4}
              maxLength={NOTE_MAX}
              aria-invalid={noteTooLong}
              placeholder="T.ex. Granskade nya brandövningsplan 2026-05-15, närvarolista bifogad"
            />
            <div className="flex justify-between gap-3 text-[10px] text-muted-foreground">
              <span>
                Anteckna vad du granskade — sparas i aktivitetsloggen som bevis.
              </span>
              <span className="shrink-0">
                {note.length}/{NOTE_MAX}
              </span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Avbryt
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={!canSubmit}
            data-testid="verify-finding-submit"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              'Verifiera och stäng'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
