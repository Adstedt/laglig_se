'use client'

/**
 * Story 25.4 (Epic 25, B.4): Done state for the template path.
 *
 * Mounted by <FirstRunModal> after <TemplatePickStep>'s onTemplateApplied
 * fires — replaces 25.1's "route out to /mallar/{slug}" behaviour with an
 * in-modal handoff card.
 *
 * Lightweight by design: no LLM-progress narrative, no celebration ring.
 * Template apply is synchronous (Story 12.10's adoptTemplate returns in
 * <2s) — the user already knows it worked because the inline spinner in
 * <TemplatePickStep> cleared. This step is just a clean handoff with the
 * actual list name + item count + a "Visa min laglista" CTA.
 *
 * The success-mode "Fortsätt utforska" secondary CTA is rendered DISABLED
 * with a "Kommer snart" tooltip per owner decision v0.4.
 *
 * No failed-mode variant — template failures stay on template-pick with a
 * toast per AC 21 (the user can pick a different template or click Tillbaka).
 *
 * Telemetry is fired by <FirstRunModal>, not here.
 */

import { ListChecks, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface DoneTemplateStepProps {
  /** Returned by adoptTemplate. Used by onShowList for the route. */
  listId: string
  listName: string
  itemCount: number
  /** Primary CTA. Parent closes the modal + routes to /laglistor/{listId}. */
  onShowList: () => void
  /**
   * "Fortsätt utforska" callback — plumbed but unused in B.4 (button is
   * disabled per AC 18 owner decision). B.6 will enable + invoke.
   */
  onKeepExploring: () => void
}

export function DoneTemplateStep({
  listId: _listId,
  listName,
  itemCount,
  onShowList,
  onKeepExploring: _onKeepExploring,
}: DoneTemplateStepProps) {
  return (
    <div className="flex flex-col px-1 py-4">
      <ListChecks
        className="mx-auto mb-5 h-10 w-10 text-foreground/80"
        aria-hidden="true"
      />

      <p className="mx-auto mb-2 max-w-prose text-center text-[14px] text-muted-foreground">
        &apos;{listName}&apos; innehåller {itemCount} regelverk redo att börja
        arbetas med.
      </p>

      <p className="mx-auto mb-6 max-w-prose text-center text-[12.5px] text-muted-foreground">
        Ni kan justera kravpunkter, lägga till regelverk, eller tilldela
        ansvariga när som helst.
      </p>

      <div className="flex items-center justify-center gap-3">
        <Button
          onClick={onShowList}
          className="gap-1.5"
          data-onboarding-focus-target="true"
        >
          <span>Visa min laglista</span>
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
