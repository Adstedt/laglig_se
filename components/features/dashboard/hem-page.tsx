'use client'

/**
 * Story 14.11: HemPage client wrapper
 * Full-height container for the Hem chat interface.
 * Negates parent padding to achieve edge-to-edge layout.
 *
 * Story 14.10: Manages transition between home state and change assessment view.
 * Story 25.6 (B.6): mounts <OnboardingFab> + reads ?onboarding=tutorial deep-link.
 */

import { useState, useCallback, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import useSWR from 'swr'
import { HemChat } from '@/components/features/dashboard/hem-chat'
import { ChangeAssessmentView } from '@/components/features/dashboard/change-assessment-view'
import { LawListGenerationProgress } from '@/components/features/dashboard/law-list-generation-progress'
import { FirstRunModal } from '@/components/features/onboarding-modal/first-run-modal'
import { OnboardingFab } from '@/components/features/onboarding-modal/onboarding-fab'
import {
  hasSeenDoneGenerate,
  markDoneGenerateShown,
} from '@/lib/onboarding/done-generate-shown'
import type { DashboardCardData } from '@/components/features/dashboard/context-cards'
import type { UnacknowledgedChange } from '@/lib/changes/change-utils'
import type { OnboardingState } from '@/lib/onboarding/get-onboarding-state'
import type { PublishedTemplate } from '@/lib/db/queries/template-catalog'
import type { TutorialTabId } from '@/components/features/onboarding-modal/tutorial-step'

/**
 * Type-guard for `?tab=<tabId>` URL params. Invalid values fall back to the
 * default tab inside <TutorialStep>. AC 15.
 */
const VALID_TUTORIAL_TABS: readonly TutorialTabId[] = [
  'laglista',
  'kravpunkter',
  'uppgifter',
  'kontroller',
  'lagandringar',
  'ai-agent',
  'feedback',
]

function isValidTutorialTab(value: string | null): value is TutorialTabId {
  return (
    value !== null && (VALID_TUTORIAL_TABS as readonly string[]).includes(value)
  )
}

interface HemPageProps {
  dashboardData: DashboardCardData | null
  userName?: string | undefined
  /** Pre-fetched change for deep-link from email notifications */
  initialChange?: UnacknowledgedChange | null
  /** Story 8.23: Auto-open amendments picker from deep-link */
  initialView?: 'amendments' | undefined
  /** Story 16.4: Law list generation status */
  generationStatus?: string | null
  /** Story 25.0: server-derived first-run onboarding state */
  onboardingState: OnboardingState
  /** Story 25.6 v1.1: workspace id for the localStorage "seen done-generate"
   *  flag — drives the FAB celebrate-variant demotion. */
  workspaceId: string
  /** Story 25.0: FIRST_RUN_MODAL_V0 emergency-disable flag (read server-side) */
  firstRunModalEnabled: boolean
  /** Story 25.1: server-prefetched templates for the modal's inline picker */
  firstRunTemplates?: PublishedTemplate[] | undefined
}

export function HemPage({
  dashboardData,
  userName,
  initialChange,
  initialView,
  generationStatus,
  onboardingState,
  workspaceId,
  firstRunModalEnabled,
  firstRunTemplates,
}: HemPageProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [activeChange, setActiveChange] = useState<UnacknowledgedChange | null>(
    initialChange ?? null
  )

  // Story 25.6 (B.6): two B.6-driven modal mount paths beyond the existing
  // firstRunOpen auto-mount.
  //   1. FAB click → opens modal at `tutorial-only` mode (local state).
  //   2. URL `?onboarding=tutorial[&tab=<id>]` → opens modal at `tutorial-only`
  //      at the deep-linked tab; on close, strip the query param via
  //      router.replace so back-button doesn't re-open.
  const [fabOpen, setFabOpen] = useState(false)
  const deepLinkOpen = searchParams?.get('onboarding') === 'tutorial'
  const rawDeepLinkTab = searchParams?.get('tab') ?? null
  const deepLinkTab = isValidTutorialTab(rawDeepLinkTab) ? rawDeepLinkTab : null

  const handleDeepLinkClose = useCallback(() => {
    router.replace('/dashboard')
    // Force-refresh server state so the FAB visibility derivation re-runs.
    // Without this, the dashboard route's cached server-component output
    // can re-render with stale `onboardingState.fabVisible` and the FAB
    // disappears post-minimize (bug observed 2026-05-18).
    router.refresh()
  }, [router])

  const handleFabOpen = useCallback(() => setFabOpen(true), [])
  const handleFabClose = useCallback(() => setFabOpen(false), [])
  const handleFabDismissed = useCallback(() => {
    router.refresh()
  }, [router])

  // Story 25.6 polish (post-smoke 2026-05-18): smart open-target for re-entry.
  // Per arch §6.5, the FAB opens at `'tutorial'` when work is in flight (so
  // the <ProgressStrip> stays visible) and `'tutorial-only'` when done. We
  // extend the same smart-default to the Hjälp / URL-deep-link path because
  // users opening Help mid-generation expect to see progress, not a strip-less
  // tutorial view. This is a minor deviation from arch §6.5 row 3 (which said
  // "Always tutorial_only" for Hjälp) — see Story 25.6 v1.1 Change Log.
  const workInFlight =
    generationStatus === 'pending' || generationStatus === 'in_progress'

  // Story 25.6 v1.1: per-workspace "seen done-generate" flag drives the FAB
  // celebrate-variant + the done-generate auto-open. Default true to avoid
  // hydration mismatch flash (server render assumes seen; client useEffect
  // flips to actual value). Pattern mirrors
  // components/features/billing/trial-countdown-banner.tsx:37-49.
  const [hasSeenCelebrate, setHasSeenCelebrate] = useState(true)
  useEffect(() => {
    setHasSeenCelebrate(hasSeenDoneGenerate(workspaceId))
  }, [workspaceId])

  const showCelebrate = onboardingState.fabState === 'done' && !hasSeenCelebrate

  const handleDoneGenerateShown = useCallback(() => {
    markDoneGenerateShown(workspaceId)
    setHasSeenCelebrate(true)
  }, [workspaceId])

  const reEntryInitialStep: 'tutorial' | 'tutorial-only' | 'done-generate' =
    workInFlight
      ? 'tutorial'
      : showCelebrate
        ? 'done-generate'
        : 'tutorial-only'

  // Story 25.6 v1.1: when generation finishes in the background while the
  // user is on /dashboard (modal minimised), the FAB visibility +
  // celebrate-derivation are server-derived and stale until next navigation.
  // Subscribe to the existing /api/workspace/generation-status SWR key
  // (cache-shared with the modal's TutorialStep + FirstRunModal — dedupe is
  // free) and fire router.refresh() once when status flips to completed or
  // failed so the FAB visual updates without needing a manual reload.
  //
  // Polls only while we have a FAB to update AND work is actually in flight.
  // Passing `null` as the SWR key disables the request entirely when not
  // polling.
  const shouldPollForCompletion = onboardingState.fabVisible && workInFlight
  const { data: polledStatus } = useSWR<{ status: string }>(
    shouldPollForCompletion ? '/api/workspace/generation-status' : null,
    (url: string) =>
      fetch(url).then((res) => res.json() as Promise<{ status: string }>),
    { refreshInterval: shouldPollForCompletion ? 3000 : 0 }
  )
  const completedDetectedRef = useRef(false)
  useEffect(() => {
    const next = polledStatus?.status
    if (
      !completedDetectedRef.current &&
      (next === 'completed' || next === 'failed')
    ) {
      completedDetectedRef.current = true
      router.refresh()
    }
  }, [polledStatus?.status, router])

  // Clean the URL after consuming the deep-link param
  useEffect(() => {
    if (initialChange || initialView) {
      window.history.replaceState({}, '', '/dashboard')
    }
  }, [initialChange, initialView])

  // Story 8.23: Clear assessment view when navigating back via ?view=amendments
  // (e.g., clicking a notification while inside an assessment)
  useEffect(() => {
    if (initialView === 'amendments') {
      setActiveChange(null)
    }
  }, [initialView])

  const handleSelectChange = useCallback((change: UnacknowledgedChange) => {
    setActiveChange(change)
  }, [])

  const handleBack = useCallback(() => {
    setActiveChange(null)
    router.refresh()
  }, [router])

  const showGenerationProgress =
    // Story 25.6 (B.6): when the FAB is visible, it carries the working state
    // already ("Genererar laglista..." pill) — banner would be redundant.
    !onboardingState.fabVisible &&
    (generationStatus === 'pending' ||
      generationStatus === 'in_progress' ||
      generationStatus === 'completed' ||
      generationStatus === 'failed')

  return (
    <div className="-m-4 md:-m-6 flex flex-col h-[calc(100vh-60px)]">
      {/* Story 25.0: first-run path-choice modal — gated by the server-derived
          onboarding state AND the FIRST_RUN_MODAL_V0 emergency-disable flag. */}
      {firstRunModalEnabled && onboardingState.firstRunOpen && (
        <FirstRunModal
          open={true}
          templates={firstRunTemplates}
          userFirstName={userName}
          initialStatus={
            generationStatus === 'pending' ||
            generationStatus === 'in_progress' ||
            generationStatus === 'completed' ||
            generationStatus === 'failed'
              ? generationStatus
              : null
          }
        />
      )}

      {/* Story 25.6 (B.6) — FAB-driven re-entry. Smart open-target per
          arch §6.5: `'tutorial'` when work is in flight (ProgressStrip
          visible), `'done-generate'` on the first FAB-click after completion
          (Story 25.6 v1.1 celebrate), `'tutorial-only'` thereafter. */}
      {firstRunModalEnabled && !onboardingState.firstRunOpen && fabOpen && (
        <FirstRunModal
          open={true}
          userFirstName={userName}
          initialStep={reEntryInitialStep}
          initialStatus={
            generationStatus === 'pending' ||
            generationStatus === 'in_progress' ||
            generationStatus === 'completed' ||
            generationStatus === 'failed'
              ? generationStatus
              : null
          }
          openTrigger="fab"
          onClose={handleFabClose}
          onDoneGenerateShown={handleDoneGenerateShown}
        />
      )}

      {/* Story 25.6 (B.6) — URL deep-link re-entry (`?onboarding=tutorial`).
          Same smart open-target as the FAB — opening Help mid-generation
          should show progress, not a strip-less tutorial view. On close,
          strips the query param via router.replace + router.refresh so the
          FAB visibility derivation re-runs cleanly. */}
      {firstRunModalEnabled &&
        !onboardingState.firstRunOpen &&
        !fabOpen &&
        deepLinkOpen && (
          <FirstRunModal
            open={true}
            userFirstName={userName}
            initialStep={reEntryInitialStep}
            initialStatus={
              generationStatus === 'pending' ||
              generationStatus === 'in_progress' ||
              generationStatus === 'completed' ||
              generationStatus === 'failed'
                ? generationStatus
                : null
            }
            {...(deepLinkTab && { initialTutorialTab: deepLinkTab })}
            openTrigger="help_menu"
            onClose={handleDeepLinkClose}
            onDoneGenerateShown={handleDoneGenerateShown}
          />
        )}

      {/* Story 25.6 (B.6) — corner FAB. Server-derived visibility +
          state. Story 25.6 v1.1: when status='completed' AND user hasn't
          yet seen done-generate, render the Sparkles celebrate variant. */}
      {firstRunModalEnabled && onboardingState.fabVisible && (
        <OnboardingFab
          fabState={onboardingState.fabState}
          celebrate={showCelebrate}
          onOpen={handleFabOpen}
          onDismissed={handleFabDismissed}
        />
      )}
      {showGenerationProgress && (
        <div className="px-4 md:px-6 pt-4 md:pt-6">
          <LawListGenerationProgress initialStatus={generationStatus ?? null} />
        </div>
      )}
      {activeChange ? (
        <ChangeAssessmentView change={activeChange} onBack={handleBack} />
      ) : (
        <HemChat
          mode="full"
          dashboardData={dashboardData}
          userName={userName}
          onSelectChange={handleSelectChange}
          initialView={initialView}
        />
      )}
    </div>
  )
}
