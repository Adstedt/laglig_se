'use client'

/**
 * Story 21.6 — Confirmation dialog for cycle Complete (PAGAENDE → AVSLUTAD).
 *
 * Open-work advisory paragraph (AC 2):
 *  - `openFindings > 0 && pendingTasks > 0` → both-counts copy.
 *  - `openFindings > 0 && pendingTasks === 0` → findings-only copy.
 *  - `openFindings === 0` → advisory omitted entirely.
 *
 * **`pendingTasks` approximation (deliberate).** The count is derived from
 * findings with `correctiveActionTaskId !== null && closedAt === null`. This
 * is a proxy for "tasks not yet completed" — not the task's actual
 * `status !== 'completed'`. For the dialog advisory this is good enough:
 * closing a finding is gated on its linked task being completed (Story 21.7
 * AC 5), so finding-open ≈ task-pending. Do NOT "fix" this by adding a DB
 * round-trip; the approximation is the point.
 */

import { Loader2 } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

interface CompleteCycleDialogProps {
  open: boolean
  onOpenChange: (_next: boolean) => void
  onConfirm: () => void | Promise<void>
  isSubmitting: boolean
  openFindings: number
  pendingTasks: number
}

export function CompleteCycleDialog({
  open,
  onOpenChange,
  onConfirm,
  isSubmitting,
  openFindings,
  pendingTasks,
}: CompleteCycleDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Slutför kontrollen?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>
                Granskningen är klar. Resultatet kan användas som det är för att
                dokumentera nuläget — revisionsrapporten kan genereras direkt.
              </p>
              <p>
                Kontrollen blir låst när den slutförs. För att göra ytterligare
                ändringar i bedömningar, motiveringar eller anmärkningar måste
                du återställa kontrollen till pågående via Åtgärder-menyn.
                Fastställandet är ett separat, oåterkalleligt steg.
              </p>
              {openFindings > 0 ? (
                <OpenWorkAdvisory
                  openFindings={openFindings}
                  pendingTasks={pendingTasks}
                />
              ) : null}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isSubmitting}>Avbryt</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              // Prevent the default auto-close so the dialog stays open if
              // the mutation fails (error path keeps dialog open per AC 2).
              e.preventDefault()
              void onConfirm()
            }}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <Loader2
                className="mr-2 h-4 w-4 animate-spin"
                aria-hidden="true"
              />
            ) : null}
            Slutför kontroll
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

interface OpenWorkAdvisoryProps {
  openFindings: number
  pendingTasks: number
}

function OpenWorkAdvisory({
  openFindings,
  pendingTasks,
}: OpenWorkAdvisoryProps) {
  const findingsLabel =
    openFindings === 1 ? 'öppen anmärkning' : 'öppna anmärkningar'

  if (pendingTasks > 0) {
    const tasksLabel =
      pendingTasks === 1
        ? 'pågående åtgärdsuppgift'
        : 'pågående åtgärdsuppgifter'
    return (
      <p className="text-sm text-muted-foreground">
        Följs upp efter avslutad kontroll: {openFindings} {findingsLabel} med{' '}
        {pendingTasks} {tasksLabel}.
      </p>
    )
  }

  const noActionsLabel =
    openFindings === 1 ? 'utan aktiv åtgärd' : 'utan aktiva åtgärder'
  return (
    <p className="text-sm text-muted-foreground">
      Följs upp efter avslutad kontroll: {openFindings} {findingsLabel}{' '}
      {noActionsLabel}.
    </p>
  )
}
