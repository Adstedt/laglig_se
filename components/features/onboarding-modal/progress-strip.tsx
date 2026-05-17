'use client'

/**
 * Story 25.2 (Epic 25, B.2): Onboarding modal — progress strip.
 *
 * Two-row layout: determinate %-filled bar with the percent + rader counter
 * inline on the right, and a context line below showing the most recent done
 * step's label (when one exists).
 *
 * Post-25.4 polish (2026-05-17): dropped the "Tänker / Söker / Analyserar"
 * thinking-phrase ticker + bouncing-dots focal row. Once the asymptotic %
 * bar landed in 25.3 v0.5, the "we're working" signal was already conveyed
 * by the steadily-creeping bar — the ticker became redundant decorative
 * noise. The context line (latest done step) keeps the "what just happened"
 * thread intact.
 *
 * Data wiring: SWR-shares the `/api/workspace/generation-status` cache with
 * `<LawListGenerationProgress>` — same key, same fetcher shape, same poll
 * interval — so the dashboard banner's first render after Minimera is
 * instant (the cache is already warm).
 *
 * No retry-on-pending logic here: the banner already covers that, and a
 * double-fire from two surfaces would be wasteful.
 */

import useSWR from 'swr'
import { useEffect, useState } from 'react'
import { Check } from 'lucide-react'

// Story 25.3 polish: asymptotic % progress.
// EXPECTED_DURATION_MS = ~5 min average for a cold-start generation (kept as
// documented intent; the curve shape is actually controlled by TAU_MS).
// TAU_MS = time-constant of `1 - e^(-elapsed/tau)`; ~3 min gives a curve
// that feels organic: rises fast in the first minute, slows toward 99%.
// Cap at 99 — never claim 100% until real completion (status flips to
// 'completed', at which point the strip unmounts entirely per AC 13).
const EXPECTED_DURATION_MS = 300_000
const TAU_MS = 180_000
const POLL_PCT_MS = 2_000

export function computePercent(startedAt: string | null | undefined): number {
  if (!startedAt) return 0
  const elapsed = Date.now() - new Date(startedAt).getTime()
  if (elapsed <= 0) return 0
  const ratio = 1 - Math.exp(-elapsed / TAU_MS)
  return Math.min(99, Math.round(ratio * 100))
}

// Suppress "unused" warning for the documented constant.
void EXPECTED_DURATION_MS

export type GenerationStatus =
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'failed'

interface ProgressStep {
  label: string
  status: 'done' | 'active' | 'pending'
}

interface GenerationStatusResponse {
  status: GenerationStatus
  progress: ProgressStep[] | null
  itemCount?: number
  error: string | null
  // Story 25.3 polish: ISO string set server-side when the atomic claim
  // in generate-law-list/route.ts succeeds. Drives the asymptotic % bar.
  startedAt?: string | null
}

const fetcher = (url: string) =>
  fetch(url).then((res) => res.json() as Promise<GenerationStatusResponse>)

interface ProgressStripProps {
  initialStatus?: GenerationStatus | null | undefined
}

export function ProgressStrip({ initialStatus }: ProgressStripProps) {
  const { data } = useSWR<GenerationStatusResponse>(
    '/api/workspace/generation-status',
    fetcher,
    {
      refreshInterval: (latestData) => {
        const s = latestData?.status ?? initialStatus
        return s === 'pending' || s === 'in_progress' ? 3000 : 0
      },
      revalidateOnFocus: false,
    }
  )

  const status = data?.status ?? initialStatus ?? null
  const progress = data?.progress ?? null
  const itemCount = data?.itemCount

  // findLast: most recently reported done step (last in the array order).
  const latestDoneStep =
    progress && progress.length > 0
      ? [...progress].reverse().find((s) => s.status === 'done')
      : undefined

  // Story 25.3 polish: asymptotic % progress. Re-compute every 2s while
  // mounted so the filled bar visibly creeps even without new SWR data
  // (the only data needed is `startedAt`, which doesn't change after the
  // initial in_progress observation).
  const startedAt = data?.startedAt
  const [percent, setPercent] = useState(() => computePercent(startedAt))
  useEffect(() => {
    setPercent(computePercent(startedAt))
    const id = setInterval(() => {
      setPercent(computePercent(startedAt))
    }, POLL_PCT_MS)
    return () => clearInterval(id)
  }, [startedAt])

  // Per AC 13 — completed/failed/null all hide the strip. Done state is B.4.
  // Early return MUST come after all hooks (rules-of-hooks).
  if (status !== 'pending' && status !== 'in_progress') {
    return null
  }

  return (
    <div
      aria-live="polite"
      className="rounded-xl border border-border bg-section-warm px-5 py-3"
    >
      {/* Bar + % counter on the same row. The bar conveys the live
          "we're working" signal that the dropped ticker used to carry; the
          % counter is the precise read of the same data. Two decisive
          signals: % (time-based, smooth) + rader (concrete output count). */}
      <div className="flex items-center gap-3">
        <div
          className="h-1 flex-1 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          aria-label="Lagliste-generering"
        >
          <div
            className="h-full rounded-full bg-foreground/85 transition-[width] duration-500 ease-out"
            style={{ width: `${percent}%` }}
          />
        </div>
        <span className="shrink-0 text-[11.5px] tabular-nums text-muted-foreground">
          {percent}%{typeof itemCount === 'number' && ` · ${itemCount} rader`}
        </span>
      </div>

      {/* CONTEXT LINE — most recent completed step. The "what just happened"
          thread. Omitted entirely when no done steps yet — the bar alone is
          fine for the first few seconds. */}
      {latestDoneStep && (
        <div
          className="mt-2 flex items-center gap-2 text-[12.5px] text-muted-foreground/80"
          data-testid="strip-context"
        >
          <Check className="h-3 w-3 shrink-0" aria-hidden="true" />
          <span className="min-w-0 truncate">{latestDoneStep.label}</span>
        </div>
      )}
    </div>
  )
}
