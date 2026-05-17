'use client'

/**
 * Story 25.4 (Epic 25, B.4): Done state for the generate path.
 *
 * Mounted by <FirstRunModal> when SWR sees `law_list_generation_status` flip
 * to 'completed' OR 'failed' while the user is in the tutorial step.
 *
 * Two modes:
 *   - success: sage success ring + itemCount + (optional) "Klart på Xm Ys"
 *              duration + group chips + 2-CTA row.
 *   - failed:  AlertTriangle + error headline + error message + Försök igen
 *              (re-fires generation API) + Stäng guiden (real enabled close).
 *
 * The success-mode "Fortsätt utforska" secondary CTA is rendered DISABLED
 * with a "Kommer snart" tooltip per owner decision v0.4 — the tutorial_only
 * mode it should transition into lands in B.6. `onKeepExploring` is plumbed
 * through but never invoked in B.4.
 *
 * Telemetry is fired by <FirstRunModal>, not here.
 */

import { Sparkles, ArrowRight, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface DoneGenerateStepProps {
  mode?: 'success' | 'failed'
  /** Number of items in the generated default list (success mode only). */
  itemCount: number | null
  /** Group breakdown chips (success mode only). */
  groups: Array<{ name: string; count: number }> | null
  /**
   * Generation start timestamp ISO string from the generation-status API
   * (Story 25.3 v0.5 — see `app/api/workspace/generation-status/route.ts:134-135`).
   * When non-null, renders the "Klart på Xm Ys" copy hook. When null,
   * the duration line is omitted.
   */
  startedAt: string | null
  /** Error message from the API for failed mode. */
  errorMessage?: string | null
  /** Primary CTA in success mode. */
  onShowList: () => void
  /**
   * "Fortsätt utforska" callback — plumbed but unused in B.4 (button is
   * disabled per AC 6 owner decision). B.6 enables the button + invokes
   * this for the tutorial_only mode transition.
   */
  onKeepExploring: () => void
  /** Primary CTA in failed mode — re-fires the generation API. */
  onRetry?: () => void
  /** Secondary CTA in failed mode — closes the modal. */
  onCloseFailure?: () => void
}

/**
 * Render-time formatter: takes a millisecond duration, returns Swedish text.
 *   < 60s → "Ns" (min 1s)
 *   < 60min, divisible by 60s → "Nmin"
 *   otherwise → "Nmin Ms"
 */
function formatDuration(ms: number): string {
  const seconds = Math.max(1, Math.round(ms / 1000))
  if (seconds < 60) return `${seconds} s`
  const minutes = Math.floor(seconds / 60)
  const remainder = seconds % 60
  return remainder === 0 ? `${minutes} min` : `${minutes} min ${remainder} s`
}

export function DoneGenerateStep({
  mode = 'success',
  itemCount,
  groups,
  startedAt,
  errorMessage,
  onShowList,
  onKeepExploring: _onKeepExploring,
  onRetry,
  onCloseFailure,
}: DoneGenerateStepProps) {
  if (mode === 'failed') {
    return (
      <div className="flex flex-col overflow-y-auto px-1 py-4">
        <AlertTriangle
          className="mx-auto mb-5 h-12 w-12 text-foreground/80"
          aria-hidden="true"
        />
        {errorMessage && (
          <p className="mx-auto mb-6 max-w-prose text-center text-[14px] text-muted-foreground">
            {errorMessage}
          </p>
        )}
        <div className="flex items-center justify-center gap-3">
          <Button
            onClick={onRetry}
            className="gap-1.5"
            data-onboarding-focus-target="true"
          >
            <span>Försök igen</span>
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Button>
          <Button variant="ghost" onClick={onCloseFailure}>
            Stäng guiden
          </Button>
        </div>
      </div>
    )
  }

  const durationMs = startedAt
    ? Date.now() - new Date(startedAt).getTime()
    : null

  return (
    <div className="flex flex-col overflow-y-auto px-1 py-4">
      {/* Success ring — sage tint behind sparkles icon. */}
      <div
        className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-section-sage"
        aria-hidden="true"
      >
        <Sparkles className="h-7 w-7 text-foreground/80" />
      </div>

      <p className="mx-auto mb-5 max-w-prose text-center text-[14px] text-muted-foreground">
        {itemCount ?? '—'} regelverk har lagts till.
        {durationMs !== null && durationMs >= 0 && (
          <>
            {' '}
            <span className="text-muted-foreground/70">
              Klart på {formatDuration(durationMs)}.
            </span>
          </>
        )}
      </p>

      {groups && groups.length > 0 && (
        <div className="mx-auto mb-6 flex max-w-prose flex-wrap items-center justify-center gap-2">
          {groups.map((group) => (
            <span
              key={group.name}
              className="inline-flex items-center gap-1.5 rounded-full bg-section-warm/60 px-3 py-1 text-[12.5px] text-foreground"
            >
              {group.count} {group.name}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center justify-center gap-3">
        <Button
          onClick={onShowList}
          className="gap-1.5"
          data-onboarding-focus-target="true"
        >
          <span>Visa min laglista</span>
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Button>
        {/* "Fortsätt utforska" — DISABLED in B.4 per owner decision v0.4.
            We use aria-disabled + no onClick rather than the `disabled` HTML
            attribute so the tooltip still fires on hover (disabled buttons
            swallow pointer events). B.6 will drop aria-disabled + the
            <Tooltip> wrapper and wire onClick={onKeepExploring}. */}
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
