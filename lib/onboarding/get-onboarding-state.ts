/**
 * Story 25.0 (Epic 25): First-run onboarding modal — server-side state derivation.
 * Story 25.6 (Epic 25, B.6): `fabVisible` + `fabState` derivation lit up.
 *
 * Pure read: given a workspace id, decides which onboarding surfaces the
 * dashboard should render (first-run modal, corner FAB, FAB visual state).
 * No writes, no telemetry, no side effects — safe to call on every dashboard
 * render.
 */

import { prisma } from '@/lib/prisma'

export type OnboardingState = {
  /** true → dashboard auto-opens the first-run modal at the path-choice step */
  firstRunOpen: boolean
  /** true → dashboard mounts <OnboardingFab> in the corner */
  fabVisible: boolean
  /** Drives the FAB visual: working pill / lightbulb / lightbulb */
  fabState: 'working' | 'done' | 'idle'
}

const FRESH_WINDOW_MS = 24 * 60 * 60 * 1000 // 24h cap — arch §6.4

const DEFAULT_STATE: OnboardingState = {
  firstRunOpen: false,
  fabVisible: false,
  fabState: 'idle',
}

/**
 * Derive the onboarding surface state for a workspace.
 *
 * `firstRunOpen` is true only when all three guards hold:
 *  1. workspace is fresh (created within the last 24h)
 *  2. the modal has never been dismissed (`first_run_dismissed_at` is null)
 *  3. no path has been chosen yet (`law_list_generation_status` is null —
 *     works because Story 25.0's migration drops the `@default("pending")`)
 *
 * `fabVisible` is true when the inverse holds (modal HAS been dismissed at
 * least once) AND the FAB itself hasn't been dismissed AND the user didn't
 * hit Hoppa över. The 24h FRESH cap deliberately does NOT apply — once the
 * user is in the loop, the FAB stays as long as they want it (arch §6.4 line 353).
 *
 * `fabState` mirrors `law_list_generation_status`: pending/in_progress →
 * 'working' (pill + spinner); completed → 'done' (lightbulb); else 'idle'
 * (same lightbulb, included for symmetry).
 *
 * Any workspace-not-found or DB error returns the safe default (all closed).
 */
export async function getOnboardingState(
  workspaceId: string
): Promise<OnboardingState> {
  try {
    const ws = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: {
        created_at: true,
        first_run_dismissed_at: true,
        tutorial_fab_dismissed_at: true,
        law_list_generation_status: true,
      },
    })

    if (!ws) return DEFAULT_STATE

    const isFresh = Date.now() - ws.created_at.getTime() <= FRESH_WINDOW_MS

    const firstRunOpen =
      isFresh &&
      ws.first_run_dismissed_at === null &&
      ws.law_list_generation_status === null

    const fabVisible =
      ws.first_run_dismissed_at !== null &&
      ws.tutorial_fab_dismissed_at === null &&
      ws.law_list_generation_status !== 'skipped'

    const fabState: OnboardingState['fabState'] =
      ws.law_list_generation_status === 'pending' ||
      ws.law_list_generation_status === 'in_progress'
        ? 'working'
        : ws.law_list_generation_status === 'completed'
          ? 'done'
          : 'idle'

    return { firstRunOpen, fabVisible, fabState }
  } catch {
    // Non-critical — a derivation failure must never break the dashboard render.
    return DEFAULT_STATE
  }
}
