'use client'

import { useEffect, useState } from 'react'
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

interface ManualCloseFindingDialogProps {
  open: boolean
  onOpenChange: (_open: boolean) => void
  finding: FindingRow | null
  onConfirm: (_findingId: string, _closeReason: string) => Promise<void>
}

const REASON_MAX = 1000

export function ManualCloseFindingDialog({
  open,
  onOpenChange,
  finding,
  onConfirm,
}: ManualCloseFindingDialogProps) {
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open) {
      setReason('')
      setSubmitting(false)
    }
  }, [open])

  if (!finding) return null

  const task = finding.correctiveActionTask
  const trimmed = reason.trim()
  const reasonTooLong = reason.length > REASON_MAX
  const canSubmit = !submitting && !reasonTooLong && trimmed.length > 0

  async function handleConfirm() {
    if (!canSubmit || !finding) return
    setSubmitting(true)
    try {
      await onConfirm(finding.id, trimmed)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Markera som åtgärdat utan slutförd uppgift</DialogTitle>
          <DialogDescription>
            Den kopplade åtgärdsuppgiften är inte slutförd. Ange en manuell
            anledning för att markera anmärkningen som åtgärdad ändå — sparas i
            aktivitetsloggen som bevis.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div
            className="space-y-1 rounded-md border bg-muted/40 p-3 text-xs"
            data-testid="manual-close-finding-context"
          >
            <p>
              <span className="font-medium">Anmärkning:</span> {finding.title}
            </p>
            {task ? (
              <p>
                <span className="font-medium">Åtgärdsuppgift:</span>{' '}
                {task.title}
                <span className="text-muted-foreground"> — ej slutförd</span>
              </p>
            ) : null}
          </div>

          <div className="space-y-1">
            <Label htmlFor="manual-close-reason" className="text-xs">
              Anledning för manuell stängning *
            </Label>
            <Textarea
              id="manual-close-reason"
              data-testid="manual-close-finding-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
              maxLength={REASON_MAX}
              aria-invalid={reasonTooLong}
              aria-required="true"
              placeholder="T.ex. Avvikelsen är inte längre relevant — verksamheten har förändrats och kraven gäller inte längre."
            />
            <div className="flex justify-between gap-3 text-[10px] text-muted-foreground">
              <span>Krävs för audit-spårbarhet.</span>
              <span className="shrink-0">
                {reason.length}/{REASON_MAX}
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
            data-testid="manual-close-finding-submit"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              'Markera ändå'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
