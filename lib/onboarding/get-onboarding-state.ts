/**
 * Story 25.0 (Epic 25): First-run onboarding modal — server-side state derivation.
 *
 * Pure read: given a workspace id, decides whether the dashboard should auto-open
 * the first-run path-choice modal. No writes, no telemetry, no side effects — safe
 * to call on every dashboard render.
 *
 * B.0 scope: only `firstRunOpen` is derived. `fabVisible` / `fabState` are
 * hardcoded to their idle defaults — the corner FAB and its full derivation
 * (arch §6.4) ship in Story B.6.
 */

import { prisma } from '@/lib/prisma'

export type OnboardingState = {
  /** true → dashboard auto-opens the first-run modal at the path-choice step */
  firstRunOpen: boolean
  /** false in B.0 — the corner FAB ships in Story B.6 */
  fabVisible: boolean
  /** 'idle' in B.0 — full working/done/idle derivation ships in Story B.6 */
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
 * Any workspace-not-found or DB error returns the safe default (modal closed).
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

    // fabVisible / fabState are deferred to Story B.6 — idle defaults for now.
    return {
      firstRunOpen,
      fabVisible: false,
      fabState: 'idle',
    }
  } catch {
    // Non-critical — a derivation failure must never break the dashboard render.
    return DEFAULT_STATE
  }
}
