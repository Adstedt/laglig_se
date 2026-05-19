'use client'

/**
 * Story 25.6 (Epic 25, B.6): corner FAB — re-entry layer 2 of 3 per arch §6.5.
 *
 * Renders bottom-right on /dashboard when `onboardingState.fabVisible === true`
 * (modal has been dismissed at least once, FAB itself not dismissed, user did
 * not hit Hoppa över). Three visual states driven by `fabState`:
 *  - `working`: pill button with spinner + "Genererar laglista..." text
 *  - `done` / `idle`: circular lightbulb button with "Tutorial" tooltip
 *
 * Main click → `onOpen` callback (parent opens modal at tutorial-only mode).
 * Tiny X on hover → `dismissOnboardingFab` action → sets `tutorial_fab_dismissed_at`.
 * After successful X-dismiss, calls optional `onDismissed` callback so the
 * parent can re-derive state and unmount this component cleanly.
 *
 * Z-index 40 — one below Radix Dialog's z-50, so the FAB naturally hides
 * behind the modal when it's open. No display:none needed.
 */

import { Lightbulb, Loader2, Sparkles, X } from 'lucide-react'

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { dismissOnboardingFab } from '@/app/actions/onboarding-modal'
import { cn } from '@/lib/utils'

import { runDismissAction } from './run-dismiss-action'

export type FabState = 'working' | 'done' | 'idle'

interface OnboardingFabProps {
  fabState: FabState
  /** Called when the user clicks the FAB body (NOT the X). Parent opens the modal. */
  onOpen: () => void
  /** Called after `dismissOnboardingFab` succeeds. Parent should re-derive
   *  `fabVisible` (e.g. `router.refresh()`) so this component unmounts. */
  onDismissed?: () => void
  /**
   * Story 25.6 v1.1 polish: when true (and fabState is 'done'/'idle'), render
   * the Sparkles + sage-tint + pulse celebrate variant + open the modal at
   * done-generate (parent decides via own state). Drives the "your laglista
   * is ready" affordance for users who minimised mid-generation. Once the
   * done-generate surface has been seen (localStorage flag in
   * `lib/onboarding/done-generate-shown.ts`), parent passes false and the
   * FAB falls back to the plain done variant.
   */
  celebrate?: boolean
}

export function OnboardingFab({
  fabState,
  onOpen,
  onDismissed,
  celebrate = false,
}: OnboardingFabProps) {
  const isWorking = fabState === 'working'
  const isCelebrate = celebrate && !isWorking
  const ariaLabel = isWorking
    ? 'Genererar laglista — öppna guiden'
    : isCelebrate
      ? 'Er laglista är klar — öppna guiden'
      : 'Öppna tutorial'

  async function handleDismiss(e: React.MouseEvent<HTMLButtonElement>) {
    e.stopPropagation()
    const ok = await runDismissAction(
      dismissOnboardingFab,
      'dismissOnboardingFab'
    )
    if (ok) onDismissed?.()
  }

  // Working pill — wider, with text + spinner. Wrapped in a group/relative
  // container so the absolute-positioned X can sit at top-right.
  if (isWorking) {
    return (
      <div className="group fixed bottom-6 right-6 z-40">
        {/* Subtle pulse ring — motion-safe to respect reduced-motion users.
            Precedent: components/features/dashboard/context-cards.tsx:197. */}
        <div
          aria-hidden="true"
          className="absolute inset-0 rounded-full bg-foreground/5 motion-safe:animate-pulse"
        />
        <button
          type="button"
          onClick={onOpen}
          aria-label={ariaLabel}
          className={cn(
            'relative inline-flex h-11 items-center gap-2 rounded-full border border-border bg-background px-4 text-[13px] font-medium text-foreground shadow-md',
            'transition-shadow hover:shadow-lg',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
          )}
        >
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          <span>Genererar laglista...</span>
        </button>
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Dölj guide-knappen"
          className={cn(
            'absolute -right-1 -top-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-foreground text-background shadow-sm',
            'opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
          )}
        >
          <X className="h-3 w-3" aria-hidden="true" />
        </button>
      </div>
    )
  }

  // Done / idle — circular button. Celebrate variant (Story 25.6 v1.1) uses
  // a Sparkles icon + sage tint + subtle motion-safe pulse to signal "your
  // laglista is newly ready"; plain variant is the lightbulb.
  return (
    <TooltipProvider>
      <div className="group fixed bottom-6 right-6 z-40">
        {isCelebrate && (
          <div
            aria-hidden="true"
            className="absolute inset-0 rounded-full bg-foreground/5 motion-safe:animate-pulse"
          />
        )}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={onOpen}
              aria-label={ariaLabel}
              className={cn(
                'relative inline-flex h-11 w-11 items-center justify-center rounded-full border border-border text-foreground shadow-md',
                'transition-shadow hover:shadow-lg',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                isCelebrate ? 'bg-section-sage' : 'bg-background'
              )}
            >
              {isCelebrate ? (
                <Sparkles className="h-5 w-5" aria-hidden="true" />
              ) : (
                <Lightbulb className="h-5 w-5" aria-hidden="true" />
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent side="left">
            {isCelebrate ? 'Er laglista är klar!' : 'Tutorial'}
          </TooltipContent>
        </Tooltip>
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Dölj guide-knappen"
          className={cn(
            'absolute -right-1 -top-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-foreground text-background shadow-sm',
            'opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
          )}
        >
          <X className="h-3 w-3" aria-hidden="true" />
        </button>
      </div>
    </TooltipProvider>
  )
}
