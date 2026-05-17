'use client'

/**
 * Story 25.2 (Epic 25, B.2): Onboarding modal — progress strip.
 *
 * Compact "latest-step" pattern: shimmer bar (always animating while in
 * progress) + a single-line row with the most recent step's label and a
 * "N steg klara" counter.
 *
 * Why not the prototype's full chevron-separated trail (AC 9): the LLM skill
 * writes long Swedish step labels (e.g. "Söker branschspecifika regler") and
 * the trail wraps onto multiple lines after 3-4 steps, looking cluttered.
 * The single-line pattern mirrors the dashboard banner
 * (<LawListGenerationProgress>) and never wraps.
 *
 * Why no "Steg N av Y" denominator: the skill in
 * `lib/agent/skills/generate-law-list.ts` writes each step's status=done as
 * it completes — it never seeds the total expected steps upfront. So
 * `progress.length` always equals `doneCount`, making "Steg N av Y" always
 * read "Steg N av N" (misleading). Showing just "N steg klara" tells the
 * truth: how many steps the skill has reported as complete so far.
 * Fix-upstream: seed all expected steps upfront in the skill (Story 16.4
 * follow-up).
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

import { cn } from '@/lib/utils'

/**
 * Swedish "thinking" phrases that rotate beside the latest done step's label
 * when no step is currently 'active' — simulates the chat-agent thinking
 * pattern (ChatGPT/Claude's "Searching the web…", etc.) so the strip feels
 * alive between reported skill steps. Skill currently only writes
 * status='done' (no 'active' writes), so the ticker is what fills the
 * between-steps gaps where there'd otherwise be a static label for many seconds.
 */
const THINKING_PHRASES = [
  'Tänker',
  'Söker',
  'Analyserar',
  'Bedömer relevans',
  'Förbereder nästa steg',
] as const
const THINKING_INTERVAL_MS = 5000

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

  const doneCount = progress?.filter((s) => s.status === 'done').length ?? 0
  const activeStep = progress?.find((s) => s.status === 'active')
  // findLast: most recently reported done step (last in the array order).
  const latestDoneStep =
    progress && progress.length > 0
      ? [...progress].reverse().find((s) => s.status === 'done')
      : undefined

  // Thinking ticker fills the focal line ANY time there's no real active
  // step. The skill rarely writes status='active' (it only writes 'done'
  // post-step), so the ticker is the focal indicator most of the time.
  // Hooks MUST be called before any early-return — keeping them above the
  // status guard below.
  const showTicker = !activeStep
  const [tickerIdx, setTickerIdx] = useState(0)
  useEffect(() => {
    if (!showTicker) return
    const id = setInterval(() => {
      setTickerIdx((i) => (i + 1) % THINKING_PHRASES.length)
    }, THINKING_INTERVAL_MS)
    return () => clearInterval(id)
  }, [showTicker])

  // Per AC 13 — completed/failed/null all hide the strip. Done state is B.4.
  // Early return MUST come after all hooks (rules-of-hooks).
  if (status !== 'pending' && status !== 'in_progress') {
    return null
  }

  // Swedish singular/plural: "1 steg klart" / "N steg klara".
  const klaraText =
    doneCount === 0
      ? ''
      : doneCount === 1
        ? '1 steg klart'
        : `${doneCount} steg klara`

  return (
    <div
      aria-live="polite"
      className="rounded-xl border border-border bg-section-warm px-5 py-4"
    >
      <div className="shimmer-track h-1 w-full rounded-full" aria-hidden="true">
        <div className="fill" />
      </div>

      {/* FOCAL LINE — live agent activity. Three bouncing dots lead the
          phrase (either the active step's label or the rotating thinking
          phrase). Visual weight: high (foreground, font-medium). */}
      <div
        className="mt-3 flex items-center gap-2.5 text-[13px]"
        data-testid="strip-focal"
      >
        <span
          className="inline-flex shrink-0 items-end gap-[3px] text-foreground/85"
          aria-hidden="true"
        >
          <span className="thinking-dot" />
          <span className="thinking-dot" />
          <span className="thinking-dot" />
        </span>
        {activeStep ? (
          <span className="min-w-0 truncate font-medium text-foreground">
            {activeStep.label}
          </span>
        ) : (
          <span
            key={tickerIdx}
            className="thinking-shimmer-text min-w-0 truncate font-medium animate-in fade-in-50 duration-500"
            data-testid="thinking-ticker"
          >
            {THINKING_PHRASES[tickerIdx]}
          </span>
        )}
        <span
          className={cn(
            'ml-auto shrink-0 font-mono text-[11.5px] text-muted-foreground'
          )}
        >
          {klaraText}
          {typeof itemCount === 'number' && (
            <>
              {klaraText && ' · '}
              {itemCount} rader
            </>
          )}
        </span>
      </div>

      {/* CONTEXT LINE — most recent completed step. Visual weight: low
          (muted-foreground/65, smaller). Demoted to "what just happened",
          not the focal point. Omitted entirely when no done steps yet. */}
      {latestDoneStep && (
        <div
          className="mt-1.5 flex items-center gap-2 text-[11.5px] text-muted-foreground/70"
          data-testid="strip-context"
        >
          <Check className="h-3 w-3 shrink-0" aria-hidden="true" />
          <span className="min-w-0 truncate">{latestDoneStep.label}</span>
        </div>
      )}
    </div>
  )
}
