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

import { useState } from 'react'
import { Sparkles, ArrowRight, AlertTriangle, Check } from 'lucide-react'
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
  // groups intentionally unused — the Områden breakdown row was removed
  // post-smoke (2026-05-17) per owner feedback: redundant with the laglistor
  // page the user reaches via the primary CTA, and it surfaced the
  // LLM-grouping bug (overlapping group names like "Brandskydd" +
  // "Brandskydd & Säkerhet"). Prop kept in the interface so a future
  // iteration can re-render without a parent-side prop change.
  groups: _groups,
  startedAt,
  errorMessage,
  onShowList,
  onKeepExploring: _onKeepExploring,
  onRetry,
  onCloseFailure,
}: DoneGenerateStepProps) {
  // Freeze the duration on first mount so it doesn't drift upward as the
  // component re-renders. Without this, Date.now() would be recomputed on
  // every render and the displayed "Klart på Xm Ys" would tick up as the
  // user sits on the done-generate surface. The "true" fix would be a
  // server-side completedAt timestamp — deferred to a future API change.
  //
  // Hook MUST be called above the failed-mode early return (rules-of-hooks);
  // durationMs is unused in failed mode but still has to be initialized.
  const [durationMs] = useState<number | null>(() =>
    startedAt ? Date.now() - new Date(startedAt).getTime() : null
  )

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

  return (
    <div className="flex flex-col overflow-y-auto px-1 py-2">
      {/* Success ring — sage tint behind sparkles icon. */}
      <div
        className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-section-sage"
        aria-hidden="true"
      >
        <Sparkles className="h-7 w-7 text-foreground/80" />
      </div>

      {/* Hero cluster: Safiro number + unit label baseline-aligned. Pattern
          matches dashboard "1,234 kr" stat treatments — the unit anchors what
          the number counts so the eye doesn't have to scan to learn. */}
      <p className="mb-1 text-center">
        <span className="font-safiro text-5xl font-medium text-foreground">
          {itemCount ?? '—'}
        </span>
        <span className="ml-2 text-[16px] text-muted-foreground">
          regelverk
        </span>
      </p>

      {durationMs !== null && durationMs >= 0 && (
        <p className="mb-5 text-center text-[12px] text-muted-foreground/70">
          identifierade på {formatDuration(durationMs)}
        </p>
      )}

      {/* Two-column trust + guidance card. LEFT explains methodology (trust
          signal — naming SFS/AFS signals domain expertise, "affärskontext"
          references the agent's businessContext field). RIGHT previews the
          natural next-step product features (collaboration, kravpunkter,
          change-events) — soft cross-sell. Mirrors the tutorial-tab 2-col
          visual language so the post-generation surface feels like the
          natural payoff of what the user just watched.

          Each bullet has a sub-line of 1-line elaboration to add depth
          without losing scannability. */}
      <div className="mx-auto mb-5 w-full max-w-4xl rounded-xl border bg-card">
        <div className="grid grid-cols-1 md:grid-cols-2">
          <div className="border-b border-border p-6 md:border-b-0 md:border-r">
            <h4 className="mb-4 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
              Detta gjorde vi
            </h4>
            <ul className="space-y-4 text-[13.5px] text-foreground">
              <li className="flex gap-2.5">
                <Check
                  className="mt-0.5 h-4 w-4 shrink-0 text-foreground/60"
                  aria-hidden="true"
                />
                <div>
                  <p>Läste er företagsprofil</p>
                  <p className="mt-0.5 text-[12px] text-muted-foreground">
                    Bransch, antal anställda, verksamhetsflaggor
                  </p>
                </div>
              </li>
              <li className="flex gap-2.5">
                <Check
                  className="mt-0.5 h-4 w-4 shrink-0 text-foreground/60"
                  aria-hidden="true"
                />
                <div>
                  <p>Sökte mot SFS, AFS, EU-direktiv och andra föreskrifter</p>
                  <p className="mt-0.5 text-[12px] text-muted-foreground">
                    Svensk och europeisk lagstiftning
                  </p>
                </div>
              </li>
              <li className="flex gap-2.5">
                <Check
                  className="mt-0.5 h-4 w-4 shrink-0 text-foreground/60"
                  aria-hidden="true"
                />
                <div>
                  <p>
                    Filtrerade till bransch- och verksamhetsspecifika regelverk
                  </p>
                  <p className="mt-0.5 text-[12px] text-muted-foreground">
                    Bara det som faktiskt rör er
                  </p>
                </div>
              </li>
              <li className="flex gap-2.5">
                <Check
                  className="mt-0.5 h-4 w-4 shrink-0 text-foreground/60"
                  aria-hidden="true"
                />
                <div>
                  <p>Skrev kort affärskontext per regelverk</p>
                  <p className="mt-0.5 text-[12px] text-muted-foreground">
                    Varför denna lag bör gälla er
                  </p>
                </div>
              </li>
            </ul>
          </div>

          <div className="p-6">
            <h4 className="mb-4 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
              Detta händer nu
            </h4>
            <ul className="space-y-4 text-[13.5px] text-foreground">
              <li className="flex gap-2.5">
                <ArrowRight
                  className="mt-0.5 h-4 w-4 shrink-0 text-foreground/60"
                  aria-hidden="true"
                />
                <div>
                  <p>Granska listan och justera vid behov</p>
                  <p className="mt-0.5 text-[12px] text-muted-foreground">
                    Lägg till, ta bort eller byt grupp
                  </p>
                </div>
              </li>
              <li className="flex gap-2.5">
                <ArrowRight
                  className="mt-0.5 h-4 w-4 shrink-0 text-foreground/60"
                  aria-hidden="true"
                />
                <div>
                  <p>Bjud in kollegor och tilldela ansvariga</p>
                  <p className="mt-0.5 text-[12px] text-muted-foreground">
                    Dela arbetet och bevisföringen
                  </p>
                </div>
              </li>
              <li className="flex gap-2.5">
                <ArrowRight
                  className="mt-0.5 h-4 w-4 shrink-0 text-foreground/60"
                  aria-hidden="true"
                />
                <div>
                  <p>Lägg till bevis och dokumentera efterlevnad</p>
                  <p className="mt-0.5 text-[12px] text-muted-foreground">
                    Bygg ert systematiska arbete
                  </p>
                </div>
              </li>
              <li className="flex gap-2.5">
                <ArrowRight
                  className="mt-0.5 h-4 w-4 shrink-0 text-foreground/60"
                  aria-hidden="true"
                />
                <div>
                  <p>Vi håller koll på lagändringar åt er</p>
                  <p className="mt-0.5 text-[12px] text-muted-foreground">
                    Notifieras när något ändras
                  </p>
                </div>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Hedging note — small framing-line below the card. Phrased as an
          invitation ("granska och justera fritt") rather than a bare
          disclaimer. */}
      <p className="mx-auto mb-6 max-w-prose text-center text-[12.5px] text-muted-foreground">
        Bedöms vara relevanta utifrån er företagsprofil — granska och justera
        fritt.
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
