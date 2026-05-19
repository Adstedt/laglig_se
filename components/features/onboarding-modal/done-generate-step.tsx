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

import { useEffect, useState } from 'react'
import {
  Sparkles,
  ArrowRight,
  AlertTriangle,
  Target,
  UserRoundCog,
  BellRing,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { LawListPreview } from './law-list-preview'

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
   * "Fortsätt utforska" callback — Story 25.6 (B.6) enabled this so clicking
   * transitions the modal to `tutorial-only` mode. Parent fires
   * `done_cta_clicked.cta='keep_exploring'` telemetry.
   */
  onKeepExploring: () => void
  /** Primary CTA in failed mode — re-fires the generation API. */
  onRetry?: () => void
  /** Secondary CTA in failed mode — closes the modal. */
  onCloseFailure?: () => void
  /**
   * Story 25.6 v1.1: fired once on mount in `mode='success'` so the parent
   * can persist a per-workspace "user has seen the celebration" flag (drives
   * the FAB celebrate-variant demotion on subsequent dashboard visits).
   * NOT fired in `mode='failed'` — the failure card isn't a celebration.
   */
  onShown?: () => void
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
  onKeepExploring,
  onRetry,
  onCloseFailure,
  onShown,
}: DoneGenerateStepProps) {
  // Story 25.6 v1.1: fire onShown once when this surface is actually rendered
  // in success mode — drives the per-workspace localStorage flag in
  // <HemPage> that demotes the FAB celebrate variant. Guard against firing
  // in failed mode (failure isn't a celebration; a future retry should still
  // get the celebrate FAB). Deps include `mode` so a rare in-place failed→
  // success flip (no remount) still fires once.
  useEffect(() => {
    if (mode === 'success') {
      onShown?.()
    }
  }, [mode, onShown])
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
    <div className="grid grid-cols-5 gap-10 overflow-y-auto px-1 py-2">
      {/* ====================================================
          LEFT col-span-2 — explainer, benefits, hedging, CTAs.
          ==================================================== */}
      <div className="col-span-2 flex flex-col">
        <span className="mb-3 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
          Översikt
        </span>

        {/* Sage success ring + hero number + unit — anchors the celebration. */}
        <div className="mb-3 flex items-center gap-3">
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-section-sage"
            aria-hidden="true"
          >
            <Sparkles className="h-6 w-6 text-foreground/80" />
          </div>
          <p>
            <span className="font-safiro text-[40px] font-medium leading-none text-foreground">
              {itemCount ?? '—'}
            </span>
            <span className="ml-2 text-[15px] text-muted-foreground">
              regelverk
            </span>
          </p>
        </div>

        {durationMs !== null && durationMs >= 0 && (
          <p className="mb-4 text-[12px] text-muted-foreground/70">
            identifierade på {formatDuration(durationMs)}
          </p>
        )}

        <p className="mb-5 text-[14px] leading-relaxed text-muted-foreground">
          Vi har gått igenom Sveriges och EU:s lagstiftning och plockat ut
          regelverk som bedöms vara relevanta för er verksamhet utifrån
          företagsprofilen ni lämnade.
        </p>

        {/* Benefits — sage icon containers (mirrors tab-laglista.tsx).
            Three benefit-focused items (vs the previous process-focused
            "Detta gjorde vi / händer nu" pair): Skräddarsytt urval,
            Ansvar/bevis per regelverk, AI bevakar lagändringar. */}
        <ul className="mb-6 space-y-3">
          <li className="flex gap-3 text-[13.5px]">
            <span
              className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-section-sage"
              aria-hidden="true"
            >
              <Target
                className="h-3 w-3"
                style={{ color: 'hsl(var(--tone-success-soft-fg))' }}
              />
            </span>
            <span>
              <span className="font-medium">Skräddarsytt urval</span>
              <span className="block text-muted-foreground">
                Filtrerat på bransch, antal anställda och verksamhetsflaggor —
                bara det som faktiskt rör er.
              </span>
            </span>
          </li>
          <li className="flex gap-3 text-[13.5px]">
            <span
              className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-section-sage"
              aria-hidden="true"
            >
              <UserRoundCog
                className="h-3 w-3"
                style={{ color: 'hsl(var(--tone-success-soft-fg))' }}
              />
            </span>
            <span>
              <span className="font-medium">
                Ansvar och bevis per regelverk
              </span>
              <span className="block text-muted-foreground">
                Tilldela ansvariga, lägg till bevis och dokumentera ert
                systematiska arbete.
              </span>
            </span>
          </li>
          <li className="flex gap-3 text-[13.5px]">
            <span
              className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-section-sage"
              aria-hidden="true"
            >
              <BellRing
                className="h-3 w-3"
                style={{ color: 'hsl(var(--tone-success-soft-fg))' }}
              />
            </span>
            <span>
              <span className="font-medium">AI bevakar lagändringar</span>
              <span className="block text-muted-foreground">
                Ni notifieras när något ändras och kan göra en bedömning av
                påverkan på er verksamhet.
              </span>
            </span>
          </li>
        </ul>

        {/* Hedging note — small framing-line as an invitation rather than
            a bare disclaimer. */}
        <p className="mb-5 text-[12px] text-muted-foreground">
          Bedöms vara relevanta utifrån er företagsprofil — granska och justera
          fritt.
        </p>

        {/* CTAs anchored to bottom of LEFT col via mt-auto */}
        <div className="mt-auto flex items-center gap-3">
          <Button
            onClick={onShowList}
            className="gap-1.5"
            data-onboarding-focus-target="true"
          >
            <span>Visa min laglista</span>
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Button>
          {/* Story 25.6 (B.6): "Fortsätt utforska" enabled — parent transitions
              the modal to tutorial-only mode + fires keep_exploring telemetry. */}
          <Button variant="ghost" onClick={onKeepExploring}>
            Fortsätt utforska
          </Button>
        </div>
      </div>

      {/* ====================================================
          RIGHT col-span-3 — realistic preview of /laglistor
          with the user's just-generated content. Self-fetches
          via SWR inside <LawListPreview>; parent props stay
          unchanged. Mirrors the laglistor-tab tutorial pattern.
          ==================================================== */}
      <div className="col-span-3 flex flex-col">
        <span className="mb-3 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
          Förhandsvisning · /laglistor
        </span>
        <LawListPreview />
      </div>
    </div>
  )
}
