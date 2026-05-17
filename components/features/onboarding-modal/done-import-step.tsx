'use client'

/**
 * Story 25.4 (Epic 25, B.4): Done state for the import path.
 *
 * Mounted by <FirstRunModal> when <ImportUploadStep>'s onSuccess fires —
 * replaces 25.1's immediate-route behaviour (modal closed + pushed to
 * /granska) with a celebratory + summary surface that the user CTAs
 * through. Counts are sourced from getImport(importId).counts (Story 24.4)
 * via <FirstRunModal>'s handleImportSuccess.
 *
 * Two modes:
 *   - success: CheckCircle2 + headline + 3-tile confidence breakdown +
 *              Granska matchningar (primary) + Fortsätt utforska (disabled).
 *   - failed:  AlertTriangle + headline + Skapa supportärende (mailto) +
 *              Stäng guiden.
 *
 * The success-mode "Fortsätt utforska" secondary CTA is rendered DISABLED
 * with a "Kommer snart" tooltip per owner decision v0.4. Failure-mode
 * "Stäng guiden" stays enabled.
 *
 * Telemetry is fired by <FirstRunModal>, not here.
 */

import { ArrowRight, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface DoneImportStepProps {
  mode?: 'success' | 'failed'
  /** Confidence-tier row counts from getImport(importId).counts. */
  counts: {
    highCount: number
    mediumCount: number
    unmatchedCount: number
  }
  /** Used by onGoToReview to construct the granska route. */
  importId: string
  /** Primary CTA in success mode. */
  onGoToReview: () => void
  /**
   * "Fortsätt utforska" callback — plumbed but unused in B.4 (button is
   * disabled per AC 12 owner decision). B.6 will enable + invoke.
   */
  onKeepExploring: () => void
  /** Primary CTA in failed mode — opens mailto for support. */
  onCreateSupportTicket?: () => void
  /** Secondary CTA in failed mode — closes the modal. */
  onCloseFailure?: () => void
}

export function DoneImportStep({
  mode = 'success',
  counts,
  importId: _importId,
  onGoToReview,
  onKeepExploring: _onKeepExploring,
  onCreateSupportTicket,
  onCloseFailure,
}: DoneImportStepProps) {
  if (mode === 'failed') {
    return (
      <div className="flex flex-col px-1 py-4">
        <AlertTriangle
          className="mx-auto mb-5 h-12 w-12 text-foreground/80"
          aria-hidden="true"
        />
        <div className="flex items-center justify-center gap-3">
          <Button
            onClick={onCreateSupportTicket}
            className="gap-1.5"
            data-onboarding-focus-target="true"
          >
            <span>Skapa supportärende</span>
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Button>
          <Button variant="ghost" onClick={onCloseFailure}>
            Stäng guiden
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col px-1 py-4">
      {/* Confidence breakdown — three stat tiles in a single row. The
          card is the celebratory anchor; no top icon needed (DialogTitle +
          the green tone pill on Hög provide all the "done" signal). */}
      <div className="mx-auto mb-2 max-w-prose rounded-xl border bg-card">
        <div className="grid grid-cols-3 gap-4 p-5">
          <div className="flex flex-col items-center text-center">
            <span className="font-safiro text-3xl font-medium">
              {counts.highCount}
            </span>
            <p className="mt-1 text-[12.5px] text-muted-foreground">Hög</p>
            <span className="mt-2 inline-flex items-center rounded-full bg-[hsl(var(--tone-success-soft-bg))] px-2 py-0.5 text-[10.5px] font-medium text-[hsl(var(--tone-success-soft-fg))]">
              Acceptera
            </span>
          </div>
          <div className="flex flex-col items-center text-center">
            <span className="font-safiro text-3xl font-medium">
              {counts.mediumCount}
            </span>
            <p className="mt-1 text-[12.5px] text-muted-foreground">
              Behöver bekräftelse
            </p>
            <span className="mt-2 inline-flex items-center rounded-full bg-[hsl(var(--tone-warning-soft-bg))] px-2 py-0.5 text-[10.5px] font-medium text-[hsl(var(--tone-warning-soft-fg))]">
              Välj kandidat
            </span>
          </div>
          <div className="flex flex-col items-center text-center">
            <span className="font-safiro text-3xl font-medium">
              {counts.unmatchedCount}
            </span>
            <p className="mt-1 text-[12.5px] text-muted-foreground">Saknas</p>
            <span className="mt-2 inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10.5px] font-medium text-muted-foreground">
              Begär tillägg
            </span>
          </div>
        </div>
      </div>

      <p className="mx-auto mt-4 max-w-prose text-center text-[12.5px] text-muted-foreground">
        På nästa sida kan ni acceptera höga matchningar, byta kandidat för
        osäkra rader, och begära tillägg om något saknas.
      </p>

      <div className="mt-6 flex items-center justify-center gap-3">
        <Button
          onClick={onGoToReview}
          className="gap-1.5"
          data-onboarding-focus-target="true"
        >
          <span>Granska matchningar</span>
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Button>
        {/* "Fortsätt utforska" disabled in B.4 — see done-generate-step.tsx
            for the rationale + B.6 swap pattern. */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                aria-disabled="true"
                className="cursor-not-allowed opacity-50 hover:bg-transparent hover:text-current"
              >
                Fortsätt utforska
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">Kommer snart</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  )
}
